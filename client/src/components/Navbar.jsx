import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useSubscription } from '../contexts/SubscriptionContext'
import './Navbar.css'

function Navbar() {
  const { currentUser, logout } = useAuth()
  const { tokensRemaining, subscriptionTier } = useSubscription()
  const location = useLocation()

  return (
    <nav className="navbar">
      <div className="navbar-content">
        <Link to="/" className="navbar-logo">
          <h2>Video Censor</h2>
        </Link>
        
        <div className="navbar-links">
          <Link 
            to="/" 
            className={`navbar-link ${location.pathname === '/' ? 'active' : ''}`}
          >
            Home
          </Link>
          <Link 
            to="/plan" 
            className={`navbar-link ${location.pathname === '/plan' ? 'active' : ''}`}
          >
            Plan
          </Link>
          
          {currentUser && (
            <div className="navbar-user-info">
              <span className="token-info">
                {tokensRemaining} tokens ({subscriptionTier})
              </span>
              <button onClick={logout} className="logout-button">
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}

export default Navbar

