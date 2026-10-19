import type { Page, Theme } from '../types'
import { useAuth } from '../context/AuthContext'

type LandingProps = {
  theme: Theme
  toggleTheme: () => void
  setPage: (page: Page) => void
}

export function Landing({ theme, toggleTheme, setPage }: LandingProps) {
  const { isAuthenticated, user, logout } = useAuth()

  return (
    <div className={`landing-root ${theme}`}>
      <header className="landing-nav">
        <button type="button" className="landing-brand" onClick={() => setPage('landing')}>
          <div className="landing-logo-icon">T</div>
          <div className="landing-brand-text">
            <strong>TRI LTD</strong>
            <span>Stock &amp; business management</span>
          </div>
        </button>

        <nav className="landing-nav-links">
          <a href="#features">What you can do</a>
          <a href="#overview">Overview</a>
        </nav>

        <div className="landing-nav-actions">
          <button
            type="button"
            className="landing-theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>

          {isAuthenticated ? (
            <div className="landing-nav-account">
              <span className="landing-user-badge">{user?.username}</span>
              <button
                type="button"
                className="landing-btn-primary"
                onClick={() => setPage('dashboard')}
              >
                Open workspace
              </button>
              <button
                type="button"
                className="landing-btn-ghost"
                onClick={logout}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="landing-nav-account">
              <button
                type="button"
                className="landing-btn-ghost"
                onClick={() => setPage('login')}
              >
                Sign In
              </button>
              <button
                type="button"
                className="landing-btn-primary"
                onClick={() => setPage('register')}
              >
                Create account
              </button>
            </div>
          )}
        </div>
      </header>

      <section className="landing-hero">
        <p className="landing-hero-eyebrow">For shops of every kind</p>
        <h1 className="landing-hero-title">
          Run your shop with stock, sales and finances in step.
        </h1>
        <p className="landing-hero-sub">
          Manage inventory, purchases, sales and everyday expenses in one place. See what is moving,
          what needs attention and how your business is doing.
        </p>

        <div className="landing-hero-cta">
          {isAuthenticated ? (
            <button
              type="button"
              className="landing-btn-hero-primary"
              onClick={() => setPage('dashboard')}
            >
              Open workspace
            </button>
          ) : (
            <>
              <button
                type="button"
                className="landing-btn-hero-primary"
                onClick={() => setPage('register')}
              >
                Create an account
              </button>
              <button
                type="button"
                className="landing-btn-hero-secondary"
                onClick={() => setPage('login')}
              >
                Sign in
              </button>
            </>
          )}
        </div>

        <div id="overview" className="landing-preview-card">
          <div className="preview-card-header">
            <div>
              <span className="preview-card-kicker">Example workspace</span>
              <strong className="preview-card-title">Business overview</strong>
            </div>
            <span className="preview-badge">Today</span>
          </div>
          <div className="preview-card-body">
            <div className="preview-stat-row">
              <div className="preview-stat-box">
                <span className="stat-label">Items in stock</span>
                <span className="stat-value">1,482</span>
                <span className="stat-tag">Across your products</span>
              </div>
              <div className="preview-stat-box">
                <span className="stat-label">Sales today</span>
                <span className="stat-value">3,850,000 RWF</span>
                <span className="stat-tag">Recorded at the counter</span>
              </div>
              <div className="preview-stat-box">
                <span className="stat-label">Purchases</span>
                <span className="stat-value">12 orders</span>
                <span className="stat-tag">Being received</span>
              </div>
              <div className="preview-stat-box">
                <span className="stat-label">Customer balances</span>
                <span className="stat-value">18 accounts</span>
                <span className="stat-tag">Open balances</span>
              </div>
            </div>

            <div className="preview-mock-grid">
              <div className="mock-chart-panel">
                <div className="mock-title">Sales over the past six days</div>
                <div className="mock-bars">
                  <div className="bar" style={{ height: '40%' }}><span>Mon</span></div>
                  <div className="bar" style={{ height: '65%' }}><span>Tue</span></div>
                  <div className="bar" style={{ height: '55%' }}><span>Wed</span></div>
                  <div className="bar" style={{ height: '80%' }}><span>Thu</span></div>
                  <div className="bar" style={{ height: '95%' }}><span>Fri</span></div>
                  <div className="bar highlight" style={{ height: '100%' }}><span>Sat</span></div>
                </div>
              </div>
              <div className="mock-activity-panel">
                <div className="mock-title">Recent activity</div>
                <div className="mock-activity-item">
                  <span>Sale recorded</span>
                  <strong>RWF 94,500</strong>
                </div>
                <div className="mock-activity-item">
                  <span>Stock received</span>
                  <strong>120 items</strong>
                </div>
                <div className="mock-activity-item">
                  <span>Stock count updated</span>
                  <strong>45 items</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-shop-types" aria-label="Types of shops">
        <p>One workspace for your kind of shop</p>
        <ul>
          <li>Grocery stores</li>
          <li>Cafés</li>
          <li>Bakeries</li>
          <li>Electronics</li>
          <li>Clothing</li>
          <li>And more</li>
        </ul>
      </section>

      <section id="features" className="landing-features">
        <div className="landing-section-header">
          <p className="landing-section-eyebrow">The essentials, connected</p>
          <h2>Made for the work behind every sale.</h2>
          <p>Keep day-to-day records together, from the first purchase to the end-of-day report.</p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">01</div>
            <h3>Inventory</h3>
            <p>
              Keep product details, stock levels and movements up to date across your business.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">02</div>
            <h3>Purchases</h3>
            <p>
              Record supplier orders and track deliveries as stock arrives.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">03</div>
            <h3>Sales</h3>
            <p>
              Make sales, issue receipts and keep customer accounts in one place.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">04</div>
            <h3>Expenses &amp; balances</h3>
            <p>
              Track everyday costs, customer balances and repayments as they happen.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">05</div>
            <h3>Reports</h3>
            <p>
              Review sales, stock and financial activity with reports you can export.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">06</div>
            <h3>Team access</h3>
            <p>
              Set up staff accounts and control which parts of the workspace they can use.
            </p>
          </div>
        </div>
      </section>

      <section className="landing-cta-banner">
        <div>
          <h2>Bring your daily records together.</h2>
          <p>Get started with TRI LTD or sign in to continue where you left off.</p>
        </div>
        <div className="landing-cta-actions">
          <button
            type="button"
            className="landing-btn-hero-primary"
            onClick={() => setPage(isAuthenticated ? 'dashboard' : 'register')}
          >
            {isAuthenticated ? 'Open workspace' : 'Create an account'}
          </button>
          {!isAuthenticated && (
            <button
              type="button"
              className="landing-btn-hero-secondary"
              onClick={() => setPage('login')}
            >
              Sign in
            </button>
          )}
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-content">
          <div className="landing-brand">
            <div className="landing-logo-icon">T</div>
            <div className="landing-brand-text">
              <strong>TRI LTD</strong>
              <span>Stock &amp; business management</span>
            </div>
          </div>
          <p>© {new Date().getFullYear()} TRI LTD</p>
        </div>
      </footer>
    </div>
  )
}
