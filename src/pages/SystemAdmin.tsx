import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { api, type AdminOverview, type AdminUser, type CreateAdminUserPayload } from '../api'
import { Topbar } from '../components/Topbar'
import type { PageDefinition, PageRenderProps } from '../types'

export const page: Pick<PageDefinition, 'id' | 'label' | 'icon'> = {
  id: 'system-admin',
  label: 'System Admin',
  icon: 'gear',
}

export function SystemAdmin({ theme = 'dark', toggleTheme = () => undefined, page = 'system-admin', onOpenShop }: Partial<PageRenderProps>) {
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [search, setSearch] = useState('')
  const [section, setSection] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isUserFormOpen, setIsUserFormOpen] = useState(false)
  const [savingUser, setSavingUser] = useState(false)
  const [updatingUserId, setUpdatingUserId] = useState('')
  const [userForm, setUserForm] = useState<CreateAdminUserPayload>({ username: '', email: '', password: '', role: 'staff', ownerKey: '' })
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [editUserForm, setEditUserForm] = useState({ username: '', email: '', password: '', role: 'staff' as 'admin' | 'staff', ownerKey: '' })

  const loadOverview = async () => {
    try {
      const [response, platformUsers] = await Promise.all([api.adminOverview(), api.adminUsers()])
      setOverview(response)
      setUsers(platformUsers)
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load system activity.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadOverview()
    const interval = window.setInterval(() => { void loadOverview() }, 30000)
    return () => window.clearInterval(interval)
  }, [])

  const visibleActivity = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (overview?.activity || []).filter((entry) => {
      const matchesSection = section === 'ALL' || entry.section === section
      const matchesSearch = !query || [entry.type, entry.reference, entry.description, entry.actor, entry.status]
        .some((value) => value.toLowerCase().includes(query))
      return matchesSection && matchesSearch
    })
  }, [overview, search, section])

  const metrics = overview?.metrics
  const view = page === 'system-admin-shops' ? 'shops' : page === 'system-admin-users' ? 'users' : page === 'system-admin-activity' ? 'activity' : 'overview'
  const viewCopy = {
    overview: ['Platform Overview', 'Monitor the health of every shop, account, and operational record.'],
    shops: ['Shops', 'Review the shops registered on the platform and their active account totals.'],
    users: ['User Accounts', 'Review platform, shop administrator, and staff access.'],
    activity: ['Activity Log', 'Audit recent activity across every shop from one place.'],
  } as const
  const metricCards = [
    { label: 'Shops', value: metrics?.shops ?? 0, tone: 'blue' },
    { label: 'Platform users', value: metrics?.users ?? 0, tone: 'green' },
    { label: 'Active users', value: metrics?.activeUsers ?? 0, tone: 'cyan' },
    { label: 'Inventory items', value: metrics?.inventoryItems ?? 0, tone: 'cyan' },
    { label: 'Low stock', value: metrics?.lowStockCount ?? 0, tone: 'orange' },
    { label: 'Out of stock', value: metrics?.outOfStockCount ?? 0, tone: 'red' },
    { label: 'Open loans', value: metrics?.openLoans ?? 0, tone: 'violet' },
    { label: 'Open transfers', value: metrics?.openTransfers ?? 0, tone: 'teal' },
  ]

  const createUser = async (event: FormEvent) => {
    event.preventDefault()
    if (userForm.role === 'staff' && !userForm.ownerKey) {
      setError('Select a shop before creating a staff account.')
      return
    }

    setSavingUser(true)
    try {
      await api.createAdminUser(userForm)
      setUserForm({ username: '', email: '', password: '', role: 'staff', ownerKey: '' })
      setIsUserFormOpen(false)
      await loadOverview()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not create the user account.')
    } finally {
      setSavingUser(false)
    }
  }

  const toggleUserStatus = async (user: AdminUser) => {
    setUpdatingUserId(user.id)
    try {
      await api.updateAdminUser(user.id, { active: !user.active })
      await loadOverview()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update the user account.')
    } finally {
      setUpdatingUserId('')
    }
  }

  const openEditUser = (user: AdminUser) => {
    setEditUserForm({ username: user.username, email: user.email, password: '', role: user.role === 'admin' ? 'admin' : 'staff', ownerKey: user.ownerKey })
    setEditingUser(user)
  }

  const saveEditedUser = async (event: FormEvent) => {
    event.preventDefault()
    if (!editingUser) return
    if (editUserForm.role === 'staff' && !editUserForm.ownerKey) {
      setError('Select a shop before saving a staff account.')
      return
    }
    setSavingUser(true)
    try {
      await api.updateAdminUser(editingUser.id, editUserForm)
      setEditingUser(null)
      await loadOverview()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not update the user account.')
    } finally {
      setSavingUser(false)
    }
  }

  return (
    <>
      <Topbar title="System Admin" theme={theme} toggleTheme={toggleTheme} minimal />
      <div className="system-admin-page page-pad">
        <header className="system-admin-heading">
          <div>
            <h1>{viewCopy[view][0]}</h1>
            <p>{viewCopy[view][1]}</p>
          </div>
          <div className="admin-refresh-meta">
            {overview && <span>Updated {new Date(overview.generatedAt).toLocaleTimeString()}</span>}
            <button type="button" onClick={() => { setLoading(true); void loadOverview() }} disabled={loading} aria-label="Refresh system activity">
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </header>

        {error && <div className="admin-error" role="alert">{error}</div>}

        {view === 'overview' && <section className="admin-metric-grid" aria-label="System overview">
          {metricCards.map((metric) => (
            <article key={metric.label} className={`admin-metric ${metric.tone}`}>
              <span>{metric.label}</span>
              <strong>{metric.value.toLocaleString()}</strong>
            </article>
          ))}
        </section>}

        {view === 'shops' && <section className="admin-activity-section">
          <header className="admin-activity-heading"><div><h2>Registered shops</h2><p>Each shop is owned by its shop administrator.</p></div></header>
          <div className="admin-activity-table-wrap"><table className="admin-activity-table">
            <thead><tr><th>Shop</th><th>Administrator email</th><th>Users</th><th>Status</th></tr></thead>
            <tbody>{(overview?.shops || []).map((shop) => <tr key={shop.ownerKey} className="admin-shop-row" onClick={() => onOpenShop?.(shop.ownerKey, shop.name)}><td><button type="button" className="admin-shop-link">{shop.name}</button></td><td>{shop.email}</td><td>{shop.userCount}</td><td><span className={`admin-status ${shop.active ? 'positive' : 'neutral'}`}>{shop.active ? 'Active' : 'Inactive'}</span></td></tr>)}
              {!loading && overview?.shops.length === 0 && <tr><td className="admin-empty" colSpan={4}>No shops found.</td></tr>}
            </tbody>
          </table></div>
        </section>}

        {view === 'users' && <section className="admin-activity-section">
          <header className="admin-activity-heading"><div><h2>Platform users</h2><p>System administrators are kept separate from shop accounts.</p></div><button type="button" className="admin-user-create" onClick={() => setIsUserFormOpen(true)}>Add user</button></header>
          <div className="admin-activity-table-wrap"><table className="admin-activity-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Shop</th><th>Status</th><th>Access</th></tr></thead>
            <tbody>{users.map((user) => <tr key={user.id}><td>{user.username}</td><td>{user.email}</td><td><span className="admin-type-label">{formatRole(user.role)}</span></td><td>{user.shopName}</td><td><span className={`admin-status ${user.active ? 'positive' : 'neutral'}`}>{user.active ? 'Active' : 'Inactive'}</span></td><td>{user.role === 'system_admin' ? <span className="admin-protected">Protected</span> : <div className="shop-user-actions"><button type="button" className="admin-user-action" onClick={() => openEditUser(user)}>Edit</button><button type="button" className="admin-user-action" disabled={updatingUserId === user.id} onClick={() => void toggleUserStatus(user)}>{updatingUserId === user.id ? 'Updating...' : user.active ? 'Deactivate' : 'Activate'}</button></div>}</td></tr>)}
              {!loading && users.length === 0 && <tr><td className="admin-empty" colSpan={6}>No user accounts found.</td></tr>}
            </tbody>
          </table></div>
        </section>}

        {(view === 'overview' || view === 'activity') && <section className="admin-activity-section">
          <header className="admin-activity-heading">
            <div>
              <h2>Recent activity</h2>
              <p>Latest sales, purchases, expenses, stock movements, loans, and partner transfers.</p>
            </div>
            <div className="admin-activity-filters">
              <label>Area
                <select value={section} onChange={(event) => setSection(event.target.value)}>
                  <option value="ALL">All areas</option>
                  <option value="sales">Sales</option>
                  <option value="purchases">Purchases</option>
                  <option value="expenses">Expenses</option>
                  <option value="inventory">Inventory</option>
                  <option value="stock-movements">Stock movements</option>
                  <option value="loans">Loans</option>
                  <option value="transfers">Transfers</option>
                </select>
              </label>
              <label>Find
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Reference, actor, item..." />
              </label>
            </div>
          </header>
          <div className="admin-activity-table-wrap">
            <table className="admin-activity-table">
              <thead><tr><th>Time</th><th>Area / Type</th><th>Reference</th><th>Activity</th><th>Status</th><th>Recorded by</th><th>Shop</th></tr></thead>
              <tbody>
                {visibleActivity.map((entry) => (
                  <tr key={`${entry.type}-${entry.id}`}>
                    <td>{formatDate(entry.date)}</td>
                    <td><span className="admin-type-label">{entry.type}</span></td>
                    <td>{entry.reference || '—'}</td>
                    <td>{entry.description}{entry.amount ? <strong className="admin-activity-amount">{entry.amount}</strong> : null}</td>
                    <td><span className={`admin-status ${statusTone(entry.status)}`}>{entry.status}</span></td>
                    <td>{entry.actor}</td>
                    <td>{entry.shopName}</td>
                  </tr>
                ))}
                {!loading && visibleActivity.length === 0 && (
                  <tr><td className="admin-empty" colSpan={7}>No matching activity records.</td></tr>
                )}
                {loading && <tr><td className="admin-empty" colSpan={7}>Loading activity…</td></tr>}
              </tbody>
            </table>
          </div>
        </section>}
      </div>
      {isUserFormOpen && <div className="modal-backdrop" role="presentation">
        <section className="entry-modal admin-user-modal" role="dialog" aria-modal="true" aria-labelledby="create-user-title">
          <header className="detail-head"><div><h2 id="create-user-title">Add user account</h2><p>Create a shop administrator or assign staff to a shop.</p></div><button type="button" className="modal-close" onClick={() => setIsUserFormOpen(false)} disabled={savingUser} aria-label="Close">x</button></header>
          <form className="admin-user-form" onSubmit={createUser}>
            <label>Name<input required value={userForm.username} onChange={(event) => setUserForm((current) => ({ ...current, username: event.target.value }))} /></label>
            <label>Email<input required type="email" value={userForm.email} onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))} /></label>
            <label>Password<input required type="password" minLength={8} value={userForm.password} onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))} /></label>
            <label>Role<select value={userForm.role} onChange={(event) => setUserForm((current) => ({ ...current, role: event.target.value as CreateAdminUserPayload['role'], ownerKey: event.target.value === 'admin' ? '' : current.ownerKey }))}><option value="staff">Staff</option><option value="admin">Shop administrator</option></select></label>
            {userForm.role === 'staff' && <label className="admin-user-form-wide">Shop<select required value={userForm.ownerKey} onChange={(event) => setUserForm((current) => ({ ...current, ownerKey: event.target.value }))}><option value="">Select a shop</option>{(overview?.shops || []).filter((shop) => shop.active).map((shop) => <option key={shop.ownerKey} value={shop.ownerKey}>{shop.name}</option>)}</select></label>}
            <footer><button type="button" onClick={() => setIsUserFormOpen(false)} disabled={savingUser}>Cancel</button><button type="submit" className="primary-action" disabled={savingUser}>{savingUser ? 'Creating...' : 'Create user'}</button></footer>
          </form>
        </section>
      </div>}
      {editingUser && <div className="modal-backdrop" role="presentation">
        <section className="entry-modal admin-user-modal" role="dialog" aria-modal="true" aria-labelledby="edit-platform-user-title">
          <header className="detail-head"><div><h2 id="edit-platform-user-title">Edit user account</h2><p>Leave password blank to keep the existing password.</p></div><button type="button" className="modal-close" onClick={() => setEditingUser(null)} disabled={savingUser} aria-label="Close">x</button></header>
          <form className="admin-user-form" onSubmit={saveEditedUser}>
            <label>Name<input required value={editUserForm.username} onChange={(event) => setEditUserForm((current) => ({ ...current, username: event.target.value }))} /></label>
            <label>Email<input required type="email" value={editUserForm.email} onChange={(event) => setEditUserForm((current) => ({ ...current, email: event.target.value }))} /></label>
            <label>Password<input type="password" minLength={8} placeholder="Keep current password" value={editUserForm.password} onChange={(event) => setEditUserForm((current) => ({ ...current, password: event.target.value }))} /></label>
            <label>Role<select value={editUserForm.role} onChange={(event) => setEditUserForm((current) => ({ ...current, role: event.target.value as 'admin' | 'staff', ownerKey: event.target.value === 'admin' ? '' : current.ownerKey }))}><option value="staff">Staff</option><option value="admin">Shop administrator</option></select></label>
            {editUserForm.role === 'staff' && <label className="admin-user-form-wide">Shop<select required value={editUserForm.ownerKey} onChange={(event) => setEditUserForm((current) => ({ ...current, ownerKey: event.target.value }))}><option value="">Select a shop</option>{(overview?.shops || []).filter((shop) => shop.active).map((shop) => <option key={shop.ownerKey} value={shop.ownerKey}>{shop.name}</option>)}</select></label>}
            <footer><button type="button" onClick={() => setEditingUser(null)} disabled={savingUser}>Cancel</button><button type="submit" className="primary-action" disabled={savingUser}>{savingUser ? 'Saving...' : 'Save changes'}</button></footer>
          </form>
        </section>
      </div>}
    </>
  )
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function statusTone(status: string) {
  const value = status.toLowerCase()
  if (['completed', 'received', 'paid', 'closed', 'recorded'].includes(value)) return 'positive'
  if (['pending', 'active', 'open', 'given', 'overdue'].includes(value)) return 'warning'
  if (['returned', 'cancelled', 'defaulted'].includes(value)) return 'neutral'
  return 'neutral'
}

function formatRole(role: string) {
  return String(role).replace(/[_-]+/g, ' ')
}
