import { spawn } from 'child_process'
import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Audio format constants
const SAMPLE_RATE = 44100
const CHANNELS = 1 // Mono
const SAMPLE_FORMAT = 's16le' // Signed 16-bit little-endian
const BYTES_PER_SAMPLE = 2 // 16-bit = 2 bytes
const SAMPLES_PER_SECOND = SAMPLE_RATE * CHANNELS
const BYTES_PER_SECOND = SAMPLES_PER_SECOND * BYTES_PER_SAMPLE

/**
 * Sanitize intervals: merge overlaps, clamp min duration 80ms, keep within file duration
 */
function sanitizeIntervals(intervals, duration) {
  if (!intervals || intervals.length === 0) {
    return []
  }

  // Sort by start time
  const sorted = [...intervals].sort((a, b) => a.start - b.start)

  // Merge overlapping intervals (only if they're close together, within 0.5s)
  const merged = []
  const MAX_MERGE_GAP = 0.5 // Only merge if intervals are within 0.5 seconds
  
  for (const current of sorted) {
    const last = merged[merged.length - 1]
    // Only merge if intervals overlap OR are very close together (within MAX_MERGE_GAP)
    if (last && current.start <= last.end + MAX_MERGE_GAP) {
      // Merge overlapping or nearby intervals
      last.end = Math.max(last.end, current.end)
      if (current.word) {
        last.word = last.word ? `${last.word} ${current.word}` : current.word
      }
    } else {
      merged.push({ ...current })
    }
  }

  // Clamp to file duration and enforce minimum duration
  const MIN_DURATION = 0.08 // 80ms
  const MAX_DURATION = 5.0 // Maximum 5 seconds per interval (prevents runaway intervals)
  const sanitized = []
  
  for (const interval of merged) {
    // Clamp start to [0, duration)
    const start = Math.max(0, Math.min(interval.start, duration - MIN_DURATION))
    // Clamp end to (start + MIN_DURATION, duration]
    let end = Math.min(duration, Math.max(start + MIN_DURATION, interval.end))
    
    // Enforce maximum duration per interval (prevent runaway intervals)
    const maxAllowedEnd = Math.min(duration, start + MAX_DURATION)
    if (end > maxAllowedEnd) {
      console.log(`   ⚠️  Interval "${interval.word}" was ${(end - start).toFixed(2)}s, clamped to ${MAX_DURATION}s`)
      end = maxAllowedEnd
    }

    // Only add if valid after clamping
    if (end > start && end <= duration && (end - start) <= MAX_DURATION) {
      sanitized.push({
        start,
        end,
        word: interval.word
      })
    } else {
      console.log(`   ⚠️  Skipping invalid interval: "${interval.word}" [${start.toFixed(2)}s - ${end.toFixed(2)}s]`)
    }
  }

  return sanitized
}

/**
 * Generate beep tone PCM samples
 * @param {number} durationSeconds - Duration in seconds
 * @param {number} frequency - Frequency in Hz (default 800)
 * @returns {Buffer} PCM samples
 */
function generateBeepPCM(durationSeconds, frequency = 800) {
  const numSamples = Math.floor(SAMPLE_RATE * durationSeconds)
  const buffer = Buffer.allocUnsafe(numSamples * BYTES_PER_SAMPLE)
  
  // Generate sine wave
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE
    const sample = Math.sin(2 * Math.PI * frequency * t)
    // Convert to 16-bit signed integer
    const int16Sample = Math.round(sample * 32767)
    // Write as little-endian
    buffer.writeInt16LE(int16Sample, i * BYTES_PER_SAMPLE)
  }
  
  return buffer
}

/**
 * Apply edits to PCM buffer: mute segments and optionally add beep tones
 * @param {Buffer} pcmBuffer - Raw PCM samples
 * @param {Array} intervals - Array of {start, end, word} intervals to mute
 * @param {boolean} addBeep - Whether to add beep tones during muted segments
 * @returns {Buffer} Edited PCM buffer
 */
