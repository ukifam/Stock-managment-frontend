import { useEffect, useState, type FormEvent } from 'react'
import { api, type OrganizationBranch, type OrganizationBusiness, type OrganizationResponse, type OrganizationUser, type Warehouse } from '../api'
import { Topbar } from '../components/Topbar'
import type { ThemePageProps } from '../types'

type BranchDraft = Omit<OrganizationBranch, 'id'>

const EMPTY_BUSINESS: OrganizationBusiness = {
  id: '', name: '', address: '', phone: '', email: '', logoUrl: '', currency: 'RWF',
  tax: { taxNumber: '', taxRate: 0, taxInclusive: false }, template: 'other', processingEnabled: false, active: true,
}

const EMPTY_BRANCH: BranchDraft = {
  name: '', code: '', address: '', phone: '', email: '', manager: '', active: true, warehouses: [],
}

export function Organization({ theme, toggleTheme }: ThemePageProps) {
  const [organization, setOrganization] = useState<OrganizationResponse | null>(null)
  const [businessDraft, setBusinessDraft] = useState<OrganizationBusiness>(EMPTY_BUSINESS)
  const [branchDraft, setBranchDraft] = useState<BranchDraft>(EMPTY_BRANCH)
  const [isBusinessModalOpen, setIsBusinessModalOpen] = useState(false)
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false)
  const [editingBranchCode, setEditingBranchCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingUserId, setSavingUserId] = useState('')
  const [notice, setNotice] = useState('')

  const loadOrganization = async () => {
    try {
      const response = await api.organization()
      setOrganization(response)
      setBusinessDraft(response.business)
      setNotice('')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not load organization settings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const loader = window.setTimeout(() => {
      void api.organization()
        .then((response) => {
          setOrganization(response)
          setBusinessDraft(response.business)
          setNotice('')
        })
        .catch((error: unknown) => {
          setNotice(error instanceof Error ? error.message : 'Could not load organization settings.')
        })
        .finally(() => setLoading(false))
    }, 0)
    return () => window.clearTimeout(loader)
  }, [])

  const saveBusiness = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const business = await api.updateOrganizationBusiness(businessDraft)
      setOrganization((current) => current ? { ...current, business } : current)
      setBusinessDraft(business)
      window.dispatchEvent(new Event('tri:business-template-updated'))
      setIsBusinessModalOpen(false)
      setNotice('Business profile saved.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save the business profile.')
    } finally {
      setSaving(false)
    }
  }

  const beginBranch = (branch?: OrganizationBranch) => {
    if (!branch) {
      setEditingBranchCode('')
      setBranchDraft(EMPTY_BRANCH)
    } else {
      setEditingBranchCode(branch.code)
      setBranchDraft({
        name: branch.name,
        code: branch.code,
        address: branch.address,
        phone: branch.phone,
        email: branch.email,
        manager: branch.manager,
        active: branch.active,
        warehouses: branch.warehouses,
      })
    }
    setIsBranchModalOpen(true)
  }

  const saveBranch = async (event: FormEvent) => {
    event.preventDefault()
    const wasEditing = Boolean(editingBranchCode)
    setSaving(true)
    try {
      if (wasEditing) {
        await api.updateOrganizationBranch(editingBranchCode, branchDraft)
      } else {
        await api.createOrganizationBranch(branchDraft)
      }
      setEditingBranchCode('')
      setBranchDraft(EMPTY_BRANCH)
      setIsBranchModalOpen(false)
      await loadOrganization()
      setNotice(wasEditing ? 'Branch updated.' : 'Branch created.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save the branch.')
    } finally {
      setSaving(false)
    }
  }

  const updateWarehouse = (index: number, patch: Partial<Warehouse>) => {
    setBranchDraft((current) => ({
      ...current,
      warehouses: current.warehouses.map((warehouse, warehouseIndex) => warehouseIndex === index ? { ...warehouse, ...patch } : warehouse),
    }))
  }

  const updateUserBranches = async (user: OrganizationUser, branchCodes: string[]) => {
    if (!branchCodes.length) {
      setNotice('Each team member needs at least one branch assignment.')
      return
    }
    setSavingUserId(user.id)
    try {
      const updated = await api.assignOrganizationUserBranches(user.id, branchCodes)
      setOrganization((current) => current ? {
        ...current,
        users: current.users.map((currentUser) => currentUser.id === updated.id ? updated : currentUser),
      } : current)
      setNotice(`${updated.username}'s branch access was updated.`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not update branch access.')
    } finally {
      setSavingUserId('')
    }
  }

  const templates = organization?.templates || ['cafe', 'bakery', 'restaurant', 'maize_mill', 'retail_shop', 'electronics_store', 'other']
  const activeBranches = organization?.branches.filter((branch) => branch.active) || []

  return <>
    <Topbar title="Organization" placeholder="Search the active branch..." theme={theme} toggleTheme={toggleTheme} />
    <main className="organization-page page-pad">
      <header className="organization-heading">
        <div>
          <h1>Business & organization</h1>
          <p>Keep the business profile, branch operations, warehouses, and employee access in one place.</p>
        </div>
        {organization && <span className={`organization-status ${organization.business.active ? 'active' : 'inactive'}`}>{organization.business.active ? 'Business active' : 'Business inactive'}</span>}
      </header>

      {notice && <div className={`organization-notice ${notice.includes('Could not') || notice.includes('needs') ? 'error' : ''}`} role="status">{notice}</div>}

      <section className="organization-section">
        <div className="organization-section-heading"><div><h2>Business profile</h2><p>Identity, tax treatment, currency, operating template, and whether this business runs processing work.</p></div><button type="button" className="secondary-action" onClick={() => { setBusinessDraft(organization?.business || EMPTY_BUSINESS); setIsBusinessModalOpen(true) }}>Edit business profile</button></div>
        {organization && <div className="organization-profile-summary">
          <div><span>Business</span><strong>{organization.business.name}</strong></div>
          <div><span>Industry</span><strong>{templateLabel(organization.business.template)}</strong></div>
          <div><span>Currency</span><strong>{organization.business.currency}</strong></div>
          <div><span>Tax rate</span><strong>{organization.business.tax.taxRate}%</strong></div>
        </div>}
      </section>

      <section className="organization-section organization-branches-section">
        <div className="organization-section-heading"><div><h2>Branches & warehouses</h2><p>Each branch keeps its own stock, transactions, teams, and warehouse locations.</p></div><button type="button" className="secondary-action" onClick={() => beginBranch()}>Add branch</button></div>
        <div className="organization-branch-list">
          {organization?.branches.map((branch) => <article className="organization-branch-row" key={branch.code}>
            <div className="organization-branch-title"><strong>{branch.name}</strong><span>{branch.code}</span></div>
            <div className="organization-branch-detail"><b>{branch.warehouses.length}</b><span>warehouses</span></div>
            <div className="organization-branch-detail"><span>{branch.manager || 'No manager assigned'}</span><small>{branch.address || 'No address added'}</small></div>
            <span className={`organization-status ${branch.active ? 'active' : 'inactive'}`}>{branch.active ? 'Active' : 'Inactive'}</span>
            <button type="button" className="text-action" onClick={() => beginBranch(branch)}>Edit</button>
          </article>)}
          {!loading && !organization?.branches.length && <p className="organization-empty">No branches are available yet.</p>}
        </div>

      </section>

      <section className="organization-section">
        <div className="organization-section-heading"><div><h2>Employee branch access</h2><p>Assign every employee to the branches where they can work.</p></div></div>
        <div className="organization-access-table-wrap">
          <table className="organization-access-table"><thead><tr><th>Employee</th><th>Role</th><th>Assigned branches</th></tr></thead><tbody>
            {organization?.users.map((user) => <tr key={user.id}><td><strong>{user.username}</strong><small>{user.email}</small></td><td>{user.role === 'admin' ? 'Business administrator' : user.shopRole || 'Staff'}</td><td><div className="branch-access-options">{activeBranches.map((branch) => <label key={branch.code}><input type="checkbox" disabled={savingUserId === user.id} checked={user.branchCodes.includes(branch.code)} onChange={(event) => {
              const branchCodes = event.target.checked ? [...user.branchCodes, branch.code] : user.branchCodes.filter((code) => code !== branch.code)
              void updateUserBranches(user, branchCodes)
            }} />{branch.name}</label>)}</div></td></tr>)}
            {!loading && !organization?.users.length && <tr><td colSpan={3} className="organization-empty">No employee accounts have been created for this business.</td></tr>}
          </tbody></table>
        </div>
      </section>
    </main>
    {isBusinessModalOpen && <div className="modal-backdrop" role="presentation">
      <section className="entry-modal organization-modal" role="dialog" aria-modal="true" aria-labelledby="business-profile-title">
        <header className="detail-head"><div><h2 id="business-profile-title">Business profile</h2><p>Update the business identity, operating template, tax, and processing settings.</p></div><button type="button" className="modal-close" onClick={() => setIsBusinessModalOpen(false)} disabled={saving} aria-label="Close">x</button></header>
        <form className="organization-form-grid organization-modal-form" onSubmit={saveBusiness}>
          <label>Business name<input required value={businessDraft.name} onChange={(event) => setBusinessDraft({ ...businessDraft, name: event.target.value })} /></label>
          <label>Industry template<select value={businessDraft.template} onChange={(event) => setBusinessDraft({ ...businessDraft, template: event.target.value })}>{templates.map((template) => <option key={template} value={template}>{templateLabel(template)}</option>)}</select></label>
          <label>Business email<input type="email" value={businessDraft.email} onChange={(event) => setBusinessDraft({ ...businessDraft, email: event.target.value })} /></label>
          <label>Phone number<input value={businessDraft.phone} onChange={(event) => setBusinessDraft({ ...businessDraft, phone: event.target.value })} /></label>
          <label className="organization-field-wide">Address<input value={businessDraft.address} onChange={(event) => setBusinessDraft({ ...businessDraft, address: event.target.value })} /></label>
          <label className="organization-field-wide">Logo URL<input type="url" value={businessDraft.logoUrl} placeholder="https://..." onChange={(event) => setBusinessDraft({ ...businessDraft, logoUrl: event.target.value })} /></label>
          <label>Currency<input maxLength={3} value={businessDraft.currency} onChange={(event) => setBusinessDraft({ ...businessDraft, currency: event.target.value.toUpperCase() })} /></label>
          <label>Tax number<input value={businessDraft.tax.taxNumber} onChange={(event) => setBusinessDraft({ ...businessDraft, tax: { ...businessDraft.tax, taxNumber: event.target.value } })} /></label>
          <label>Tax rate (%)<input type="number" min="0" step="0.01" value={businessDraft.tax.taxRate} onChange={(event) => setBusinessDraft({ ...businessDraft, tax: { ...businessDraft.tax, taxRate: Number(event.target.value) } })} /></label>
          <label className="organization-checkbox"><input type="checkbox" checked={businessDraft.tax.taxInclusive} onChange={(event) => setBusinessDraft({ ...businessDraft, tax: { ...businessDraft.tax, taxInclusive: event.target.checked } })} />Prices include tax</label>
          <label className="organization-checkbox"><input type="checkbox" checked={businessDraft.processingEnabled} onChange={(event) => setBusinessDraft({ ...businessDraft, processingEnabled: event.target.checked })} />This business uses production and processing</label>
          <label className="organization-checkbox"><input type="checkbox" checked={businessDraft.active} onChange={(event) => setBusinessDraft({ ...businessDraft, active: event.target.checked })} />Business is active</label>
          <footer className="organization-form-actions organization-modal-actions"><button type="button" className="secondary-action" onClick={() => setIsBusinessModalOpen(false)} disabled={saving}>Cancel</button><button className="primary-action" disabled={saving || loading} type="submit">{saving ? 'Saving...' : 'Save business profile'}</button></footer>
        </form>
      </section>
    </div>}
    {isBranchModalOpen && <div className="modal-backdrop" role="presentation">
      <section className="entry-modal organization-modal" role="dialog" aria-modal="true" aria-labelledby="branch-editor-title">
        <header className="detail-head"><div><h2 id="branch-editor-title">{editingBranchCode ? `Edit ${editingBranchCode}` : 'New branch'}</h2><p>Set the branch details and its warehouse locations.</p></div><button type="button" className="modal-close" onClick={() => { setIsBranchModalOpen(false); setEditingBranchCode(''); setBranchDraft(EMPTY_BRANCH) }} disabled={saving} aria-label="Close">x</button></header>
        <form className="organization-form-grid organization-modal-form" onSubmit={saveBranch}>
          <label>Branch name<input required value={branchDraft.name} onChange={(event) => setBranchDraft({ ...branchDraft, name: event.target.value })} /></label>
          <label>Branch code<input required disabled={Boolean(editingBranchCode)} maxLength={18} value={branchDraft.code} onChange={(event) => setBranchDraft({ ...branchDraft, code: event.target.value.toUpperCase() })} /></label>
          <label>Email<input type="email" value={branchDraft.email} onChange={(event) => setBranchDraft({ ...branchDraft, email: event.target.value })} /></label>
          <label>Phone<input value={branchDraft.phone} onChange={(event) => setBranchDraft({ ...branchDraft, phone: event.target.value })} /></label>
          <label>Manager<input value={branchDraft.manager} onChange={(event) => setBranchDraft({ ...branchDraft, manager: event.target.value })} /></label>
          <label className="organization-checkbox"><input type="checkbox" checked={branchDraft.active} onChange={(event) => setBranchDraft({ ...branchDraft, active: event.target.checked })} />Branch is active</label>
          <label className="organization-field-wide">Address<input value={branchDraft.address} onChange={(event) => setBranchDraft({ ...branchDraft, address: event.target.value })} /></label>
          <div className="warehouse-editor">
            <div className="warehouse-editor-heading"><h4>Warehouses</h4><button type="button" className="text-action" onClick={() => setBranchDraft((current) => ({ ...current, warehouses: [...current.warehouses, { name: '', code: '', address: '', active: true }] }))}>Add warehouse</button></div>
            {branchDraft.warehouses.map((warehouse, index) => <div className="warehouse-fields" key={`${warehouse.code}-${index}`}>
              <input required placeholder="Warehouse name" value={warehouse.name} onChange={(event) => updateWarehouse(index, { name: event.target.value })} />
              <input required placeholder="Code" maxLength={18} value={warehouse.code} onChange={(event) => updateWarehouse(index, { code: event.target.value.toUpperCase() })} />
              <input placeholder="Address" value={warehouse.address} onChange={(event) => updateWarehouse(index, { address: event.target.value })} />
              <label className="organization-checkbox"><input type="checkbox" checked={warehouse.active} onChange={(event) => updateWarehouse(index, { active: event.target.checked })} />Active</label>
              <button type="button" className="icon-action" aria-label={`Remove warehouse ${warehouse.name || index + 1}`} onClick={() => setBranchDraft((current) => ({ ...current, warehouses: current.warehouses.filter((_, warehouseIndex) => warehouseIndex !== index) }))}>x</button>
            </div>)}
          </div>
          <footer className="organization-form-actions organization-modal-actions"><button type="button" className="secondary-action" onClick={() => { setIsBranchModalOpen(false); setEditingBranchCode(''); setBranchDraft(EMPTY_BRANCH) }} disabled={saving}>Cancel</button><button className="primary-action" disabled={saving} type="submit">{saving ? 'Saving...' : editingBranchCode ? 'Save branch' : 'Create branch'}</button></footer>
        </form>
      </section>
    </div>}
  </>
}

function templateLabel(template: string) {
  return template.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}
