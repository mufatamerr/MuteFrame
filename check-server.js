#!/usr/bin/env node

// Quick diagnostic script to check server setup

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log('🔍 Checking server setup...\n')

// Check 1: Node version
const nodeVersion = process.version
console.log(`✅ Node.js version: ${nodeVersion}`)

// Check 2: Server directory exists
const serverDir = path.join(__dirname, 'server')
if (fs.existsSync(serverDir)) {
  console.log('✅ Server directory exists')
} else {
  console.log('❌ Server directory not found')
  process.exit(1)
}

// Check 3: Server files exist
const serverFile = path.join(serverDir, 'server.js')
if (fs.existsSync(serverFile)) {
  console.log('✅ server.js exists')
} else {
  console.log('❌ server.js not found')
  process.exit(1)
}

// Check 4: node_modules
const nodeModules = path.join(serverDir, 'node_modules')
if (fs.existsSync(nodeModules)) {
  console.log('✅ node_modules exists')
} else {
  console.log('❌ node_modules not found - run: cd server && npm install')
  process.exit(1)
}

// Check 5: .env file
const envFile = path.join(serverDir, '.env')
if (fs.existsSync(envFile)) {
  console.log('✅ .env file exists')
  const envContent = fs.readFileSync(envFile, 'utf8')
  if (envContent.includes('OPENAI_API_KEY=your_openai_api_key_here')) {
    console.log('⚠️  .env file has placeholder API key - update it with your real key')
  } else if (envContent.includes('OPENAI_API_KEY=')) {
    const apiKey = envContent.match(/OPENAI_API_KEY=(.+)/)?.[1]?.trim()
    if (apiKey && apiKey.length > 20) {
      console.log('✅ OpenAI API key appears to be configured')
    } else {
      console.log('⚠️  OpenAI API key seems invalid or too short')
    }
  }
} else {
  console.log('❌ .env file not found')
  console.log('   Create it with: echo "OPENAI_API_KEY=your_key_here\nPORT=3001" > server/.env')
}

// Check 6: FFmpeg (basic check)
import { execSync } from 'child_process'
try {
  const ffmpegVersion = execSync('ffmpeg -version', { encoding: 'utf8', stdio: 'pipe' })
  if (ffmpegVersion.includes('ffmpeg version')) {
    console.log('✅ FFmpeg is installed')
  }
} catch (e) {
  console.log('⚠️  FFmpeg not found in PATH - video processing will fail')
  console.log('   Install with: brew install ffmpeg (macOS)')
}

console.log('\n✨ Setup check complete!')
console.log('\nTo start the server:')
console.log('  npm run dev')
console.log('  or')
console.log('  cd server && npm run dev')

