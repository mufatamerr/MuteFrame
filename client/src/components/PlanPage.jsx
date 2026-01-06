import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSubscription } from '../contexts/SubscriptionContext'
import { loadStripe } from '@stripe/stripe-js'
import { useSearchParams } from 'react-router-dom'
import './PlanPage.css'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_51SmKy2RwrCSU1MT9rqAUl5OTs4mP7rgIB1hX2r1whDfogLBLToE0RGf7XIpESHQR4o2YHYZDNY0DmzLFK2eZM3Hx007wKJ9hci')

// Debug: Log environment variables
console.log('Environment variables:', {
  VITE_STRIPE_PRICE_ID_TIER1: import.meta.env.VITE_STRIPE_PRICE_ID_TIER1,
  VITE_PRICE_ID_TIER1: import.meta.env.VITE_PRICE_ID_TIER1,
  VITE_STRIPE_PRICE_ID_TIER2: import.meta.env.VITE_STRIPE_PRICE_ID_TIER2,
  VITE_PRICE_ID_TIER2: import.meta.env.VITE_PRICE_ID_TIER2,
  VITE_STRIPE_PRICE_ID_KING: import.meta.env.VITE_STRIPE_PRICE_ID_KING,
  VITE_PRICE_ID_KING: import.meta.env.VITE_PRICE_ID_KING,
})

const SUBSCRIPTION_TIERS = {
  FREE: {
    name: 'Free',
    price: 0,
    tokens: 10,
    features: ['10 tokens per month', '1 token = 1 minute of video', 'Basic processing']
  },
  TIER1: {
    name: 'Tier 1',
    price: 4.99,
    tokens: 100,
    priceId: import.meta.env.VITE_STRIPE_PRICE_ID_TIER1 || import.meta.env.VITE_PRICE_ID_TIER1 || 'price_tier1',
    features: ['100 tokens per month', '1 token = 1 minute of video', 'Priority processing']
  },
  TIER2: {
    name: 'Tier 2',
    price: 14.99,
    tokens: 500,
    priceId: import.meta.env.VITE_STRIPE_PRICE_ID_TIER2 || import.meta.env.VITE_PRICE_ID_TIER2 || 'price_tier2',
    features: ['500 tokens per month', '1 token = 1 minute of video', 'Priority processing', 'Faster speeds']
  },
  KING: {
    name: 'King',
    price: 49.99,
    tokens: 5000,
    priceId: import.meta.env.VITE_STRIPE_PRICE_ID_KING || import.meta.env.VITE_PRICE_ID_KING || 'price_king',
    features: ['5,000 tokens per month', '1 token = 1 minute of video', 'Highest priority', 'Fastest processing', 'Premium support']
  }
}

