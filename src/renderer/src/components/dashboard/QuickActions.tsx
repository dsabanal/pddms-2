import type { DashboardView } from '@renderer/data/adminDashboard'
import { useAccount } from '@renderer/hooks/useAccount'
import { canAccessPath } from '@renderer/navigation/access'
import { Link } from '@tanstack/react-router'
import type { ReactElement } from 'react'
import type { IconType } from 'react-icons'
import {
  FiBarChart2,
  FiClipboard,
  FiCreditCard,
  FiPackage,
  FiSearch,
  FiShoppingCart,
  FiUserPlus,
  FiUsers
} from 'react-icons/fi'

interface QuickAction {
  label: string
  description: string
  to: '/sales' | '/inventory' | '/suppliers' | '/customers' | '/users' | '/reports'
  tab?: 'orders' | 'receiving' | 'invoices'
  icon: IconType
}

// Note: Ordered by how often each role needs the task. Links are still filtered by canAccessPath,
// so a role never sees a shortcut to a page it cannot open.
const actions: Record<DashboardView, QuickAction[]> = {
  admin: [
    {
      label: 'Manage Users',
      description: 'Create, block or unblock',
      to: '/users',
      icon: FiUsers
    },
    {
      label: 'Open Reports',
      description: 'Sales, stock and receiving',
      to: '/reports',
      icon: FiBarChart2
    },
    {
      label: 'Create Purchase Order',
      description: 'Order stock from a supplier',
      to: '/suppliers',
      tab: 'orders',
      icon: FiClipboard
    },
    {
      label: 'Receive Products',
      description: 'Record batches and expiry dates',
      to: '/suppliers',
      tab: 'receiving',
      icon: FiPackage
    }
  ],
  staff: [
    {
      label: 'Look Up a Product',
      description: 'Stock, batches and expiry dates',
      to: '/inventory',
      icon: FiSearch
    },
    {
      label: 'Receive Products',
      description: 'Record batches and expiry dates',
      to: '/suppliers',
      tab: 'receiving',
      icon: FiPackage
    },
    {
      label: 'Create Purchase Order',
      description: 'Order stock from a supplier',
      to: '/suppliers',
      tab: 'orders',
      icon: FiClipboard
    },
    {
      label: 'Record Supplier Payment',
      description: 'Invoices, balances and payments',
      to: '/suppliers',
      tab: 'invoices',
      icon: FiCreditCard
    }
  ],
  cashier: [
    {
      label: 'Start a Sale',
      description: 'Search products, check stock, take payment',
      to: '/sales',
      icon: FiShoppingCart
    },
    {
      label: 'Find or Add a Customer',
      description: 'Senior Citizen and PWD records',
      to: '/customers',
      icon: FiUserPlus
    }
  ]
}

export default function QuickActions({
  view,
  tone = 'light'
}: {
  view: DashboardView
  /** `hero` styles the shortcuts for the deep-teal summary band. */
  tone?: 'light' | 'hero'
}): ReactElement | null {
  const { account } = useAccount()
  const permitted = actions[view].filter(
    (action) => account !== null && canAccessPath(account.role, action.to)
  )
  if (permitted.length === 0) return null

  return (
    <nav aria-label="Shortcuts" className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {permitted.map(({ label, description, to, tab, icon: Icon }, index) => (
        <Link
          key={label}
          to={to}
          search={to === '/suppliers' ? { tab } : undefined}
          className={`flex min-w-0 items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
            tone === 'hero'
              ? index === 0
                ? 'text-brand-900 hover:bg-brand-50 border-white bg-white shadow-sm'
                : 'border-white/20 bg-white/10 text-white hover:border-white/35 hover:bg-white/15'
              : index === 0
                ? 'bg-brand-700 border-brand-700 hover:bg-brand-800 text-white'
                : 'hover:border-brand-300 hover:bg-brand-50 border-slate-200 bg-white text-slate-800'
          }`}
        >
          <span
            className={`grid size-10 shrink-0 place-items-center rounded-lg ${
              tone === 'hero'
                ? index === 0
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-brand-100 bg-white/10'
                : index === 0
                  ? 'bg-white/15 text-white'
                  : 'bg-brand-50 text-brand-700'
            }`}
          >
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{label}</span>
            <span
              className={`block text-xs leading-5 ${
                tone === 'hero'
                  ? index === 0
                    ? 'text-slate-600'
                    : 'text-brand-100'
                  : index === 0
                    ? 'text-white'
                    : 'text-slate-600'
              }`}
            >
              {description}
            </span>
          </span>
        </Link>
      ))}
    </nav>
  )
}
