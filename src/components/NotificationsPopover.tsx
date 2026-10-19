import { useEffect, useRef, useState } from 'react'
import { api, type DashboardResponse } from '../api'
import { GLOBAL_SEARCH_NAVIGATION_EVENT, type Page } from '../types'
import { useAuth } from '../context/AuthContext'

export type NotificationCategory = 'inventory' | 'sales' | 'loans' | 'transfers' | 'users' | 'production' | 'system'
export type NotificationSeverity = 'critical' | 'warning' | 'info' | 'success'

export type AppNotification = {
  id: string
  title: string
  message: string
  category: NotificationCategory
  severity: NotificationSeverity
  timestamp: Date
  read: boolean
  targetPage?: Page
  actionLabel?: string
}

const STORAGE_READ_KEY = 'tri_read_notifications_v1'
const STORAGE_DISMISSED_KEY = 'tri_dismissed_notifications_v1'

const CATEGORY_META: Record<NotificationCategory, { icon: string; label: string; color: string }> = {
  inventory: { icon: '📦', label: 'Inventory', color: '#f59e0b' },
  sales: { icon: '🏷️', label: 'Sales', color: '#10b981' },
  loans: { icon: '💳', label: 'Loans & Debt', color: '#ef4444' },
  transfers: { icon: '🔁', label: 'Transfers', color: '#06b6d4' },
  users: { icon: '👥', label: 'Team', color: '#8b5cf6' },
  production: { icon: '🏭', label: 'Production', color: '#3b82f6' },
  system: { icon: '⚙️', label: 'System', color: '#6366f1' },
}