function PlanPage() {
  const { currentUser } = useAuth()
  const { subscription, subscriptionTier } = useSubscription()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()
  
  // Check for successful payment and sync subscription (only once)
  useEffect(() => {
    const syncSubscription = async () => {
      const successParam = searchParams.get('success')
      if (successParam === 'true' && currentUser) {
        // Remove success parameter immediately to prevent re-triggering
        setSearchParams({}, { replace: true })
        
        console.log('🔄 Syncing subscription after successful payment...')
        setLoading(true)
        setError(null)
        
        try {
          const idToken = await currentUser.getIdToken()
          const apiUrl = import.meta.env.VITE_API_URL || ''
          const response = await fetch(`${apiUrl}/api/sync-subscription`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
              email: currentUser.email
            })
          })
          
          if (response.ok) {
            const data = await response.json()
            console.log('Sync response:', data)
            
            // Update Firestore directly from client
            const { doc, setDoc } = await import('firebase/firestore')
            const { db } = await import('../firebase/config')
            const userRef = doc(db, 'users', currentUser.uid)
            
            if (data.success && data.subscription) {
              const updateData = {
                ...data.subscription,
                createdAt: subscription?.createdAt || new Date().toISOString()
              }
              
              console.log('Updating Firestore with:', updateData)
              await setDoc(userRef, updateData, { merge: true })
              
              console.log('✅ Subscription updated successfully in Firestore')
              // Force page reload to refresh subscription data
              setTimeout(() => {
                console.log('Reloading page to show updated subscription...')
                window.location.reload()
              }, 1500)
            } else {
              console.warn('No subscription data in response:', data)
              setError('Subscription synced but no upgrade found. Please check your Stripe dashboard.')
              setLoading(false)
            }
          } else {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
            console.error('Sync failed:', errorData)
            setError(errorData.error || 'Failed to sync subscription')
            setLoading(false)
          }
        } catch (err) {
          console.error('Error syncing subscription:', err)
          setError('Failed to sync subscription. Please refresh the page manually.')
          setLoading(false)
        }
      }
    }
    
    syncSubscription()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount, not on every searchParams change

  const handleSubscribe = async (tierKey) => {
    if (!currentUser) {
      setError('Please sign in to subscribe')
      return
    }

    if (tierKey === 'FREE') {
      setError('You are already on the free tier')
      return
    }

    const tier = SUBSCRIPTION_TIERS[tierKey]
    if (!tier.priceId) {
      setError('Subscription tier not configured. Please contact support.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Get ID token for authentication
      const idToken = await currentUser.getIdToken()
      
      // Use relative URL to work with Vite proxy, or absolute if VITE_API_URL is set
      const apiUrl = import.meta.env.VITE_API_URL || ''
      const endpoint = apiUrl ? `${apiUrl}/api/create-checkout-session` : '/api/create-checkout-session'
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          priceId: tier.priceId,
          tier: tierKey,
          email: currentUser.email
        })
      })

      if (!response.ok) {
        let errorMessage = 'Failed to create checkout session'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch (e) {
          // If response isn't JSON, try to get text
          try {
            const text = await response.text()
            errorMessage = text || errorMessage
          } catch (e2) {
            errorMessage = `Server error: ${response.status} ${response.statusText}`
          }
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      const { sessionId } = data
      
      if (!sessionId) {
        throw new Error('No session ID received from server')
      }
      const stripe = await stripePromise
      
      // Redirect to Stripe Checkout
      const { error: stripeError } = await stripe.redirectToCheckout({
        sessionId
      })

      if (stripeError) {
        throw new Error(stripeError.message)
      }
    } catch (err) {
      console.error('Subscription error:', err)
      setError(err.message || 'Failed to start subscription process')
      setLoading(false)
    }
  }

  const getCurrentTier = () => {
    return SUBSCRIPTION_TIERS[subscriptionTier] || SUBSCRIPTION_TIERS.FREE
  }

  return (
    <div className="plan-page">
      <div className="plan-header">
        <h1>Choose Your Plan</h1>
        <p>Select a subscription tier that fits your needs</p>
      </div>

      {error && (
        <div className="plan-error">
          {error}
        </div>
      )}

      <div className="plans-grid">
        {Object.entries(SUBSCRIPTION_TIERS).map(([key, tier]) => {
          const isCurrentTier = subscriptionTier === key
          const isFree = key === 'FREE'
          
          return (
            <div 
              key={key} 
              className={`plan-card ${isCurrentTier ? 'current' : ''} ${isFree ? 'free' : ''}`}
            >
              {isCurrentTier && (
                <div className="current-badge">Current Plan</div>
              )}
              
              <div className="plan-header-card">
                <h2>{tier.name}</h2>
                <div className="plan-price">
                  {tier.price === 0 ? (
                    <span className="price-free">Free</span>
                  ) : (
                    <>
                      <span className="price-amount">${tier.price}</span>
                      <span className="price-period">/month</span>
                    </>
                  )}
                </div>
              </div>

              <div className="plan-tokens">
                <span className="tokens-amount">{tier.tokens.toLocaleString()}</span>
                <span className="tokens-label">tokens per month</span>
              </div>

              <ul className="plan-features">
                {tier.features.map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>

              <button
                className={`plan-button ${isCurrentTier ? 'current-button' : ''}`}
                onClick={() => handleSubscribe(key)}
                disabled={isCurrentTier || loading}
              >
                {isCurrentTier 
                  ? 'Current Plan' 
                  : isFree 
                    ? 'Free Forever' 
                    : loading 
                      ? 'Processing...' 
                      : 'Subscribe'}
              </button>
            </div>
          )
        })}
      </div>

      <div className="plan-info">
        <p><strong>How tokens work:</strong></p>
        <p>Each token equals 1 minute of video processing. Tokens are rounded down (e.g., a 1:30 video uses 1 token).</p>
        <p>Tokens reset monthly on the first day of each month.</p>
      </div>
    </div>
  )
}

export default PlanPage

