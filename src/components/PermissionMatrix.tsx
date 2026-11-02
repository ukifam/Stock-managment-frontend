import type { PermissionAction, RolePermission } from '../api'
import { ACTION_LABELS, MODULE_LABELS, PERMISSION_ACTIONS, hasPermission, togglePermission } from '../utils/permissions'

type PermissionMatrixProps = {
  modules: string[]
  value: RolePermission[]
  // When set, cells that differ from the role are marked as added or removed.
  base?: RolePermission[]
  canChange?: (module: string, action: PermissionAction) => boolean
  disabled?: boolean
  onChange: (next: RolePermission[]) => void
}

export function PermissionMatrix({ modules, value, base, canChange, disabled = false, onChange }: PermissionMatrixProps) {
  return (
    <div className="permission-matrix-wrap">
      <table className="permission-matrix">
        <thead>
          <tr>
            <th>Page</th>
            {PERMISSION_ACTIONS.map((action) => <th key={action}>{ACTION_LABELS[action]}</th>)}
          </tr>
        </thead>
        <tbody>
          {modules.map((module) => {
            const pageOpen = hasPermission(value, module, 'view')
            return (
              <tr key={module} className={pageOpen ? '' : 'page-off'}>
                <td>{MODULE_LABELS[module] || module.replace(/_/g, ' ')}</td>
                {PERMISSION_ACTIONS.map((action) => {
                  const checked = hasPermission(value, module, action)
                  const inRole = base ? hasPermission(base, module, action) : checked
                  const state = checked === inRole ? '' : checked ? 'granted' : 'revoked'
                  return (
                    <td key={action} className={state}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled || (canChange ? !canChange(module, action) : false)}
                        onChange={() => onChange(togglePermission(value, module, action))}
                        aria-label={`${ACTION_LABELS[action]} ${MODULE_LABELS[module] || module}`}
                      />
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
