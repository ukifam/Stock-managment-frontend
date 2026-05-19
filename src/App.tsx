import { useState } from 'react'
import { EntryFlowModal } from './components/EntryFlowModal'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './pages/Dashboard'
import { Inventory } from './pages/Inventory'
import { Purchases } from './pages/Purchases'
import { Reports } from './pages/Reports'
import { Sales } from './pages/Sales'
import { Settings } from './pages/Settings'
import type { EntryMode, EntryType, Page, Theme } from './types'
import './App.css'

function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [theme, setTheme] = useState<Theme>('dark')
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false)
  const [entryRequest, setEntryRequest] = useState<{ type: EntryType; mode: EntryMode; id: number } | null>(null)
  const isLight = theme === 'light'

  const toggleTheme = () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))

  const handleEntrySubmit = (type: EntryType, mode: EntryMode) => {
    setIsEntryModalOpen(false)
    setEntryRequest({ type, mode, id: Date.now() })
    setPage(type === 'purchase' ? 'purchases' : 'sales')
  }

  return (
    <main className={`shell ${theme}`}>
      <Sidebar page={page} setPage={setPage} onNewEntry={() => setIsEntryModalOpen(true)} />
      <section className="workspace">
        {page === 'dashboard' && <Dashboard theme={theme} toggleTheme={toggleTheme} />}
        {page === 'inventory' && <Inventory theme={theme} toggleTheme={toggleTheme} />}
        {page === 'purchases' && (
          <Purchases
            key={`purchase-${entryRequest?.type === 'purchase' ? entryRequest.id : 'list'}`}
            theme={theme}
            toggleTheme={toggleTheme}
            startAdding={entryRequest?.type === 'purchase'}
            entryMode={entryRequest?.type === 'purchase' ? entryRequest.mode : 'scan'}
          />
        )}
        {page === 'sales' && (
          <Sales
            key={`sale-${entryRequest?.type === 'sale' ? entryRequest.id : 'list'}`}
            theme={theme}
            toggleTheme={toggleTheme}
            startSelling={entryRequest?.type === 'sale'}
            entryMode={entryRequest?.type === 'sale' ? entryRequest.mode : 'scan'}
          />
        )}
        {page === 'reports' && <Reports theme={theme} toggleTheme={toggleTheme} />}
        {page === 'settings' && <Settings isLight={isLight} toggleTheme={toggleTheme} />}
      </section>
      {isEntryModalOpen && <EntryFlowModal onClose={() => setIsEntryModalOpen(false)} onSubmit={handleEntrySubmit} />}
    </main>
  )
}

export default App
