import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppBar from '../components/AppBar'
import { usePOStore } from '../po/store'
import type { POEvent } from '../po/types'
import { useLangStore } from '../utils/langStore'
import { useToast } from '../components/Toast'
import { Ic } from '../components/icons'

const STR = {
  id: {
    title: 'Impor dari Chip!n',
    intro:
      'Bawa PO lama dari aplikasi Chip!n ke sini. Di Chip!n buka Pengaturan → Cadangkan Data untuk mengunduh berkas .json, lalu pilih berkas itu di bawah.',
    pick: 'Pilih berkas cadangan',
    note: 'Hanya data Pre-Order yang diimpor. PO yang sudah ada di sini tidak akan tertimpa.',
    done: (n: number) => (n > 0 ? `${n} PO berhasil diimpor 🎉` : 'Tidak ada PO baru — semuanya sudah ada di sini.'),
    errRead: 'Berkas tidak bisa dibaca — pastikan ini cadangan Chip!n (.json).',
    errNoPO: 'Cadangan ini tidak berisi data Pre-Order.',
  },
  en: {
    title: 'Import from Chip!n',
    intro:
      'Bring your old POs from the Chip!n app. In Chip!n open Settings → Back Up Data to download the .json file, then pick that file below.',
    pick: 'Choose backup file',
    note: 'Only Pre-Order data is imported. POs already here are never overwritten.',
    done: (n: number) => (n > 0 ? `${n} POs imported 🎉` : 'No new POs — everything is already here.'),
    errRead: "Couldn't read the file — make sure it's a Chip!n backup (.json).",
    errNoPO: 'This backup has no Pre-Order data.',
  },
} as const

/**
 * Menerima dua bentuk berkas:
 *  - cadangan Chip!n     → { app:'chipn', data: { 'dompetkas-po-v1': '<json zustand>' } }
 *  - cadangan Chip!n ORDER → kunci `chipinorder-po-v1` (lihat utils/backup.ts)
 * Kunci sendiri WAJIB dikenali: tanpa itu, cadangan yang dibuat aplikasi ini
 * tak bisa dipulihkan sendiri — arsip jadi jalan buntu.
 */
function extractEvents(text: string): POEvent[] | null {
  try {
    const parsed = JSON.parse(text)
    const raw: unknown =
      parsed?.data?.['chipinorder-po-v1'] ?? // cadangan Chip!n Order
      parsed?.['chipinorder-po-v1'] ??
      parsed?.data?.['dompetkas-po-v1'] ?? // berkas cadangan Chip!n
      parsed?.['dompetkas-po-v1'] // salinan localStorage mentah
    // Zustand menyimpan sebagai string JSON; terima juga bentuk objek langsung.
    const store = typeof raw === 'string' ? JSON.parse(raw) : raw
    const events = (store as { state?: { events?: unknown } })?.state?.events
    return Array.isArray(events) ? (events as POEvent[]) : null
  } catch {
    return null
  }
}

export default function ImportPage() {
  const navigate = useNavigate()
  const { currentLang } = useLangStore()
  const t = STR[currentLang]
  const toast = useToast()
  const importEvents = usePOStore((s) => s.importEvents)
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  async function onFile(file: File | undefined) {
    setError(null)
    if (!file) return
    let text: string
    try {
      text = await file.text()
    } catch {
      setError(t.errRead)
      return
    }
    const events = extractEvents(text)
    if (events == null) {
      setError(text.includes('dompetkas') ? t.errNoPO : t.errRead)
      return
    }
    const n = importEvents(events)
    toast.show(t.done(n))
    navigate('/', { replace: true })
  }

  return (
    <>
      <AppBar title={t.title} backTo="/" />
      <main className="page page--import" style={{ paddingTop: 20 }}>
        <div className="card import-card">
          <p className="import-card__intro">{t.intro}</p>
          <button
            type="button"
            className="btn btn--primary import-card__pick-btn"
            onClick={() => fileRef.current?.click()}
          >
            {Ic.download} {t.pick}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <p className="muted import-card__note">
            {t.note}
          </p>
          {error && <p className="login__error">{error}</p>}
        </div>
      </main>
    </>
  )
}
