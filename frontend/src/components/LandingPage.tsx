import React, { useState } from 'react';

interface LandingPageProps {
  onOpenChat: () => void;
}

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: "How do I book an appointment?",
    answer: "Simply click the chat button and tell our AI assistant you'd like to book. You can also say 'book appointment' or 'schedule a visit'. The assistant will guide you through selecting a service, choosing your preferred staff member, and picking a convenient time."
  },
  {
    question: "Can I choose my preferred therapist?",
    answer: "Absolutely! During the booking process, you'll see a list of available staff members. You can select your preferred therapist or choose 'No preference' if you're flexible."
  },
  {
    question: "What if I need to reschedule or cancel?",
    answer: "We require 24 hours notice for cancellations. You can manage your booking through the chat assistant or by calling us directly. Late cancellations may incur a 50% fee."
  },
  {
    question: "Is the AI available 24/7?",
    answer: "Yes! Our AI receptionist is available around the clock to answer questions and help you book appointments. Bookings are confirmed instantly for available time slots."
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major credit cards, debit cards, cash, and digital payments including Apple Pay and Google Pay. Payment is collected at the time of your appointment."
  }
];

const FAQAccordion: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="faq-list">
      {faqs.map((faq, index) => (
        <div
          key={index}
          className={`faq-item ${openIndex === index ? 'open' : ''}`}
          onClick={() => setOpenIndex(openIndex === index ? null : index)}
        >
          <div className="faq-question">
            <span>{faq.question}</span>
            <svg
              className="faq-icon"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points={openIndex === index ? "18 15 12 9 6 15" : "6 9 12 15 18 9"}></polyline>
            </svg>
          </div>
          <div className="faq-answer">
            <p>{faq.answer}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

const LandingPage: React.FC<LandingPageProps> = ({ onOpenChat }) => {
  return (
    <div className="landing-page">
      {/* Navigation */}
      <nav className="landing-nav">
        <div className="nav-container">
          <div className="logo">
            <div className="logo-icon-wrapper">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
            <span className="logo-text">Serenity Wellness</span>
          </div>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#faq">FAQ</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#/admin" className="nav-btn-outline">Admin</a>
            <button className="nav-btn-primary" onClick={onOpenChat}>
              Start Chat
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="hero-section">
        <div className="hero-bg-gradient"></div>
        <div className="hero-container">
          <div className="hero-content">
            <div className="hero-badge">
              <span className="badge-dot"></span>
              AI-Powered Support
            </div>
            <h1>
              Your Personal<br />
              <span className="gradient-text">Wellness Concierge</span>
            </h1>
            <p>
              Meet Sarah, your 24/7 AI assistant. Book appointments, get answers,
              and discover our services - all through a natural conversation.
            </p>
            <div className="hero-buttons">
              <button className="btn-primary-large" onClick={onOpenChat}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                Chat with Sarah
              </button>
              <a href="#features" className="btn-secondary-large">
                Explore Features
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 17l9.2-9.2M17 17V7H7"/>
                </svg>
              </a>
            </div>
            <div className="hero-stats">
              <div className="stat-item">
                <span className="stat-number">24/7</span>
                <span className="stat-label">Availability</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-number">&lt;3s</span>
                <span className="stat-label">Response Time</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-number">100%</span>
                <span className="stat-label">Satisfaction</span>
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="phone-mockup">
              <div className="phone-notch"></div>
              <div className="chat-demo">
                <div className="chat-demo-header">
                  <div className="demo-avatar">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <div>
                    <div className="demo-name">Sarah</div>
                    <div className="demo-status">
                      <span className="status-dot-green"></span>
                      Online now
                    </div>
                  </div>
                </div>
                <div className="chat-demo-body">
                  <div className="demo-msg bot">
                    Hello! Welcome to Serenity Wellness. I'm Sarah, your virtual concierge. How can I help you today?
                  </div>
                  <div className="demo-msg user">
                    I'd like to book a massage
                  </div>
                  <div className="demo-msg bot">
                    I'd be happy to help you book a massage! We offer Swedish Relaxation and Deep Tissue options. Which sounds better for you?
                  </div>
                  <div className="demo-typing">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              </div>
            </div>
            <div className="floating-card card-1">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#667eea" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
              </svg>
              <span>Instant Booking</span>
            </div>
            <div className="floating-card card-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <span>Confirmed!</span>
            </div>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section id="features" className="features-section">
        <div className="section-container">
          <div className="section-header">
            <span className="section-tag">Features</span>
            <h2>Everything You Need</h2>
            <p>Powerful AI-driven features for seamless customer experience</p>
          </div>

          <div className="features-grid">
            <div className="feature-card featured">
              <div className="feature-icon-large">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
              </div>
              <h3>Natural Conversations</h3>
              <p>Chat naturally like you would with a real receptionist. Our AI understands context and provides helpful, accurate responses.</p>
              <div className="feature-tag">AI Powered</div>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
              </div>
              <h3>Smart Booking</h3>
              <p>Book appointments 24/7 with real-time availability and instant confirmations.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
              <h3>Staff Selection</h3>
              <p>Choose your preferred therapist when booking your appointment.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
              </div>
              <h3>Email Confirmations</h3>
              <p>Receive instant confirmation emails with all your booking details.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              </div>
              <h3>Business Hours</h3>
              <p>Automatic handling of open hours, holidays, and special schedules.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="20" x2="18" y2="10"></line>
                  <line x1="12" y1="20" x2="12" y2="4"></line>
                  <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
              </div>
              <h3>Admin Dashboard</h3>
              <p>Full control panel to manage bookings, staff, and analytics.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="faq-section">
        <div className="section-container">
          <div className="faq-layout">
            <div className="faq-header">
              <span className="section-tag">FAQ</span>
              <h2>Common Questions</h2>
              <p>Quick answers to help you get started</p>
              <button className="btn-primary" onClick={onOpenChat}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                Ask Sarah Instead
              </button>
            </div>
            <FAQAccordion />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="how-section">
        <div className="section-container">
          <div className="section-header">
            <span className="section-tag">Process</span>
            <h2>How It Works</h2>
            <p>Get started in three simple steps</p>
          </div>

          <div className="steps-container">
            <div className="step-card">
              <div className="step-number">1</div>
              <div className="step-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
              </div>
              <h3>Start a Conversation</h3>
              <p>Click the chat button and say hello. Ask about services, availability, or start booking.</p>
            </div>

            <div className="step-connector">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </div>

            <div className="step-card">
              <div className="step-number">2</div>
              <div className="step-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                </svg>
              </div>
              <h3>Choose & Book</h3>
              <p>Select your service, preferred staff, and pick a time that works for you.</p>
            </div>

            <div className="step-connector">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </div>

            <div className="step-card">
              <div className="step-number">3</div>
              <div className="step-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </div>
              <h3>Get Confirmed</h3>
              <p>Receive instant confirmation in chat and via email. You're all set!</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-container">
          <div className="cta-content">
            <h2>Ready to Experience<br />Effortless Booking?</h2>
            <p>Start a conversation with Sarah and see how easy it can be.</p>
            <button className="btn-white-large" onClick={onOpenChat}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              Start Chatting Now
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-container">
          <div className="footer-brand">
            <div className="logo">
              <div className="logo-icon-wrapper">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
              </div>
              <span>Serenity Wellness</span>
            </div>
            <p>AI-powered virtual receptionist for modern businesses.</p>
          </div>
          <div className="footer-links">
            <a href="#features">Features</a>
            <a href="#faq">FAQ</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#/admin">Admin Dashboard</a>
          </div>
          <div className="footer-bottom">
            <p>Demo Project - Built with React, Node.js, Socket.IO & Groq AI</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