function applyPCMEdits(pcmBuffer, intervals, addBeep = true) {
  // Create a copy to avoid mutating original
  const edited = Buffer.from(pcmBuffer)
  const totalDuration = pcmBuffer.length / BYTES_PER_SECOND
  
  console.log(`   Total PCM buffer duration: ${totalDuration.toFixed(3)}s (${pcmBuffer.length} bytes)`)
  
  for (let i = 0; i < intervals.length; i++) {
    const interval = intervals[i]
    const intervalDuration = interval.end - interval.start
    
    // Calculate sample positions (must align to sample boundaries)
    const startSample = Math.floor(interval.start * SAMPLE_RATE)
    const endSample = Math.floor(interval.end * SAMPLE_RATE)
    
    // Convert to byte positions (aligned to sample boundaries)
    const startByte = startSample * BYTES_PER_SAMPLE
    const endByte = endSample * BYTES_PER_SAMPLE
    
    // Ensure we don't go beyond buffer bounds and align to sample boundaries
    const actualStartByte = Math.max(0, Math.min(startByte, edited.length - (edited.length % BYTES_PER_SAMPLE)))
    const actualEndByte = Math.max(actualStartByte, Math.min(endByte, edited.length - (edited.length % BYTES_PER_SAMPLE)))
    const actualDuration = (actualEndByte - actualStartByte) / BYTES_PER_SECOND
    
    console.log(`   Processing interval ${i + 1}: "${interval.word}"`)
    console.log(`     Requested: [${interval.start.toFixed(3)}s - ${interval.end.toFixed(3)}s] (${intervalDuration.toFixed(3)}s)`)
    console.log(`     Actual: [${(actualStartByte / BYTES_PER_SECOND).toFixed(3)}s - ${(actualEndByte / BYTES_PER_SECOND).toFixed(3)}s] (${actualDuration.toFixed(3)}s)`)
    console.log(`     Bytes: [${actualStartByte} - ${actualEndByte}] (${actualEndByte - actualStartByte} bytes)`)
    
    if (addBeep && actualDuration > 0) {
      // Generate beep for EXACTLY the interval duration (not longer)
      const beepPCM = generateBeepPCM(actualDuration)
      const beepLength = Math.min(beepPCM.length, actualEndByte - actualStartByte)
      
      // Ensure beep length is aligned to sample boundaries and doesn't exceed the interval
      const alignedBeepLength = Math.floor(beepLength / BYTES_PER_SAMPLE) * BYTES_PER_SAMPLE
      const maxBeepLength = actualEndByte - actualStartByte
      const finalBeepLength = Math.min(alignedBeepLength, maxBeepLength)
      
      console.log(`     Generating beep: ${actualDuration.toFixed(3)}s (${finalBeepLength} bytes)`)
      
      // Overwrite with beep (only for the exact interval length)
      if (finalBeepLength > 0) {
        beepPCM.copy(edited, actualStartByte, 0, finalBeepLength)
      }
      // Zero out any remaining samples in the interval (should be none, but safety check)
      if (actualStartByte + finalBeepLength < actualEndByte) {
        edited.fill(0, actualStartByte + finalBeepLength, actualEndByte)
      }
    } else {
      // Just mute (zero out samples)
      edited.fill(0, actualStartByte, actualEndByte)
    }
  }
  
  return edited
}

/**
 * Decode audio file to raw PCM using ffmpeg pipe
 * @param {string} inputPath - Input audio file path
 * @returns {Promise<{buffer: Buffer, duration: number}>}
 */
async function decodeToPCM(inputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-i', inputPath,
      '-f', SAMPLE_FORMAT,
      '-ar', SAMPLE_RATE.toString(),
      '-ac', CHANNELS.toString(),
      '-' // Output to stdout
    ]

    const ffmpegProcess = spawn('ffmpeg', args, {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    const chunks = []
    let stderr = ''

    ffmpegProcess.stdout.on('data', (chunk) => {
      chunks.push(chunk)
    })

    ffmpegProcess.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    ffmpegProcess.on('close', (code) => {
      if (code !== 0) {
        const errorMatch = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/)
        if (!errorMatch) {
          reject(new Error(`FFmpeg decode failed with code ${code}: ${stderr.substring(0, 500)}`))
          return
        }
      }

      const buffer = Buffer.concat(chunks)
      
      // Extract duration from stderr
      const durationMatch = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/)
      let duration = 0
      if (durationMatch) {
        const hours = parseInt(durationMatch[1], 10)
        const minutes = parseInt(durationMatch[2], 10)
        const seconds = parseInt(durationMatch[3], 10)
        const centiseconds = parseInt(durationMatch[4], 10)
        duration = hours * 3600 + minutes * 60 + seconds + centiseconds / 100
      } else {
        // Fallback: calculate from buffer size
        duration = buffer.length / BYTES_PER_SECOND
      }

      resolve({ buffer, duration })
    })

    ffmpegProcess.on('error', (err) => {
      reject(new Error(`Failed to start FFmpeg: ${err.message}`))
    })
  })
}

/**
 * Encode PCM buffer to AAC (m4a) using ffmpeg pipe
 * @param {Buffer} pcmBuffer - Raw PCM samples
 * @param {string} outputPath - Output file path
 * @returns {Promise<void>}
 */
