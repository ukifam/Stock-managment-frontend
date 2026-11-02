import { useEffect, useState, type FormEvent } from 'react'
import { api, type AccessRole, type PermissionAction, type RolePermission, type ShopRole, type ShopUser } from '../api'
import { PermissionMatrix } from '../components/PermissionMatrix'
import { Topbar } from '../components/Topbar'
import type { PageRenderProps, ThemePageProps } from '../types'
import { useAuth } from '../context/AuthContext'
import { canAccess, isFullAccessRole } from '../utils/access'
import { applyOverrides, countPermissions, diffPermissions, hasPermission, pageModules } from '../utils/permissions'

type UserForm = {
  username: string
  email: string
  password: string
  shopRole: ShopRole
  accountType: 'admin' | 'staff'
  accessRoleCode: string
  // null means "exactly what the access role gives".
  permissions: RolePermission[] | null
}

type StatusFilter = 'all' | 'admin' | 'staff' | 'inactive'

const JOB_GROUPS: Array<{ label: string; roles: Array<[ShopRole, string]> }> = [
  {
    label: 'Operations',
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
    roles: [
      ['manager', 'Manager'],
      ['store_manager', 'Store Manager'],
      ['assistant_store_manager', 'Assistant Store Manager'],
      ['shift_supervisor', 'Shift Supervisor'],
    ],
  },
  {
    label: 'Sales & Service',
    roles: [
      ['sales_associate', 'Sales Associate'],
      ['customer_service_representative', 'Customer Service'],
      ['stock_clerk', 'Stock Clerk'],
      ['visual_merchandiser', 'Visual Merchandiser'],
      ['loss_prevention_officer', 'Loss Prevention'],
    ],
  },
]

const JOB_LABELS = new Map(JOB_GROUPS.flatMap((group) => group.roles))
const jobLabel = (role: ShopRole) => JOB_LABELS.get(role) || role.replace(/_/g, ' ')

const FILTERS: Array<[StatusFilter, string]> = [['all', 'All'], ['admin', 'Admins'], ['staff', 'Staff'], ['inactive', 'Inactive']]

const EMPTY_FORM: UserForm = {
  username: '',
  email: '',
  password: '',
  shopRole: 'cashier',
  accountType: 'staff',
  accessRoleCode: 'cashier',
  permissions: null,
}

type ShopUsersProps = ThemePageProps & Pick<PageRenderProps, 'setPage' | 'processingEnabled'>

