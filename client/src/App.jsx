import { useState } from 'react'
import { useAuth } from './contexts/AuthContext'
import VideoInput from './components/VideoInput'
import ProcessingStatus from './components/ProcessingStatus'
import ResultVideo from './components/ResultVideo'
import AuthModal from './components/AuthModal'
import './App.css'

function App() {
  const { currentUser, logout } = useAuth()
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [resultVideoUrl, setResultVideoUrl] = useState(null)
  const [error, setError] = useState(null)
  const [showAuthModal, setShowAuthModal] = useState(false)

  const handleProcess = async (type, data) => {
    setProcessing(true)
    setProgress(0)
    setStatus('Starting...')
    setError(null)
    setResultVideoUrl(null)

    try {
      const formData = new FormData()
      
      if (type === 'file') {
        formData.append('video', data)
      } else if (type === 'youtube') {
        formData.append('youtubeUrl', data)
      }

      const apiUrl = import.meta.env.VITE_API_URL || ''
      const response = await fetch(`${apiUrl}/api/process`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        let errorMessage = 'Processing failed'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
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

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(line => line.trim())

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.progress !== undefined) {
                setProgress(data.progress)
              }
              if (data.status) {
                setStatus(data.status)
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
          {currentUser && (
            <button onClick={logout} className="logout-button">
              Sign Out
            </button>
          )}
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
    </div>
  )
}

export default App

