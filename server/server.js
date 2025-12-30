import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs-extra'
import { execSync } from 'child_process'
import { processVideo } from './services/videoProcessor.js'
import { downloadYouTubeVideo } from './services/youtubeDownloader.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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

// Main processing endpoint
app.post('/api/process', upload.single('video'), async (req, res) => {
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

      sendProgress(20, 'Processing video and extracting audio...')
      
      // Process the video
      const result = await processVideo(videoPath, outputDir, sendProgress)
      
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

// Error handling for uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`)
  console.log(`📝 OpenAI API Key: ${process.env.OPENAI_API_KEY ? '✅ Configured' : '❌ Missing - please set OPENAI_API_KEY in .env file'}`)
  console.log(`🎬 FFmpeg: ${ffmpegAvailable ? '✅ Available' : '❌ Not found - video processing will fail'}`)
}).on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Please stop the other process or change the PORT in .env`)
  } else {
    console.error('❌ Server error:', error)
  }
  process.exit(1)
})

