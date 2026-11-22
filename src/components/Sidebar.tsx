import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Ic } from './icons'
import { useLangStore } from '../utils/langStore'
import { usePOStore } from '../po/store'
import { useOperatorStore } from '../utils/operatorStore'
import brandLogo from '../assets/branding/chipin-order-lockup.jpg'

const COLLAPSE_KEY = 'chipinorder-sidenav'

const LABELS = {
  id: { home: 'Beranda', orders: 'Pesanan', groups: 'Grup', promo: 'Promosi', reports: 'Laporan', supplier: 'Portal Supplier', settings: 'Pengaturan', logout: 'Keluar' },
  en: { home: 'Home', orders: 'Orders', groups: 'Groups', promo: 'Promotion', reports: 'Reports', supplier: 'Supplier Portal', settings: 'Settings', logout: 'Logout' },
} as const

export default function Sidebar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { currentLang } = useLangStore()
  const t = LABELS[currentLang] ?? LABELS.id

  const hasOperators = useOperatorStore((s) => s.operators.length > 0)
  const activeOperator = usePOStore((s) => s.activeOperator)
  const logoutOperator = usePOStore((s) => s.logoutOperator)
  // Lapis supplier digerbang OTOMATIS (bukan toggle): Portal Supplier hanya muncul bila ada
  // PO aktif dengan minimal satu menu bersupplier. Produksi-sendiri murni → item ini absen.
  const hasSupplierWork = usePOStore((s) =>
    s.events.some((e) => e.status !== 'closed' && e.menus.some((m) => m.vendor && m.vendor.trim())),
  )

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === '1',
  )
  
  function toggle() {
    setCollapsed((v) => {
      localStorage.setItem(COLLAPSE_KEY, v ? '0' : '1')
      return !v
    })
  }

  const items = [
    { to: '/', label: t.home, icon: Ic.home, active: pathname === '/' || pathname.startsWith('/po') || pathname === '/import' },
    { to: '/orders', label: t.orders, icon: Ic.clipboard, active: pathname === '/orders' },
    { to: '/groups', label: t.groups, icon: Ic.users, active: pathname === '/groups' },
    { to: '/promosi', label: t.promo, icon: Ic.megaphone, active: pathname === '/promosi' },
    { to: '/stats', label: t.reports, icon: Ic.barChart, active: pathname === '/stats' },
    ...(hasSupplierWork ? [{ to: '/supplier', label: t.supplier, icon: Ic.bank, active: pathname === '/supplier' }] : []),
    { to: '/pengaturan', label: t.settings, icon: Ic.gear, active: pathname === '/pengaturan' || pathname === '/catatan' || pathname === '/intake' },
  ]

  return (
    <nav className={'app__nav' + (collapsed ? ' is-collapsed' : '')} aria-label="Navigasi utama">
      <div className="sidenav__top">
        <div
          className="sidenav__brand"
          style={{ maxWidth: '120px', display: collapsed ? 'none' : 'block', padding: '4px 0' }}
        >
          <img src={brandLogo} alt="Chip!n Order" style={{ width: '100%', height: 'auto', mixBlendMode: 'multiply' }} />
        </div>

        <button
          type="button"
          className="sidenav__toggle"
          aria-label={collapsed ? 'Bentangkan menu' : 'Ciutkan menu'}
          onClick={toggle}
          style={{ marginLeft: collapsed ? 'auto' : '8px' }}
        >
          {collapsed ? '»' : '«'}
        </button>
      </div>
      <div className="sidenav__links">
        {items.map((it) => (
          <button
            key={it.to}
            type="button"
            className={'sidenav__link' + (it.active ? ' is-active' : '')}
            title={collapsed ? it.label : undefined}
            onClick={() => navigate(it.to)}
          >
            <span className="sidenav__ico">{it.icon}</span>
            <span className="sidenav__label">{it.label}</span>
          </button>
        ))}
      </div>
      <div className="sidenav__footer">
        <div className="sidenav__meta">
          <span className="sidenav__meta-icon" aria-hidden>{Ic.users}</span>
          <span className="sidenav__meta-text">
            <strong>{activeOperator.operatorName ?? 'Admin'}</strong>
            <small>v 1.0.0</small>
          </span>
        </div>
        {hasOperators && activeOperator.operatorId && (
          <button
            type="button"
            className="btn btn--ghost btn--sm sidenav__logout"
            onClick={() => {
              logoutOperator()
              navigate('/login')
            }}
          >
            <span className="sidenav__logout-ico" aria-hidden>{Ic.x}</span>
            <span className="sidenav__logout-label">{t.logout}</span>
          </button>
        )}
      </div>
    </nav>
  )
}
