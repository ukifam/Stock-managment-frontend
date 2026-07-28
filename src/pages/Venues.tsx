import { useEffect, useState } from 'react'
import type React from 'react'
import { api, type VenueRow } from '../api'
import { Topbar } from '../components/Topbar'
import type { ThemePageProps } from '../types'

export function Venues({ theme, toggleTheme }: ThemePageProps) {
  const [venues, setVenues] = useState<VenueRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [selectedVenue, setSelectedVenue] = useState<VenueRow | null>(null)
  const [formData, setFormData] = useState<Partial<VenueRow>>({})

  useEffect(() => {
    loadVenues()
  }, [])

  const loadVenues = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.venues()
      setVenues(response.rows ?? [])
    } catch (error) {
      console.error('Failed to load venues:', error)
      setError(error instanceof Error ? error.message : 'Failed to load venues')
      setVenues([])
    } finally {
      setLoading(false)
    }
  }

  const handleAddVenue = () => {
    setFormData({})
    setSelectedVenue(null)
    setShowForm(true)
  }

  const handleEditVenue = (venue: VenueRow) => {
    setFormData(venue)
    setSelectedVenue(venue)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (selectedVenue?.code) {
        // Update
        await api.updateVenue(selectedVenue.code, formData)
      } else {
        // Create
        await api.createVenue(formData as VenueRow)
      }

      setShowForm(false)
      loadVenues()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to save venue')
    }
  }

  const handleDeleteVenue = async (code: string) => {
    if (confirm('Are you sure you want to delete this venue?')) {
      try {
        await api.deleteVenue(code)
        loadVenues()
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Failed to delete venue')
      }
    }
  }

  return (
    <>
      <Topbar placeholder="Search venues..." theme={theme} toggleTheme={toggleTheme} />
      <div className="page-container page-pad">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1>Saved Venue Listings</h1>
            <p>Browse all saved venues</p>
          </div>
          <button onClick={handleAddVenue} className="primary-action">
            + Add Venue
          </button>
        </div>

        {loading ? (
          <p>Loading venues...</p>
        ) : error ? (
          <div style={{ padding: '40px', textAlign: 'center', border: '1px solid #ddd', borderRadius: '8px' }}>
            <p style={{ color: '#b42318', fontSize: '16px', marginBottom: '16px' }}>{error}</p>
            <button onClick={loadVenues} className="primary-action">
              Retry
            </button>
          </div>
        ) : venues.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', border: '1px solid #ddd', borderRadius: '8px' }}>
            <p style={{ color: '#666', fontSize: '16px', marginBottom: '16px' }}>
              No venues found in the backend database yet.
            </p>
            <button onClick={handleAddVenue} className="primary-action">
              Create First Venue
            </button>
          </div>
        ) : (
          <div className="table-frame">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Type</th>
                  <th>Location</th>
                  <th>Manager</th>
                  <th>Capacity</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {venues.map((venue) => (
                  <tr key={venue.code}>
                    <td>
                      <strong>{venue.name}</strong>
                    </td>
                    <td>{venue.code}</td>
                    <td>{venue.type}</td>
                    <td>{venue.location}</td>
                    <td>{venue.manager}</td>
                    <td>{venue.capacity} units</td>
                    <td>
                      <i className={venue.status === 'Active' ? 'status' : 'status low'}>{venue.status}</i>
                    </td>
                    <td>
                      <button onClick={() => handleEditVenue(venue)} style={{ marginRight: '8px' }}>
                        Edit
                      </button>
                      <button onClick={() => handleDeleteVenue(venue.code)} style={{ color: '#d32f2f' }}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showForm && (
          <VenueForm
            venue={selectedVenue}
            onSubmit={handleSubmit}
            onChange={setFormData}
            onCancel={() => setShowForm(false)}
            data={formData}
          />
        )}
      </div>
    </>
  )
}

function VenueForm({
  venue,
  onSubmit,
  onChange,
  onCancel,
  data,
}: {
  venue?: VenueRow | null
  onSubmit: (e: React.FormEvent) => void
  onChange: (data: Partial<VenueRow>) => void
  onCancel: () => void
  data: Partial<VenueRow>
}) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <form
        onSubmit={onSubmit}
        style={{
          backgroundColor: '#fff',
          padding: '24px',
          borderRadius: '8px',
          maxWidth: '500px',
          width: '90%',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <h2>{venue ? 'Edit Venue' : 'Add New Venue'}</h2>

        <div style={{ marginBottom: '16px' }}>
          <label>
            Venue Name *
            <input
              type="text"
              required
              value={data.name || ''}
              onChange={(e) => onChange({ ...data, name: e.target.value })}
              style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </label>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label>
            Venue Code *
            <input
              type="text"
              required
              value={data.code || ''}
              onChange={(e) => onChange({ ...data, code: e.target.value })}
              placeholder="e.g., WH-001"
              style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
              disabled={!!venue}
            />
          </label>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label>
            Type *
            <select
              required
              value={data.type || 'Warehouse'}
              onChange={(e) => onChange({ ...data, type: e.target.value })}
              style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option>Warehouse</option>
              <option>Retail</option>
              <option>Distribution</option>
              <option>Store</option>
            </select>
          </label>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label>
            Location
            <input
              type="text"
              value={data.location || ''}
              onChange={(e) => onChange({ ...data, location: e.target.value })}
              style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </label>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label>
            Address
            <textarea
              value={data.address || ''}
              onChange={(e) => onChange({ ...data, address: e.target.value })}
              style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px' }}
            />
          </label>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label>
            Capacity (units)
            <input
              type="number"
              value={data.capacity || 1000}
              onChange={(e) => onChange({ ...data, capacity: parseInt(e.target.value) })}
              style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </label>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label>
            Manager
            <input
              type="text"
              value={data.manager || ''}
              onChange={(e) => onChange({ ...data, manager: e.target.value })}
              style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </label>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label>
            Contact
            <input
              type="tel"
              value={data.contact || ''}
              onChange={(e) => onChange({ ...data, contact: e.target.value })}
              style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </label>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label>
            Status
            <select
              value={data.status || 'Active'}
              onChange={(e) => onChange({ ...data, status: e.target.value })}
              style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option>Active</option>
              <option>Inactive</option>
              <option>Maintenance</option>
            </select>
          </label>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label>
            Notes
            <textarea
              value={data.notes || ''}
              onChange={(e) => onChange({ ...data, notes: e.target.value })}
              style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px' }}
            />
          </label>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="primary-action">
            {venue ? 'Update Venue' : 'Create Venue'}
          </button>
        </div>
      </form>
    </div>
  )
}
