import { useEffect, useState, type FormEvent } from 'react'
import { api, type AccessRole, type RolePermission } from '../api'
import { PermissionMatrix } from '../components/PermissionMatrix'
import { Topbar } from '../components/Topbar'
import type { PageRenderProps, ThemePageProps } from '../types'
import { useAuth } from '../context/AuthContext'
import { canAccess, isFullAccessRole } from '../utils/access'
import { hasPermission, pageModules } from '../utils/permissions'

type RoleDraft = {
  name: string
  code: string
  description: string
  permissions: RolePermission[]
  active: boolean
}

const EMPTY_ROLE: RoleDraft = { name: '', code: '', description: '', permissions: [], active: true }

type AccessControlProps = ThemePageProps & Pick<PageRenderProps, 'setPage' | 'processingEnabled'>

export function AccessControl({ theme, toggleTheme, setPage, processingEnabled }: AccessControlProps) {
  const { user } = useAuth()
  const [roles, setRoles] = useState<AccessRole[]>([])
  const [selected, setSelected] = useState<AccessRole | null>(null)
  const [draft, setDraft] = useState<RoleDraft>(EMPTY_ROLE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  const canCreate = canAccess(user, 'users', 'create')
  const canEdit = canAccess(user, 'users', 'edit')
  const isOwner = isFullAccessRole(user?.role)
  const modules = pageModules(processingEnabled)

  const loadRoles = async () => {
    try {
      const response = await api.accessRoles()
      setRoles(response.roles)
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Could not load roles.', error: true })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state is only set after the request resolves
    void loadRoles()
  }, [])

  const selectRole = (role: AccessRole | null) => {
    setSelected(role)
    setMessage(null)
    setDraft(role ? { name: role.name, code: role.code, description: role.description, permissions: role.permissions, active: role.active } : EMPTY_ROLE)
  }

  const readOnly = selected ? selected.builtIn || !canEdit : !canCreate

  const saveRole = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const saved = selected
        ? await api.updateAccessRole(selected.code, { name: draft.name, description: draft.description, permissions: draft.permissions, active: draft.active })
        : await api.createAccessRole(draft)
      await loadRoles()
      selectRole(saved)
      setMessage({ text: selected ? 'Role saved' : 'Role created', error: false })
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Could not save the role.', error: true })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Topbar title="" placeholder="Search the active branch..." theme={theme} toggleTheme={toggleTheme} />
      <main className="page-pad access-control-page">
        <div className="page-title-row">
          <h1>Roles<span className="count-badge">{roles.length}</span></h1>
          <div className="toolbar">
            <button type="button" className="secondary-action" onClick={() => setPage('shop-users')}>Staff</button>
            {canCreate && <button type="button" className="primary-action" onClick={() => selectRole(null)}>+ New role</button>}
          </div>
        </div>

        <div className="list-detail-layout roles-layout">
          <section className="role-list" aria-label="Roles">
            {loading && <p className="empty-state">Loading…</p>}
            {roles.map((role) => (
              <button
                key={role.code}
                type="button"
                className={`role-list-item ${selected?.code === role.code ? 'selected' : ''}`}
                onClick={() => selectRole(role)}
              >
                <strong>{role.name}</strong>
                <small>{role.builtIn ? 'Built-in' : 'Custom'} · {role.permissions.filter((permission) => modules.includes(permission.module)).length} pages{role.active ? '' : ' · inactive'}</small>
              </button>
            ))}
          </section>

          <section className="detail-panel role-editor">
            <form onSubmit={saveRole}>
              <div className="role-editor-fields">
                <label>Name<input required disabled={readOnly} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
                <label>
                  Code
                  <input
                    required
                    disabled={readOnly || Boolean(selected)}
                    pattern="[a-z0-9_]+"
                    value={draft.code}
                    onChange={(event) => setDraft({ ...draft, code: event.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  />
                </label>
                <label className="role-editor-wide">Description<input disabled={readOnly} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
                <label className="role-active"><input type="checkbox" disabled={readOnly} checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />Active</label>
              </div>
              <PermissionMatrix
                modules={modules}
                value={draft.permissions}
                disabled={readOnly}
                canChange={(module, action) => isOwner || hasPermission(draft.permissions, module, action) || hasPermission(user?.permissions, module, action)}
                onChange={(permissions) => setDraft({ ...draft, permissions })}
              />
              <div className="button-row">
                {!readOnly && <button className="primary-action" disabled={saving} type="submit">{saving ? 'Saving…' : selected ? 'Save role' : 'Create role'}</button>}
                {selected?.builtIn && <span className="notice inline">Built-in roles are fixed. Create a new role to customise.</span>}
                {message && <span className={`notice inline ${message.error ? 'error' : 'success'}`} role="status">{message.text}</span>}
              </div>
            </form>
          </section>
        </div>
      </main>
    </>
  )
}
