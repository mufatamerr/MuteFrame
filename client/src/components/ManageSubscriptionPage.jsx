import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSubscription } from '../contexts/SubscriptionContext'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import './ManageSubscriptionPage.css'

function ManageSubscriptionPage() {
  const { currentUser } = useAuth()
  const { subscription, subscriptionTier } = useSubscription()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    videosProcessed: 0,
    subscriptionStartDate: null,
    subscriptionDuration: ''
  })
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState(null)
  const [cancelSuccess, setCancelSuccess] = useState(false)

  useEffect(() => {
    const loadStats = async () => {
      if (!currentUser) return

      try {
        const userRef = doc(db, 'users', currentUser.uid)
        const userDoc = await userRef.get()
        
        if (userDoc.exists()) {
          const userData = userDoc.data()
          const videosProcessed = userData.videosProcessed || 0
          
          // Calculate subscription duration
          // Use createdAt if available, otherwise use current date as fallback
          let subscriptionStartDate = null
          let subscriptionDuration = 'N/A'
          
          // Try to get createdAt from userData, or use a fallback
          const startDate = userData.createdAt || userData.subscriptionStartDate || new Date().toISOString()
          
          try {
            subscriptionStartDate = new Date(startDate)
            const now = new Date()
            
            // Check if the date is valid
            if (!isNaN(subscriptionStartDate.getTime())) {
              const diffTime = Math.abs(now - subscriptionStartDate)
              const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
              
              if (diffDays === 0) {
                subscriptionDuration = 'Today'
              } else if (diffDays < 30) {
                subscriptionDuration = `${diffDays} day${diffDays !== 1 ? 's' : ''}`
              } else if (diffDays < 365) {
                const months = Math.floor(diffDays / 30)
                subscriptionDuration = `${months} month${months !== 1 ? 's' : ''}`
              } else {
                const years = Math.floor(diffDays / 365)
                const remainingMonths = Math.floor((diffDays % 365) / 30)
                subscriptionDuration = `${years} year${years !== 1 ? 's' : ''}`
                if (remainingMonths > 0) {
                  subscriptionDuration += `, ${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`
                }
              }
            } else {
              subscriptionDuration = 'N/A'
            }
          } catch (error) {
            console.error('Error calculating subscription duration:', error)
            subscriptionDuration = 'N/A'
          }
          
          setStats({
            videosProcessed,
            subscriptionStartDate,
            subscriptionDuration
          })
        }
      } catch (error) {
        console.error('Error loading stats:', error)
      } finally {
        setLoading(false)
      }
    }

    loadStats()
  }, [currentUser])

  const handleCancelSubscription = async () => {
    if (!currentUser) return

    setCancelling(true)
    setCancelError(null)

    try {
      const idToken = await currentUser.getIdToken()
      const apiUrl = import.meta.env.VITE_API_URL || ''
      const response = await fetch(`${apiUrl}/api/cancel-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        }
      })

      const data = await response.json()

      if (response.ok) {
        setCancelSuccess(true)
        setShowCancelConfirm(false)
        
        // Update Firestore locally to reflect cancellation
        try {
          const { doc, setDoc } = await import('firebase/firestore')
          const { db } = await import('../firebase/config')
          const userRef = doc(db, 'users', currentUser.uid)
          
          const now = new Date()
          const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1)
          
          await setDoc(userRef, {
            subscriptionTier: 'FREE',
            tokensRemaining: 10,
            tokensTotal: 10,
            stripeSubscriptionId: null,
            lastResetDate: now.toISOString(),
            nextResetDate: nextReset.toISOString()
          }, { merge: true })
          
          console.log('✅ Updated Firestore after cancellation')
        } catch (firestoreError) {
          console.warn('Could not update Firestore locally:', firestoreError)
          // Continue anyway - server already updated it
        }
        
        // Reload page after 2 seconds to show updated subscription
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      } else {
        setCancelError(data.error || 'Failed to cancel subscription')
      }
    } catch (error) {
      console.error('Error cancelling subscription:', error)
      setCancelError('An error occurred. Please try again.')
    } finally {
      setCancelling(false)
    }
  }

  if (!currentUser) {
    return (
      <div className="manage-subscription-page">
        <div className="manage-subscription-header">
          <h1>Manage Subscription</h1>
          <p>Please sign in to manage your subscription.</p>
        </div>
      </div>
    )
  }

  if (subscriptionTier === 'FREE') {
    return (
      <div className="manage-subscription-page">
        <div className="manage-subscription-header">
          <h1>Manage Subscription</h1>
          <p>You're currently on the free plan. Upgrade to a paid plan to access subscription management.</p>
        </div>
      </div>
    )
  }

  const tierNames = {
    'TIER1': 'Tier 1',
    'TIER2': 'Tier 2',
    'KING': 'King Tier'
  }

  return (
    <div className="manage-subscription-page">
      <div className="manage-subscription-header">
        <h1>Manage Subscription</h1>
        <p>View your subscription details and manage your account.</p>
      </div>

      {loading ? (
        <div className="loading-state">Loading...</div>
      ) : (
        <>
          <div className="subscription-stats">
            <div className="stat-card">
              <div className="stat-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21 16V8C20.9996 7.64928 20.9071 7.30481 20.7315 7.00116C20.556 6.69751 20.3037 6.44536 20 6.27L13 2.27C12.696 2.09446 12.3511 2.00205 12 2.00205C11.6489 2.00205 11.304 2.09446 11 2.27L4 6.27C3.69626 6.44536 3.44398 6.69751 3.26846 7.00116C3.09294 7.30481 3.00036 7.64928 3 8V16C3.00036 16.3507 3.09294 16.6952 3.26846 16.9988C3.44398 17.3025 3.69626 17.5546 4 17.73L11 21.73C11.304 21.9055 11.6489 21.9979 12 21.9979C12.3511 21.9979 12.696 21.9055 13 21.73L20 17.73C20.3037 17.5546 20.556 17.3025 20.7315 16.9988C20.9071 16.6952 20.9996 16.3507 21 16Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M3.27 6.96L12 12.01L20.73 6.96" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 22.08V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="stat-content">
                <h3>Current Plan</h3>
                <p className="stat-value">{tierNames[subscriptionTier] || subscriptionTier}</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15 10L4 19V4H11L15 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M18 8V20H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="stat-content">
                <h3>Videos Processed</h3>
                <p className="stat-value">{stats.videosProcessed}</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="stat-content">
                <h3>Member Since</h3>
                <p className="stat-value">{stats.subscriptionDuration}</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 7H4C2.89543 7 2 7.89543 2 9V19C2 20.1046 2.89543 21 4 21H20C21.1046 21 22 20.1046 22 19V9C22 7.89543 21.1046 7 20 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 21V13C16 12.4477 15.5523 12 15 12H9C8.44772 12 8 12.4477 8 13V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 10C2 8.89543 2.89543 8 4 8H20C21.1046 8 22 8.89543 22 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="stat-content">
                <h3>Tokens Remaining</h3>
                <p className="stat-value">{subscription?.tokensRemaining || 0}</p>
              </div>
            </div>
          </div>

          <div className="subscription-benefits">
            <h2>Your Subscription Benefits</h2>
            <ul>
              <li>✓ Unlimited video processing (within token limits)</li>
              <li>✓ High-quality audio bleeping</li>
              <li>✓ Priority processing</li>
              <li>✓ Regular token resets each month</li>
              <li>✓ Access to all premium features</li>
            </ul>
          </div>

          <div className="cancel-section">
            <h2>Cancel Subscription</h2>
            <p>If you cancel, you'll lose access to premium features and will be downgraded to the free plan at the end of your billing period.</p>
            <button 
              className="cancel-button"
              onClick={() => setShowCancelConfirm(true)}
              disabled={cancelling || cancelSuccess}
            >
              Cancel Subscription
            </button>
          </div>

          {showCancelConfirm && (
            <div className="modal-overlay" onClick={() => !cancelling && setShowCancelConfirm(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3>Cancel Subscription?</h3>
                <p>Are you sure you want to cancel your subscription? You'll be downgraded to the free plan and lose access to premium features.</p>
                {cancelError && (
                  <div className="error-message">{cancelError}</div>
                )}
                {cancelSuccess && (
                  <div className="success-message">Subscription cancelled successfully. You'll be redirected shortly...</div>
                )}
                <div className="modal-buttons">
                  <button
                    className="modal-button confirm"
                    onClick={handleCancelSubscription}
                    disabled={cancelling || cancelSuccess}
                  >
                    {cancelling ? 'Cancelling...' : 'Yes, Cancel Subscription'}
                  </button>
                  <button
                    className="modal-button cancel"
                    onClick={() => {
                      setShowCancelConfirm(false)
                      setCancelError(null)
                    }}
                    disabled={cancelling}
                  >
                    Keep Subscription
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default ManageSubscriptionPage

