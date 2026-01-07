
import Stripe from 'stripe'
import admin from 'firebase-admin'

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// Export stripe instance and db for use in server endpoints
export { stripe, db }

// Initialize Firebase Admin
let db = null
try {
  if (!admin.apps.length) {
    // Try to initialize with service account if available
    let serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    if (serviceAccount) {
      try {
        // Remove surrounding quotes if present (from .env file parsing)
        serviceAccount = serviceAccount.trim()
        if ((serviceAccount.startsWith('"') && serviceAccount.endsWith('"')) ||
            (serviceAccount.startsWith("'") && serviceAccount.endsWith("'"))) {
          serviceAccount = serviceAccount.slice(1, -1)
        }
        // dotenv converts \\n to actual newlines, but JSON.parse() needs \n escape sequences
        // Convert actual newlines back to \\n (which JSON.parse will interpret as \n)
        serviceAccount = serviceAccount.replace(/\n/g, '\\\\n').replace(/\r/g, '\\\\r')
        
        // Parse the JSON
        const serviceAccountObj = JSON.parse(serviceAccount)
        
        // Convert \n escape sequences in private_key to actual newlines (Firebase Admin needs real newlines)
        if (serviceAccountObj.private_key) {
          serviceAccountObj.private_key = serviceAccountObj.private_key.replace(/\\n/g, '\n')
        }
        
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccountObj)
        })
        db = admin.firestore()
        console.log('✅ Firebase Admin initialized with service account')
      } catch (e) {
        console.warn('⚠️  Could not initialize with service account:', e.message)
        console.warn('   Make sure FIREBASE_SERVICE_ACCOUNT is valid JSON with properly escaped newlines (\\n)')
        // Debug: show first 200 chars to help diagnose
        if (serviceAccount) {
          console.warn('   First 200 chars of service account:', serviceAccount.substring(0, 200))
        }
      }
    } else {
      // Don't initialize Firestore without credentials - it will fail
      console.warn('⚠️  FIREBASE_SERVICE_ACCOUNT not set. Firestore operations will be disabled.')
      console.warn('   Subscription data will be managed client-side via Firestore SDK.')
    }
  } else {
    // App already initialized, try to get Firestore
    try {
      db = admin.firestore()
    } catch (e) {
      console.warn('⚠️  Could not access Firestore:', e.message)
    }
  }
} catch (error) {
  console.warn('⚠️  Firebase Admin initialization warning:', error.message)
  console.warn('   Subscription features will use client-side Firestore')
}

// Subscription tiers configuration
export const SUBSCRIPTION_TIERS = {
  FREE: {
    name: 'Free',
    price: 0,
    tokens: 10,
    priceId: null
  },
  TIER1: {
    name: 'Tier 1',
    price: 4.99,
    tokens: 100,
    priceId: process.env.STRIPE_PRICE_ID_TIER1 || 'price_tier1'
  },
  TIER2: {
    name: 'Tier 2',
    price: 14.99,
    tokens: 500,
    priceId: process.env.STRIPE_PRICE_ID_TIER2 || 'price_tier2'
  },
  KING: {
    name: 'King',
    price: 49.99,
    tokens: 5000,
    priceId: process.env.STRIPE_PRICE_ID_KING || 'price_king'
  }
}

// Debug: Log price IDs
console.log('Stripe Price IDs:', {
  TIER1: SUBSCRIPTION_TIERS.TIER1.priceId,
  TIER2: SUBSCRIPTION_TIERS.TIER2.priceId,
  KING: SUBSCRIPTION_TIERS.KING.priceId,
  env_TIER1: process.env.STRIPE_PRICE_ID_TIER1,
  env_TIER2: process.env.STRIPE_PRICE_ID_TIER2,
  env_KING: process.env.STRIPE_PRICE_ID_KING
})

/**
 * Verify Firebase ID token and get user ID
 * Uses Firebase REST API if Admin SDK is not available
 */