export function NotificationsPopover() {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'alerts'>('all')
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_READ_KEY)
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch {
      return new Set()
    }
  })
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_DISMISSED_KEY)
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch {
      return new Set()
    }
  })

  const popoverRef = useRef<HTMLDivElement>(null)

  // Close when clicking outside
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isOpen])

  // Save read & dismissed IDs to localStorage
  const markAsRead = (id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev).add(id)
      localStorage.setItem(STORAGE_READ_KEY, JSON.stringify([...next]))
      return next
    })
    void api.markNotificationRead(id).catch(() => undefined)
  }

  const markAllAsRead = () => {
    const allIds = notifications.map((n) => n.id)
    setReadIds((prev) => {
      const next = new Set([...prev, ...allIds])
      localStorage.setItem(STORAGE_READ_KEY, JSON.stringify([...next]))
      return next
    })
    void api.markAllNotificationsRead().catch(() => undefined)
  }

  const dismissNotification = (id: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev).add(id)
      localStorage.setItem(STORAGE_DISMISSED_KEY, JSON.stringify([...next]))
      return next
    })
  }

  const clearAllNotifications = () => {
    const allIds = notifications.map((n) => n.id)
    setDismissedIds((prev) => {
      const next = new Set([...prev, ...allIds])
      localStorage.setItem(STORAGE_DISMISSED_KEY, JSON.stringify([...next]))
      return next
    })
  }

  // Load live system alerts and notifications
  useEffect(() => {
    let active = true

    const loadAlerts = async () => {
      const generated: AppNotification[] = []
      const now = new Date()

      try {
        // 0. Check Backend Notifications (worker pipeline activities, email alerts log)
        const backendRes = await api.notifications().catch(() => null)
        if (backendRes?.notifications && backendRes.notifications.length > 0) {
          backendRes.notifications.forEach((item) => {
            generated.push({
              id: item._id,
              title: item.title,
              message: item.message,
              category: item.category || 'production',
              severity: item.severity || 'info',
              timestamp: new Date(item.createdAt),
              read: item.read,
              targetPage: item.targetPage,
              actionLabel: item.actionLabel || 'View Pipeline',
            })
          })
        }

        // 1. Check Dashboard for low stock alerts
        const dashData: DashboardResponse = await api.dashboard().catch(() => ({
          categories: [],
          metrics: [],
          salesBars: [],
          salesLabels: [],
          lowStock: [],
          catalog: [],
        }))

        if (dashData.lowStock && dashData.lowStock.length > 0) {
          dashData.lowStock.forEach((item) => {
            const isOut = item.status.toLowerCase().includes('out')
            generated.push({
              id: `stock-${item.sku}`,
              title: isOut ? `Out of Stock: ${item.name}` : `Low Stock Warning: ${item.name}`,
              message: `${item.name} (${item.sku}) is currently ${item.status.toLowerCase()}. Urgent replenishment advised.`,
              category: 'inventory',
              severity: isOut ? 'critical' : 'warning',
              timestamp: new Date(now.getTime() - 1000 * 60 * 15),
              read: false,
              targetPage: 'inventory',
              actionLabel: 'Check Products',
            })
          })
        }

        // 2. Check Loans
        const loansData = await api.loans().catch(() => null)
        if (loansData?.rows && loansData.rows.length > 0) {
          const activeLoans = loansData.rows.filter((l) => (l.remainingBalance || 0) > 0)
          if (activeLoans.length > 0) {
            generated.push({
              id: 'active-loans-summary',
              title: `${activeLoans.length} Active Loan${activeLoans.length > 1 ? 's' : ''} Outstanding`,
              message: `There are currently ${activeLoans.length} open loan contracts with outstanding balances to monitor.`,
              category: 'loans',
              severity: 'warning',
              timestamp: new Date(now.getTime() - 1000 * 60 * 60),
              read: false,
              targetPage: 'loans',
              actionLabel: 'View Loans',
            })
          }
        }

        // 3. Check Pending Transfers
        const transfersData = await api.partnerTransfers('PENDING').catch(() => null)
        if (transfersData?.rows && transfersData.rows.length > 0) {
          generated.push({
            id: 'pending-transfers-alert',
            title: `${transfersData.rows.length} Partner Transfer${transfersData.rows.length > 1 ? 's' : ''} Pending`,
            message: 'You have incoming or outgoing stock transfers awaiting approval or dispatch.',
            category: 'transfers',
            severity: 'info',
            timestamp: new Date(now.getTime() - 1000 * 60 * 120),
            read: false,
            targetPage: 'transfers',
            actionLabel: 'Review Transfers',
          })
        }

        // 4. Team notification
        generated.push({
          id: 'team-worker-mgmt-ready',
          title: 'Worker Management Active',
          message: 'You can create worker accounts across operational departments and configure roles in User Management.',
          category: 'users',
          severity: 'info',
          timestamp: new Date(now.getTime() - 1000 * 60 * 300),
          read: false,
          targetPage: 'shop-users',
          actionLabel: 'Manage Workers',
        })

        // 5. System operational status
        generated.push({
          id: 'system-online-notice',
          title: 'Business Suite Online',
          message: `Connected as ${user?.username || 'Admin'} (${user?.role || 'Staff'}). Data synchronization is active.`,
          category: 'system',
          severity: 'success',
          timestamp: new Date(now.getTime() - 1000 * 60 * 720),
          read: false,
          targetPage: 'dashboard',
          actionLabel: 'Dashboard',
        })

        if (active) {
          setNotifications(generated)
        }
      } catch {
        // Fallback
      }
    }

    void loadAlerts()
    const interval = setInterval(loadAlerts, 60000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [user])

  // Filter out dismissed
  const visibleNotifications = notifications
    .filter((n) => !dismissedIds.has(n.id))
    .map((n) => ({
      ...n,
      read: n.read || readIds.has(n.id),
    }))

  const unreadCount = visibleNotifications.filter((n) => !n.read).length
  const alertCount = visibleNotifications.filter((n) => n.severity === 'critical' || n.severity === 'warning').length

  const filteredItems = visibleNotifications.filter((item) => {
    if (activeTab === 'unread') return !item.read
    if (activeTab === 'alerts') return item.severity === 'critical' || item.severity === 'warning'
    return true
  })

  const handleAction = (item: AppNotification) => {
    markAsRead(item.id)
    setIsOpen(false)
    if (item.targetPage) {
      window.dispatchEvent(new CustomEvent(GLOBAL_SEARCH_NAVIGATION_EVENT, { detail: { page: item.targetPage } }))
    }
  }

  const formatRelativeTime = (date: Date) => {
    const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000)
    if (diffSeconds < 60) return 'Just now'
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`
    return `${Math.floor(diffSeconds / 86400)}d ago`
  }

  return (
    <div className="notifications-widget" ref={popoverRef} style={{ position: 'relative' }}>
      {/* Trigger Bell Button */}
      <button
        type="button"
        className={`icon-button notifications-bell-btn ${unreadCount > 0 ? 'has-unread' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Notifications (${unreadCount} unread)`}
        title="Notifications"
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          border: '1px solid var(--line, rgba(255,255,255,0.12))',
          background: isOpen ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
          color: unreadCount > 0 ? 'var(--text-strong, #fff)' : 'var(--text-soft, #94a3b8)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-3px',
              right: '-3px',
              minWidth: '18px',
              height: '18px',
              padding: '0 4px',
              borderRadius: '9px',
              background: '#ef4444',
              color: '#fff',
              fontSize: '11px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 8px rgba(239,68,68,0.7)',
              border: '2px solid var(--surface, #0f172a)',
              lineHeight: 1,
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            width: '380px',
            maxWidth: 'calc(100vw - 28px)',
            background: 'var(--surface, #1e293b)',
            backdropFilter: 'blur(20px)',
            border: '1px solid var(--line, rgba(255,255,255,0.12))',
            borderRadius: '16px',
            boxShadow: '0 20px 40px -10px rgba(0,0,0,0.6), 0 0 1px 1px rgba(255,255,255,0.06)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'fadeInSlide 0.18s ease-out',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px 18px 12px',
              borderBottom: '1px solid var(--line, rgba(255,255,255,0.08))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Notifications</h3>
              {unreadCount > 0 && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: 'rgba(239,68,68,0.15)',
                    color: '#f87171',
                    border: '1px solid rgba(239,68,68,0.3)',
                  }}
                >
                  {unreadCount} new
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '12px',
                    color: 'var(--accent, #6366f1)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    padding: '2px 4px',
                  }}
                >
                  Mark all read
                </button>
              )}
              {visibleNotifications.length > 0 && (
                <button
                  type="button"
                  onClick={clearAllNotifications}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '12px',
                    color: 'var(--text-soft, #94a3b8)',
                    cursor: 'pointer',
                    padding: '2px 4px',
                  }}
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* Filter Tabs */}
          <div
            style={{
              display: 'flex',
              padding: '6px 14px',
              background: 'rgba(0,0,0,0.15)',
              borderBottom: '1px solid var(--line, rgba(255,255,255,0.06))',
              gap: '6px',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              style={{
                flex: 1,
                padding: '5px 8px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '12px',
                fontWeight: activeTab === 'all' ? 600 : 400,
                background: activeTab === 'all' ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: activeTab === 'all' ? '#fff' : 'var(--text-soft, #94a3b8)',
                cursor: 'pointer',
              }}
            >
              All ({visibleNotifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('unread')}
              style={{
                flex: 1,
                padding: '5px 8px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '12px',
                fontWeight: activeTab === 'unread' ? 600 : 400,
                background: activeTab === 'unread' ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: activeTab === 'unread' ? '#fff' : 'var(--text-soft, #94a3b8)',
                cursor: 'pointer',
              }}
            >
              Unread ({unreadCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('alerts')}
              style={{
                flex: 1,
                padding: '5px 8px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '12px',
                fontWeight: activeTab === 'alerts' ? 600 : 400,
                background: activeTab === 'alerts' ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: activeTab === 'alerts' ? '#fff' : 'var(--text-soft, #94a3b8)',
                cursor: 'pointer',
              }}
            >
              Alerts ({alertCount})
            </button>
          </div>

          {/* Notifications List */}
          <div
            style={{
              maxHeight: '380px',
              overflowY: 'auto',
              padding: '4px 0',
            }}
          >
            {filteredItems.length === 0 ? (
              <div
                style={{
                  padding: '36px 20px',
                  textAlign: 'center',
                  color: 'var(--text-soft, #94a3b8)',
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎉</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-strong, #fff)' }}>
                  All caught up!
                </div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>
                  {activeTab === 'unread'
                    ? 'No unread notifications.'
                    : activeTab === 'alerts'
                    ? 'No critical alerts or warnings.'
                    : 'No notifications at this time.'}
                </div>
              </div>
            ) : (
              filteredItems.map((item) => {
                const category = CATEGORY_META[item.category] || CATEGORY_META.system
                return (
                  <div
                    key={item.id}
                    style={{
                      padding: '12px 18px',
                      borderBottom: '1px solid var(--line, rgba(255,255,255,0.05))',
                      background: item.read ? 'transparent' : 'rgba(99,102,241,0.04)',
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'flex-start',
                      transition: 'background 0.15s ease',
                      position: 'relative',
                    }}
                  >
                    {/* Severity colored icon badge */}
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '10px',
                        flexShrink: 0,
                        background:
                          item.severity === 'critical'
                            ? 'rgba(239,68,68,0.16)'
                            : item.severity === 'warning'
                            ? 'rgba(245,158,11,0.16)'
                            : item.severity === 'success'
                            ? 'rgba(16,185,129,0.16)'
                            : 'rgba(99,102,241,0.16)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '15px',
                        border: `1px solid ${
                          item.severity === 'critical'
                            ? 'rgba(239,68,68,0.3)'
                            : item.severity === 'warning'
                            ? 'rgba(245,158,11,0.3)'
                            : item.severity === 'success'
                            ? 'rgba(16,185,129,0.3)'
                            : 'rgba(99,102,241,0.3)'
                        }`,
                      }}
                    >
                      {category.icon}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '6px',
                          marginBottom: '3px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: category.color,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {category.label}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-soft, #94a3b8)' }}>
                          {formatRelativeTime(item.timestamp)}
                        </span>
                      </div>

                      <strong
                        style={{
                          display: 'block',
                          fontSize: '13px',
                          fontWeight: item.read ? 600 : 700,
                          color: item.read ? 'var(--text-soft, #cbd5e1)' : 'var(--text-strong, #fff)',
                          marginBottom: '3px',
                        }}
                      >
                        {item.title}
                      </strong>

                      <p
                        style={{
                          margin: 0,
                          fontSize: '12px',
                          color: 'var(--text-soft, #94a3b8)',
                          lineHeight: 1.4,
                        }}
                      >
                        {item.message}
                      </p>

                      {/* Action & Dismiss bar */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: '8px',
                          gap: '8px',
                        }}
                      >
                        {item.actionLabel && (
                          <button
                            type="button"
                            onClick={() => handleAction(item)}
                            style={{
                              background: 'rgba(255,255,255,0.06)',
                              border: '1px solid var(--line, rgba(255,255,255,0.1))',
                              borderRadius: '6px',
                              padding: '4px 9px',
                              fontSize: '11px',
                              fontWeight: 600,
                              color: 'var(--accent, #a5b4fc)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            {item.actionLabel} →
                          </button>
                        )}

                        <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                          {!item.read && (
                            <button
                              type="button"
                              onClick={() => markAsRead(item.id)}
                              title="Mark as read"
                              style={{
                                background: 'none',
                                border: 'none',
                                fontSize: '11px',
                                color: 'var(--text-soft, #94a3b8)',
                                cursor: 'pointer',
                                padding: '2px 4px',
                              }}
                            >
                              Mark read
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => dismissNotification(item.id)}
                            title="Dismiss notification"
                            style={{
                              background: 'none',
                              border: 'none',
                              fontSize: '14px',
                              color: 'var(--text-soft, #94a3b8)',
                              cursor: 'pointer',
                              padding: '0 4px',
                              lineHeight: 1,
                            }}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Unread indicator dot */}
                    {!item.read && (
                      <span
                        style={{
                          position: 'absolute',
                          top: '12px',
                          left: '6px',
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: '#6366f1',
                          boxShadow: '0 0 6px #6366f1',
                        }}
                      />
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
