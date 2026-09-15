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
      {/* Navigation Header */}
      <header className="landing-nav">
        <div className="landing-brand" onClick={() => setPage('landing')} style={{ cursor: 'pointer' }}>
          <div className="landing-logo-icon">▲</div>
          <div className="landing-brand-text">
            <strong>TRI LTD</strong>
            <span>Business Suite</span>
          </div>
        </div>

        <nav className="landing-nav-links">
          <a href="#features">Features</a>
          <a href="#solutions">Modules</a>
          <a href="#metrics">Performance</a>
        </nav>

        <div className="landing-nav-actions">
          <button
            type="button"
            className="landing-theme-toggle"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          {isAuthenticated ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className="landing-user-badge">👤 {user?.username}</span>
              <button
                type="button"
                className="landing-btn-primary"
                onClick={() => setPage('dashboard')}
              >
                Go to Workspace →
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
                Get Started Free →
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="landing-hero-badge">
          <span className="pulse-dot" /> Next-Gen Enterprise Stock & POS Platform
        </div>
        <h1 className="landing-hero-title">
          Smart Inventory Control, Unified Financials & Rapid POS
        </h1>
        <p className="landing-hero-sub">
          Accelerate your operational throughput with intelligent barcode scanning, comprehensive
          purchase ordering, double-entry stock movement ledgers, customer loan tracking, and real-time P&L analytics.
        </p>

        <div className="landing-hero-cta">
          {isAuthenticated ? (
            <button
              type="button"
              className="landing-btn-hero-primary"
              onClick={() => setPage('dashboard')}
            >
              Open Dashboard Workspace
            </button>
          ) : (
            <>
              <button
                type="button"
                className="landing-btn-hero-primary"
                onClick={() => setPage('register')}
              >
                Start Your Free Trial
              </button>
              <button
                type="button"
                className="landing-btn-hero-secondary"
                onClick={() => setPage('login')}
              >
                Access Account
              </button>
            </>
          )}
        </div>

        {/* Hero Visual Mockup */}
        <div className="landing-preview-card">
          <div className="preview-card-header">
            <div className="preview-card-dots">
              <span className="dot red" />
              <span className="dot yellow" />
              <span className="dot green" />
            </div>
            <span className="preview-card-title">TRI LTD ERP / Central Operations Terminal</span>
            <div className="preview-badge">Live Sync Active</div>
          </div>
          <div className="preview-card-body">
            <div className="preview-stat-row">
              <div className="preview-stat-box">
                <span className="stat-label">Active SKUs</span>
                <span className="stat-value">1,482</span>
                <span className="stat-tag positive">+14% this month</span>
              </div>
              <div className="preview-stat-box">
                <span className="stat-label">Today's Sales</span>
                <span className="stat-value">3,850,000 RWF</span>
                <span className="stat-tag positive">+22.4% vs avg</span>
              </div>
              <div className="preview-stat-box">
                <span className="stat-label">Stock Discrepancy</span>
                <span className="stat-value">0.00%</span>
                <span className="stat-tag neutral">Ledger Verified</span>
              </div>
              <div className="preview-stat-box">
                <span className="stat-label">Total Loans Tracked</span>
                <span className="stat-value">18 Active</span>
                <span className="stat-tag warning">3 Due Soon</span>
              </div>
            </div>

            <div className="preview-mock-grid">
              <div className="mock-chart-panel">
                <div className="mock-title">Revenue & Cash Flow Dynamics</div>
                <div className="mock-bars">
                  <div className="bar" style={{ height: '40%' }} />
                  <div className="bar" style={{ height: '65%' }} />
                  <div className="bar" style={{ height: '55%' }} />
                  <div className="bar" style={{ height: '80%' }} />
                  <div className="bar" style={{ height: '95%' }} />
                  <div className="bar highlight" style={{ height: '100%' }} />
                </div>
              </div>
              <div className="mock-activity-panel">
                <div className="mock-title">Recent Verified Transactions</div>
                <div className="mock-activity-item">
                  <span>🟢 Sale Completed</span>
                  <strong>#SL-2026-981</strong>
                  <span>94,500 RWF</span>
                </div>
                <div className="mock-activity-item">
                  <span>🔵 Inbound Shipment</span>
                  <strong>#PO-2026-440</strong>
                  <span>120 Units</span>
                </div>
                <div className="mock-activity-item">
                  <span>⚖️ Physical Stock Count</span>
                  <strong>SKU-IMP-09</strong>
                  <span>Count: 45</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="landing-features">
        <div className="landing-section-header">
          <span className="section-pill">Core Architecture</span>
          <h2>Everything Your Business Needs In One Place</h2>
          <p>Built for retailers, distributors, and growing enterprises demanding absolute accuracy and speed.</p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">📦</div>
            <h3>Inventory & Stock Movements</h3>
            <p>
              Complete SKU tracking, automated stock count reconciliations, low-stock alerts, and double-entry movement auditing.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🛒</div>
            <h3>Smart Purchasing & Inbound</h3>
            <p>
              Streamline supplier POs, barcode scanning at receiving, automated cost basis allocation, and status flows.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <h3>High-Speed Point of Sale</h3>
            <p>
              Lightning fast cart processing, multi-item barcode checkout, customer accounts, and receipt export.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">💳</div>
            <h3>Expense & Loan Auditing</h3>
            <p>
              Track loans given to customers or taken from lenders, record partial repayments, and audit daily operational expenses.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Financial Insights & P&L</h3>
            <p>
              Interactive margin calculators, gross profit analysis, customizable time filters, and one-click CSV export.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🔒</div>
            <h3>Bank-Grade Security</h3>
            <p>
              Bcrypt encryption, signed JWT bearer authentication, role-based controls, and fully isolated data stores.
            </p>
          </div>
        </div>
      </section>

      {/* Metrics Section */}
      <section id="metrics" className="landing-metrics">
        <div className="metric-item">
          <strong>99.9%</strong>
          <span>Inventory Accuracy</span>
        </div>
        <div className="metric-item">
          <strong>10x</strong>
          <span>Faster Stock Auditing</span>
        </div>
        <div className="metric-item">
          <strong>0.2s</strong>
          <span>POS Transaction Speed</span>
        </div>
        <div className="metric-item">
          <strong>100%</strong>
          <span>Traceable Movement Ledger</span>
        </div>
      </section>

      {/* Call To Action Banner */}
      <section className="landing-cta-banner">
        <h2>Ready to transform your business operations?</h2>
        <p>Join businesses managing their stock, orders, and finances with unmatched efficiency.</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="landing-btn-hero-primary"
            onClick={() => setPage(isAuthenticated ? 'dashboard' : 'register')}
          >
            {isAuthenticated ? 'Enter Workspace' : 'Get Started Now'}
          </button>
          {!isAuthenticated && (
            <button
              type="button"
              className="landing-btn-hero-secondary"
              onClick={() => setPage('login')}
            >
              Sign In to Existing Account
            </button>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-content">
          <div className="landing-brand">
            <div className="landing-logo-icon">▲</div>
            <div className="landing-brand-text">
              <strong>TRI LTD</strong>
              <span>Business Suite</span>
            </div>
          </div>
          <p>© {new Date().getFullYear()} TRI LTD Systems. All rights reserved. Enterprise Stock, POS & Ledger Engine.</p>
        </div>
      </footer>
    </div>
  )
}
