import './ResultVideo.css'

function ResultVideo({ videoUrl, onReset }) {
  // Handle both string (legacy) and object (new) formats
  const displayUrl = typeof videoUrl === 'object' ? videoUrl.videoUrl : videoUrl
  const providedDownloadUrl = typeof videoUrl === 'object' ? videoUrl.downloadUrl : null
  
  const handleDownload = async () => {
    try {
      // Use provided downloadUrl if available, otherwise construct it
      let downloadUrl = providedDownloadUrl
      
      if (!downloadUrl) {
        // Extract filename from videoUrl
        if (displayUrl.includes('/output/')) {
          const filename = displayUrl.split('/output/')[1].split('?')[0]
          downloadUrl = `/api/video/${filename}`
        } else if (displayUrl.includes('/api/video/')) {
          downloadUrl = displayUrl
        } else {
          // Try to extract filename from any URL format
          const urlParts = displayUrl.split('/')
          const filename = urlParts[urlParts.length - 1].split('?')[0]
          downloadUrl = `/api/video/${filename}`
        }
      }
      
      console.log('Downloading from:', downloadUrl)
      
      // Try direct download first (simpler, more reliable)
      // If the video is already loaded in the browser, we can use it directly
      const videoElement = document.querySelector('.video-player')
      if (videoElement && videoElement.src) {
        try {
          // Try to use the video element's source directly
          const link = document.createElement('a')
          link.href = videoElement.src
          link.download = downloadUrl.split('/').pop() || 'censored-video.mp4'
          link.target = '_blank'
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          return
        } catch (e) {
          console.log('Direct download failed, trying fetch...', e)
        }
      }
      
      // Fetch the video file as a blob with validation
      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          'Accept': 'video/mp4'
        }
      })
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`)
      }
      
      // Validate content-type and content-length BEFORE reading the blob
      const contentType = response.headers.get('content-type') || ''
      const contentLength = Number(response.headers.get('content-length') || '0')
      
      // If we got HTML, we're hitting Vite or an error page
      if (!contentType.includes('video/mp4') || contentLength < 100_000) {
        const text = await response.text()
        throw new Error(
          `Not an MP4 file. Content-Type: ${contentType}, Length: ${contentLength} bytes.\n` +
          `Response starts: ${text.slice(0, 200)}`
        )
      }
      
      const blob = await response.blob()
      
      // Verify blob is not empty
      if (blob.size === 0) {
        throw new Error('Downloaded file is empty')
      }
      
      // Additional validation: check blob type
      if (!blob.type.includes('video/mp4') && blob.type !== '') {
        console.warn(`Warning: Blob type is ${blob.type}, expected video/mp4`)
      }
      
      console.log(`Downloaded ${(blob.size / (1024 * 1024)).toFixed(2)}MB (Content-Type: ${contentType})`)
      
      const url = window.URL.createObjectURL(blob)
      
      // Extract filename from download URL or use default
      const filename = downloadUrl.split('/').pop() || 'censored-video.mp4'
      
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      
      // Cleanup
      setTimeout(() => {
        window.URL.revokeObjectURL(url)
        document.body.removeChild(link)
      }, 100)
    } catch (error) {
      console.error('Download error:', error)
      const errorMsg = error.message || 'Unknown error'
      
      // Provide helpful error message
      if (errorMsg.includes('Not an MP4')) {
        alert(
          `Download Error: Received HTML instead of MP4 file.\n\n` +
          `This usually means:\n` +
          `1. The Vite proxy is not configured correctly\n` +
          `2. The server is not running on port 3001\n\n` +
          `Error details: ${errorMsg}\n\n` +
          `Try: Right-click the video player and select "Save video as..."`
        )
      } else {
        alert(`Failed to download video: ${errorMsg}\n\nTry right-clicking the video player and selecting "Save video as..."`)
      }
    }
  }

  return (
    <div className="result-video">
      <h2>Video Censored Successfully</h2>
      <div className="video-container">
        <video controls src={displayUrl} className="video-player">
          Your browser does not support the video tag.
        </video>
      </div>
      <div className="action-buttons">
        <button onClick={handleDownload} className="download-button">
          Download Video
        </button>
        <button onClick={onReset} className="reset-button">
          Process Another Video
        </button>
      </div>
    </div>
  )
}

export default ResultVideo

