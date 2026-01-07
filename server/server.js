import 'dotenv/config'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'
import { existsSync } from 'fs'

// Explicitly load .env file from server directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const envPath = path.join(__dirname, '.env')

// Check if .env file exists
if (existsSync(envPath)) {
  console.log('✅ Found .env file at:', envPath)
  const result = config({ path: envPath })
  if (result.error) {
    console.error('❌ Error loading .env file:', result.error)
  } else {
    console.log('✅ .env file loaded successfully')
    // Debug: Check what was actually loaded
    console.log('📋 Environment variables check:')
    console.log('   STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? `✅ (${process.env.STRIPE_SECRET_KEY.substring(0, 20)}...)` : '❌ undefined')
    console.log('   STRIPE_PRICE_ID_TIER1:', process.env.STRIPE_PRICE_ID_TIER1 || '❌ undefined')
    console.log('   STRIPE_PRICE_ID_TIER2:', process.env.STRIPE_PRICE_ID_TIER2 || '❌ undefined')
    console.log('   STRIPE_PRICE_ID_KING:', process.env.STRIPE_PRICE_ID_KING || '❌ undefined')
  }
} else {
  console.error('❌ .env file NOT FOUND at:', envPath)
  console.error('   Please create a .env file in the server/ directory')
}

import express from 'express'
import cors from 'cors'
import multer from 'multer'
import fs from 'fs-extra'
import { execSync } from 'child_process'
import { processVideo } from './services/videoProcessor.js'
import { downloadYouTubeVideo } from './services/youtubeDownloader.js'
import { 
  verifyIdToken, 
  checkUserTokens, 
  deductTokens, 
  createCheckoutSession,
  handleStripeWebhook,
  getUserSubscription,
  SUBSCRIPTION_TIERS,
  stripe
} from './services/subscriptionService.js'
import ffmpeg from 'fluent-ffmpeg'

// Log environment variables for debugging
console.log('Environment check:')
console.log('  STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? `✅ Set (${process.env.STRIPE_SECRET_KEY.substring(0, 20)}...)` : '❌ Not set')
console.log('  PORT:', process.env.PORT || '3001 (default)')

console.log('✅ All imports loaded successfully')

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Serve static files with proper MIME types
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.mp4')) {
      res.setHeader('Content-Type', 'video/mp4')
    }
  }
}))

app.use('/output', express.static(path.join(__dirname, 'output'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.mp4')) {
      res.setHeader('Content-Type', 'video/mp4')
      res.setHeader('Accept-Ranges', 'bytes')
    }
  }
}))

// Ensure directories exist
const uploadsDir = path.join(__dirname, 'uploads')
const outputDir = path.join(__dirname, 'output')
const tempDir = path.join(__dirname, 'temp')

fs.ensureDirSync(uploadsDir)
fs.ensureDirSync(outputDir)
fs.ensureDirSync(tempDir)

// Check if FFmpeg is installed
function checkFFmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'pipe' })
    console.log('✅ FFmpeg is installed')
    return true
  } catch (error) {
    console.error('❌ FFmpeg is not installed or not in PATH')
    console.error('   Please install FFmpeg:')
    console.error('   macOS: brew install ffmpeg')
    console.error('   Linux: sudo apt-get install ffmpeg (or sudo yum install ffmpeg)')
    console.error('   Windows: Download from https://ffmpeg.org/download.html')
    return false
  }
}

// Check FFmpeg on startup
const ffmpegAvailable = checkFFmpeg()
if (!ffmpegAvailable) {
  console.error('\n⚠️  WARNING: FFmpeg is required for video processing!')
  console.error('   The server will start but video processing will fail until FFmpeg is installed.\n')
}

// Configure multer for file uploads
const upload = multer({
  dest: uploadsDir,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit
  }
})

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

