import ytdl from '@distube/ytdl-core'
import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync, spawn } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Try to use yt-dlp or youtube-dl as fallback (more reliable)
async function downloadWithYtDlp(originalUrl, outputDir) {
  return new Promise((resolve, reject) => {
    // Check for yt-dlp first (preferred, actively maintained), then youtube-dl
    let command = 'yt-dlp'
    let commandFound = false
    try {
      execSync('which yt-dlp', { stdio: 'ignore' })
      commandFound = true
    } catch {
      try {
        execSync('which youtube-dl', { stdio: 'ignore' })
        command = 'youtube-dl'
        commandFound = true
      } catch {
        reject(new Error('yt-dlp or youtube-dl not found. Install yt-dlp for best results: brew install yt-dlp'))
        return
      }
    }

    // Extract video ID for filename (yt-dlp/youtube-dl can handle URLs directly)
    let videoId = null
    if (originalUrl.includes('youtu.be/')) {
      videoId = originalUrl.split('youtu.be/')[1].split('?')[0].split('#')[0]
    } else if (originalUrl.includes('youtube.com/shorts/')) {
      videoId = originalUrl.split('youtube.com/shorts/')[1].split('?')[0].split('#')[0]
    } else if (originalUrl.includes('youtube.com/watch?v=')) {
      videoId = originalUrl.split('watch?v=')[1].split('&')[0].split('#')[0]
    } else if (originalUrl.includes('youtube.com/embed/')) {
      videoId = originalUrl.split('embed/')[1].split('?')[0].split('#')[0]
    }
    
    if (!videoId) {
      reject(new Error(`Could not extract video ID from URL: ${originalUrl}`))
      return
    }

    const outputPath = path.join(outputDir, `${videoId}.mp4`)
    
    // Use yt-dlp/youtube-dl to download - use original URL (they handle all formats)
    const args = [
      originalUrl, // Use original URL - yt-dlp handles Shorts, regular videos, etc.
      '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best', // Best quality with video+audio, fallback to best MP4, then best
      '-o', outputPath,
      '--no-playlist',
      '--no-warnings'
    ]

    console.log(`Using ${command} to download: ${originalUrl}`)
    const downloadProcess = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let output = ''
    let errorOutput = ''

    downloadProcess.stdout.on('data', (data) => {
      const dataStr = data.toString()
      output += dataStr
      // Log progress to console
      if (dataStr.includes('%') || dataStr.includes('Downloading')) {
        console.log(dataStr.trim())
      }
    })

    downloadProcess.stderr.on('data', (data) => {
      const dataStr = data.toString()
      errorOutput += dataStr
      // yt-dlp writes progress to stderr, log it
      if (dataStr.includes('%') || dataStr.includes('Downloading') || dataStr.includes('ETA')) {
        console.log(dataStr.trim())
      }
    })

    downloadProcess.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        console.log(`Video downloaded successfully with ${command}: ${outputPath}`)
        resolve(outputPath)
      } else {
        const errorMsg = errorOutput || output || 'Unknown error'
        reject(new Error(`${command} failed with code ${code}: ${errorMsg}`))
      }
    })

    downloadProcess.on('error', (error) => {
      reject(new Error(`${command} execution failed: ${error.message}`))
    })
  })
}

