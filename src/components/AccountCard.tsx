import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../cloud/authStore'
import { cloudEnabled } from '../cloud/supabase'
import { hasPending, signOutAndWipe, syncNow, useSyncStatus } from '../cloud/sync'
import { useLangStore } from '../utils/langStore'
import { Ic } from './icons'

const STR = {
  id: {
    title: 'Akun penjual',
    signedInAs: 'Masuk sebagai',
    synced: 'Tersimpan di cloud',
    syncing: 'Menyimpan ke cloud…',
    offline: 'Offline — perubahan tersimpan di perangkat ini dan dikirim saat online',
    error: 'Gagal menyimpan ke cloud',
    off: 'Belum tersambung',
    ago: (m: number) => (m < 1 ? 'baru saja' : `${m} menit lalu`),
    pending: (n: number) => `${n} perubahan menunggu`,
    syncNow: 'Sinkron sekarang',
    signOut: 'Keluar',
    signingOut: 'Keluar…',
    signOutNote: 'Saat keluar, data dihapus dari perangkat ini (tetap aman di akunmu).',
    pendingConfirm:
      'Ada perubahan yang belum terkirim ke cloud (mungkin karena offline). Kalau keluar sekarang, perubahan itu hilang. Tetap keluar?',
  },
  en: {
    title: 'Seller account',
    signedInAs: 'Signed in as',
    synced: 'Saved to the cloud',
    syncing: 'Saving to the cloud…',
    offline: 'Offline — changes are kept on this device and sent when you’re back online',
    error: 'Couldn’t save to the cloud',
    off: 'Not connected yet',
    ago: (m: number) => (m < 1 ? 'just now' : `${m} min ago`),
    pending: (n: number) => `${n} change${n === 1 ? '' : 's'} waiting`,
    syncNow: 'Sync now',
    signOut: 'Sign out',
    signingOut: 'Signing out…',
    signOutNote: 'Signing out removes the data from this device (it stays safe in your account).',
    pendingConfirm:
      'Some changes haven’t reached the cloud yet (maybe you’re offline). If you sign out now they’ll be lost. Sign out anyway?',
  },
} as const

export default function AccountCard() {
  const { currentLang } = useLangStore()
  const t = STR[currentLang] ?? STR.id
  const navigate = useNavigate()
  const email = useAuthStore((s) => s.email)
  const { state, lastSyncedAt, pending } = useSyncStatus()
  const [busy, setBusy] = useState(false)
  const [, tick] = useState(0)

  // "2 menit lalu" ikut berjalan tanpa menunggu sinkron berikutnya
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  if (!cloudEnabled || !email) return null

  const minutes = lastSyncedAt ? Math.floor((Date.now() - lastSyncedAt) / 60_000) : null
  const label =
    state === 'synced'
      ? `${t.synced}${minutes != null ? ` · ${t.ago(minutes)}` : ''}`
      : state === 'syncing'
        ? t.syncing
        : state === 'offline'
          ? t.offline
          : state === 'error'
            ? t.error
            : t.off

  async function logout() {
    setBusy(true)
    try {
      await syncNow()
    } catch {
      /* dicek lewat hasPending di bawah */
    }
    if (hasPending() && !window.confirm(t.pendingConfirm)) {
      setBusy(false)
      return
    }
    await signOutAndWipe()
    navigate('/', { replace: true })
  }

  return (
    <div className="card account-card">
      <div className="account-card__row">
        <div className="account-card__who">
          <span className="account-card__label">{t.signedInAs}</span>
          <strong className="account-card__email">{email}</strong>
        </div>
        <button type="button" className="btn btn--ghost btn--sm" disabled={busy} onClick={logout}>
          {busy ? t.signingOut : t.signOut}
        </button>
      </div>
      <div className={`account-card__sync is-${state}`} role="status">
        <span className="account-card__dot" aria-hidden />
        <span>{label}</span>
        {pending > 0 && state !== 'synced' && <span className="account-card__pending">· {t.pending(pending)}</span>}
        {(state === 'error' || state === 'offline') && (
          <button type="button" className="account-card__retry" onClick={() => void syncNow()}>
            {Ic.refresh} {t.syncNow}
          </button>
        )}
      </div>
      <p className="field__hint" style={{ margin: '8px 0 0' }}>
        {t.signOutNote}
      </p>
    </div>
  )
}