// Direct video download endpoint with proper headers
app.get('/api/video/:filename', (req, res) => {
  const filename = req.params.filename
  const filePath = path.join(outputDir, filename)
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Video file not found' })
  }
  
  const stats = fs.statSync(filePath)
  const fileSize = stats.size
  
  // Validate file size is reasonable
  if (fileSize < 100 * 1024) {
    console.error(`⚠️  Warning: File ${filename} is suspiciously small (${(fileSize / 1024).toFixed(2)} KB)`)
    return res.status(500).json({ error: 'Video file appears to be corrupted or incomplete' })
  }
  
  const range = req.headers.range
  
  if (range) {
    // Handle range requests for video streaming
    const parts = range.replace(/bytes=/, '').split('-')
    const start = parseInt(parts[0], 10)
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
    const chunksize = (end - start) + 1
    
    // Validate range
    if (start >= fileSize || end >= fileSize || start < 0 || end < start) {
      return res.status(416).json({ error: 'Range not satisfiable' })
    }
    
    const file = fs.createReadStream(filePath, { start, end })
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    }
    res.writeHead(206, head)
    file.pipe(res)
  } else {
    // Full file download
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
    res.writeHead(200, head)
    
    const file = fs.createReadStream(filePath)
    
    // Handle errors
    file.on('error', (err) => {
      console.error(`Error reading file ${filename}:`, err)
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error reading video file' })
      }
    })
    
    file.pipe(res)
  }
})

// Authentication middleware
async function authenticateUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required', code: 'UNAUTHORIZED' })
    }

    const idToken = authHeader.split('Bearer ')[1]
    const userId = await verifyIdToken(idToken)
    req.userId = userId
    next()
  } catch (error) {
    console.error('Authentication error:', error)
    return res.status(401).json({ error: 'Invalid authentication token', code: 'UNAUTHORIZED' })
  }
}

// Helper function to get video duration
function getVideoDuration(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err)
        return
      }
      const duration = metadata.format.duration || 0
      resolve(duration)
    })
  })
}

