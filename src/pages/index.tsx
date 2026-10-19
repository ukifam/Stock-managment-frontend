import { Dashboard } from './Dashboard'
import { dashboardPage } from './dashboardPage'
import { Inventory, page as inventoryPage } from './Inventory'
import { InventoryControl } from './InventoryControl'
import { inventoryControlPage } from './inventoryControlPage'
import { Purchases, page as purchasesPage } from './Purchases'
import { Sales } from './Sales'
import { Expenses, page as expensesPage } from './Expenses'
import { Loans, page as loansPage } from './Loans'
import { Reports, page as reportsPage } from './Reports'
import { Settings, page as settingsPage } from './Settings'
import { StockMovements } from './StockMovements'
import { stockMovementsPage } from './stockMovementsPage'
import { StockAdjustments, page as stockAdjustmentsPage } from './StockAdjustments'
import { Production } from './Production'
import { ProductionPipeline } from './ProductionPipeline'
import { QualityControl } from './QualityControl'
import { productionPage } from './productionPage'
import { Transfers, page as transfersPage } from './Transfers'
import { SystemAdmin, page as systemAdminPage } from './SystemAdmin'
import { ShopUsers } from './ShopUsers'
import { shopUsersPage } from './shopUsersPage'
import { AccessControl } from './AccessControl'
import { accessControlPage } from './accessControlPage'
import { Organization } from './Organization'
import { organizationPage } from './organizationPage'
import { Landing } from './Landing'
import { Login } from './Login'
import { Register } from './Register'
import { ForgotPassword } from './ForgotPassword'
import type { PageDefinition } from '../types'

const salesPage = { id: 'sales' as const, label: 'Sales', icon: 'tag' }

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
    id: 'forgot-password',
    label: 'Reset Password',
    icon: 'lock',
    render: ({ theme, toggleTheme, setPage }) => <ForgotPassword theme={theme} toggleTheme={toggleTheme} setPage={setPage} />,
  },
  {
    ...dashboardPage,
    render: ({ theme, toggleTheme, openEntryModal, activeShopName, processingEnabled, setPage }) => (
      <Dashboard theme={theme} toggleTheme={toggleTheme} onNewEntry={() => openEntryModal()} activeShopName={activeShopName} processingEnabled={processingEnabled} setPage={setPage} />
    ),
  },
  {
    ...shopUsersPage,
    render: ({ theme, toggleTheme, setPage }) => <ShopUsers theme={theme} toggleTheme={toggleTheme} setPage={setPage} />,
  },
  {
    ...accessControlPage,
    render: ({ theme, toggleTheme, setPage }) => <AccessControl theme={theme} toggleTheme={toggleTheme} setPage={setPage} />,
  },
  {
    ...organizationPage,
    render: ({ theme, toggleTheme }) => <Organization theme={theme} toggleTheme={toggleTheme} />,
  },
  {
    id: 'quality-control',
    label: 'Quality Control',
    icon: 'box',
    render: ({ theme, toggleTheme }) => <QualityControl theme={theme} toggleTheme={toggleTheme} />,
  },
  {
    ...inventoryPage,
    render: (props) => <Inventory {...props} />,
  },
  {
    ...inventoryControlPage,
    render: ({ theme, toggleTheme, setPage }) => <InventoryControl theme={theme} toggleTheme={toggleTheme} setPage={setPage} />,
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
  {
    ...productionPage,
    render: (props) => <Production {...props} tab="planner" />,
  },
  {
    id: 'production-objectives',
    label: 'What Do I Need?',
    icon: 'box',
    render: (props) => <Production {...props} tab="objectives" />,
  },
  {
    id: 'production-recipes',
    label: 'Recipes & BOM',
    icon: 'box',
    render: (props) => <Production {...props} tab="recipes" />,
  },
  {
    id: 'production-processes',
    label: 'Production Processes',
    icon: 'box',
    render: (props) => <Production {...props} tab="processes" />,
  },
  {
    id: 'production-orders',
    label: 'Orders & Quality',
    icon: 'box',
    render: (props) => <Production {...props} tab="orders" />,
  },
  {
    id: 'production-procurement',
    label: 'Purchasing',
    icon: 'box',
    render: (props) => <Production {...props} tab="procurement" />,
  },
  {
    id: 'production-resources',
    label: 'Resources & Cost',
    icon: 'box',
    render: (props) => <Production {...props} tab="resources" />,
  },
  {
    id: 'production-waste',
    label: 'Waste & By-products',
    icon: 'box',
    render: (props) => <Production {...props} tab="waste" />,
  },
  {
    id: 'production-pipeline',
    label: 'Pipeline',
    icon: 'box',
    render: (props) => <ProductionPipeline theme={props.theme} toggleTheme={props.toggleTheme} currency={props.currency} />,
  },
  {
    ...transfersPage,
    render: (props) => <Transfers {...props} />,
  },
  {
    ...systemAdminPage,
    render: (props) => <SystemAdmin {...props} />,
  },
  {
    id: 'system-admin-shops',
    label: 'Shops',
    icon: 'box',
    render: (props) => <SystemAdmin {...props} />,
  },
  {
    id: 'system-admin-users',
    label: 'User Accounts',
    icon: 'user',
    render: (props) => <SystemAdmin {...props} />,
  },
  {
    id: 'system-admin-activity',
    label: 'Activity Log',
    icon: 'reports',
    render: (props) => <SystemAdmin {...props} />,
  },
  {
    ...shopUsersPage,
    render: (props) => <ShopUsers {...props} />,
  },
  {
    ...accessControlPage,
    render: (props) => <AccessControl {...props} />,
  },
  {
    ...organizationPage,
    render: (props) => <Organization {...props} />,
  },
  {
    id: 'quality-control',
    label: 'Quality Control',
    icon: 'box',
    render: (props) => <QualityControl {...props} />,
  },
]
