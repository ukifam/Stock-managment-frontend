import { useEffect, useState, type FormEvent } from 'react'
import { api, type AccessRole, type ShopRole, type ShopUser } from '../api'
import { Topbar } from '../components/Topbar'
import type { PageRenderProps, ThemePageProps } from '../types'
import { useAuth } from '../context/AuthContext'

type UserForm = {
  username: string
  email: string
  password: string
  shopRole: ShopRole
  accountType: 'admin' | 'staff'
  accessRoleCode: string
}

const ROLE_GROUPS: Array<{ label: string; icon: string; roles: Array<[ShopRole, string]> }> = [
  {
    label: 'Operations',
    icon: '⚙️',
    roles: [
      ['cashier', 'Cashier'],
      ['storekeeper', 'Storekeeper'],
      ['production_supervisor', 'Production Supervisor'],
      ['procurement_officer', 'Procurement Officer'],
      ['quality_officer', 'Quality Officer'],
      ['accountant', 'Accountant'],
    ],
  },
  {
    label: 'Management',
    icon: '🏢',
    roles: [
      ['manager', 'Manager'],
      ['store_manager', 'Store Manager'],
      ['assistant_store_manager', 'Assistant Store Manager'],
      ['shift_supervisor', 'Shift Supervisor'],
    ],
  },
  {
    label: 'Sales & Service',
    icon: '💼',
    roles: [
      ['sales_associate', 'Sales Associate'],
      ['customer_service_representative', 'Customer Service Representative'],
      ['stock_clerk', 'Stock Clerk'],
      ['visual_merchandiser', 'Visual Merchandiser'],
      ['loss_prevention_officer', 'Loss Prevention'],
    ],
  },
]

const ALL_ROLES = ROLE_GROUPS.flatMap((group) => group.roles)
const roleLabel = (role: ShopRole) => ALL_ROLES.find(([value]) => value === role)?.[1] || role
const roleGroupOf = (role: ShopRole) => ROLE_GROUPS.find((group) => group.roles.some(([value]) => value === role))

const EMPTY_FORM: UserForm = { username: '', email: '', password: '', shopRole: 'cashier', accountType: 'staff', accessRoleCode: 'cashier' }