// Main processing endpoint
app.post('/api/process', upload.single('video'), authenticateUser, async (req, res) => {
  const sendProgress = (progress, status) => {
    try {
      res.write(`data: ${JSON.stringify({ progress, status })}\n\n`)
    } catch (err) {
      console.error('Error sending progress:', err)
    }
  }

  try {
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY in server/.env file')
    }
    let videoPath = null
    const tempFiles = []
    let videoDuration = 0

    try {
      // Set up streaming response
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')

      sendProgress(5, 'Initializing...')

      // Handle YouTube URL or file upload
      if (req.body.youtubeUrl) {
        sendProgress(10, 'Downloading YouTube video...')
        videoPath = await downloadYouTubeVideo(req.body.youtubeUrl, tempDir)
        tempFiles.push(videoPath)
      } else if (req.file) {
        videoPath = req.file.path
        sendProgress(10, 'Video file received')
      } else {
        throw new Error('No video file or YouTube URL provided')
      }

      // Get video duration and check tokens
      sendProgress(12, 'Checking video duration...')
      try {
        videoDuration = await getVideoDuration(videoPath)
        // Calculate tokens: minimum 1 token for videos under 1 minute, round down for longer videos
        const tokensNeeded = videoDuration < 60 ? 1 : Math.floor(videoDuration / 60)
        
        // Get current token count from client (since server can't read Firestore)
        // Client sends this in the request body
        let currentTokens = null
        if (req.body.currentTokens !== undefined && req.body.currentTokens !== null) {
          currentTokens = parseInt(req.body.currentTokens)
          console.log(`✅ Using client-provided token count: ${currentTokens}`)
        } else {
          // Fallback: try to get from subscription (but will return default 10 if db is null)
          const tokenCheck = await checkUserTokens(req.userId, videoDuration)
          currentTokens = tokenCheck.tokensRemaining
          console.log(`⚠️  Using fallback token count from server (may be inaccurate): ${currentTokens}`)
        }
        
        // Validate tokens
        if (currentTokens === null || isNaN(currentTokens) || currentTokens < tokensNeeded) {
          const errorMessage = `Not enough tokens. This video requires ${tokensNeeded} token${tokensNeeded > 1 ? 's' : ''}, but you only have ${currentTokens || 0}. Please upgrade your plan to process longer videos.`
          res.write(`data: ${JSON.stringify({ 
            error: errorMessage,
            code: 'INSUFFICIENT_TOKENS',
            tokensNeeded: tokensNeeded,
            tokensRemaining: currentTokens || 0
          })}\n\n`)
          res.end()
          return
        }
        
        // Store current tokens for deduction later
        req.currentTokens = currentTokens
        console.log(`Token check passed: ${currentTokens} tokens available, need ${tokensNeeded}`)
      } catch (error) {
        console.error('Error checking tokens:', error)
        // Continue processing if token check fails (for now)
      }

      sendProgress(20, 'Processing video and extracting audio...')
      
      // Process the video
      const result = await processVideo(videoPath, outputDir, sendProgress)
      
      // Deduct tokens after successful processing
      try {
        // Calculate tokens: minimum 1 token for videos under 1 minute, round down for longer videos
        const tokensUsed = videoDuration < 60 ? 1 : Math.floor(videoDuration / 60)
        
        // Use the current tokens we stored earlier, or try to get from subscription
        let currentTokens = req.currentTokens
        if (currentTokens === null || currentTokens === undefined) {
          // Fallback: try to get from subscription
          const subscription = await getUserSubscription(req.userId)
          currentTokens = subscription.tokensRemaining
          console.log(`⚠️  Using fallback token count from getUserSubscription: ${currentTokens}`)
        }
        
        const newTokensRemaining = Math.max(0, currentTokens - tokensUsed)
        console.log(`✅ Deducted ${tokensUsed} tokens from user ${req.userId}. Balance: ${currentTokens} → ${newTokensRemaining}`)
        
        // Include token deduction info in response for client to update Firestore
        res.write(`data: ${JSON.stringify({ 
          tokensDeducted: tokensUsed,
          newTokensRemaining: newTokensRemaining
        })}\n\n`)
      } catch (error) {
        console.error('Error deducting tokens:', error)
        // Don't fail the request if token deduction fails
      }
      
      sendProgress(95, 'Finalizing...')
      
      // Verify file exists and is valid before sending URL
      const finalPath = result.path
      if (!fs.existsSync(finalPath)) {
        throw new Error('Output video file was not created')
      }
      
      // Wait a bit to ensure file is fully written
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Check file size multiple times to ensure it's stable
      let previousSize = 0
      let stableCount = 0
      for (let i = 0; i < 5; i++) {
        const stats = fs.statSync(finalPath)
        if (stats.size === previousSize && stats.size > 100 * 1024) { // At least 100KB
          stableCount++
          if (stableCount >= 2) break
        } else {
          stableCount = 0
        }
        previousSize = stats.size
        await new Promise(resolve => setTimeout(resolve, 200))
      }
      
      const finalStats = fs.statSync(finalPath)
      if (finalStats.size === 0) {
        throw new Error('Output video file is empty')
      }
      
      if (finalStats.size < 100 * 1024) {
        throw new Error(`Output video file is suspiciously small (${(finalStats.size / 1024).toFixed(2)} KB). File may be corrupted.`)
      }
      
      console.log(`✅ Video ready: ${result.filename} (${(finalStats.size / 1024 / 1024).toFixed(2)} MB)`)
      
      // Send final result - use both static and API endpoint
      res.write(`data: ${JSON.stringify({ 
        progress: 100, 
        status: 'Complete!',
        videoUrl: `/output/${result.filename}`,
        downloadUrl: `/api/video/${result.filename}`
      })}\n\n`)
      
      res.end()
    } catch (error) {
      console.error('Processing error:', error)
      res.write(`data: ${JSON.stringify({ 
        error: error.message || 'Processing failed'
      })}\n\n`)
      res.end()
    } finally {
      // Cleanup temp files
      for (const file of tempFiles) {
        try {
          if (fs.existsSync(file)) {
            fs.unlinkSync(file)
          }
        } catch (err) {
          console.error('Error cleaning up temp file:', err)
        }
      }
      
      // Cleanup uploaded file if it exists
      if (req.file && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path)
        } catch (err) {
          console.error('Error cleaning up uploaded file:', err)
        }
      }
    }
  } catch (error) {
    console.error('Server error:', error)
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Internal server error' })
    }
  }
})

