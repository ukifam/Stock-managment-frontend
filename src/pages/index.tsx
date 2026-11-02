import { Dashboard } from './Dashboard'
import { Inventory } from './Inventory'
import { InventoryControl } from './InventoryControl'
import { Purchases } from './Purchases'
import { Sales } from './Sales'
import { Expenses } from './Expenses'
import { Loans } from './Loans'
import { Reports } from './Reports'
import { Settings } from './Settings'
import { StockMovements } from './StockMovements'
import { StockAdjustments } from './StockAdjustments'
import { Production } from './Production'
import { ProductionPipeline } from './ProductionPipeline'
import { QualityControl } from './QualityControl'
import { Transfers } from './Transfers'
import { SystemAdmin } from './SystemAdmin'
import { ShopUsers } from './ShopUsers'
import { AccessControl } from './AccessControl'
import { Organization } from './Organization'
import { Landing } from './Landing'
import { Login } from './Login'
import { Register } from './Register'
import { ForgotPassword } from './ForgotPassword'
import type { Page, PageDefinition, PageRenderProps } from '../types'

type TabbedPage = 'all' | 'items' | 'report'

function purchasesView(page: Page, subTab: TabbedPage) {
  return (props: PageRenderProps) => {
    const { entryRequest, listRefreshId, setPage, setReportScope, openEntryModal } = props
    const isEntry = entryRequest?.type === 'purchase'
    return (
      <Purchases
        key={`${page}-${isEntry && page === 'purchases' ? entryRequest.id : `list-${listRefreshId}`}`}
        page={page}
        subTab={subTab}
        setPage={setPage}
        theme={props.theme}
        toggleTheme={props.toggleTheme}
        startAdding={isEntry}
        entryMode={isEntry ? entryRequest.mode : 'scan'}
        onNewEntry={() => openEntryModal('purchase')}
        currency={props.currency}
        onOpenReport={() => {
          setReportScope('purchases')
          setPage('purchases-report')
        }}
      />
    )
  }
}

function salesView(page: Page, subTab: TabbedPage) {
  return (props: PageRenderProps) => {
    const { entryRequest, listRefreshId, setPage, setReportScope, openEntryModal } = props
    const isEntry = entryRequest?.type === 'sale'
    return (
      <Sales
        key={`${page}-${isEntry && page === 'sales' ? entryRequest.id : `list-${listRefreshId}`}`}
        page={page}
        subTab={subTab}
        setPage={setPage}
        theme={props.theme}
        toggleTheme={props.toggleTheme}
        startSelling={isEntry}
        entryMode={isEntry ? entryRequest.mode : 'scan'}
        onNewEntry={() => openEntryModal('sale')}
        currency={props.currency}
        onOpenReport={() => {
          setReportScope('sales')
          setPage('sales-report')
        }}
      />
    )
  }
}

function expensesView(page: Page, subTab: TabbedPage) {
  return ({ theme, toggleTheme, setPage, setReportScope, currency }: PageRenderProps) => (
    <Expenses
      page={page}
      subTab={subTab}
      setPage={setPage}
      currency={currency}
      theme={theme}
      toggleTheme={toggleTheme}
      onOpenReport={() => {
        setReportScope('expenses')
        setPage('expenses-report')
      }}
    />
  )
}

function loansView(page: Page, subTab: 'given' | 'taken' | 'repayments') {
  return ({ theme, toggleTheme, setPage, currency }: PageRenderProps) => (
    <Loans page={page} subTab={subTab} setPage={setPage} currency={currency} theme={theme} toggleTheme={toggleTheme} />
  )
}

function productionView(tab: 'planner' | 'objectives' | 'recipes' | 'processes' | 'orders' | 'procurement' | 'resources' | 'waste') {
  return (props: PageRenderProps) => <Production {...props} tab={tab} />
}

