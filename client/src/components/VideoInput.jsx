import { useState } from 'react'
import './VideoInput.css'

function VideoInput({ onProcess, isAuthenticated, onAuthRequired }) {
  const [inputType, setInputType] = useState('file')
  const [file, setFile] = useState(null)
  const [youtubeUrl, setYoutubeUrl] = useState('')

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile && selectedFile.type.startsWith('video/')) {
      setFile(selectedFile)
    } else {
      alert('Please select a valid video file')
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    
    // Check authentication first
    if (!isAuthenticated) {
      onAuthRequired()
      return
    }
    
    if (inputType === 'file' && !file) {
      alert('Please select a video file')
      return
    }
    
    if (inputType === 'youtube' && !youtubeUrl.trim()) {
      alert('Please enter a YouTube URL')
      return
    }

    if (inputType === 'youtube') {
      // Basic YouTube URL validation
      const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/
      if (!youtubeRegex.test(youtubeUrl)) {
        alert('Please enter a valid YouTube URL')
        return
      }
    }

    onProcess(inputType, inputType === 'file' ? file : youtubeUrl)
  }

  return (
    <div className="video-input">
      <div className="input-type-selector">
        <button
          className={`type-button ${inputType === 'file' ? 'active' : ''}`}
          onClick={() => {
            setInputType('file')
            setFile(null)
            setYoutubeUrl('')
          }}
        >
          Upload MP4
        </button>
        <button
          className={`type-button ${inputType === 'youtube' ? 'active' : ''}`}
          onClick={() => {
            setInputType('youtube')
            setFile(null)
            setYoutubeUrl('')
          }}
        >
          YouTube Link
        </button>
      </div>

      <form onSubmit={handleSubmit} className="input-form">
        {inputType === 'file' ? (
          <div className="file-input-wrapper">
            <label htmlFor="video-file" className="file-label">
              {file ? file.name : 'Choose Video File'}
            </label>
            <input
              id="video-file"
              type="file"
              accept="video/mp4,video/*"
              onChange={handleFileChange}
              className="file-input"
            />
            {file && (
              <div className="file-info">
                <p>Selected: {file.name}</p>
                <p>Size: {(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            )}
          </div>
        ) : (
          <div className="youtube-input-wrapper">
            <input
              type="text"
              placeholder="Paste YouTube URL here (e.g., https://www.youtube.com/watch?v=...)"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              className="youtube-input"
            />
            <div className="youtube-note">
              <p>Note: YouTube downloads may fail due to frequent API changes. If it fails, download the video manually and use MP4 upload instead.</p>
            </div>
          </div>
        )}

        <button type="submit" className="submit-button">
          Censor Video
        </button>
      </form>
    </div>
  )
}

export default VideoInput