export async function downloadYouTubeVideo(url, outputDir) {
  try {
    // Normalize YouTube URL (handle youtu.be short links and YouTube Shorts)
    let normalizedUrl = url.trim()
    let videoId = null
    
    // Extract video ID from various YouTube URL formats
    if (normalizedUrl.includes('youtu.be/')) {
      videoId = normalizedUrl.split('youtu.be/')[1].split('?')[0].split('#')[0]
      normalizedUrl = `https://www.youtube.com/watch?v=${videoId}`
    } else if (normalizedUrl.includes('youtube.com/shorts/')) {
      // Handle YouTube Shorts URLs
      videoId = normalizedUrl.split('youtube.com/shorts/')[1].split('?')[0].split('#')[0]
      normalizedUrl = `https://www.youtube.com/watch?v=${videoId}`
    } else if (normalizedUrl.includes('youtube.com/watch?v=')) {
      videoId = normalizedUrl.split('watch?v=')[1].split('&')[0].split('#')[0]
    } else if (normalizedUrl.includes('youtube.com/embed/')) {
      videoId = normalizedUrl.split('embed/')[1].split('?')[0].split('#')[0]
    }
    
    // Validate URL
    if (!ytdl.validateURL(normalizedUrl)) {
      throw new Error(`Invalid YouTube URL: ${url}`)
    }

    console.log(`Downloading YouTube video: ${normalizedUrl}`)

    // Get video info with retry logic and better error handling
    let info
    let retries = 3
    while (retries > 0) {
      try {
        info = await ytdl.getInfo(normalizedUrl, {
          requestOptions: {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-us,en;q=0.5',
              'Accept-Encoding': 'gzip, deflate',
              'Connection': 'keep-alive',
            }
          }
        })
        break
      } catch (error) {
        retries--
        const errorMsg = error.message || String(error)
        const statusCode = error.statusCode || (errorMsg.match(/Status code: (\d+)/)?.[1])
        
        console.log(`Error getting video info (attempt ${4 - retries}/3): ${errorMsg}`)
        
        // Handle specific error cases
        if (statusCode === '410' || errorMsg.includes('410') || errorMsg.includes('Gone')) {
          throw new Error(`YouTube API endpoint is no longer available (410 Gone). Please use MP4 file upload instead, or try updating: cd server && npm install @distube/ytdl-core@latest`)
        }
        
        if (errorMsg.includes('parsing watch.html') || errorMsg.includes('YouTube made a change')) {
          throw new Error(`YouTube has changed their page structure and the downloader needs an update. Please use MP4 file upload instead. To download YouTube videos, use a tool like yt-dlp or a browser extension, then upload the MP4 file.`)
        }
        
        if (errorMsg.includes('Could not extract functions') || errorMsg.includes('Sign in to confirm your age')) {
          throw new Error(`YouTube download failed: ${errorMsg}. Please use MP4 file upload instead.`)
        }
        
        if (errorMsg.includes('Private video') || errorMsg.includes('Video unavailable')) {
          throw new Error(`Video is private or unavailable. Please use a public video or upload an MP4 file instead.`)
        }
        
        if (retries === 0) {
          throw new Error(`YouTube download failed: ${errorMsg}. Please use MP4 file upload instead.`)
        }
        console.log(`Retrying in 2 seconds...`)
        await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds before retry
      }
    }

    // Get video ID from info (more reliable than URL parsing)
    const finalVideoId = info.videoDetails.videoId || videoId
    if (!finalVideoId) {
      throw new Error('Could not determine video ID')
    }
    const outputPath = path.join(outputDir, `${finalVideoId}.mp4`)

    // Find best format with both video and audio
    const format = ytdl.chooseFormat(info.formats, {
      quality: 'highest',
      filter: format => format.hasVideo && format.hasAudio
    })

    if (!format) {
      // Fallback: get best video and best audio separately
      const videoFormat = ytdl.chooseFormat(info.formats, {
        quality: 'highestvideo',
        filter: 'videoonly'
      })
      const audioFormat = ytdl.chooseFormat(info.formats, {
        quality: 'highestaudio',
        filter: 'audioonly'
      })
      
      if (!videoFormat || !audioFormat) {
        throw new Error('No suitable video/audio format found')
      }
      
      // For now, just use video format and we'll handle audio separately if needed
      // This is a simplified approach - full implementation would merge streams
      throw new Error('Video with separate audio streams not yet supported. Please try a different video or use MP4 upload.')
    }

    return new Promise((resolve, reject) => {
      const videoStream = ytdl.downloadFromInfo(info, {
        format: format,
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
          }
        }
      })

      const writeStream = fs.createWriteStream(outputPath)
      
      let downloadedBytes = 0
      const totalBytes = format.contentLength || 0

      videoStream.on('progress', (chunkLength, downloaded, total) => {
        if (total) {
          const percent = (downloaded / total * 100).toFixed(2)
          console.log(`Download progress: ${percent}%`)
        }
      })

      videoStream.pipe(writeStream)

      videoStream.on('error', (error) => {
        console.error('YouTube stream error:', error)
        // Clean up partial file
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath).catch(() => {})
        }
        reject(new Error(`YouTube download failed: ${error.message}`))
      })

      writeStream.on('finish', () => {
        console.log(`Video downloaded successfully: ${outputPath}`)
        resolve(outputPath)
      })

      writeStream.on('error', (error) => {
        console.error('File write error:', error)
        // Clean up partial file
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath).catch(() => {})
        }
        reject(new Error(`File write failed: ${error.message}`))
      })
    })
  } catch (error) {
    console.error('YouTube download error with ytdl-core:', error)
    
    // Try fallback to yt-dlp/youtube-dl if available
    // Use original URL (not normalized) since yt-dlp handles all formats
    console.log('Attempting fallback to yt-dlp/youtube-dl...')
    try {
      const originalUrl = url.trim() // Use the original URL passed in
      return await downloadWithYtDlp(originalUrl, outputDir)
    } catch (fallbackError) {
      console.error('Fallback download also failed:', fallbackError)
      const errorMsg = fallbackError.message || String(fallbackError)
      if (errorMsg.includes('not found')) {
        throw new Error(`Failed to download YouTube video. Please install yt-dlp for better YouTube support: brew install yt-dlp. Or use MP4 file upload instead.`)
      }
      throw new Error(`Failed to download YouTube video: ${error.message}. Fallback also failed: ${fallbackError.message}`)
    }
  }
}