export const pageRegistry: PageDefinition[] = [
  { id: 'landing', label: 'Home', icon: 'home', render: ({ theme, toggleTheme, setPage }) => <Landing theme={theme} toggleTheme={toggleTheme} setPage={setPage} /> },
  { id: 'login', label: 'Sign In', icon: 'lock', render: ({ theme, toggleTheme, setPage }) => <Login theme={theme} toggleTheme={toggleTheme} setPage={setPage} /> },
  { id: 'register', label: 'Sign Up', icon: 'user-plus', render: ({ theme, toggleTheme, setPage }) => <Register theme={theme} toggleTheme={toggleTheme} setPage={setPage} /> },
  { id: 'forgot-password', label: 'Reset Password', icon: 'lock', render: ({ theme, toggleTheme, setPage }) => <ForgotPassword theme={theme} toggleTheme={toggleTheme} setPage={setPage} /> },
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'grid',
    render: ({ theme, toggleTheme, openEntryModal, activeShopName, processingEnabled, setPage, currency }) => (
      <Dashboard theme={theme} toggleTheme={toggleTheme} onNewEntry={openEntryModal} activeShopName={activeShopName} processingEnabled={processingEnabled} setPage={setPage} currency={currency} />
    ),
  },
  { id: 'organization', label: 'Business & Branches', icon: 'gear', render: (props) => <Organization {...props} /> },
  { id: 'shop-users', label: 'Staff', icon: 'user', render: (props) => <ShopUsers {...props} /> },
  { id: 'access-control', label: 'Roles & Permissions', icon: 'gear', render: (props) => <AccessControl {...props} /> },
  { id: 'quality-control', label: 'Quality Control', icon: 'box', render: (props) => <QualityControl {...props} /> },

  { id: 'inventory', label: 'Inventory', icon: 'box', render: (props) => <Inventory {...props} /> },
  { id: 'inventory-control', label: 'Inventory Setup', icon: 'box', render: ({ theme, toggleTheme, setPage }) => <InventoryControl theme={theme} toggleTheme={toggleTheme} setPage={setPage} /> },
  { id: 'stock-movements', label: 'Movements', icon: 'Activity', render: (props) => <StockMovements {...props} /> },
  { id: 'stock-adjustments', label: 'Adjustments', icon: 'Edit3', render: (props) => <StockAdjustments {...props} /> },

  { id: 'purchases', label: 'Purchases', icon: 'cart', render: purchasesView('purchases', 'all') },
  { id: 'purchase-items', label: 'Purchase Items', icon: 'cart', render: purchasesView('purchase-items', 'items') },
  { id: 'purchases-report', label: 'Purchases Report', icon: 'cart', render: purchasesView('purchases-report', 'report') },

  { id: 'sales', label: 'Sales', icon: 'tag', render: salesView('sales', 'all') },
  { id: 'sale-items', label: 'Sale Items', icon: 'tag', render: salesView('sale-items', 'items') },
  { id: 'sales-report', label: 'Sales Report', icon: 'tag', render: salesView('sales-report', 'report') },

  { id: 'expenses', label: 'Expenses', icon: 'receipt', render: expensesView('expenses', 'all') },
  { id: 'expense-items', label: 'Expense Items', icon: 'receipt', render: expensesView('expense-items', 'items') },
  { id: 'expenses-report', label: 'Expenses Report', icon: 'receipt', render: expensesView('expenses-report', 'report') },

  { id: 'loans', label: 'Loans & Debt', icon: 'credit-card', render: loansView('loans', 'given') },
  { id: 'loans-given', label: 'Loans Given', icon: 'credit-card', render: loansView('loans-given', 'given') },
  { id: 'loans-taken', label: 'Loans Taken', icon: 'credit-card', render: loansView('loans-taken', 'taken') },
  { id: 'loans-repayments', label: 'Repayments', icon: 'credit-card', render: loansView('loans-repayments', 'repayments') },

  {
    id: 'reports',
    label: 'Reports',
    icon: 'doc',
    render: ({ theme, toggleTheme, currency, reportScope, setReportScope }) => (
      <Reports theme={theme} toggleTheme={toggleTheme} currency={currency} reportScope={reportScope} onReportScopeChange={setReportScope} />
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'gear',
    render: ({ isLight, toggleTheme, onCurrencyChange, setPage }) => (
      <Settings isLight={isLight} toggleTheme={toggleTheme} onCurrencyChange={onCurrencyChange} setPage={setPage} />
    ),
  },

  { id: 'production', label: 'Production', icon: 'box', render: productionView('planner') },
  { id: 'production-objectives', label: 'What Do I Need?', icon: 'box', render: productionView('objectives') },
  { id: 'production-recipes', label: 'Recipes & BOM', icon: 'box', render: productionView('recipes') },
  { id: 'production-processes', label: 'Processes', icon: 'box', render: productionView('processes') },
  { id: 'production-orders', label: 'Orders & Quality', icon: 'box', render: productionView('orders') },
  { id: 'production-procurement', label: 'Purchasing', icon: 'box', render: productionView('procurement') },
  { id: 'production-resources', label: 'Resources & Cost', icon: 'box', render: productionView('resources') },
  { id: 'production-waste', label: 'Waste & By-products', icon: 'box', render: productionView('waste') },
  { id: 'production-pipeline', label: 'Pipeline', icon: 'box', render: ({ theme, toggleTheme, currency }) => <ProductionPipeline theme={theme} toggleTheme={toggleTheme} currency={currency} /> },

  { id: 'transfers', label: 'Transfers', icon: 'transfer', render: (props) => <Transfers {...props} /> },

  { id: 'system-admin', label: 'System Admin', icon: 'gear', render: (props) => <SystemAdmin {...props} /> },
  { id: 'system-admin-shops', label: 'Shops', icon: 'box', render: (props) => <SystemAdmin {...props} /> },
  { id: 'system-admin-users', label: 'User Accounts', icon: 'user', render: (props) => <SystemAdmin {...props} /> },
  { id: 'system-admin-activity', label: 'Activity Log', icon: 'reports', render: (props) => <SystemAdmin {...props} /> },
]
