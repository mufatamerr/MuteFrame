import OpenAI from 'openai'
import fs from 'fs-extra'
import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Initialize OpenAI client if API key is available
let openai = null
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  })
}

export async function transcribeAudio(audioPath) {
  try {
    // Try OpenAI Whisper API first
    if (openai) {
      return await transcribeWithOpenAI(audioPath)
    } else {
      // Fallback: Use a simple approach or throw error
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY in your .env file.')
    }
  } catch (error) {
    throw new Error(`Transcription failed: ${error.message}`)
  }
}

async function transcribeWithOpenAI(audioPath) {
  try {
    // Check file size - OpenAI has a 25MB limit
    const stats = fs.statSync(audioPath)
    const fileSizeMB = stats.size / (1024 * 1024)
    const maxSizeMB = 25
    
    let finalAudioPath = audioPath
    
    // If file is too large, compress it
    if (stats.size > maxSizeMB * 1024 * 1024) {
      console.log(`   Audio file is ${fileSizeMB.toFixed(2)}MB, compressing for OpenAI...`)
      const compressedPath = audioPath.replace('.wav', '_compressed.wav')
      
      await new Promise((resolve, reject) => {
        ffmpeg(audioPath)
          .output(compressedPath)
          .audioCodec('pcm_s16le')
          .audioFrequency(16000) // 16kHz is sufficient for speech
          .audioChannels(1) // Mono to reduce size
          .audioBitrate('64k') // Lower bitrate for compression
          .on('end', () => {
            const compressedStats = fs.statSync(compressedPath)
            const compressedSizeMB = compressedStats.size / (1024 * 1024)
            console.log(`   Compressed to ${compressedSizeMB.toFixed(2)}MB`)
            
            // If still too large, try even more aggressive compression
            if (compressedStats.size > maxSizeMB * 1024 * 1024) {
              console.log(`   Still too large, applying aggressive compression...`)
              const moreCompressedPath = audioPath.replace('.wav', '_more_compressed.wav')
              
              ffmpeg(audioPath)
                .output(moreCompressedPath)
                .audioCodec('pcm_s16le')
                .audioFrequency(8000) // Very low sample rate
                .audioChannels(1) // Mono
                .on('end', () => {
                  const finalStats = fs.statSync(moreCompressedPath)
                  const finalSizeMB = finalStats.size / (1024 * 1024)
                  console.log(`   Aggressively compressed to ${finalSizeMB.toFixed(2)}MB`)
                  
                  if (finalStats.size > maxSizeMB * 1024 * 1024) {
                    reject(new Error(`Audio file is too large (${finalSizeMB.toFixed(2)}MB) even after compression. Maximum size is ${maxSizeMB}MB. Please use a shorter video or split it into parts.`))
                  } else {
                    finalAudioPath = moreCompressedPath
                    // Clean up intermediate file
                    if (fs.existsSync(compressedPath)) {
                      try {
                        fs.unlinkSync(compressedPath)
                      } catch (err) {
                        // Ignore cleanup errors
                      }
                    }
                    resolve()
                  }
                })
                .on('error', reject)
                .run()
            } else {
              finalAudioPath = compressedPath
              resolve()
            }
          })
          .on('error', reject)
          .run()
      })
    }
    
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(finalAudioPath),
      model: 'whisper-1',
      response_format: 'verbose_json', // Get timestamps
      timestamp_granularities: ['word'] // Get word-level timestamps
    })
    
    // Clean up compressed file if it was created
    if (finalAudioPath !== audioPath && fs.existsSync(finalAudioPath)) {
      try {
        fs.unlinkSync(finalAudioPath)
      } catch (err) {
        // Ignore cleanup errors
      }
    }

    // Extract word-level timestamps
    if (transcription.words && transcription.words.length > 0) {
      return transcription.words.map(word => ({
        word: word.word.toLowerCase(),
        start: word.start,
        end: word.end
      }))
    }

    // Fallback to segment-level if word-level not available
    if (transcription.segments && transcription.segments.length > 0) {
      return transcription.segments.map(segment => ({
        word: segment.text.toLowerCase(),
        start: segment.start,
        end: segment.end
      }))
    }

    // Last resort: return full text with estimated timestamps
    const fullText = transcription.text || ''
    const words = fullText.toLowerCase().split(/\s+/)
    const duration = await getAudioDuration(audioPath)
    const avgWordDuration = duration / words.length

    return words.map((word, index) => ({
      word: word.replace(/[^\w]/g, ''), // Remove punctuation
      start: index * avgWordDuration,
      end: (index + 1) * avgWordDuration
    }))
  } catch (error) {
    throw new Error(`OpenAI transcription failed: ${error.message}`)
  }
}

async function getAudioDuration(audioPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (err, metadata) => {
      if (err) {
        reject(err)
      } else {
        resolve(metadata.format.duration || 0)
      }
    })
  })
}

