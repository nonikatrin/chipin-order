import { useState } from 'react'
import { useLangStore } from '../utils/langStore'
import { Ic } from './icons'

/** Panduan singkat "getting started" — modal carousel beberapa langkah (Next/Back/Skip). */
interface Step {
  emoji: string
  title: string
  body: string
}

const STEPS: Record<'id' | 'en', Step[]> = {
  id: [
    { emoji: '👋', title: 'Selamat datang di Chip!n Order', body: 'Kelola pre-order makanan komunitas — menu, pembayaran, dan pengiriman — semua di satu tempat.' },
    { emoji: '📓', title: 'Buat Buku Pesanan', body: 'Satu PO = satu acara. Tambah menu, harga jual (atau HPP kalau buatan sendiri), dan batas kuota.' },
    { emoji: '🔗', title: 'Terima pesanan lewat tautan', body: 'Bagikan Formulir Pesan — tetangga memesan sendiri lewat link, dan nomor WhatsApp-mu tetap privat.' },
    { emoji: '📣', title: 'Promosikan', body: 'Buat flyer "OPEN PO" otomatis dari data menu — sudah berisi tautan pesanan siap dibagikan.' },
    { emoji: '📊', title: 'Pantau untung', body: 'Lihat untung bersih, tagih pembayaran, dan setor ke supplier lewat Laporan & Portal Supplier.' },
  ],
  en: [
    { emoji: '👋', title: 'Welcome to Chip!n Order', body: 'Run community food pre-orders — menus, payments, and delivery — all in one place.' },
    { emoji: '📓', title: 'Create an Order Book', body: 'One PO = one event. Add menus, sell prices (or COGS if self-made), and quota limits.' },
    { emoji: '🔗', title: 'Take orders via a link', body: 'Share the Order Form — neighbours order through a link themselves, and your WhatsApp number stays private.' },
    { emoji: '📣', title: 'Promote it', body: 'Auto-generate an "OPEN PO" flyer from your menu data — it already carries the order link.' },
    { emoji: '📊', title: 'Track your profit', body: 'See net profit, chase payments, and pay suppliers from Reports & the Supplier Portal.' },
  ],
}

const LABELS = {
  id: { skip: 'Lewati', back: 'Kembali', next: 'Lanjut', done: 'Mulai' },
  en: { skip: 'Skip', back: 'Back', next: 'Next', done: 'Get started' },
} as const

export function GettingStartedTour({ onClose }: { onClose: () => void }) {
  const { currentLang } = useLangStore()
  const steps = STEPS[currentLang] ?? STEPS.id
  const l = LABELS[currentLang] ?? LABELS.id
  const [i, setI] = useState(0)
  const step = steps[i]
  const last = i === steps.length - 1

  return (
    <div
      className="sheet-backdrop sheet-backdrop--center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="sheet sheet--center tour" role="dialog" aria-modal="true" aria-label={step.title}>
        <button type="button" className="tour__close" onClick={onClose} aria-label={l.skip} title={l.skip}>
          {Ic.x}
        </button>
        <div className="tour__emoji" aria-hidden>{step.emoji}</div>
        <div className="tour__title">{step.title}</div>
        <p className="tour__body">{step.body}</p>
        <div className="tour__dots" aria-hidden>
          {steps.map((_, k) => (
            <span key={k} className={'tour__dot' + (k === i ? ' is-on' : '')} />
          ))}
        </div>
        <div className="tour__nav">
          <button
            type="button"
            className="wizard-nav-btn"
            onClick={() => setI(i - 1)}
            disabled={i === 0}
            aria-label={l.back}
            title={l.back}
          >
            {Ic.arrowLeft}
          </button>
          <button
            type="button"
            className="wizard-nav-btn wizard-nav-btn--primary"
            onClick={() => (last ? onClose() : setI(i + 1))}
            aria-label={last ? l.done : l.next}
            title={last ? l.done : l.next}
          >
            {last ? Ic.check : Ic.arrowRight}
          </button>
        </div>
      </div>
    </div>
  )
}
