import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { api, type QualityInspection, type QualityOverview } from '../api'
import { Topbar } from '../components/Topbar'
import { useAuth } from '../context/AuthContext'
import type { Theme } from '../types'

type QualityControlProps = { theme: Theme; toggleTheme: () => void }

type CriterionDraft = { name: string; minimum: string; maximum: string; requiredResult: string; unit: string }

const EMPTY_CRITERION: CriterionDraft = { name: '', minimum: '', maximum: '', requiredResult: '', unit: '' }

export function QualityControl({ theme, toggleTheme }: QualityControlProps) {
  const { user } = useAuth()
  const [overview, setOverview] = useState<QualityOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [standardName, setStandardName] = useState('')
  const [standardProduct, setStandardProduct] = useState('')
  const [standardProcess, setStandardProcess] = useState('')
  const [standardStep, setStandardStep] = useState('')
  const [criteria, setCriteria] = useState<CriterionDraft[]>([{ ...EMPTY_CRITERION }])
  const [inspectionStandard, setInspectionStandard] = useState('')
  const [inspectionProduct, setInspectionProduct] = useState('')
  const [inspectionOrder, setInspectionOrder] = useState('')
  const [batchNumber, setBatchNumber] = useState('')
  const [inspectionNotes, setInspectionNotes] = useState('')
  const [resultValues, setResultValues] = useState<Record<string, string>>({})

  const selectedStandard = useMemo(
    () => overview?.standards.find((standard) => standard._id === inspectionStandard),
    [inspectionStandard, overview?.standards],
  )
  const canApprove = user?.role === 'admin' || Boolean(user?.permissions?.some(
    (permission) => permission.module === 'quality' && permission.actions.includes('approve'),
  ))

  const refresh = async () => setOverview(await api.qualityOverview())

  useEffect(() => {
    let active = true
    api.qualityOverview()
      .then((result) => { if (active) setOverview(result) })
      .catch((loadError: unknown) => { if (active) setError(messageFor(loadError)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const addCriterion = () => setCriteria((current) => [...current, { ...EMPTY_CRITERION }])

  const updateCriterion = (index: number, patch: Partial<CriterionDraft>) => {
    setCriteria((current) => current.map((criterion, itemIndex) => itemIndex === index ? { ...criterion, ...patch } : criterion))
  }

  const submitStandard = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await api.createQualityStandard({
        name: standardName.trim(),
        productSku: standardProduct,
        processCode: standardProcess,
        stepSequence: standardStep ? Number(standardStep) : null,
        criteria: criteria.map((criterion) => ({
          name: criterion.name.trim(),
          minimum: criterion.minimum ? Number(criterion.minimum) : null,
          maximum: criterion.maximum ? Number(criterion.maximum) : null,
          requiredResult: criterion.requiredResult.trim(),
          unit: criterion.unit.trim(),
        })),
      })
      setStandardName('')
      setCriteria([{ ...EMPTY_CRITERION }])
      await refresh()
      setNotice('Quality standard created.')
    } catch (saveError) {
      setError(messageFor(saveError))
    } finally {
      setSaving(false)
    }
  }

  const submitInspection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedStandard) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const inspection = await api.createQualityInspection({
        standardId: selectedStandard._id,
        productSku: inspectionProduct,
        productionOrderId: inspectionOrder,
        batchNumber,
        processCode: selectedStandard.processCode,
        stepSequence: selectedStandard.stepSequence ?? undefined,
        results: selectedStandard.criteria.map((criterion) => ({
          name: criterion.name,
          value: resultValues[criterion.name] ?? '',
        })),
        notes: inspectionNotes,
      })
      await refresh()
      setBatchNumber('')
      setInspectionOrder('')
      setInspectionNotes('')
      setResultValues({})
      setNotice(`Inspection recorded: ${outcomeLabel(inspection.outcome)}.`)
    } catch (saveError) {
      setError(messageFor(saveError))
    } finally {
      setSaving(false)
    }
  }

  const disposition = async (inspection: QualityInspection, outcome: 'ON_HOLD' | 'REWORK' | 'REJECT') => {
    setError('')
    setNotice('')
    try {
      await api.setQualityDisposition(inspection._id, outcome)
      await refresh()
      setNotice(`Inspection disposition updated to ${outcomeLabel(outcome)}.`)
    } catch (saveError) {
      setError(messageFor(saveError))
    }
  }

  return (
    <div className="page">
      <Topbar title="Quality Control" theme={theme} toggleTheme={toggleTheme} />
      <section className="page-content">
        <header className="page-heading">
          <div><h1>Quality Control</h1><p>Define measurable standards and record batch inspections.</p></div>
        </header>
        {error && <div className="notice error" role="alert">{error}</div>}
        {notice && <div className="notice success" role="status">{notice}</div>}
        {loading ? <p>Loading quality records…</p> : (
          <div className="quality-layout">
            <section className="panel">
              <h2>Create quality standard</h2>
              <form className="form-grid" onSubmit={submitStandard}>
                <label>Standard name<input required value={standardName} onChange={(event) => setStandardName(event.target.value)} /></label>
                <label>Product (optional)
                  <select value={standardProduct} onChange={(event) => setStandardProduct(event.target.value)}>
                    <option value="">Any product</option>
                    {overview?.products.map((product) => <option key={product.sku} value={product.sku}>{product.sku} — {product.item}</option>)}
                  </select>
                </label>
                <label>Process (optional)
                  <select value={standardProcess} onChange={(event) => setStandardProcess(event.target.value)}>
                    <option value="">No process link</option>
                    {overview?.processes.map((process) => <option key={process.code} value={process.code}>{process.code} — {process.name}</option>)}
                  </select>
                </label>
                <label>Process step
                  <select value={standardStep} onChange={(event) => setStandardStep(event.target.value)} disabled={!standardProcess}>
                    <option value="">All process steps</option>
                    {overview?.processes.find((process) => process.code === standardProcess)?.steps.map((step) => (
                      <option key={step.sequence} value={step.sequence}>{step.sequence}. {step.name}</option>
                    ))}
                  </select>
                </label>
                <div className="quality-criteria">
                  <h3>Criteria</h3>
                  {criteria.map((criterion, index) => (
                    <div className="quality-criterion" key={index}>
                      <label>Name<input required value={criterion.name} onChange={(event) => updateCriterion(index, { name: event.target.value })} /></label>
                      <label>Min<input type="number" step="any" value={criterion.minimum} onChange={(event) => updateCriterion(index, { minimum: event.target.value })} /></label>
                      <label>Max<input type="number" step="any" value={criterion.maximum} onChange={(event) => updateCriterion(index, { maximum: event.target.value })} /></label>
                      <label>Required result<input value={criterion.requiredResult} onChange={(event) => updateCriterion(index, { requiredResult: event.target.value })} /></label>
                      <label>Unit<input value={criterion.unit} onChange={(event) => updateCriterion(index, { unit: event.target.value })} /></label>
                    </div>
                  ))}
                  <button type="button" className="secondary-button" onClick={addCriterion}>Add criterion</button>
                </div>
                <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save standard'}</button>
              </form>
            </section>

            <section className="panel">
              <h2>Record inspection</h2>
              <form className="form-grid" onSubmit={submitInspection}>
                <label>Quality standard
                  <select required value={inspectionStandard} onChange={(event) => {
                    const standard = overview?.standards.find((entry) => entry._id === event.target.value)
                    setInspectionStandard(event.target.value)
                    setInspectionProduct(standard?.productSku || '')
                    setResultValues({})
                  }}>
                    <option value="">Select standard</option>
                    {overview?.standards.filter((standard) => standard.active).map((standard) => (
                      <option key={standard._id} value={standard._id}>{standard.name}</option>
                    ))}
                  </select>
                </label>
                <label>Product
                  <select required value={inspectionProduct} onChange={(event) => setInspectionProduct(event.target.value)}>
                    <option value="">Select product</option>
                    {overview?.products.map((product) => <option key={product.sku} value={product.sku}>{product.sku} — {product.item}</option>)}
                  </select>
                </label>
                <label>Production order (optional)
                  <select value={inspectionOrder} onChange={(event) => {
                    const order = overview?.orders.find((entry) => entry.id === event.target.value)
                    setInspectionOrder(event.target.value)
                    setBatchNumber(order?.id || batchNumber)
                    if (order) setInspectionProduct(order.productSku)
                  }}>
                    <option value="">Not linked</option>
                    {overview?.orders.map((order) => <option key={order.id} value={order.id}>{order.id} — {order.productName} ({order.status})</option>)}
                  </select>
                </label>
                <label>Batch number<input required value={batchNumber} onChange={(event) => setBatchNumber(event.target.value)} /></label>
                {selectedStandard?.criteria.map((criterion) => (
                  <label key={criterion.name}>{criterion.name}{criterion.unit ? ` (${criterion.unit})` : ''}
                    <input
                      required
                      type={criterion.minimum !== null || criterion.maximum !== null ? 'number' : 'text'}
                      step="any"
                      value={resultValues[criterion.name] || ''}
                      onChange={(event) => setResultValues((current) => ({ ...current, [criterion.name]: event.target.value }))}
                    />
                  </label>
                ))}
                <label>Notes<textarea value={inspectionNotes} onChange={(event) => setInspectionNotes(event.target.value)} /></label>
                <button type="submit" disabled={saving || !selectedStandard}>{saving ? 'Saving…' : 'Record inspection'}</button>
              </form>
            </section>
          </div>
        )}

        <section className="panel">
          <h2>Recent inspections</h2>
          <div className="table-wrap">
            <table><thead><tr><th>Date</th><th>Product / Batch</th><th>Inspector</th><th>Results</th><th>Outcome</th><th>Disposition</th></tr></thead>
              <tbody>{overview?.inspections.map((inspection) => (
                <tr key={inspection._id}>
                  <td>{new Date(inspection.inspectionDate).toLocaleDateString()}</td>
                  <td>{inspection.productName} ({inspection.productSku})<br />{inspection.batchNumber}</td>
                  <td>{inspection.inspector?.username || inspection.inspector?.email || '—'}</td>
                  <td>{inspection.results.map((result) => `${result.name}: ${result.value}${result.unit ? ` ${result.unit}` : ''} ${result.passed ? '✓' : '✗'}`).join('; ')}</td>
                  <td>{outcomeLabel(inspection.outcome)}</td>
                  <td>{canApprove && ['FAIL', 'ON_HOLD', 'REWORK'].includes(inspection.outcome) ? (
                    <div className="button-row">
                      <button type="button" onClick={() => void disposition(inspection, 'ON_HOLD')}>Hold</button>
                      <button type="button" onClick={() => void disposition(inspection, 'REWORK')}>Rework</button>
                      <button type="button" onClick={() => void disposition(inspection, 'REJECT')}>Reject</button>
                    </div>
                  ) : '—'}</td>
                </tr>
              ))}</tbody>
            </table>
            {!overview?.inspections.length && <p>No inspections recorded yet.</p>}
          </div>
        </section>
      </section>
    </div>
  )
}

function outcomeLabel(outcome: string) {
  return ({ PASS: 'Passed', FAIL: 'Failed', ON_HOLD: 'On Hold', REWORK: 'Rework', REJECT: 'Rejected' } as Record<string, string>)[outcome] || outcome
}

function messageFor(error: unknown) {
  return error instanceof Error ? error.message : 'Quality operation failed.'
}