async function encodePCMToAAC(pcmBuffer, outputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-f', SAMPLE_FORMAT,
      '-ar', SAMPLE_RATE.toString(),
      '-ac', CHANNELS.toString(),
      '-i', '-', // Read from stdin
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ar', SAMPLE_RATE.toString(),
      '-ac', CHANNELS.toString(),
      '-y',
      outputPath
    ]

    const ffmpegProcess = spawn('ffmpeg', args, {
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let stderr = ''

    // Write PCM data to stdin
    ffmpegProcess.stdin.write(pcmBuffer)
    ffmpegProcess.stdin.end()

    ffmpegProcess.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    ffmpegProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`FFmpeg encode failed with code ${code}: ${stderr.substring(0, 500)}`))
        return
      }

      if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
        reject(new Error('Encoded audio file was not created or is empty'))
        return
      }

      resolve()
    })

    ffmpegProcess.on('error', (err) => {
      reject(new Error(`Failed to start FFmpeg: ${err.message}`))
    })
  })
}

/**
 * Validate audio file using ffprobe and ffmpeg decode test
 * @param {string} filePath - Path to audio file
 * @returns {Promise<object>} Metadata from ffprobe
 */
async function validateAudioFile(filePath) {
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

  // Second, run ffmpeg decode test
  const decodeTestArgs = [
    '-v', 'error',
    '-i', filePath,
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

  return metadata
}

/**
 * Main function: Process audio with profanity edits using PCM-based approach
 * @param {string} audioPath - Input audio file path
 * @param {string} outputPath - Output audio file path
 * @param {Array} swearWordTimestamps - Array of {start, end, word} intervals
 * @param {boolean} addBeep - Whether to add beep tones (default: true)
 */
export async function addBleepSounds(audioPath, outputPath, swearWordTimestamps, addBeep = true) {
  console.log(`🎵 Processing audio with PCM-based editing for ${swearWordTimestamps.length} swear words...`)

  if (swearWordTimestamps.length === 0) {
    // No swear words, just copy the original audio
    console.log('   No swear words found, copying original audio')
    fs.copyFileSync(audioPath, outputPath)
    return
  }

  try {
    // Step 1: Decode audio to PCM
    console.log('   Step 1: Decoding audio to PCM...')
    const { buffer: pcmBuffer, duration } = await decodeToPCM(audioPath)
    console.log(`   Decoded ${(pcmBuffer.length / 1024 / 1024).toFixed(2)}MB PCM data, duration: ${duration.toFixed(2)}s`)

    // Step 2: Sanitize intervals
    console.log('   Step 2: Sanitizing intervals...')
    console.log(`   Original intervals: ${swearWordTimestamps.map(i => `${i.word} [${i.start.toFixed(2)}s-${i.end.toFixed(2)}s]`).join(', ')}`)
    const sanitizedIntervals = sanitizeIntervals(swearWordTimestamps, duration)
    console.log(`   Sanitized ${swearWordTimestamps.length} intervals to ${sanitizedIntervals.length} valid intervals`)
    sanitizedIntervals.forEach((interval, idx) => {
      console.log(`   Interval ${idx + 1}: "${interval.word}" [${interval.start.toFixed(3)}s - ${interval.end.toFixed(3)}s] (duration: ${(interval.end - interval.start).toFixed(3)}s)`)
    })

    if (sanitizedIntervals.length === 0) {
      console.log('   No valid intervals after sanitization, copying original audio')
      fs.copyFileSync(audioPath, outputPath)
      return
    }

    // Step 3: Apply edits to PCM samples
    console.log('   Step 3: Applying edits to PCM samples...')
    const editedPCM = applyPCMEdits(pcmBuffer, sanitizedIntervals, addBeep)
    console.log(`   Applied edits to ${sanitizedIntervals.length} intervals`)

    // Step 4: Encode edited PCM to AAC
    console.log('   Step 4: Encoding edited PCM to AAC...')
    await encodePCMToAAC(editedPCM, outputPath)
    console.log(`   Encoded to AAC: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`)

    // Step 5: Validate output
    console.log('   Step 5: Validating output...')
    const metadata = await validateAudioFile(outputPath)
    const audioStream = metadata.streams?.find(s => s.codec_type === 'audio')
    if (!audioStream) {
      throw new Error('No audio stream found in output file')
    }
    console.log(`   ✅ Validation passed: ${audioStream.codec_name}, ${audioStream.sample_rate}Hz, ${audioStream.channels}ch`)

    console.log(`✅ Audio processing complete: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`)
  } catch (error) {
    console.error(`❌ Audio processing failed: ${error.message}`)
    throw error
  }
}