export function ShopUsers({ theme, toggleTheme, setPage, processingEnabled }: ShopUsersProps) {
  const { user } = useAuth()
  const [users, setUsers] = useState<ShopUser[]>([])
  const [roles, setRoles] = useState<AccessRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('all')
  // null: closed, 'new': creating, otherwise the user being edited.
  const [dialog, setDialog] = useState<ShopUser | 'new' | null>(null)

  const canCreate = canAccess(user, 'users', 'create')
  const canEdit = canAccess(user, 'users', 'edit')
  const isOwner = isFullAccessRole(user?.role)

  const loadUsers = async () => {
    try {
      const [userRows, roleResponse] = await Promise.all([api.shopUsers(), api.accessRoles()])
      setUsers(userRows)
      setRoles(roleResponse.roles.filter((role) => role.active))
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load staff.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state is only set after the request resolves
    void loadUsers()
  }, [])

  const toggleActive = async (target: ShopUser) => {
    setUpdatingId(target.id)
    try {
      await api.updateShopUser(target.id, { active: !target.active })
      await loadUsers()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update the account.')
    } finally {
      setUpdatingId('')
    }
  }

  const query = search.trim().toLowerCase()
  const filtered = users.filter((row) => {
    const matchesFilter = filter === 'all'
      || (filter === 'inactive' ? !row.active : row.accountType === filter)
    const matchesSearch = !query
      || row.username.toLowerCase().includes(query)
      || row.email.toLowerCase().includes(query)
      || jobLabel(row.shopRole).toLowerCase().includes(query)
    return matchesFilter && matchesSearch
  })

  return (
    <>
      <Topbar title="" placeholder="Search the active branch..." theme={theme} toggleTheme={toggleTheme} />
      <div className="page-pad shop-users-page">
        <div className="page-title-row">
          <h1>Staff<span className="count-badge">{users.length}</span></h1>
          <div className="toolbar">
            <input type="search" placeholder="Search staff" value={search} onChange={(event) => setSearch(event.target.value)} />
            <div className="segmented">
              {FILTERS.map(([value, label]) => (
                <button key={value} type="button" className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>
              ))}
            </div>
            <button type="button" className="secondary-action" onClick={() => setPage('access-control')}>Roles</button>
            {canCreate && <button type="button" className="primary-action" onClick={() => setDialog('new')}>+ Add staff</button>}
          </div>
        </div>

        {error && <div className="notice error" role="alert">{error}</div>}

        <div className="table-frame">
          <table className="shop-users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Job</th>
                <th>Access role</th>
                <th>Page access</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="empty-state">Loading…</td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6} className="empty-state">{users.length ? 'No matches' : 'No staff yet'}</td></tr>
              )}
              {filtered.map((row) => {
                const added = countPermissions(row.permissionGrants)
                const removed = countPermissions(row.permissionRevokes)
                const isSelf = row.id === user?.id
                const editable = canEdit && (isOwner || row.accountType !== 'admin')
                return (
                  <tr key={row.id}>
                    <td>
                      <div className="staff-cell">
                        <span className={`product-avatar ${row.accountType === 'admin' ? 'admin' : ''}`}>{row.username.slice(0, 1).toUpperCase()}</span>
                        <div>
                          <strong>{row.username}{isSelf && <small className="you-tag">you</small>}</strong>
                          <small>{row.email}</small>
                        </div>
                      </div>
                    </td>
                    <td>{jobLabel(row.shopRole)}</td>
                    <td><span className="access-role-chip">{row.accountType === 'admin' ? 'Administrator' : roleName(roles, row.accessRoleCode)}</span></td>
                    <td>
                      {row.accountType === 'admin'
                        ? <span className="access-tag full">Full</span>
                        : added || removed
                          ? <span className="access-tag custom">{added ? `+${added}` : ''}{added && removed ? ' ' : ''}{removed ? `−${removed}` : ''}</span>
                          : <span className="access-tag">Role</span>}
                    </td>
                    <td><span className={`admin-status ${row.active ? 'positive' : 'neutral'}`}>{row.active ? 'Active' : 'Inactive'}</span></td>
                    <td className="row-actions">
                      {editable && (
                        <>
                          <button type="button" className="link-button" onClick={() => setDialog(row)}>Edit</button>
                          {!isSelf && (
                            <button type="button" className="link-button" disabled={updatingId === row.id} onClick={() => void toggleActive(row)}>
                              {updatingId === row.id ? '…' : row.active ? 'Deactivate' : 'Activate'}
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {dialog && (
        <UserDialog
          key={dialog === 'new' ? 'new' : dialog.id}
          target={dialog === 'new' ? null : dialog}
          roles={roles}
          modules={pageModules(processingEnabled)}
          isOwner={isOwner}
          isSelf={dialog !== 'new' && dialog.id === user?.id}
          actorPermissions={user?.permissions || []}
          onClose={() => setDialog(null)}
          onSaved={async () => {
            setDialog(null)
            await loadUsers()
          }}
        />
      )}
    </>
  )
}

function formForUser(target: ShopUser, roles: AccessRole[]): UserForm {
  const accessRoleCode = target.accessRoleCode || (target.accountType === 'admin' ? 'administrator' : 'cashier')
  const grants = target.permissionGrants ?? []
  const revokes = target.permissionRevokes ?? []
  const hasOverrides = grants.length > 0 || revokes.length > 0
  return {
    username: target.username,
    email: target.email,
    password: '',
    shopRole: target.shopRole,
    accountType: target.accountType,
    accessRoleCode,
    permissions: hasOverrides
      ? applyOverrides(rolePermissions(roles, accessRoleCode), grants, revokes)
      : null,
  }
}

function UserDialog({
  target,
  roles,
  modules,
  isOwner,
  isSelf,
  actorPermissions,
  onClose,
  onSaved,
}: {
  target: ShopUser | null
  roles: AccessRole[]
  modules: string[]
  isOwner: boolean
  isSelf: boolean
  actorPermissions: RolePermission[]
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [form, setForm] = useState<UserForm>(() => (target ? formForUser(target, roles) : EMPTY_FORM))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isNew = !target
  // Non-owners cannot change their own access; the server enforces this too.
  const accessLocked = isSelf && !isOwner
  const roleBase = rolePermissions(roles, form.accessRoleCode)
  const effective = form.permissions ?? roleBase
  const customized = form.permissions !== null
  const assignableRoles = isOwner ? roles : roles.filter((role) => role.permissions.every(({ module, actions }) => actions.every((action) => hasPermission(actorPermissions, module, action))))

  const canChange = (module: string, action: PermissionAction) =>
    isOwner || hasPermission(effective, module, action) || hasPermission(actorPermissions, module, action)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    const { grants, revokes } = form.accountType === 'admin' || !form.permissions
      ? { grants: [], revokes: [] }
      : diffPermissions(roleBase, form.permissions)
    const details = { username: form.username, email: form.email, password: form.password, shopRole: form.shopRole }
    const access = {
      accountType: form.accountType,
      accessRoleCode: form.accountType === 'admin' ? 'administrator' : form.accessRoleCode,
      permissionGrants: grants,
      permissionRevokes: revokes,
    }
    try {
      if (target) await api.updateShopUser(target.id, accessLocked ? details : { ...details, ...access })
      else await api.createShopUser({ ...details, ...access })
      await onSaved()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the account.')
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="entry-modal admin-user-modal staff-dialog" role="dialog" aria-modal="true" aria-label={isNew ? 'Add staff' : `Edit ${target.username}`}>
        <header className="detail-head">
          <h2>{isNew ? 'Add staff' : target.username}</h2>
          <button type="button" className="modal-close" onClick={onClose} disabled={saving} aria-label="Close">×</button>
        </header>
        <form className="admin-user-form" onSubmit={submit}>
          <label>
            Name
            <input required value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
          </label>
          <label>
            Email
            <input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </label>
          <label>
            Password
            <input
              required={isNew}
              type="password"
              minLength={8}
              autoComplete="new-password"
              placeholder={isNew ? 'Min. 8 characters' : 'Unchanged'}
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
          </label>
          <label>
            Job
            <select value={form.shopRole} onChange={(event) => setForm({ ...form, shopRole: event.target.value as ShopRole })}>
              {JOB_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.roles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label>
            Account
            <select
              value={form.accountType}
              disabled={accessLocked || !isOwner}
              onChange={(event) => {
                const accountType = event.target.value as UserForm['accountType']
                setForm({ ...form, accountType, accessRoleCode: accountType === 'admin' ? 'administrator' : 'cashier', permissions: null })
              }}
            >
              <option value="staff">Staff</option>
              <option value="admin">Administrator</option>
            </select>
          </label>
          {form.accountType === 'staff' && (
            <label>
              Access role
              <select
                value={form.accessRoleCode}
                disabled={accessLocked}
                onChange={(event) => setForm({ ...form, accessRoleCode: event.target.value, permissions: null })}
              >
                {!assignableRoles.some((role) => role.code === form.accessRoleCode) && (
                  <option value={form.accessRoleCode}>{roleName(roles, form.accessRoleCode)}</option>
                )}
                {assignableRoles.map((role) => <option key={role.code} value={role.code}>{role.name}</option>)}
              </select>
            </label>
          )}

          <div className="admin-user-form-wide staff-access">
            {form.accountType === 'admin' ? (
              <p className="empty-state">Administrators can open every page.</p>
            ) : (
              <>
                <div className="staff-access-head">
                  <h3>Page access</h3>
                  <span className="access-legend"><i className="granted" />Added <i className="revoked" />Removed</span>
                  {customized && !accessLocked && (
                    <button type="button" className="link-button" onClick={() => setForm({ ...form, permissions: null })}>Reset to role</button>
                  )}
                </div>
                <PermissionMatrix
                  modules={modules}
                  value={effective}
                  base={roleBase}
                  canChange={canChange}
                  disabled={accessLocked}
                  onChange={(permissions) => setForm({ ...form, permissions })}
                />
              </>
            )}
          </div>

          {error && <div className="notice error admin-user-form-wide" role="alert">{error}</div>}
          <footer>
            <button type="button" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="primary-action" disabled={saving}>{saving ? 'Saving…' : isNew ? 'Create' : 'Save'}</button>
          </footer>
        </form>
      </section>
    </div>
  )
}

function rolePermissions(roles: AccessRole[], code: string) {
  return roles.find((role) => role.code === code)?.permissions || []
}

function roleName(roles: AccessRole[], code: string) {
  return roles.find((role) => role.code === code)?.name || code.replace(/_/g, ' ') || 'Not assigned'
}