export async function verifyIdToken(idToken) {
  try {
    // Try using Firebase Admin SDK if available
    if (admin.apps.length > 0) {
      try {
        const decodedToken = await admin.auth().verifyIdToken(idToken)
        return decodedToken.uid
      } catch (adminError) {
        console.warn('Admin SDK verification failed, trying REST API:', adminError.message)
        // Fall through to REST API
      }
    }
    
    // Fallback: Use Firebase REST API to verify token (if API key is available)
    // Otherwise, use basic JWT decoding
    if (!process.env.FIREBASE_WEB_API_KEY) {
      // No API key, use basic JWT decoding
      if (!global._firebaseWarningLogged) {
        console.warn('⚠️  FIREBASE_WEB_API_KEY not set. Using basic token decoding (not secure for production)')
        global._firebaseWarningLogged = true
      }
      try {
        // Basic JWT decode (just get the payload, no signature verification)
        const parts = idToken.split('.')
        if (parts.length !== 3) {
          throw new Error('Invalid token format')
        }
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
        
        // Check expiration
        if (payload.exp && payload.exp < Date.now() / 1000) {
          throw new Error('Token expired')
        }
        
        // Return user ID (Firebase uses 'user_id' or 'sub')
        const userId = payload.user_id || payload.sub
        if (!userId) {
          throw new Error('No user ID found in token')
        }
        
        return userId
      } catch (decodeError) {
        console.error('JWT decode error:', decodeError.message)
        throw new Error('Invalid authentication token')
      }
    }
    
    // Use Firebase REST API
    const projectId = process.env.FIREBASE_PROJECT_ID || 'yt-censor-988e9'
    const response = await fetch(
      `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getAccountInfo?key=${process.env.FIREBASE_WEB_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idToken: idToken
        })
      }
    )
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Firebase REST API error:', response.status, errorText)
      throw new Error('Token verification failed')
    }
    
    const data = await response.json()
    if (data.users && data.users.length > 0) {
      return data.users[0].localId
    }
    throw new Error('User not found in token')
  } catch (error) {
    console.error('Error verifying ID token:', error)
    throw new Error('Invalid authentication token')
  }
}

/**
 * Get or create user subscription document
 */
export async function getUserSubscription(userId) {
  try {
    if (!db) {
      // Return default subscription if Firestore isn't available
      // Client-side will handle creating the document
      const now = new Date()
      const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      return {
        subscriptionTier: 'FREE',
        tokensRemaining: 10,
        tokensTotal: 10,
        lastResetDate: now.toISOString(),
        nextResetDate: nextReset.toISOString(),
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        createdAt: now.toISOString()
      }
    }
    
    let userRef, userDoc
    try {
      userRef = db.collection('users').doc(userId)
      userDoc = await userRef.get()
    } catch (firestoreError) {
      console.warn('Firestore operation failed, using default subscription:', firestoreError.message)
      // Return default if Firestore fails
      const now = new Date()
      const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      return {
        subscriptionTier: 'FREE',
        tokensRemaining: 10,
        tokensTotal: 10,
        lastResetDate: now.toISOString(),
        nextResetDate: nextReset.toISOString(),
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        createdAt: now.toISOString()
      }
    }
    
    if (!userDoc.exists) {
      // Create new user document with free tier
      const now = new Date()
      const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1) // First day of next month
      
      const userData = {
        subscriptionTier: 'FREE',
        tokensRemaining: 10,
        tokensTotal: 10,
        lastResetDate: now.toISOString(),
        nextResetDate: nextReset.toISOString(),
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        createdAt: now.toISOString()
      }
      
      await userRef.set(userData)
      return userData
    }
    
    const userData = userDoc.data()
    
    // Check if we need to reset tokens for the month
    const now = new Date()
    const nextReset = new Date(userData.nextResetDate)
    
    if (now >= nextReset) {
      // Reset tokens for new month
      const tier = SUBSCRIPTION_TIERS[userData.subscriptionTier] || SUBSCRIPTION_TIERS.FREE
      const newNextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      
      await userRef.update({
        tokensRemaining: tier.tokens,
        tokensTotal: tier.tokens,
        lastResetDate: now.toISOString(),
        nextResetDate: newNextReset.toISOString()
      })
      
      return {
        ...userData,
        tokensRemaining: tier.tokens,
        tokensTotal: tier.tokens,
        lastResetDate: now.toISOString(),
        nextResetDate: newNextReset.toISOString()
      }
    }
    
    return userData
  } catch (error) {
    console.error('Error getting user subscription:', error)
    throw error
  }
}

/**
 * Check if user has enough tokens for video processing
 */
export async function checkUserTokens(userId, videoDurationSeconds) {
  const subscription = await getUserSubscription(userId)
  // Calculate tokens: minimum 1 token for videos under 1 minute, round down for longer videos
  const tokensNeeded = videoDurationSeconds < 60 ? 1 : Math.floor(videoDurationSeconds / 60)
  
  if (subscription.tokensRemaining >= tokensNeeded) {
    return { hasEnough: true, tokensNeeded, tokensRemaining: subscription.tokensRemaining }
  }
  
  return { 
    hasEnough: false, 
    tokensNeeded, 
    tokensRemaining: subscription.tokensRemaining,
    subscriptionTier: subscription.subscriptionTier
  }
}

/**
 * Deduct tokens from user account
 * Note: Since Firestore isn't initialized on server, this returns the new token count
 * and the client should update Firestore
 */
export async function deductTokens(userId, tokensUsed) {
  try {
    if (db) {
      // If Firestore is available, update directly
      const userRef = db.collection('users').doc(userId)
      const userDoc = await userRef.get()
      
      if (!userDoc.exists) {
        throw new Error('User not found')
      }
      
      const userData = userDoc.data()
      const newTokensRemaining = Math.max(0, userData.tokensRemaining - tokensUsed)
      
      await userRef.update({
        tokensRemaining: newTokensRemaining
      })
      
      return newTokensRemaining
    } else {
      // Firestore not available - return the calculation for client to update
      const subscription = await getUserSubscription(userId)
      const newTokensRemaining = Math.max(0, subscription.tokensRemaining - tokensUsed)
      console.log(`Token deduction calculated: ${subscription.tokensRemaining} - ${tokensUsed} = ${newTokensRemaining}`)
      return newTokensRemaining
    }
  } catch (error) {
    console.error('Error deducting tokens:', error)
    throw error
  }
}

/**
 * Create Stripe checkout session
 */
export async function createCheckoutSession(userId, userEmail, priceId, successUrl, cancelUrl) {
  try {
    console.log('createCheckoutSession called with:', { userId, userEmail, priceId })
    
    if (!priceId || !priceId.startsWith('price_')) {
      throw new Error(`Invalid price ID: ${priceId}. Price IDs must start with 'price_'`)
    }
    
    const userSubscription = await getUserSubscription(userId)
    console.log('User subscription retrieved:', userSubscription.subscriptionTier)
    
    // Get or create Stripe customer
    let customerId = userSubscription.stripeCustomerId
    
    if (!customerId) {
      console.log('Creating new Stripe customer for:', userEmail)
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          userId: userId
        }
      })
      customerId = customer.id
      console.log('Created Stripe customer:', customerId)
      
      // Save customer ID to user document
      if (db) {
        try {
          await db.collection('users').doc(userId).update({
            stripeCustomerId: customerId
          })
          console.log('Saved customer ID to Firestore')
        } catch (firestoreError) {
          console.warn('Could not save customer ID to Firestore:', firestoreError.message)
          // Continue anyway - customer is created in Stripe
        }
      }
    } else {
      console.log('Using existing Stripe customer:', customerId)
    }
    
    // Create checkout session
    console.log('Creating Stripe checkout session with:', {
      customerId,
      priceId,
      successUrl,
      cancelUrl
    })
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: userId
      }
    })
    
    console.log('Stripe checkout session created successfully:', session.id)
    return session
  } catch (error) {
    console.error('Error in createCheckoutSession:', error)
    console.error('Error type:', error.type)
    console.error('Error code:', error.code)
    console.error('Error message:', error.message)
    if (error.raw) {
      console.error('Stripe raw error:', error.raw)
    }
    throw error
  }
}

/**
 * Handle Stripe webhook events
 */
export async function handleStripeWebhook(event) {
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object
        const userId = session.metadata?.userId
        
        if (userId) {
          // Get subscription details
          const subscriptionId = session.subscription
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          
          // Determine tier from price ID
          const priceId = subscription.items.data[0].price.id
          let tier = 'FREE'
          
          if (priceId === SUBSCRIPTION_TIERS.TIER1.priceId) {
            tier = 'TIER1'
          } else if (priceId === SUBSCRIPTION_TIERS.TIER2.priceId) {
            tier = 'TIER2'
          } else if (priceId === SUBSCRIPTION_TIERS.KING.priceId) {
            tier = 'KING'
          }
          
          const tierConfig = SUBSCRIPTION_TIERS[tier]
          const now = new Date()
          const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1)
          
          // Update user subscription (if Firestore is available)
          if (db) {
            try {
              await db.collection('users').doc(userId).update({
                subscriptionTier: tier,
                tokensRemaining: tierConfig.tokens,
                tokensTotal: tierConfig.tokens,
                stripeSubscriptionId: subscriptionId,
                lastResetDate: now.toISOString(),
                nextResetDate: nextReset.toISOString()
              })
              console.log(`✅ Updated user ${userId} to ${tier} tier via webhook`)
            } catch (firestoreError) {
              console.warn('⚠️  Could not update Firestore via webhook:', firestoreError.message)
              console.warn('   Subscription will be synced when user visits the app')
            }
          } else {
            console.warn('⚠️  Firestore not available. Subscription will be synced when user visits the app')
          }
        }
        break
        
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        const subscription = event.data.object
        const customerId = subscription.customer
        
        // Find user by customer ID (if Firestore is available)
        if (db) {
          try {
            const userQuery = await db.collection('users')
              .where('stripeCustomerId', '==', customerId)
              .limit(1)
              .get()
            
            if (!userQuery.empty) {
              const userId = userQuery.docs[0].id
              
              if (event.type === 'customer.subscription.deleted' || subscription.status !== 'active') {
                // Downgrade to free tier
                const now = new Date()
                const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1)
                
                await db.collection('users').doc(userId).update({
                  subscriptionTier: 'FREE',
                  tokensRemaining: SUBSCRIPTION_TIERS.FREE.tokens,
                  tokensTotal: SUBSCRIPTION_TIERS.FREE.tokens,
                  stripeSubscriptionId: null,
                  lastResetDate: now.toISOString(),
                  nextResetDate: nextReset.toISOString()
                })
                console.log(`✅ Downgraded user ${userId} to FREE tier via webhook`)
              }
            }
          } catch (firestoreError) {
            console.warn('⚠️  Could not update Firestore via webhook:', firestoreError.message)
          }
        } else {
          console.warn('⚠️  Firestore not available. Subscription changes will be synced when user visits the app')
        }
        break
    }
  } catch (error) {
    console.error('Error handling webhook:', error)
    throw error
  }
}

