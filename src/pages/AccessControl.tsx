import { useEffect, useState, type FormEvent } from 'react'
import { api, type AccessRole, type PermissionAction, type RolePermission } from '../api'
import { Topbar } from '../components/Topbar'
import type { PageRenderProps, ThemePageProps } from '../types'
import { useAuth } from '../context/AuthContext'

type RoleDraft = {
  name: string
  code: string
  description: string
  permissions: RolePermission[]
  active: boolean
}

const EMPTY_ROLE: RoleDraft = { name: '', code: '', description: '', permissions: [], active: true }

export function AccessControl({ theme, toggleTheme, setPage }: ThemePageProps & Pick<PageRenderProps, 'setPage'>) {
  const { user } = useAuth()
  const [roles, setRoles] = useState<AccessRole[]>([])
  const [modules, setModules] = useState<string[]>([])
  const [actions, setActions] = useState<PermissionAction[]>([])
  const [draft, setDraft] = useState<RoleDraft>(EMPTY_ROLE)
  const [editingCode, setEditingCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const canCreate = String(user?.role) === 'admin' || Boolean(user?.permissions?.find((permission) => permission.module === 'users')?.actions.includes('create'))
  const canEdit = String(user?.role) === 'admin' || Boolean(user?.permissions?.find((permission) => permission.module === 'users')?.actions.includes('edit'))

  const loadRoles = async () => {
    try {
      const response = await api.accessRoles()
      setRoles(response.roles)
      setModules(response.modules)
      setActions(response.actions)
      setMessage('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load access roles.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const loader = window.setTimeout(() => {
      void api.accessRoles()
        .then((response) => {
          setRoles(response.roles)
          setModules(response.modules)
          setActions(response.actions)
          setMessage('')
        })
        .catch((error: unknown) => {
          setMessage(error instanceof Error ? error.message : 'Could not load access roles.')
        })
        .finally(() => setLoading(false))
    }, 0)
    return () => window.clearTimeout(loader)
  }, [])

  const startNewRole = () => {
    setEditingCode('')
    setDraft(EMPTY_ROLE)
  }

  const editRole = (role: AccessRole) => {
    if (role.builtIn || !canEdit) {
      setMessage('Built-in roles are fixed templates. Create a custom role to tailor permissions.')
      return
    }
    setEditingCode(role.code)
    setDraft({ name: role.name, code: role.code, description: role.description, permissions: role.permissions, active: role.active })
  }

  const saveRole = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      if (editingCode) {
        await api.updateAccessRole(editingCode, { name: draft.name, description: draft.description, permissions: draft.permissions, active: draft.active })
      } else {
        await api.createAccessRole(draft)
      }
      const wasEditing = Boolean(editingCode)
      startNewRole()
      await loadRoles()
      setMessage(wasEditing ? 'Custom role updated.' : 'Custom role created.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save the access role.')
    } finally {
      setSaving(false)
    }
  }

  const togglePermission = (module: string, action: PermissionAction) => {
    setDraft((current) => {
      const currentPermission = current.permissions.find((permission) => permission.module === module)
      const currentActions = currentPermission?.actions || []
      const nextActions = currentActions.includes(action) ? currentActions.filter((currentAction) => currentAction !== action) : [...currentActions, action]
      const remaining = current.permissions.filter((permission) => permission.module !== module)
      return { ...current, permissions: nextActions.length ? [...remaining, { module, actions: nextActions }] : remaining }
    })
  }

  return <>
    <Topbar title="Roles & Permissions" placeholder="Search the active branch..." theme={theme} toggleTheme={toggleTheme} />
    <main className="access-control-page page-pad">
      <header className="access-control-heading">
        <div><h1>Roles & permissions</h1><p>Set what each role can view, create, change, approve, cancel, delete, or export.</p></div>
        <div className="shop-users-heading-actions"><button type="button" className="secondary-action" onClick={() => setPage('shop-users')}>Users</button>{canCreate && <button type="button" className="primary-action" onClick={startNewRole}>Create custom role</button>}</div>
      </header>
      {message && <div className={`organization-notice ${message.includes('Could not') ? 'error' : ''}`} role="status">{message}</div>}

      <section className="access-role-list" aria-label="Access roles">
        {roles.map((role) => <article key={role.code} className="access-role-row">
          <div><strong>{role.name}</strong><span>{role.code.replace(/_/g, ' ')}</span></div>
          <p>{role.description || 'Custom access configuration'}</p>
          <div className="access-role-summary"><b>{role.permissions.length}</b><span>modules</span></div>
          <span className={`organization-status ${role.active ? 'active' : 'inactive'}`}>{role.active ? 'Active' : 'Inactive'}</span>
          {(role.builtIn || canEdit) && <button type="button" className="text-action" onClick={() => editRole(role)}>{role.builtIn ? 'View template' : 'Edit'}</button>}
        </article>)}
        {!loading && !roles.length && <p className="organization-empty">No access roles are available.</p>}
      </section>

      {(canCreate || editingCode) && <section className="role-editor-section">
        <div className="organization-section-heading"><div><h2>{editingCode ? `Edit ${editingCode.replace(/_/g, ' ')}` : 'Custom role editor'}</h2><p>Choose at least one action before saving a custom role.</p></div>{editingCode && <button type="button" className="text-action" onClick={startNewRole}>Cancel edit</button>}</div>
        <form className="role-editor-form" onSubmit={saveRole}>
          <div className="organization-form-grid">
            <label>Role name<input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
            <label>Role code<input required disabled={Boolean(editingCode)} pattern="[a-z0-9_]+" value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value.toLowerCase().replace(/\s+/g, '_') })} /></label>
            <label className="organization-checkbox"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />Role is active</label>
            <label className="organization-field-wide">Description<input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
          </div>
          <div className="permission-matrix-wrap"><table className="permission-matrix"><thead><tr><th>Module</th>{actions.map((action) => <th key={action}>{action}</th>)}</tr></thead><tbody>
            {modules.map((module) => <tr key={module}><td>{module.replace(/_/g, ' ')}</td>{actions.map((action) => <td key={action}><input type="checkbox" checked={draft.permissions.find((permission) => permission.module === module)?.actions.includes(action) || false} onChange={() => togglePermission(module, action)} aria-label={`${action} ${module}`} /></td>)}</tr>)}
          </tbody></table></div>
          <div className="organization-form-actions"><button className="primary-action" disabled={saving} type="submit">{saving ? 'Saving...' : editingCode ? 'Save custom role' : 'Create custom role'}</button></div>
        </form>
      </section>}
    </main>
  </>
}
