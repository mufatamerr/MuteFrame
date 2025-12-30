import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync, spawn } from 'child_process'
import { transcribeAudio } from './transcription.js'
import { detectSwearWords } from './swearWordDetector.js'
import { addBleepSounds } from './audioProcessor.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Helper: Run ffprobe and return detailed metadata
function probeVideo(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(new Error(`ffprobe failed: ${err.message}`))
        return
      }
      resolve(metadata)
    })
  })
}

// Helper: Verify file with ffprobe and log key properties
async function verifyAndLog(filePath, label) {
  try {
    const metadata = await probeVideo(filePath)
    const videoStream = metadata.streams.find(s => s.codec_type === 'video')
    const audioStream = metadata.streams.find(s => s.codec_type === 'audio')
    
    console.log(`\n📊 ${label} Properties:`)
    console.log(`   Duration: ${metadata.format.duration ? metadata.format.duration.toFixed(2) + 's' : 'unknown'}`)
    console.log(`   Streams: ${metadata.streams.length} (${videoStream ? 'video' : 'no video'}, ${audioStream ? 'audio' : 'no audio'})`)
    
    if (videoStream) {
      console.log(`   Video: ${videoStream.codec_name}, ${videoStream.width}x${videoStream.height}, ${videoStream.r_frame_rate || 'unknown'} fps`)
      console.log(`   Video time_base: ${videoStream.time_base || 'unknown'}`)
      console.log(`   Video start_time: ${videoStream.start_time || 'unknown'}`)
    }
    
    if (audioStream) {
      console.log(`   Audio: ${audioStream.codec_name}, ${audioStream.sample_rate || 'unknown'}Hz, ${audioStream.channel_layout || audioStream.channels + 'ch'}`)
      console.log(`   Audio time_base: ${audioStream.time_base || 'unknown'}`)
      console.log(`   Audio start_time: ${audioStream.start_time || 'unknown'}`)
    }
    
    return metadata
  } catch (error) {
    console.error(`❌ ${label} verification failed:`, error.message)
    throw error
  }
}

// Helper: Run ffmpeg command and capture stderr for errors (drains stderr to avoid deadlocks)
// Optionally accepts progressCallback for progress updates
function runFFmpegCommand(args, label, progressCallback = null, totalDuration = null) {
  return new Promise((resolve, reject) => {
    const process = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] })
    
    let stderr = ''
    let stdout = ''
    
    // Drain stderr to avoid deadlocks and parse progress
    process.stderr.on('data', (data) => {
      const dataStr = data.toString()
      stderr += dataStr
      
      // Parse ffmpeg progress if callback provided
      if (progressCallback && totalDuration) {
        // FFmpeg progress format: time=00:01:23.45 or time=83.45
        const timeMatch = dataStr.match(/time=(\d+):(\d+):(\d+\.\d+)/) || dataStr.match(/time=(\d+\.\d+)/)
        if (timeMatch) {
          let currentTime = 0
          if (timeMatch.length === 4) {
            // HH:MM:SS.mmm format
            const hours = parseInt(timeMatch[1])
            const minutes = parseInt(timeMatch[2])
            const seconds = parseFloat(timeMatch[3])
            currentTime = hours * 3600 + minutes * 60 + seconds
          } else {
            // seconds format
            currentTime = parseFloat(timeMatch[1])
          }
          
          if (currentTime > 0 && totalDuration > 0) {
            const progress = Math.min(95, Math.max(85, 85 + (currentTime / totalDuration) * 10))
            progressCallback(progress, `Rendering video... ${Math.round((currentTime / totalDuration) * 100)}%`)
          }
        }
      }
    })
    
    process.stdout.on('data', (data) => {
      stdout += data.toString()
    })
    
    process.on('close', (code) => {
      // Check for critical errors in stderr
      const errorPatterns = [
        /Non-monotonous DTS/i,
        /Invalid argument/i,
        /moov atom not found/i,
        /Error/i,
        /Failed/i,
        /Invalid data found/i
      ]
      
      const hasError = errorPatterns.some(pattern => pattern.test(stderr))
      
      if (code !== 0 || hasError) {
        const errorMsg = hasError 
          ? `FFmpeg error detected: ${stderr.match(/Error[^\n]*/i)?.[0] || 'Unknown error'}`
          : `FFmpeg exited with code ${code}`
        console.error(`❌ ${label} failed:`)
        console.error(`   Command: ffmpeg ${args.join(' ')}`)
        console.error(`   Stderr: ${stderr.substring(0, 500)}`)
        reject(new Error(errorMsg))
        return
      }
      
      resolve({ stdout, stderr })
    })
    
    process.on('error', (err) => {
      reject(new Error(`${label} process error: ${err.message}`))
    })
  })
}