// Get user subscription info
app.get('/api/subscription', authenticateUser, async (req, res) => {
  try {
    const subscription = await getUserSubscription(req.userId)
    res.json(subscription)
  } catch (error) {
    console.error('Error getting subscription:', error)
    res.status(500).json({ error: 'Failed to get subscription info' })
  }
})

// Sync subscription from Stripe (called after successful payment)
app.post('/api/sync-subscription', authenticateUser, async (req, res) => {
  try {
    const userId = req.userId
    // Get user email from request body or try to get from token
    let userEmail = req.body.email
    if (!userEmail && req.user) {
      userEmail = req.user.email
    }
    console.log('Syncing subscription for user:', userId, 'Email:', userEmail)
    const userSubscription = await getUserSubscription(userId)
    console.log('Current subscription:', userSubscription.subscriptionTier, 'Customer ID:', userSubscription.stripeCustomerId)
    
    let customerId = userSubscription.stripeCustomerId
    
    // If no customer ID in Firestore, try to find it by email in Stripe
    if (!customerId && userEmail) {
      console.log('No customer ID in Firestore, searching Stripe by email:', userEmail)
      const customers = await stripe.customers.list({
        email: userEmail,
        limit: 1
      })
      
      if (customers.data.length > 0) {
        customerId = customers.data[0].id
        console.log('Found Stripe customer by email:', customerId)
        // Continue to check subscriptions below (don't return early)
      } else {
        console.log('No Stripe customer found for email:', userEmail)
        res.json({
          success: true,
          subscription: userSubscription
        })
        return
      }
    }
    
    // If user has a Stripe customer ID, check their active subscriptions
    if (customerId) {
      // Get all subscriptions (including trialing, incomplete, etc. - not just active)
      // Sometimes subscriptions are in 'trialing' or 'incomplete' state right after payment
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        limit: 10
      })
      
      console.log(`Found ${subscriptions.data.length} subscriptions for customer ${customerId}`)
      
      // Find the most recent subscription (active, trialing, or incomplete)
      const activeSubscription = subscriptions.data.find(sub => 
        sub.status === 'active' || sub.status === 'trialing' || sub.status === 'incomplete'
      ) || subscriptions.data[0] // Fallback to most recent
      
      if (activeSubscription) {
        console.log('Found subscription:', activeSubscription.id, 'Status:', activeSubscription.status)
        const priceId = activeSubscription.items.data[0].price.id
        console.log('Price ID:', priceId)
        
        // Determine tier from price ID
        let tier = 'FREE'
        if (priceId === process.env.STRIPE_PRICE_ID_TIER1) {
          tier = 'TIER1'
        } else if (priceId === process.env.STRIPE_PRICE_ID_TIER2) {
          tier = 'TIER2'
        } else if (priceId === process.env.STRIPE_PRICE_ID_KING) {
          tier = 'KING'
        }
        
        console.log('Determined tier:', tier)
        const tierConfig = SUBSCRIPTION_TIERS[tier]
        const now = new Date()
        const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1)
        
        // Return the update data so client can update Firestore
        const subscriptionData = {
          subscriptionTier: tier,
          tokensRemaining: tierConfig.tokens,
          tokensTotal: tierConfig.tokens,
          stripeSubscriptionId: activeSubscription.id,
          lastResetDate: now.toISOString(),
          nextResetDate: nextReset.toISOString(),
          stripeCustomerId: customerId // Always include customer ID so client can save it
        }
        
        console.log('✅ Returning subscription data:', subscriptionData)
        res.json({
          success: true,
          subscription: subscriptionData
        })
        return
      } else {
        console.log('No active subscription found')
      }
    } else {
      console.log('No Stripe customer ID found')
    }
    
    // No active subscription found
    console.log('Returning current subscription (no upgrade found)')
    res.json({
      success: true,
      subscription: userSubscription
    })
  } catch (error) {
    console.error('Error syncing subscription:', error)
    console.error('Error stack:', error.stack)
    res.status(500).json({ error: 'Failed to sync subscription', details: error.message })
  }
})

