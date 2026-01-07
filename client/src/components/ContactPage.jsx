import './ContactPage.css'

function ContactPage() {
  return (
    <div className="contact-page">
      <div className="contact-header">
        <h1>Contact</h1>
        <p>Have questions, feedback, or need support? Get in touch.</p>
      </div>

      <div className="contact-main">
        <div className="contact-card-large">
          <div className="contact-icon-large">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 6L12 13L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2>Email</h2>
          <a href="mailto:mufaworks@gmail.com" className="contact-link-large">
            mufaworks@gmail.com
          </a>
          <p className="contact-description-large">
            Send an email for inquiries, support, or feedback. I'll get back to you as soon as possible.
          </p>
          <a href="mailto:mufaworks@gmail.com" className="contact-button">
            Send Email
          </a>
        </div>

        <div className="contact-info-grid">
          <div className="info-item">
            <div className="info-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="info-content">
              <h3>Response Time</h3>
              <p>Usually within 24 hours</p>
            </div>
          </div>

          <div className="info-item">
            <div className="info-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 10C21 17 12 23 12 23C12 23 3 17 3 10C3 7.61305 3.94821 5.32387 5.63604 3.63604C7.32387 1.94821 9.61305 1 12 1C14.3869 1 16.6761 1.94821 18.364 3.63604C20.0518 5.32387 21 7.61305 21 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="info-content">
              <h3>Support</h3>
              <p>Available for all users</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ContactPage

