import { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { db } from '../firebase/config'
import { doc, getDoc, onSnapshot } from 'firebase/firestore'

const SubscriptionContext = createContext(null)

export function useSubscription() {
  const context = useContext(SubscriptionContext)
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider')
  }
  return context
}

export function SubscriptionProvider({ children }) {
  const { currentUser } = useAuth()
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentUser) {
      setSubscription(null)
      setLoading(false)
      return
    }

    let isMounted = true
    const userRef = doc(db, 'users', currentUser.uid)
    
    // Set up real-time listener
    const unsubscribe = onSnapshot(
      userRef,
      async (docSnap) => {
        if (!isMounted) return
        
        if (docSnap.exists()) {
          setSubscription(docSnap.data())
        } else {
          // Create default subscription for new user
          const now = new Date()
          const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1)
          
          const defaultSubscription = {
            subscriptionTier: 'FREE',
            tokensRemaining: 10,
            tokensTotal: 10,
            lastResetDate: now.toISOString(),
            nextResetDate: nextReset.toISOString(),
            stripeCustomerId: null,
            stripeSubscriptionId: null,
            createdAt: now.toISOString()
          }
          
          // Create user document in Firestore
          try {
            const { setDoc } = await import('firebase/firestore')
            await setDoc(userRef, defaultSubscription)
            if (isMounted) {
              setSubscription(defaultSubscription)
            }
          } catch (error) {
            console.error('Error creating user document:', error)
            // Set subscription anyway for UI
            if (isMounted) {
              setSubscription(defaultSubscription)
            }
          }
        }
        if (isMounted) {
          setLoading(false)
        }
      },
      (error) => {
        console.error('Error fetching subscription:', error)
        if (isMounted) {
          setLoading(false)
        }
      }
    )

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [currentUser])

  const value = {
    subscription,
    loading,
    tokensRemaining: subscription?.tokensRemaining || 0,
    subscriptionTier: subscription?.subscriptionTier || 'FREE'
  }

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  )
}

