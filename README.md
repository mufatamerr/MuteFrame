# YouTube/MP4 Video Censor

A React application that censors swear words in videos by adding bleep sound effects. Supports both MP4 file uploads and YouTube links.

## Features

- 📁 Upload MP4 files or provide YouTube links
- 🎤 Automatic speech-to-text transcription using OpenAI Whisper
- 🔍 Swear word detection with comprehensive word list
- 🔊 Bleep sound effects over censored words
- 📥 Download censored video
- 📊 Real-time processing progress updates

## Prerequisites

- **Node.js 18+** - [Download here](https://nodejs.org/)
- **FFmpeg** - Required for video/audio processing
  - macOS: `brew install ffmpeg`
  - Linux: `sudo apt-get install ffmpeg` or `sudo yum install ffmpeg`
  - Windows: Download from [ffmpeg.org](https://ffmpeg.org/download.html)
- **OpenAI API Key** - For speech-to-text transcription
  - Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)

## Setup

1. **Clone or navigate to the project directory:**
```bash
cd yt_censor
```

2. **Install all dependencies:**
```bash
npm run install-all
```

3. **Set up environment variables:**
   - Copy `server/.env.example` to `server/.env`
   - Add your OpenAI API key:
```bash
cp server/.env.example server/.env
```

   Then edit `server/.env` and add:
```
OPENAI_API_KEY=your_openai_api_key_here
PORT=3001
```

4. **Start the development servers:**
```bash
npm run dev
```

This will start both the frontend and backend servers:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

## Usage

1. Open your browser and go to `http://localhost:5173`
2. Choose to either:
   - Upload an MP4 file, or
   - Paste a YouTube URL
3. Click "🎬 Censor Video"
4. Wait for processing (you'll see real-time progress)
5. Download your censored video when complete!

## How It Works

1. **Video Input**: Accepts MP4 files or downloads from YouTube
2. **Audio Extraction**: Extracts audio track from video
3. **Transcription**: Uses OpenAI Whisper to transcribe audio with word-level timestamps
4. **Swear Detection**: Matches transcribed words against comprehensive swear word list
5. **Bleep Generation**: Creates 1000Hz sine wave bleep sounds
6. **Audio Overlay**: Overlays bleep sounds at swear word timestamps
7. **Video Rendering**: Combines censored audio with original video

## Project Structure

```
yt_censor/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── App.jsx        # Main app component
│   │   └── main.jsx       # Entry point
│   └── package.json
├── server/                 # Express backend
│   ├── services/
│   │   ├── videoProcessor.js      # Main video processing logic
│   │   ├── transcription.js       # OpenAI Whisper integration
│   │   ├── swearWordDetector.js   # Swear word detection
│   │   ├── audioProcessor.js      # Bleep sound generation & overlay
│   │   └── youtubeDownloader.js   # YouTube video download
│   ├── server.js          # Express server
│   └── package.json
└── package.json           # Root package.json
```

## Troubleshooting

### FFmpeg not found
- Make sure FFmpeg is installed and available in your PATH
- Test with: `ffmpeg -version`

### OpenAI API errors
- Verify your API key is correct in `server/.env`
- Check your OpenAI account has credits available
- Ensure the API key has access to Whisper model

### YouTube download fails
- Some videos may be restricted or unavailable
- Try a different video or use an MP4 file instead

### Processing takes too long
- Large videos take longer to process
- Transcription is the slowest step (depends on video length)
- Consider processing shorter clips for testing

## License

MIT

