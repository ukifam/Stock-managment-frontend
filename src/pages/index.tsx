import { Dashboard, page as dashboardPage } from './Dashboard'
import { Inventory, page as inventoryPage } from './Inventory'
import { Purchases, page as purchasesPage } from './Purchases'
import { Sales, page as salesPage } from './Sales'
import { Expenses, page as expensesPage } from './Expenses'
import { Reports, page as reportsPage } from './Reports'
import { Settings, page as settingsPage } from './Settings'
import type { PageDefinition } from '../types'

export const pageRegistry: PageDefinition[] = [
  {
    ...dashboardPage,
    render: ({ theme, toggleTheme, openEntryModal }) => (
      <Dashboard theme={theme} toggleTheme={toggleTheme} onNewEntry={() => openEntryModal()} />
    ),
  },
  {
    ...inventoryPage,
    render: ({ theme, toggleTheme }) => <Inventory theme={theme} toggleTheme={toggleTheme} />,
  },
  {
    ...purchasesPage,
    render: ({ theme, toggleTheme, entryRequest, currency, openEntryModal, listRefreshId, setPage, setReportScope }) => (
      <Purchases
        key={`purchase-${entryRequest?.type === 'purchase' ? entryRequest.id : `list-${listRefreshId}`}`}
        theme={theme}
        toggleTheme={toggleTheme}
        startAdding={entryRequest?.type === 'purchase'}
        entryMode={entryRequest?.type === 'purchase' ? entryRequest.mode : 'scan'}
        onNewEntry={() => openEntryModal('purchase')}
        currency={currency}
        onOpenReport={() => {
          setReportScope('purchases')
          setPage('reports')
        }}
      />
    ),
  },
  {
    ...salesPage,
    render: ({ theme, toggleTheme, entryRequest, currency, openEntryModal, listRefreshId, setPage, setReportScope }) => (
      <Sales
        key={`sale-${entryRequest?.type === 'sale' ? entryRequest.id : `list-${listRefreshId}`}`}
        theme={theme}
        toggleTheme={toggleTheme}
        startSelling={entryRequest?.type === 'sale'}
        entryMode={entryRequest?.type === 'sale' ? entryRequest.mode : 'scan'}
        onNewEntry={() => openEntryModal('sale')}
        currency={currency}
        onOpenReport={() => {
          setReportScope('sales')
          setPage('reports')
        }}
      />
    ),
  },
  {
    ...expensesPage,
    render: ({ theme, toggleTheme, setPage, setReportScope }) => (
      <Expenses
        theme={theme}
        toggleTheme={toggleTheme}
        onOpenReport={() => {
          setReportScope('expenses')
          setPage('reports')
        }}
      />
    ),
  },
  {
    ...reportsPage,
    render: ({ theme, toggleTheme, currency, reportScope, setReportScope }) => (
      <Reports theme={theme} toggleTheme={toggleTheme} currency={currency} reportScope={reportScope} onReportScopeChange={setReportScope} />
    ),
  },
  {
    ...settingsPage,
    render: ({ isLight, toggleTheme, onCurrencyChange }) => (
      <Settings isLight={isLight} toggleTheme={toggleTheme} onCurrencyChange={onCurrencyChange} />
    ),
  },
]
