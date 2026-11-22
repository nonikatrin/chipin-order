import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import ErrorBoundary from './components/ErrorBoundary'
import { Toaster } from './components/Toast'
import { usePOStore } from './po/store'
import { useOperatorStore } from './utils/operatorStore'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import OrdersPage from './pages/OrdersPage'
import GroupsPage from './pages/GroupsPage'
import PromotionPage from './pages/PromotionPage'
import IntakePage from './pages/IntakePage'
import OrderFormPage from './pages/OrderFormPage'
import ImportPage from './pages/ImportPage'
import StatsPage from './pages/StatsPage'
import VendorPage from './pages/VendorPage'
import SettingsPage from './pages/SettingsPage'
import NotesPage from './pages/NotesPage'
import POCreatePage from './pages/po/POCreatePage'
import POEditPage from './pages/po/POEditPage'
import POEventPage from './pages/po/POEventPage'
import POEventMenuPage from './pages/po/POEventMenuPage'
import POPastePage from './pages/po/POPastePage'
import POAddBuyerPage from './pages/po/POAddBuyerPage'
import POFinalizePage from './pages/po/POFinalizePage'
import JastipPage from './pages/po/JastipPage'
import AuthPage from './pages/AuthPage'
import { cloudEnabled } from './cloud/supabase'
import { useAuthStore } from './cloud/authStore'

// Import your 800px derivative asset instead of the 4K build breaker
import brandLogo from './assets/branding/chipin-order-lockup-4k.avif'

export default function App() {
  const [showSplash, setShowSplash] = useState(true)
  const [fadeOut, setFadeOut] = useState(false)
  const { pathname } = useLocation()

  // Gerbang login hanya aktif bila ada operator terdaftar (opt-in dari Pengaturan).
  const hasOperators = useOperatorStore((s) => s.operators.length > 0)
  const activeOperator = usePOStore((s) => s.activeOperator)
  const needsLogin = hasOperators && !activeOperator.operatorId
  const isLoginRoute = pathname === '/login'
  // Formulir pesan publik: dibuka tetangga di perangkat lain — tanpa sidebar & tanpa gerbang login.
  const isPublicRoute = pathname.startsWith('/pesan/')
  const isPoRoute = pathname === '/po/buat' || pathname.startsWith('/po/')
  // Akun penjual (cloud): wajib masuk dulu sebelum aplikasi; formulir pembeli tetap publik.
  const authStatus = useAuthStore((s) => s.status)

  useEffect(() => {
    // Gracefully handle access configs for reduced-motion options
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReducedMotion) {
      setShowSplash(false)
      return
    }

    // 1. Kick off the CSS opacity transition layer at 1.2 seconds
    const fadeTimer = setTimeout(() => {
      setFadeOut(true)
    }, 1200)

    // 2. Completely unmount from DOM tree when transition completes
    const unmountTimer = setTimeout(() => {
      setShowSplash(false)
    }, 1600) // 1200ms delay + 400ms transition duration

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(unmountTimer)
    }
  }, [])

  // Toggle a body class so other components (like SideNav) can hide
  // elements only while the splash is active without changing markup.
  useEffect(() => {
    if (showSplash) document.body.classList.add('splash-active')
    else document.body.classList.remove('splash-active')
    return () => document.body.classList.remove('splash-active')
  }, [showSplash])

  return (
    <ErrorBoundary>
    <div className={`app${isPoRoute ? ' app--po' : ''}`}>
      {/* Toast host — mounted once so toast.show() calls across all pages actually render. */}
      <Toaster />
      {/* Launch/Splash Screen Overlay Module */}
      {showSplash && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: '#FCF9F2', // Brand cream surface color
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            transition: 'opacity 400ms ease-in-out',
            opacity: fadeOut ? 0 : 1,
            pointerEvents: 'none',
          }}
        >
          {/* Brand Graphic Container Layer */}
          <div style={{ maxWidth: '280px', width: '80%' }}>
            <img
              src={brandLogo}
              alt="Chip!n Order Logo"
              style={{
                width: '100%',
                height: 'auto',
                mixBlendMode: 'multiply', // Drops asset white space clean on cream
              }}
            />
          </div>
        </div>
      )}

      {isPublicRoute ? (
        <main className="app__main">
          <Routes>
            <Route path="/pesan/:code" element={<OrderFormPage />} />
          </Routes>
        </main>
      ) : cloudEnabled && authStatus === 'loading' ? (
        <main className="app__main" aria-busy="true" />
      ) : cloudEnabled && authStatus === 'signed-out' ? (
        <AuthPage />
      ) : isLoginRoute ? (
        <main className="app__main">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </main>
      ) : needsLogin ? (
        <Navigate to="/login" replace />
      ) : (
        <>
          <Sidebar />
          <main className="app__main">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/groups" element={<GroupsPage />} />
              <Route path="/promosi" element={<PromotionPage />} />
              <Route path="/intake" element={<IntakePage />} />
              <Route path="/import" element={<ImportPage />} />
              <Route path="/stats" element={<StatsPage />} />
              <Route path="/supplier" element={<VendorPage />} />
              <Route path="/pengaturan" element={<SettingsPage />} />
              <Route path="/catatan" element={<NotesPage />} />
              <Route path="/po/buat" element={<POCreatePage />} />
              <Route path="/po/:poId/edit" element={<POEditPage />} />
              <Route path="/po/:poId" element={<POEventPage />} />
              <Route path="/po/:poId/menu" element={<POEventMenuPage />} />
              <Route path="/po/:poId/salin" element={<POPastePage />} />
              <Route path="/po/:poId/pesanan/baru" element={<POAddBuyerPage />} />
              <Route path="/po/:poId/rekap" element={<POFinalizePage />} />
              <Route path="/po/:poId/jastip" element={<JastipPage />} />
              {/* rute lama Chip!n — arahkan ke dashboard */}
              <Route path="/po/list" element={<Navigate to="/" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </>
      )}
    </div>
    </ErrorBoundary>
  )
}