// Create Stripe checkout session
app.post('/api/create-checkout-session', authenticateUser, async (req, res) => {
  try {
    console.log('Creating checkout session for user:', req.userId)
    const { priceId, tier, email } = req.body
    
    if (!priceId) {
      console.error('Missing priceId in request')
      return res.status(400).json({ error: 'Price ID is required' })
    }

    // Get user email from request body
    const userEmail = email || 'user@example.com'
    console.log('Using email:', userEmail, 'Price ID:', priceId)
    
    const apiUrl = process.env.API_URL || 'http://localhost:5173'
    console.log('API URL for redirect:', apiUrl)
    
    const session = await createCheckoutSession(
      req.userId,
      userEmail,
      priceId,
      `${apiUrl}/plan?success=true`,
      `${apiUrl}/plan?canceled=true`
    )

    console.log('Checkout session created:', session.id)
    res.json({ sessionId: session.id })
  } catch (error) {
    console.error('Error creating checkout session:', error)
    console.error('Error stack:', error.stack)
    console.error('Error details:', {
      message: error.message,
      type: error.type,
      code: error.code,
      statusCode: error.statusCode
    })
    
    // Return more detailed error for debugging
    const errorMessage = error.message || 'Failed to create checkout session'
    const errorDetails = {
      error: errorMessage,
      type: error.type || 'Unknown',
      code: error.code || 'UNKNOWN_ERROR'
    }
    
    // If it's a Stripe error, include more details
    if (error.type && error.type.startsWith('Stripe')) {
      errorDetails.stripeError = true
      errorDetails.rawError = error.raw ? error.raw.message : undefined
    }
    
    res.status(500).json(errorDetails)
  }
})

// Stripe webhook endpoint
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature']
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.warn('⚠️  STRIPE_WEBHOOK_SECRET not set, webhook verification disabled')
    // In production, you should always verify webhooks
    try {
      // Parse the raw body as JSON for testing
      const event = JSON.parse(req.body.toString())
      await handleStripeWebhook(event)
      res.json({ received: true })
    } catch (error) {
      console.error('Webhook error:', error)
      res.status(400).json({ error: 'Webhook processing failed' })
    }
    return
  }

  try {
    const Stripe = (await import('stripe')).default
    const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY)
    const event = stripeInstance.webhooks.constructEvent(req.body, sig, webhookSecret)
    
    await handleStripeWebhook(event)
    res.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    res.status(400).json({ error: `Webhook Error: ${error.message}` })
  }
})

// Error handling for uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error)
  console.error('Stack:', error.stack)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise)
  console.error('Reason:', reason)
  if (reason instanceof Error) {
    console.error('Stack:', reason.stack)
  }
})

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`)
  console.log(`📝 OpenAI API Key: ${process.env.OPENAI_API_KEY ? '✅ Configured' : '❌ Missing - please set OPENAI_API_KEY in .env file'}`)
  console.log(`🎬 FFmpeg: ${ffmpegAvailable ? '✅ Available' : '❌ Not found - video processing will fail'}`)
  
  // Check Stripe key more carefully
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (stripeKey && stripeKey.length > 0 && stripeKey.startsWith('sk_')) {
    console.log(`💳 Stripe: ✅ Configured`)
  } else {
    console.log(`💳 Stripe: ❌ Missing - please set STRIPE_SECRET_KEY in .env file`)
    console.log(`   Current value: ${stripeKey ? `"${stripeKey.substring(0, 20)}..." (${stripeKey.length} chars)` : 'undefined'}`)
  }
}).on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Please stop the other process or change the PORT in .env`)
  } else {
    console.error('❌ Server error:', error)
  }
  process.exit(1)
})

