import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { useSubscription } from './contexts/SubscriptionContext'
import Navbar from './components/Navbar'
import VideoInput from './components/VideoInput'
import ProcessingStatus from './components/ProcessingStatus'
import ResultVideo from './components/ResultVideo'
import AuthModal from './components/AuthModal'
import PlanPage from './components/PlanPage'
import ContactPage from './components/ContactPage'
import ManageSubscriptionPage from './components/ManageSubscriptionPage'
import './App.css'

function HomePage() {
  const { currentUser } = useAuth()
  const { tokensRemaining, subscriptionTier } = useSubscription()
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [resultVideoUrl, setResultVideoUrl] = useState(null)
  const [error, setError] = useState(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const navigate = useNavigate()

  const handleProcess = async (type, data) => {
    // Check authentication first
    if (!currentUser) {
      setShowAuthModal(true)
      return
    }

    // Check if user has tokens (we'll verify on server too, but this prevents unnecessary processing)
    if (tokensRemaining <= 0 && subscriptionTier === 'FREE') {
      setShowPaymentModal(true)
      return
    }

    setProcessing(true)
    setProgress(0)
    setStatus('Starting...')
    setError(null)
    setResultVideoUrl(null)

    try {
      // Get ID token for authentication
      const idToken = await currentUser.getIdToken()
      
      const formData = new FormData()
      
      if (type === 'file') {
        formData.append('video', data)
      } else if (type === 'youtube') {
        formData.append('youtubeUrl', data)
      }
      
      // Send current token count so server can use accurate value
      formData.append('currentTokens', tokensRemaining.toString())

      const apiUrl = import.meta.env.VITE_API_URL || ''
      const response = await fetch(`${apiUrl}/api/process`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`
        },
        body: formData,
      })

      if (!response.ok) {
        let errorMessage = 'Processing failed'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
          
          // If it's a token error, show payment modal
          if (errorData.code === 'INSUFFICIENT_TOKENS' || errorMessage.includes('token')) {
            setShowPaymentModal(true)
            setProcessing(false)
            return
          }
        } catch (e) {
          // If response is not JSON, try to get text
          try {
            const text = await response.text()
            errorMessage = text || errorMessage
          } catch (e2) {
            errorMessage = `Server error: ${response.status} ${response.statusText}`
          }
        }
        throw new Error(errorMessage)
      }

      // Check if response is a stream (Server-Sent Events)
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('text/event-stream')) {
        // Not a stream, try to parse as JSON
        try {
          const data = await response.json()
          if (data.error) {
            throw new Error(data.error)
          }
          if (data.videoUrl) {
            setResultVideoUrl(data.videoUrl)
            setProcessing(false)
            setProgress(100)
            return
          }
        } catch (e) {
          throw new Error('Unexpected response format from server')
        }
      }

      // Handle streaming response for progress updates
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let shouldStop = false

      while (true) {
        const { done, value } = await reader.read()
        if (done || shouldStop) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(line => line.trim())

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              // Handle errors first
              if (data.error) {
                setError(data.error)
                setProcessing(false)
                setStatus('')
                shouldStop = true
                break
              }
              
              if (data.progress !== undefined) {
                setProgress(data.progress)
              }
              if (data.status) {
                setStatus(data.status)
              }
              // Handle token deduction
              if (data.tokensDeducted !== undefined && data.newTokensRemaining !== undefined) {
                console.log(`Tokens deducted: ${data.tokensDeducted}, New balance: ${data.newTokensRemaining}`)
                // Update Firestore with new token count and increment video count
                if (currentUser) {
                  import('firebase/firestore').then(({ doc, getDoc, setDoc, increment }) => {
                    import('./firebase/config').then(({ db }) => {
                      const userRef = doc(db, 'users', currentUser.uid)
                      // Get current video count and increment it
                      getDoc(userRef).then((userDoc) => {
                        const currentVideos = userDoc.exists() ? (userDoc.data().videosProcessed || 0) : 0
                        setDoc(userRef, {
                          tokensRemaining: data.newTokensRemaining,
                          videosProcessed: currentVideos + 1
                        }, { merge: true }).catch(err => {
                          console.error('Error updating Firestore:', err)
                        })
                      }).catch(err => {
                        console.error('Error reading user document:', err)
                        // Fallback: just update tokens
                        setDoc(userRef, {
                          tokensRemaining: data.newTokensRemaining
                        }, { merge: true }).catch(updateErr => {
                          console.error('Error updating tokens in Firestore:', updateErr)
                        })
                      })
                    })
                  })
                }
              }
              if (data.videoUrl) {
                // Store both videoUrl and downloadUrl if available
                setResultVideoUrl({
                  videoUrl: data.videoUrl,
                  downloadUrl: data.downloadUrl || data.videoUrl.replace('/output/', '/api/video/')
                })
                setProcessing(false)
                setProgress(100)
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (err) {
      console.error('Processing error:', err)
      setError(err.message || 'An error occurred. Make sure the server is running.')
      setProcessing(false)
    }
  }

  const handleReset = () => {
    setProcessing(false)
    setProgress(0)
    setStatus('')
    setResultVideoUrl(null)
    setError(null)
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div>
            <h1>Video Censor</h1>
            <p>Clean your videos with automatic bleep sound effects</p>
          </div>
        </div>
      </header>

      <main className="app-main">
        {!processing && !resultVideoUrl && (
          <VideoInput 
            onProcess={handleProcess} 
            isAuthenticated={!!currentUser}
            onAuthRequired={() => setShowAuthModal(true)}
          />
        )}

        {processing && (
          <ProcessingStatus progress={progress} status={status} />
        )}

        {error && (
          <div className="error-message">
            <p>Error: {error}</p>
            <button onClick={handleReset} className="reset-button">
              Try Again
            </button>
          </div>
        )}

        {resultVideoUrl && (
          <ResultVideo videoUrl={resultVideoUrl} onReset={handleReset} />
        )}
      </main>

      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
      />
      
      {showPaymentModal && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Insufficient Tokens</h2>
            <p>You don't have enough tokens to process this video. Please upgrade your plan to continue.</p>
            <div className="modal-actions">
              <button 
                className="modal-button primary"
                onClick={() => {
                  setShowPaymentModal(false)
                  navigate('/plan')
                }}
              >
                View Plans
              </button>
              <button 
                className="modal-button secondary"
                onClick={() => setShowPaymentModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/plan" element={<PlanPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/manage-subscription" element={<ManageSubscriptionPage />} />
      </Routes>
    </Router>
  )
}

export default App

