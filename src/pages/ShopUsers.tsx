import { useEffect, useState, type FormEvent } from 'react'
import { api, type ShopRole, type ShopUser } from '../api'
import { Topbar } from '../components/Topbar'
import type { ThemePageProps } from '../types'

export const page = { id: 'shop-users' as const, label: 'User Management', icon: 'user' }

const ROLE_GROUPS: Array<{ label: string; roles: Array<[ShopRole, string]> }> = [
  { label: 'Customer-Facing', roles: [['cashier', 'Cashier'], ['sales_associate', 'Sales Associate / Retail Assistant'], ['customer_service_representative', 'Customer Service Representative']] },
  { label: 'Operations & Support', roles: [['stock_clerk', 'Stocker / Stock Clerk'], ['visual_merchandiser', 'Visual Merchandiser'], ['loss_prevention_officer', 'Loss Prevention / Security Officer']] },
  { label: 'Management', roles: [['shift_supervisor', 'Department / Shift Supervisor'], ['assistant_store_manager', 'Assistant Store Manager'], ['store_manager', 'Store Manager']] },
]

const roleLabel = (role: ShopRole) => ROLE_GROUPS.flatMap((group) => group.roles).find(([value]) => value === role)?.[1] || role

export function ShopUsers({ theme, toggleTheme }: ThemePageProps) {
  const [users, setUsers] = useState<ShopUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<ShopUser | null>(null)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState('')
  const [form, setForm] = useState({ username: '', email: '', password: '', shopRole: 'sales_associate' as ShopRole })
  const [editForm, setEditForm] = useState({ username: '', email: '', password: '', shopRole: 'sales_associate' as ShopRole })

  const loadUsers = async () => {
    try {
      setUsers(await api.shopUsers())
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load shop staff.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadUsers() }, [])

  const createUser = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      await api.createShopUser(form)
      setForm({ username: '', email: '', password: '', shopRole: 'sales_associate' })
      setIsFormOpen(false)
      await loadUsers()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create the staff account.')
    } finally {
      setSaving(false)
    }
  }

  const updateUser = async (user: ShopUser, payload: { username?: string; email?: string; password?: string; active?: boolean; shopRole?: ShopRole }) => {
    setUpdatingId(user.id)
    try {
      await api.updateShopUser(user.id, payload)
      await loadUsers()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update the staff account.')
    } finally {
      setUpdatingId('')
    }
  }

  const openEditUser = (user: ShopUser) => {
    setEditForm({ username: user.username, email: user.email, password: '', shopRole: user.shopRole })
    setEditingUser(user)
  }

  const saveEditUser = async (event: FormEvent) => {
    event.preventDefault()
    if (!editingUser) return
    setSaving(true)
    try {
      await updateUser(editingUser, editForm)
      setEditingUser(null)
    } finally {
      setSaving(false)
    }
  }

  return <>
    <Topbar title="User Management" placeholder="Search shop records..." theme={theme} toggleTheme={toggleTheme} />
    <div className="shop-users-page page-pad">
      <header className="shop-users-heading"><div><h1>Shop staff</h1><p>Create staff accounts and assign responsibilities for this shop.</p></div><button type="button" className="primary-action" onClick={() => setIsFormOpen(true)}>Add staff member</button></header>
      {error && <div className="admin-error" role="alert">{error}</div>}
      <section className="admin-activity-section">
        <div className="admin-activity-table-wrap"><table className="admin-activity-table shop-users-table"><thead><tr><th>Staff member</th><th>Role</th><th>Status</th><th>Access</th></tr></thead><tbody>
          {users.map((user) => <tr key={user.id}><td><strong>{user.username}</strong><small>{user.email}</small></td><td>{user.accountType === 'admin' ? <><span className="admin-type-label">Shop administrator</span><small>Store Manager</small></> : <><select value={user.shopRole} disabled={updatingId === user.id} onChange={(event) => void updateUser(user, { shopRole: event.target.value as ShopRole })}>{ROLE_GROUPS.map((group) => <optgroup key={group.label} label={group.label}>{group.roles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</optgroup>)}</select><small>{roleLabel(user.shopRole)}</small></>}</td><td><span className={`admin-status ${user.active ? 'positive' : 'neutral'}`}>{user.active ? 'Active' : 'Inactive'}</span></td><td>{user.accountType === 'admin' ? <span className="admin-protected">Owner account</span> : <div className="shop-user-actions"><button type="button" className="admin-user-action" onClick={() => openEditUser(user)}>Edit</button><button type="button" className="admin-user-action" disabled={updatingId === user.id} onClick={() => void updateUser(user, { active: !user.active })}>{updatingId === user.id ? 'Updating...' : user.active ? 'Deactivate' : 'Activate'}</button></div>}</td></tr>)}
          {!loading && users.length === 0 && <tr><td className="admin-empty" colSpan={4}>No staff accounts yet.</td></tr>}
          {loading && <tr><td className="admin-empty" colSpan={4}>Loading staff...</td></tr>}
        </tbody></table></div>
      </section>
    </div>
    {isFormOpen && <div className="modal-backdrop" role="presentation"><section className="entry-modal admin-user-modal" role="dialog" aria-modal="true" aria-labelledby="add-shop-user-title"><header className="detail-head"><div><h2 id="add-shop-user-title">Add staff member</h2><p>This account will only belong to your shop.</p></div><button type="button" className="modal-close" onClick={() => setIsFormOpen(false)} disabled={saving} aria-label="Close">x</button></header><form className="admin-user-form" onSubmit={createUser}><label>Name<input required value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} /></label><label>Email<input required type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></label><label>Password<input required type="password" minLength={8} value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} /></label><label>Shop role<select value={form.shopRole} onChange={(event) => setForm((current) => ({ ...current, shopRole: event.target.value as ShopRole }))}>{ROLE_GROUPS.map((group) => <optgroup key={group.label} label={group.label}>{group.roles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</optgroup>)}</select></label><footer><button type="button" onClick={() => setIsFormOpen(false)} disabled={saving}>Cancel</button><button type="submit" className="primary-action" disabled={saving}>{saving ? 'Creating...' : 'Create staff account'}</button></footer></form></section></div>}
    {editingUser && <div className="modal-backdrop" role="presentation"><section className="entry-modal admin-user-modal" role="dialog" aria-modal="true" aria-labelledby="edit-shop-user-title"><header className="detail-head"><div><h2 id="edit-shop-user-title">Edit staff member</h2><p>Leave password blank to keep the existing password.</p></div><button type="button" className="modal-close" onClick={() => setEditingUser(null)} disabled={saving} aria-label="Close">x</button></header><form className="admin-user-form" onSubmit={saveEditUser}><label>Name<input required value={editForm.username} onChange={(event) => setEditForm((current) => ({ ...current, username: event.target.value }))} /></label><label>Email<input required type="email" value={editForm.email} onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))} /></label><label>Password<input type="password" minLength={8} placeholder="Keep current password" value={editForm.password} onChange={(event) => setEditForm((current) => ({ ...current, password: event.target.value }))} /></label><label>Shop role<select value={editForm.shopRole} onChange={(event) => setEditForm((current) => ({ ...current, shopRole: event.target.value as ShopRole }))}>{ROLE_GROUPS.map((group) => <optgroup key={group.label} label={group.label}>{group.roles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</optgroup>)}</select></label><footer><button type="button" onClick={() => setEditingUser(null)} disabled={saving}>Cancel</button><button type="submit" className="primary-action" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button></footer></form></section></div>}
  </>
}
