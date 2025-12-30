import './ProcessingStatus.css'

function ProcessingStatus({ progress, status }) {
  return (
    <div className="processing-status">
      <div className="spinner"></div>
      <h2>Processing Video...</h2>
      <p className="status-text">{status}</p>
      <div className="progress-bar-wrapper">
        <div className="progress-bar" style={{ width: `${progress}%` }}></div>
      </div>
      <p className="progress-text">{Math.round(progress)}%</p>
    </div>
  )
}

export default ProcessingStatus