export function ShopUsers({ theme, toggleTheme, setPage }: ThemePageProps & Pick<PageRenderProps, 'setPage'>) {
  const { user } = useAuth()
  const [users, setUsers] = useState<ShopUser[]>([])
  const [roles, setRoles] = useState<AccessRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<ShopUser | null>(null)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [filterGroup, setFilterGroup] = useState('all')
  const [form, setForm] = useState<UserForm>(EMPTY_FORM)
  const [editForm, setEditForm] = useState<UserForm>(EMPTY_FORM)

  const canCreate = String(user?.role) === 'admin' || Boolean(user?.permissions?.find((permission) => permission.module === 'users')?.actions.includes('create'))
  const canEdit = String(user?.role) === 'admin' || Boolean(user?.permissions?.find((permission) => permission.module === 'users')?.actions.includes('edit'))

  const loadUsers = async () => {
    try {
      const [userRows, roleResponse] = await Promise.all([api.shopUsers(), api.accessRoles()])
      setUsers(userRows)
      setRoles(roleResponse.roles.filter((role) => role.active))
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load business users.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const loader = window.setTimeout(() => {
      void loadUsers()
    }, 0)
    return () => window.clearTimeout(loader)
  }, [])

  const createUser = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      await api.createShopUser(form)
      setForm(EMPTY_FORM)
      setIsFormOpen(false)
      await loadUsers()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create the user account.')
    } finally {
      setSaving(false)
    }
  }

  const updateUser = async (userToUpdate: ShopUser, payload: Partial<UserForm> & { active?: boolean }) => {
    setUpdatingId(userToUpdate.id)
    try {
      await api.updateShopUser(userToUpdate.id, payload)
      await loadUsers()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update the user account.')
    } finally {
      setUpdatingId('')
    }
  }

  const openEditUser = (targetUser: ShopUser) => {
    setEditForm({
      username: targetUser.username,
      email: targetUser.email,
      password: '',
      shopRole: targetUser.shopRole,
      accountType: targetUser.accountType,
      accessRoleCode: targetUser.accessRoleCode || (targetUser.accountType === 'admin' ? 'administrator' : 'cashier'),
    })
    setEditingUser(targetUser)
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

  const filtered = users.filter((u) => {
    const matchSearch = !searchQ
      || u.username.toLowerCase().includes(searchQ.toLowerCase())
      || u.email.toLowerCase().includes(searchQ.toLowerCase())
      || roleLabel(u.shopRole).toLowerCase().includes(searchQ.toLowerCase())
    const matchGroup = filterGroup === 'all'
      || roleGroupOf(u.shopRole)?.label === filterGroup
      || (filterGroup === 'admin' && u.accountType === 'admin')
    return matchSearch && matchGroup
  })

  const activeCount = users.filter((u) => u.active).length
  const adminCount = users.filter((u) => u.accountType === 'admin').length
  const deptCounts = ROLE_GROUPS.map((g) => ({
    ...g,
    count: users.filter((u) => g.roles.some(([value]) => value === u.shopRole)).length,
  }))

  return (
    <>
      <Topbar title="User Management" placeholder="Search the active branch..." theme={theme} toggleTheme={toggleTheme} />
      <div className="shop-users-page page-pad">
        <header className="shop-users-heading">
          <div>
            <h1>👥 Users &amp; Team Management</h1>
            <p>
              {loading
                ? 'Loading workers...'
                : `${users.length} worker account${users.length !== 1 ? 's' : ''} · ${activeCount} active · ${adminCount} admin`}
            </p>
          </div>
          <div className="shop-users-heading-actions">
            <button type="button" className="secondary-action" onClick={() => setPage('access-control')}>
              🛡️ Roles &amp; permissions
            </button>
            {canCreate && (
              <button type="button" className="primary-action" onClick={() => setIsFormOpen(true)}>
                + Add Worker
              </button>
            )}
          </div>
        </header>

        {error && <div className="admin-error" role="alert">{error}</div>}

        {/* Department stat filter pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
          <button
            type="button"
            onClick={() => setFilterGroup('all')}
            style={{
              padding: '6px 14px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', border: '1px solid',
              background: filterGroup === 'all' ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
              borderColor: filterGroup === 'all' ? 'rgba(99,102,241,0.5)' : 'var(--line, rgba(255,255,255,0.1))',
              color: filterGroup === 'all' ? '#a5b4fc' : 'inherit',
              fontWeight: filterGroup === 'all' ? 600 : 400,
            }}
          >
            All ({users.length})
          </button>
          {deptCounts.map((d) => (
            <button
              key={d.label}
              type="button"
              onClick={() => setFilterGroup(d.label)}
              style={{
                padding: '6px 14px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', border: '1px solid',
                background: filterGroup === d.label ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                borderColor: filterGroup === d.label ? 'rgba(99,102,241,0.5)' : 'var(--line, rgba(255,255,255,0.1))',
                color: filterGroup === d.label ? '#a5b4fc' : 'inherit',
                fontWeight: filterGroup === d.label ? 600 : 400,
              }}
            >
              {d.icon} {d.label} ({d.count})
            </button>
          ))}
          {adminCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterGroup('admin')}
              style={{
                padding: '6px 14px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', border: '1px solid',
                background: filterGroup === 'admin' ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.04)',
                borderColor: filterGroup === 'admin' ? 'rgba(245,158,11,0.5)' : 'var(--line, rgba(255,255,255,0.1))',
                color: filterGroup === 'admin' ? '#fbbf24' : 'inherit',
                fontWeight: filterGroup === 'admin' ? 600 : 400,
              }}
            >
              👑 Admins ({adminCount})
            </button>
          )}
        </div>

        {/* Search */}
        <div style={{ marginBottom: '14px' }}>
          <input
            type="search"
            placeholder="Search by name, email or role..."
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            style={{
              width: '100%', maxWidth: '360px', padding: '9px 13px', borderRadius: '8px',
              border: '1px solid var(--line, rgba(255,255,255,0.1))',
              background: 'rgba(255,255,255,0.04)', color: 'inherit', fontSize: '13px',
            }}
          />
        </div>

        <section className="admin-activity-section">
          <div className="admin-activity-table-wrap">
            <table className="admin-activity-table shop-users-table">
              <thead>
                <tr>
                  <th>Worker</th>
                  <th>Department</th>
                  <th>Role</th>
                  <th>Account</th>
                  <th>Access Level</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td className="admin-empty" colSpan={7}>Loading users...</td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '36px' }}>
                      <div style={{ fontSize: '36px', marginBottom: '8px' }}>👥</div>
                      <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px' }}>
                        {users.length === 0 ? 'No worker accounts yet' : 'No matching worker accounts found'}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-soft)' }}>
                        {users.length === 0
                          ? 'Create the first account for your team by clicking "+ Add Worker"'
                          : 'Try adjusting your search or department filter'}
                      </div>
                      {users.length === 0 && canCreate && (
                        <button
                          type="button"
                          className="primary-action"
                          onClick={() => setIsFormOpen(true)}
                          style={{ marginTop: '14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                          + Add Worker
                        </button>
                      )}
                    </td>
                  </tr>
                )}
                {filtered.map((targetUser) => {
                  const group = roleGroupOf(targetUser.shopRole)
                  return (
                    <tr key={targetUser.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                              background: targetUser.accountType === 'admin' ? 'rgba(245,158,11,0.2)' : 'rgba(99,102,241,0.2)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '13px', fontWeight: 700,
                              color: targetUser.accountType === 'admin' ? '#fbbf24' : '#a5b4fc',
                            }}
                          >
                            {targetUser.username.slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <strong style={{ display: 'block', fontSize: '13px' }}>{targetUser.username}</strong>
                            <small style={{ color: 'var(--text-soft)', fontSize: '11px' }}>{targetUser.email}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        {group ? (
                          <span style={{ fontSize: '12px' }}>{group.icon} {group.label}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>
                        )}
                      </td>
                      <td style={{ fontSize: '13px' }}>{roleLabel(targetUser.shopRole)}</td>
                      <td>
                        {targetUser.accountType === 'admin' ? (
                          <span className="admin-type-label">👑 Administrator</span>
                        ) : (
                          <span style={{ background: 'rgba(148,163,184,0.1)', color: 'var(--text-soft)', border: '1px solid var(--line)', borderRadius: '4px', padding: '2px 7px', fontSize: '11px' }}>
                            Staff
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="access-role-chip">{roleName(roles, targetUser.accessRoleCode)}</span>
                      </td>
                      <td>
                        <span className={`admin-status ${targetUser.active ? 'positive' : 'neutral'}`}>
                          {targetUser.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {canEdit ? (
                          <div className="shop-user-actions" style={{ justifyContent: 'flex-end' }}>
                            <button type="button" className="admin-user-action" onClick={() => openEditUser(targetUser)}>
                              Edit
                            </button>
                            <button
                              type="button"
                              className="admin-user-action"
                              disabled={updatingId === targetUser.id}
                              onClick={() => void updateUser(targetUser, { active: !targetUser.active })}
                            >
                              {updatingId === targetUser.id ? 'Updating...' : targetUser.active ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        ) : (
                          <span className="admin-protected">View only</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {isFormOpen && (
        <UserDialog
          title="Add Worker"
          note="Create a worker account and assign their department and role."
          form={form}
          roles={roles}
          saving={saving}
          submitLabel="Create Account"
          onChange={setForm}
          onClose={() => setIsFormOpen(false)}
          onSubmit={createUser}
        />
      )}

      {editingUser && (
        <UserDialog
          title={`Edit ${editingUser.username}`}
          note="Update worker department, operational role or password."
          form={editForm}
          roles={roles}
          saving={saving}
          submitLabel="Save Changes"
          onChange={setEditForm}
          onClose={() => setEditingUser(null)}
          onSubmit={saveEditUser}
        />
      )}
    </>
  )
}

function UserDialog({
  title,
  note,
  form,
  roles,
  saving,
  submitLabel,
  onChange,
  onClose,
  onSubmit,
}: {
  title: string
  note: string
  form: UserForm
  roles: AccessRole[]
  saving: boolean
  submitLabel: string
  onChange: (form: UserForm) => void
  onClose: () => void
  onSubmit: (event: FormEvent) => void
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="entry-modal admin-user-modal" role="dialog" aria-modal="true" aria-label={title}>
        <header className="detail-head">
          <div>
            <h2>{title}</h2>
            <p>{note}</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} disabled={saving} aria-label="Close">
            x
          </button>
        </header>
        <form className="admin-user-form" onSubmit={onSubmit}>
          <label>
            Worker Name
            <input
              required
              value={form.username}
              onChange={(event) => onChange({ ...form, username: event.target.value })}
              placeholder="e.g. Jean Claude"
            />
          </label>
          <label>
            Email Address
            <input
              required
              type="email"
              value={form.email}
              onChange={(event) => onChange({ ...form, email: event.target.value })}
              placeholder="worker@business.com"
            />
          </label>
          <label>
            Password
            <input
              required={title.startsWith('Add')}
              type="password"
              minLength={8}
              placeholder={title.startsWith('Add') ? 'At least 8 characters' : 'Leave blank to keep current password'}
              value={form.password}
              onChange={(event) => onChange({ ...form, password: event.target.value })}
            />
          </label>
          <label>
            Account Type
            <select
              value={form.accountType}
              onChange={(event) =>
                onChange({
                  ...form,
                  accountType: event.target.value as UserForm['accountType'],
                  accessRoleCode: event.target.value === 'admin' ? 'administrator' : form.accessRoleCode,
                })
              }
            >
              <option value="staff">Staff</option>
              <option value="admin">Administrator</option>
            </select>
          </label>
          <label>
            Department &amp; Operational Role
            <select
              value={form.shopRole}
              onChange={(event) => onChange({ ...form, shopRole: event.target.value as ShopRole })}
            >
              {ROLE_GROUPS.map((group) => (
                <optgroup key={group.label} label={`${group.icon} ${group.label}`}>
                  {group.roles.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label>
            System Access Role
            <select
              value={form.accessRoleCode}
              onChange={(event) => onChange({ ...form, accessRoleCode: event.target.value })}
            >
              {roles.map((role) => (
                <option key={role.code} value={role.code}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
          <footer>
            <button type="button" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="primary-action" disabled={saving}>
              {saving ? 'Saving...' : submitLabel}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}

function roleName(roles: AccessRole[], code: string) {
  return roles.find((role) => role.code === code)?.name || code.replace(/_/g, ' ') || 'Not assigned'
}
