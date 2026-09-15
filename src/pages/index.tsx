import { Dashboard, page as dashboardPage } from './Dashboard'
import { Inventory, page as inventoryPage } from './Inventory'
import { Purchases, page as purchasesPage } from './Purchases'
import { Sales, page as salesPage } from './Sales'
import { Expenses, page as expensesPage } from './Expenses'
import { Loans, page as loansPage } from './Loans'
import { Reports, page as reportsPage } from './Reports'
import { Settings, page as settingsPage } from './Settings'
import { StockMovements, page as stockMovementsPage } from './StockMovements'
import { StockAdjustments, page as stockAdjustmentsPage } from './StockAdjustments'
import { Landing } from './Landing'
import { Login } from './Login'
import { Register } from './Register'
import type { PageDefinition } from '../types'

export const pageRegistry: PageDefinition[] = [
  {
    id: 'landing',
    label: 'Home',
    icon: 'home',
    render: ({ theme, toggleTheme, setPage }) => (
      <Landing theme={theme} toggleTheme={toggleTheme} setPage={setPage} />
    ),
  },
  {
    id: 'login',
    label: 'Sign In',
    icon: 'lock',
    render: ({ theme, toggleTheme, setPage }) => (
      <Login theme={theme} toggleTheme={toggleTheme} setPage={setPage} />
    ),
  },
  {
    id: 'register',
    label: 'Sign Up',
    icon: 'user-plus',
    render: ({ theme, toggleTheme, setPage }) => (
      <Register theme={theme} toggleTheme={toggleTheme} setPage={setPage} />
    ),
  },
  {
    ...dashboardPage,
    render: ({ theme, toggleTheme, openEntryModal }) => (
      <Dashboard theme={theme} toggleTheme={toggleTheme} onNewEntry={() => openEntryModal()} />
    ),
  },
  {
    ...inventoryPage,
    render: (props) => <Inventory {...props} />,
  },
  // Purchases Group
  {
    ...purchasesPage,
    id: 'purchases',
    render: ({ theme, toggleTheme, entryRequest, currency, openEntryModal, listRefreshId, setPage, setReportScope }) => (
      <Purchases
        key={`purchase-${entryRequest?.type === 'purchase' ? entryRequest.id : `list-${listRefreshId}`}`}
        page="purchases"
        subTab="all"
        setPage={setPage}
        theme={theme}
        toggleTheme={toggleTheme}
        startAdding={entryRequest?.type === 'purchase'}
        entryMode={entryRequest?.type === 'purchase' ? entryRequest.mode : 'scan'}
        onNewEntry={() => openEntryModal('purchase')}
        currency={currency}
        onOpenReport={() => {
          setReportScope('purchases')
          setPage('purchases-report')
        }}
      />
    ),
  },
  {
    id: 'purchase-items',
    label: 'Purchase Items',
    icon: 'cart',
    render: ({ theme, toggleTheme, entryRequest, currency, openEntryModal, listRefreshId, setPage, setReportScope }) => (
      <Purchases
        key={`purchase-items-${listRefreshId}`}
        page="purchase-items"
        subTab="items"
        setPage={setPage}
        theme={theme}
        toggleTheme={toggleTheme}
        startAdding={entryRequest?.type === 'purchase'}
        entryMode={entryRequest?.type === 'purchase' ? entryRequest.mode : 'scan'}
        onNewEntry={() => openEntryModal('purchase')}
        currency={currency}
        onOpenReport={() => {
          setReportScope('purchases')
          setPage('purchases-report')
        }}
      />
    ),
  },
  {
    id: 'purchases-report',
    label: 'Purchases Report',
    icon: 'cart',
    render: ({ theme, toggleTheme, entryRequest, currency, openEntryModal, listRefreshId, setPage, setReportScope }) => (
      <Purchases
        key={`purchase-report-${listRefreshId}`}
        page="purchases-report"
        subTab="report"
        setPage={setPage}
        theme={theme}
        toggleTheme={toggleTheme}
        startAdding={entryRequest?.type === 'purchase'}
        entryMode={entryRequest?.type === 'purchase' ? entryRequest.mode : 'scan'}
        onNewEntry={() => openEntryModal('purchase')}
        currency={currency}
        onOpenReport={() => {
          setReportScope('purchases')
          setPage('purchases-report')
        }}
      />
    ),
  },
  // Sales Group
  {
    ...salesPage,
    id: 'sales',
    render: ({ theme, toggleTheme, entryRequest, currency, openEntryModal, listRefreshId, setPage, setReportScope }) => (
      <Sales
        key={`sale-${entryRequest?.type === 'sale' ? entryRequest.id : `list-${listRefreshId}`}`}
        page="sales"
        subTab="all"
        setPage={setPage}
        theme={theme}
        toggleTheme={toggleTheme}
        startSelling={entryRequest?.type === 'sale'}
        entryMode={entryRequest?.type === 'sale' ? entryRequest.mode : 'scan'}
        onNewEntry={() => openEntryModal('sale')}
        currency={currency}
        onOpenReport={() => {
          setReportScope('sales')
          setPage('sales-report')
        }}
      />
    ),
  },
  {
    id: 'sale-items',
    label: 'Sale Items',
    icon: 'tag',
    render: ({ theme, toggleTheme, entryRequest, currency, openEntryModal, listRefreshId, setPage, setReportScope }) => (
      <Sales
        key={`sale-items-${listRefreshId}`}
        page="sale-items"
        subTab="items"
        setPage={setPage}
        theme={theme}
        toggleTheme={toggleTheme}
        startSelling={entryRequest?.type === 'sale'}
        entryMode={entryRequest?.type === 'sale' ? entryRequest.mode : 'scan'}
        onNewEntry={() => openEntryModal('sale')}
        currency={currency}
        onOpenReport={() => {
          setReportScope('sales')
          setPage('sales-report')
        }}
      />
    ),
  },
  {
    id: 'sales-report',
    label: 'Sales Report',
    icon: 'tag',
    render: ({ theme, toggleTheme, entryRequest, currency, openEntryModal, listRefreshId, setPage, setReportScope }) => (
      <Sales
        key={`sales-report-${listRefreshId}`}
        page="sales-report"
        subTab="report"
        setPage={setPage}
        theme={theme}
        toggleTheme={toggleTheme}
        startSelling={entryRequest?.type === 'sale'}
        entryMode={entryRequest?.type === 'sale' ? entryRequest.mode : 'scan'}
        onNewEntry={() => openEntryModal('sale')}
        currency={currency}
        onOpenReport={() => {
          setReportScope('sales')
          setPage('sales-report')
        }}
      />
    ),
  },
  // Expenses Group
  {
    ...expensesPage,
    id: 'expenses',
    render: ({ theme, toggleTheme, setPage, setReportScope, currency }) => (
      <Expenses
        page="expenses"
        subTab="all"
        setPage={setPage}
        currency={currency}
        theme={theme}
        toggleTheme={toggleTheme}
        onOpenReport={() => {
          setReportScope('expenses')
          setPage('expenses-report')
        }}
      />
    ),
  },
  {
    id: 'expense-items',
    label: 'Expense Items',
    icon: 'receipt',
    render: ({ theme, toggleTheme, setPage, setReportScope, currency }) => (
      <Expenses
        page="expense-items"
        subTab="items"
        setPage={setPage}
        currency={currency}
        theme={theme}
        toggleTheme={toggleTheme}
        onOpenReport={() => {
          setReportScope('expenses')
          setPage('expenses-report')
        }}
      />
    ),
  },
  {
    id: 'expenses-report',
    label: 'Expenses Report',
    icon: 'receipt',
    render: ({ theme, toggleTheme, setPage, setReportScope, currency }) => (
      <Expenses
        page="expenses-report"
        subTab="report"
        setPage={setPage}
        currency={currency}
        theme={theme}
        toggleTheme={toggleTheme}
        onOpenReport={() => {
          setReportScope('expenses')
          setPage('expenses-report')
        }}
      />
    ),
  },
  // Loans & Debt Group
  {
    ...loansPage,
    id: 'loans',
    render: ({ theme, toggleTheme, setPage, currency }) => (
      <Loans
        page="loans"
        subTab="given"
        setPage={setPage}
        currency={currency}
        theme={theme}
        toggleTheme={toggleTheme}
      />
    ),
  },
  {
    id: 'loans-given',
    label: 'Loans Given',
    icon: 'credit-card',
    render: ({ theme, toggleTheme, setPage, currency }) => (
      <Loans
        page="loans-given"
        subTab="given"
        setPage={setPage}
        currency={currency}
        theme={theme}
        toggleTheme={toggleTheme}
      />
    ),
  },
  {
    id: 'loans-taken',
    label: 'Loans Taken',
    icon: 'credit-card',
    render: ({ theme, toggleTheme, setPage, currency }) => (
      <Loans
        page="loans-taken"
        subTab="taken"
        setPage={setPage}
        currency={currency}
        theme={theme}
        toggleTheme={toggleTheme}
      />
    ),
  },
  {
    id: 'loans-repayments',
    label: 'Repayments Ledger',
    icon: 'credit-card',
    render: ({ theme, toggleTheme, setPage, currency }) => (
      <Loans
        page="loans-repayments"
        subTab="repayments"
        setPage={setPage}
        currency={currency}
        theme={theme}
        toggleTheme={toggleTheme}
      />
    ),
  },
  // General Reports
  {
    ...reportsPage,
    render: ({ theme, toggleTheme, currency, reportScope, setReportScope }) => (
      <Reports theme={theme} toggleTheme={toggleTheme} currency={currency} reportScope={reportScope} onReportScopeChange={setReportScope} />
    ),
  },
  // Settings
  {
    ...settingsPage,
    render: ({ isLight, toggleTheme, onCurrencyChange }) => (
      <Settings isLight={isLight} toggleTheme={toggleTheme} onCurrencyChange={onCurrencyChange} />
    ),
  },
  // Stock Movements & Adjustments
  {
    ...stockMovementsPage,
    render: (props) => (
      <StockMovements {...props} />
    ),
  },
  {
    ...stockAdjustmentsPage,
    render: (props) => (
      <StockAdjustments {...props} />
    ),
  },
]
