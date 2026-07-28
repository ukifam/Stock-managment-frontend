import { useEffect, useState } from 'react'
import { EntryFlowModal } from './components/EntryFlowModal'
import { api, type ManualEntryPayload } from './api'
import { Sidebar } from './components/Sidebar'
import { pageRegistry } from './pages'
import type { EntryMode, EntryType, Page, ReportScope, Theme } from './types'
import './App.css'

function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [theme, setTheme] = useState<Theme>('dark')
  const [currency, setCurrency] = useState('RWF')
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false)
  const [entryModalType, setEntryModalType] = useState<EntryType | undefined>()
  const [entryRequest, setEntryRequest] = useState<{ type: EntryType; mode: EntryMode; id: number } | null>(null)
  const [listRefreshId, setListRefreshId] = useState(0)
  const [reportScope, setReportScope] = useState<ReportScope>('all')
  const isLight = theme === 'light'

  useEffect(() => {
    api.settings().then((settings) => setCurrency(settings.financial.currency)).catch(() => undefined)
  }, [])

  const toggleTheme = () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))

  const openEntryModal = (type?: EntryType) => {
    setEntryModalType(type)
    setIsEntryModalOpen(true)
  }

  const closeEntryModal = () => {
    setIsEntryModalOpen(false)
    setEntryModalType(undefined)
  }

  const handleEntrySubmit = async (type: EntryType, mode: EntryMode, payload?: ManualEntryPayload) => {
    if (payload) {
      try {
        if (type === 'purchase') {
          await api.createPurchase(payload)
        } else {
          await api.createSale(payload)
        }
      } catch (error) {
        window.alert(error instanceof Error ? error.message : 'Could not save the entry. Please check the backend connection and try again.')
        return
      }

      closeEntryModal()
      setEntryRequest(null)
      setListRefreshId(Date.now())
      setPage(type === 'purchase' ? 'purchases' : 'sales')
      return
    }

    closeEntryModal()
    setEntryRequest({ type, mode, id: Date.now() })
    setPage(type === 'purchase' ? 'purchases' : 'sales')
  }

  return (
    <main className={`shell ${theme} ${page === 'reports' ? 'reports-mode' : ''}`}>
      <Sidebar page={page} setPage={setPage} onNewEntry={() => openEntryModal()} />
      <section className="workspace">
        {pageRegistry.find((entry) => entry.id === page)?.render({
          theme,
          toggleTheme,
          openEntryModal,
          setPage,
          entryRequest,
          currency,
          isLight,
          onCurrencyChange: setCurrency,
          listRefreshId,
          reportScope,
          setReportScope,
        })}
      </section>
      {isEntryModalOpen && <EntryFlowModal initialType={entryModalType} currency={currency} onClose={closeEntryModal} onSubmit={handleEntrySubmit} />}
    </main>
  )
}

export default App