/**
 * Strict validation: Run ffprobe and ffmpeg decode test
 * @param {string} filePath - Path to video file
 * @returns {Promise<object>} Metadata from ffprobe
 */
async function validateVideoFile(filePath) {
  // First, run ffprobe
  const probeArgs = [
    '-v', 'error',
    '-show_format',
    '-show_streams',
    '-of', 'json',
    filePath
  ]

  const probeProcess = spawn('ffprobe', probeArgs, {
    stdio: ['ignore', 'pipe', 'pipe']
  })

  let probeStdout = ''
  let probeStderr = ''

  probeProcess.stdout.on('data', (data) => {
    probeStdout += data.toString()
  })

  probeProcess.stderr.on('data', (data) => {
    probeStderr += data.toString()
  })

  await new Promise((resolve, reject) => {
    probeProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe failed with code ${code}: ${probeStderr}`))
        return
      }
      resolve()
    })

    probeProcess.on('error', (err) => {
      reject(new Error(`ffprobe process error: ${err.message}`))
    })
  })

  let metadata
  try {
    metadata = JSON.parse(probeStdout)
  } catch (err) {
    throw new Error(`Failed to parse ffprobe output: ${err.message}`)
  }

  // Second, run ffmpeg decode test with explicit stream mapping
  const decodeTestArgs = [
    '-v', 'error',
    '-i', filePath,
    '-map', '0:v:0',  // Map video stream
    '-map', '0:a:0',  // Map audio stream
    '-f', 'null',
    '-'
  ]

  const decodeProcess = spawn('ffmpeg', decodeTestArgs, {
    stdio: ['ignore', 'pipe', 'pipe']
  })

  let decodeStderr = ''

  decodeProcess.stderr.on('data', (data) => {
    decodeStderr += data.toString()
  })

  await new Promise((resolve, reject) => {
    decodeProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`FFmpeg decode test failed with code ${code}: ${decodeStderr}`))
        return
      }
      resolve()
    })

    decodeProcess.on('error', (err) => {
      reject(new Error(`FFmpeg decode test process error: ${err.message}`))
    })
  })

  // Third, validate MP4 header (check for 'ftyp' in first 12 bytes)
  try {
    const fd = fs.openSync(filePath, 'r')
    const buffer = Buffer.alloc(12)
    fs.readSync(fd, buffer, 0, 12, 0)
    fs.closeSync(fd)
    
    // Check if file starts with valid MP4 header (contains 'ftyp' at offset 4)
    const headerStr = buffer.toString('ascii', 4, 8)
    const hexDump = buffer.toString('hex').match(/.{2}/g)?.join(' ') || ''
    
    console.log(`   MP4 header check: ${hexDump} (should contain 'ftyp' at offset 4)`)
    
    if (headerStr !== 'ftyp') {
      throw new Error(`Invalid MP4 header: expected 'ftyp' at offset 4, got '${headerStr}'`)
    }
    
    console.log(`   ✅ MP4 header valid: ${headerStr}`)
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error('File does not exist for header validation')
    }
    throw new Error(`MP4 header validation failed: ${err.message}`)
  }

  return metadata
}

/**
 * Ensure file is fully written and stable by checking size multiple times
 * @param {string} filePath - Path to file
 * @param {number} timeoutMs - Maximum time to wait in milliseconds
 * @returns {Promise<void>}
 */
async function ensureFileStable(filePath, timeoutMs = 5000) {
  const startTime = Date.now()
  let previousSize = 0
  let stableCount = 0
  const requiredStableChecks = 3
  
  while (Date.now() - startTime < timeoutMs) {
    if (!fs.existsSync(filePath)) {
      await new Promise(resolve => setTimeout(resolve, 200))
      continue
    }
    
    const stats = fs.statSync(filePath)
    const currentSize = stats.size
    
    if (currentSize === previousSize && currentSize > 0) {
      stableCount++
      if (stableCount >= requiredStableChecks) {
        // File size is stable, verify it's readable
        try {
          const fd = fs.openSync(filePath, 'r')
          fs.closeSync(fd)
          return // File is stable and readable
        } catch (err) {
          // File might still be locked, wait a bit more
          await new Promise(resolve => setTimeout(resolve, 200))
          continue
        }
      }
    } else {
      stableCount = 0
    }
    
    previousSize = currentSize
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  
  // Final check
  if (!fs.existsSync(filePath)) {
    throw new Error('Output file does not exist after waiting for stability')
  }
  
  const finalStats = fs.statSync(filePath)
  if (finalStats.size === 0) {
    throw new Error('Output file is empty after waiting for stability')
  }
  
  // File exists and has size, but might not be fully stable - log warning
  console.log(`   ⚠️  File size: ${(finalStats.size / 1024 / 1024).toFixed(2)} MB (stability check completed)`)
}

export async function processVideo(videoPath, outputDir, progressCallback) {
  const tempDir = path.join(__dirname, '../temp')
  const audioPath = path.join(tempDir, `audio_${Date.now()}.wav`)
  const censoredAudioPath = path.join(tempDir, `censored_audio_${Date.now()}.wav`)
  const censoredAudioPathM4a = path.join(tempDir, `censored_audio_${Date.now()}.m4a`)
  const tempOutputPath = path.join(outputDir, `censored_temp_${Date.now()}.mp4`)
  const finalOutputPath = path.join(outputDir, `censored_${Date.now()}.mp4`)

  try {
    // Step 1: Verify input video
    progressCallback(5, 'Verifying input video...')
    console.log('\n🔍 Step 1: Verifying input video...')
    const inputMetadata = await verifyAndLog(videoPath, 'Input Video')
    
    // Step 2: Extract audio from video
    progressCallback(25, 'Extracting audio from video...')
    console.log('\n🔍 Step 2: Extracting audio...')
    await extractAudio(videoPath, audioPath)
    await verifyAndLog(audioPath, 'Extracted Audio')

    // Step 3: Transcribe audio
    progressCallback(40, 'Transcribing audio...')
    console.log('\n🔍 Step 3: Transcribing audio...')
    const transcription = await transcribeAudio(audioPath)
    
    if (!transcription || transcription.length === 0) {
      throw new Error('No transcription found. The video may not have audio.')
    }

    // Step 4: Detect swear words with timestamps
    progressCallback(60, 'Detecting swear words...')
    console.log('\n🔍 Step 4: Detecting swear words...')
    const swearWordTimestamps = detectSwearWords(transcription)
    console.log(`🔍 Found ${swearWordTimestamps.length} swear words to censor`)
    if (swearWordTimestamps.length > 0) {
      console.log(`   First few: ${swearWordTimestamps.slice(0, 3).map(s => s.word).join(', ')}`)
    }

    // Step 5: Add bleep sounds (PCM-based processing)
    progressCallback(70, 'Adding bleep sounds...')
    console.log('\n🔍 Step 5: Adding bleep sounds (PCM-based)...')
    // Note: audioProcessor now outputs AAC (m4a)
    await addBleepSounds(audioPath, censoredAudioPathM4a, swearWordTimestamps)
    
    // Verify censored audio
    if (!fs.existsSync(censoredAudioPathM4a)) {
      throw new Error('Censored audio file was not created')
    }
    const censoredAudioMetadata = await verifyAndLog(censoredAudioPathM4a, 'Censored Audio')
    
    // Verify durations match (within tolerance)
    const originalDuration = inputMetadata.format.duration
    const censoredDuration = censoredAudioMetadata.format.duration
    const durationDiff = Math.abs(originalDuration - censoredDuration)
    if (durationDiff > 2.0) {
      console.warn(`⚠️  Duration mismatch: input=${originalDuration.toFixed(2)}s, censored=${censoredDuration.toFixed(2)}s, diff=${durationDiff.toFixed(2)}s`)
    }

    // Step 6: Combine censored audio with original video (ROBUST APPROACH)
    progressCallback(85, 'Rendering final video...')
    console.log('\n🔍 Step 6: Combining video with censored audio...')
    await combineVideoAudioRobust(videoPath, censoredAudioPathM4a, tempOutputPath, progressCallback, inputMetadata.format.duration)
    
    // Step 7: Verify temp output
    console.log('\n🔍 Step 7: Verifying temp output...')
    await verifyAndLog(tempOutputPath, 'Temp Output')
    
    // Step 8: Final remux to ensure moov atom is at beginning
    progressCallback(95, 'Finalizing video...')
    console.log('\n🔍 Step 8: Final remux for web compatibility...')
    await finalRemux(tempOutputPath, finalOutputPath, progressCallback, inputMetadata.format.duration)
    
    // Step 9: Strict validation of final output
    console.log('\n🔍 Step 9: Strict validation of final output...')
    const finalMetadata = await validateVideoFile(finalOutputPath)
    await verifyAndLog(finalOutputPath, 'Final Output')
    
    // Additional validation: Try to read first frame to ensure file is playable
    console.log('   Testing file playability...')
    const testArgs = [
      '-v', 'error',
      '-i', finalOutputPath,
      '-map', '0:v:0',  // Map video stream
      '-map', '0:a:0',  // Map audio stream
      '-vframes', '1',
      '-f', 'null',
      '-'
    ]
    await runFFmpegCommand(testArgs, 'Playability test')
    console.log('   ✅ File is playable')
    
    // Compare input vs output
    console.log('\n📊 Input vs Output Comparison:')
    // Parse duration from ffprobe JSON (may be string)
    const finalDuration = typeof finalMetadata.format.duration === 'string' 
      ? parseFloat(finalMetadata.format.duration) 
      : finalMetadata.format.duration
    console.log(`   Duration: ${originalDuration.toFixed(2)}s → ${finalDuration.toFixed(2)}s`)
    const finalVideoStream = finalMetadata.streams.find(s => s.codec_type === 'video')
    const inputVideoStream = inputMetadata.streams.find(s => s.codec_type === 'video')
    if (finalVideoStream && inputVideoStream) {
      console.log(`   Resolution: ${inputVideoStream.width}x${inputVideoStream.height} → ${finalVideoStream.width}x${finalVideoStream.height}`)
    }
    
    // Ensure file is fully written and stable before returning
    console.log('   Ensuring file is fully written...')
    await ensureFileStable(finalOutputPath, 5000) // Wait up to 5 seconds for stability
    
    const stats = fs.statSync(finalOutputPath)
    const fileSizeMB = stats.size / (1024 * 1024)
    
    // Validate file size is reasonable (at least 100KB for a video)
    if (stats.size < 100 * 1024) {
      throw new Error(`Output file is suspiciously small (${(stats.size / 1024).toFixed(2)} KB). File may be corrupted.`)
    }
    
    console.log(`✅ Video processing complete: ${finalOutputPath} (${fileSizeMB.toFixed(2)} MB)`)

    // Cleanup temp files
    try {
      if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath)
      if (fs.existsSync(censoredAudioPath)) fs.unlinkSync(censoredAudioPath)
      if (fs.existsSync(censoredAudioPathM4a)) fs.unlinkSync(censoredAudioPathM4a)
      if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath)
    } catch (err) {
      console.error('Error cleaning up temp files:', err)
    }

    return {
      filename: path.basename(finalOutputPath),
      path: finalOutputPath,
      swearWordsFound: swearWordTimestamps.length
    }
  } catch (error) {
    // Cleanup on error
    try {
      if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath)
      if (fs.existsSync(censoredAudioPath)) fs.unlinkSync(censoredAudioPath)
      if (fs.existsSync(censoredAudioPathM4a)) fs.unlinkSync(censoredAudioPathM4a)
      if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath)
    } catch (err) {
      // Ignore cleanup errors
    }
    throw error
  }
}

function extractAudio(videoPath, outputPath) {
  return new Promise((resolve, reject) => {
    // Extract audio as WAV (44100 Hz, mono) for PCM processing
    const command = ffmpeg(videoPath)
      .output(outputPath)
      .audioCodec('pcm_s16le')
      .audioFrequency(44100) // Match PCM processing sample rate
      .audioChannels(1) // Mono
      .on('end', () => {
        const stats = fs.statSync(outputPath)
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2)
        console.log(`   Extracted audio: ${sizeMB}MB`)
        resolve()
      })
      .on('error', (err) => {
        let errorMsg = err.message || 'Unknown error'
        if (errorMsg.includes('Cannot find ffmpeg') || errorMsg.includes('ffmpeg')) {
          errorMsg = 'FFmpeg is not installed. Please install FFmpeg:\n' +
            '  macOS: brew install ffmpeg\n' +
            '  Linux: sudo apt-get install ffmpeg\n' +
            '  Windows: Download from https://ffmpeg.org/download.html'
        }
        reject(new Error(`Audio extraction failed: ${errorMsg}`))
      })
      .run()
  })
}

// ROBUST APPROACH: Copy video stream, encode audio separately, then remux
// Audio input is now AAC (m4a) from PCM-based processing
async function combineVideoAudioRobust(videoPath, audioPath, outputPath, progressCallback = null, totalDuration = null) {
  // Get video and audio metadata to ensure proper synchronization
  const videoMetadata = await probeVideo(videoPath)
  const audioMetadata = await probeVideo(audioPath)
  const videoStream = videoMetadata.streams.find(s => s.codec_type === 'video')
  const audioStream = audioMetadata.streams.find(s => s.codec_type === 'audio')
  
  if (!videoStream) {
    throw new Error('No video stream found in input file')
  }
  if (!audioStream) {
    throw new Error('No audio stream found in censored audio file')
  }
  
  const videoCodec = videoStream.codec_name
  const canCopyVideo = videoCodec === 'h264' || videoCodec === 'avc1'
  
  // Get durations to ensure proper sync
  const videoDuration = parseFloat(videoMetadata.format.duration) || 0
  const audioDuration = parseFloat(audioMetadata.format.duration) || 0
  
  // Build FFmpeg command - audio is already AAC, so we can copy it
  const args = [
    '-i', videoPath,
    '-i', audioPath,
    '-map', '0:v:0',  // Use video from first input
    '-map', '1:a:0',  // Use audio from second input
    '-c:v', canCopyVideo ? 'copy' : 'libx264',  // Copy if H.264, else re-encode
    '-c:a', 'copy',   // Copy audio (already AAC from PCM processing)
  ]
  
  // If copying video, add Apple-compatible tag and avoid timestamp forcing
  if (canCopyVideo) {
    // Add -tag:v avc1 right after -c:v copy for Apple compatibility
    const cVideoIndex = args.indexOf('-c:v')
    args.splice(cVideoIndex + 2, 0, '-tag:v', 'avc1')
    
    // Add duration trim if needed (only if audio is shorter)
    if (audioDuration < videoDuration) {
      args.push('-t', audioDuration.toString())
    }
    
    // For copy path: NO timestamp forcing flags (removed -vsync, -fflags, -avoid_negative_ts)
    // Only add faststart for web compatibility
    args.push('-movflags', '+faststart')
  } else {
    // Re-encode path: add encoding options and CFR-safe flags
    const fps = videoStream.r_frame_rate ? 
      parseFloat(videoStream.r_frame_rate.split('/')[0]) / parseFloat(videoStream.r_frame_rate.split('/')[1]) : 
      30
    const keyint = Math.round(fps * 2)  // Keyframe every 2 seconds
    const cVideoIndex = args.indexOf('-c:v')
    
    // Insert encoding options after -c:v libx264
    args.splice(cVideoIndex + 2, 0,
      '-profile:v', 'high',
      '-level', '4.0',
      '-preset', 'medium',
      '-crf', '23',
      '-g', keyint.toString(),
      '-keyint_min', Math.round(fps).toString(),
      '-pix_fmt', 'yuv420p',
      '-sc_threshold', '0'  // Disable scene change detection for consistent keyframes
    )
    
    // Add duration trim if needed
    if (audioDuration < videoDuration) {
      args.push('-t', audioDuration.toString())
    }
    
    // For re-encode path: add CFR-safe timestamp flags
    args.push(
      '-avoid_negative_ts', 'make_zero',
      '-fflags', '+genpts',
      '-vsync', 'cfr',
      '-movflags', '+faststart'
    )
  }
  
  // Common args
  args.push('-f', 'mp4', '-y', outputPath)
  
  const commandStr = `ffmpeg ${args.join(' ')}`
  console.log(`   Command: ${commandStr}`)
  
  // Use duration from video metadata if available
  const duration = totalDuration || videoDuration || 0
  await runFFmpegCommand(args, 'Video/Audio combination', progressCallback, duration)
  
  // Wait for file to stabilize
  let previousSize = 0
  let stableCount = 0
  for (let i = 0; i < 10; i++) {
    await new Promise(resolve => setTimeout(resolve, 500))
    if (fs.existsSync(outputPath)) {
      const currentSize = fs.statSync(outputPath).size
      if (currentSize === previousSize && currentSize > 0) {
        stableCount++
        if (stableCount >= 3) break
      } else {
        stableCount = 0
      }
      previousSize = currentSize
    }
  }
  
  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
    throw new Error('Output video file was not created or is empty')
  }
}

// Final remux to ensure moov atom is at beginning (critical for web playback)
async function finalRemux(inputPath, outputPath, progressCallback = null, totalDuration = null) {
  // Use faststart to move moov atom to beginning for web streaming
  // This requires reading the entire file, so it's done as a separate step
  const args = [
    '-i', inputPath,
    '-c:v', 'copy',  // Copy video (no re-encoding)
    '-tag:v', 'avc1',  // Force avc1 tag for Apple compatibility
    '-c:a', 'copy',  // Copy audio (no re-encoding)
    '-movflags', '+faststart',  // Move moov atom to beginning
    '-f', 'mp4',
    '-y',
    outputPath
  ]
  
  const commandStr = `ffmpeg ${args.join(' ')}`
  console.log(`   Command: ${commandStr}`)
  
  await runFFmpegCommand(args, 'Final remux', progressCallback, totalDuration)
  
  // Ensure file is fully written and stable
  await ensureFileStable(outputPath, 5000)
  
  if (!fs.existsSync(outputPath)) {
    throw new Error('Final remux file was not created')
  }
  
  const stats = fs.statSync(outputPath)
  if (stats.size === 0) {
    throw new Error('Final remux file is empty')
  }
  
  // Verify remuxed file is valid
  await verifyAndLog(outputPath, 'Remuxed Output')
}
