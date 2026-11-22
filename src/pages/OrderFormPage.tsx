import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Ic } from '../components/icons'
import { useLangStore } from '../utils/langStore'
import { formatMoney } from '../utils/format'
import { allergenLabel } from '../utils/allergens'
import { decodeForm, encodeOrder, type SubmittedOrder, type FormMenu } from '../utils/orderLink'
import type { FulfillmentMode } from '../po/types'
import brandLogo from '../assets/branding/chipin-order-lockup.jpg'

/** Pagar akal sehat bila menu tak punya batas porsi — sejalan dgn BUYER_LIMITS.qty. */
const MAX_PER_ITEM = 999

const STR = {
  id: {
    invalid: 'Tautan formulir tidak valid atau kedaluwarsa.',
    order: 'Formulir Pesan',
    yourName: 'Nama kamu',
    yourNamePh: 'mis. Bu Ani',
    phone: 'Nomor WA',
    items: 'Pilih menu',
    fulfillment: 'Cara terima',
    pickup: 'Ambil sendiri',
    delivery: 'Diantar',
    address: 'Alamat pengiriman',
    addressPh: 'Jl. …',
    note: 'Catatan untuk penjual',
    notePh: 'mis. jangan pedas',
    total: 'Total',
    finish: 'Selesai — buat kode pesanan',
    codeTitle: 'Kode pesananmu sudah siap',
    codeHint: 'Salin kode ini dan kirim ke penjual (WhatsApp/SMS/chat). Penjual menempelnya untuk mencatat pesananmu.',
    copy: 'Salin kode',
    copied: 'Kode disalin',
    edit: 'Ubah pesanan',
    faq: 'Tanya jawab',
    needName: 'Isi nama dulu.',
    needItems: 'Pilih minimal satu menu.',
    needAddress: 'Isi alamat untuk pengiriman.',
    by: 'Batas pesan',
    maxReached: (n: number) => `Maksimal ${n} porsi untuk item ini.`,
    stepYou: 'Data kamu',
    stepItems: 'Pilih menu',
    stepGet: 'Cara terima',
    stepNote: 'Catatan',
    optional: 'opsional',
    max: (n: number) => `maks ${n}`,
    deliver: 'Kirim/ambil',
    items_n: (n: number) => `${n} porsi`,
    sendWa: 'Kirim lewat WhatsApp',
    copyFail: 'Tidak bisa menyalin otomatis — tekan lama kodenya lalu salin.',
    madeWith: 'Dibuat dengan',
    tagline: 'Kelola PO tanpa ribet',
  },
  en: {
    invalid: 'This form link is invalid or expired.',
    order: 'Order Form',
    yourName: 'Your name',
    yourNamePh: 'e.g. Ms. Ani',
    phone: 'WhatsApp number',
    items: 'Pick menus',
    fulfillment: 'How to receive',
    pickup: 'Pickup',
    delivery: 'Delivery',
    address: 'Delivery address',
    addressPh: 'Street …',
    note: 'Note for the seller',
    notePh: 'e.g. not spicy',
    total: 'Total',
    finish: 'Done — make order code',
    codeTitle: 'Your order code is ready',
    codeHint: 'Copy this code and send it to the seller (WhatsApp/SMS/chat). They paste it to record your order.',
    copy: 'Copy code',
    copied: 'Code copied',
    edit: 'Edit order',
    faq: 'FAQ',
    needName: 'Enter your name first.',
    needItems: 'Pick at least one menu.',
    needAddress: 'Enter an address for delivery.',
    by: 'Order by',
    maxReached: (n: number) => `Maximum ${n} portions for this item.`,
    stepYou: 'Your details',
    stepItems: 'Pick menus',
    stepGet: 'How to receive',
    stepNote: 'Note',
    optional: 'optional',
    max: (n: number) => `max ${n}`,
    deliver: 'Pickup/delivery',
    items_n: (n: number) => `${n} item${n === 1 ? '' : 's'}`,
    sendWa: 'Send via WhatsApp',
    copyFail: 'Couldn’t copy automatically — long-press the code and copy it.',
    madeWith: 'Made with',
    tagline: 'Pre-orders without the hassle',
  },
} as const

export default function OrderFormPage() {
  const { code = '' } = useParams()
  const { currentLang } = useLangStore()
  const t = STR[currentLang] ?? STR.id
  const form = useMemo(() => decodeForm(code), [code])

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [qty, setQty] = useState<Record<string, number>>({})
  const [fulfillment, setFulfillment] = useState<FulfillmentMode>('pickup')
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [orderCode, setOrderCode] = useState<string | null>(null)
  const [copied, setCopied] = useState<'no' | 'yes' | 'fail'>('no')

  if (!form) {
    return (
      <div className="orderform">
        <div className="orderform__card">
          <p className="muted">{t.invalid}</p>
        </div>
      </div>
    )
  }

  /**
   * Batas porsi memang sudah ikut dalam tautan formulir (`FormMenu.quota`) tapi dulu tak
   * pernah dibaca — pembeli bisa menekan ＋ tanpa henti dan memesan 500 porsi dari item
   * berkuota 1. Tanpa backend kita tak tahu sisa stok sebenarnya, jadi kuota dipakai
   * sebagai batas atas yang jujur, bukan janji ketersediaan.
   */
  const capOf = (m: FormMenu) =>
    m.quota && m.quota > 0 ? Math.min(m.quota, MAX_PER_ITEM) : MAX_PER_ITEM
  /** Tambah/kurangi dari nilai TERBARU (bukan nilai saat render) — ketukan cepat tak hilang. */
  const bump = (id: string, delta: number) => {
    const m = form!.menus.find((x) => x.id === id)
    const cap = m ? capOf(m) : MAX_PER_ITEM
    setQty((cur) => ({ ...cur, [id]: Math.min(cap, Math.max(0, (cur[id] ?? 0) + delta)) }))
  }
  const total = form.menus.reduce((s, m) => s + m.price * (qty[m.id] ?? 0), 0)
  const count = form.menus.reduce((s, m) => s + (qty[m.id] ?? 0), 0)
  const locale = currentLang === 'en' ? 'en-US' : 'id-ID'
  /** 'YYYY-MM-DD' → "1 Des 2026" (dibaca sebagai tanggal lokal, bukan UTC). */
  const fmtDay = (iso?: string) => {
    const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (!m) return iso
    return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function handleFinish() {
    if (!form) return
    if (!name.trim()) return setError(t.needName)
    const lines = form.menus
      .filter((m) => (qty[m.id] ?? 0) > 0)
      .map((m) => ({ menuId: m.id, qty: qty[m.id] }))
    if (lines.length === 0) return setError(t.needItems)
    if (fulfillment === 'delivery' && !address.trim()) return setError(t.needAddress)
    const order: SubmittedOrder = {
      v: 1,
      poId: form.poId,
      name: name.trim(),
      phone: phone.trim() || undefined,
      lines,
      fulfillment,
      address: fulfillment === 'delivery' ? address.trim() : undefined,
      note: note.trim() || undefined,
    }
    setError('')
    setOrderCode(encodeOrder(order, { name: form.name, delivery: form.delivery ?? form.deadline }))
  }

  if (orderCode) {
    const link = orderCode
    async function copy() {
      try {
        if (!navigator.clipboard) throw new Error('no clipboard')
        await navigator.clipboard.writeText(link)
        setCopied('yes')
      } catch {
        // http / browser lama: tak ada Clipboard API → jangan klaim "disalin"
        setCopied('fail')
      }
    }
    return (
      <div className="orderform">
        <div className="orderform__card orderform__done">
          <div className="orderform__check">{Ic.check}</div>
          <h1 className="orderform__title">{t.codeTitle}</h1>
          <p className="field__hint">{t.codeHint}</p>
          <textarea className="input orderform__code" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
          {copied === 'fail' && <p className="orderform__error">{t.copyFail}</p>}
          <div className="orderform__done-actions">
            <a
              className="btn btn--wa btn--sm"
              href={`https://wa.me/?text=${encodeURIComponent(link)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {Ic.send} {t.sendWa}
            </a>
            <button type="button" className="btn btn--primary btn--sm" onClick={() => void copy()}>
              {Ic.copy} {copied === 'yes' ? t.copied : t.copy}
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setOrderCode(null); setCopied('no') }}>
              {t.edit}
            </button>
          </div>
        </div>
        <MadeWith t={t} />
      </div>
    )
  }

  const Step = ({ n, title, hint }: { n: number; title: string; hint?: string }) => (
    <h2 className="of-step">
      <span className="of-step__n">{n}</span>
      {title}
      {hint && <em>· {hint}</em>}
    </h2>
  )

  return (
    <div className="orderform">
      <div className="orderform__card">
        <header className="of-head">
          {form.store && <div className="orderform__store">{form.store}</div>}
          <h1 className="orderform__title">
            {form.emoji} {form.name}
          </h1>
          <div className="orderform__meta">
            {form.deadline && (
              <span>
                ⏰ {t.by}: {fmtDay(form.deadline)}
              </span>
            )}
            {form.delivery && (
              <span>
                📦 {t.deliver}: {fmtDay(form.delivery)}
              </span>
            )}
            {form.place && <span>📍 {form.place}</span>}
          </div>
        </header>

        <section className="of-section">
          <Step n={1} title={t.stepYou} />
          <div className="of-grid2">
            <label className="of-field">
              <span>{t.yourName}</span>
              <input className="of-input" placeholder={t.yourNamePh} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="of-field">
              <span>
                {t.phone} <em>({t.optional})</em>
              </span>
              <input className="of-input" type="tel" inputMode="tel" autoComplete="tel" placeholder="08…" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
          </div>
        </section>

        <section className="of-section">
          <Step n={2} title={t.stepItems} />
          <div className="orderform__menus">
            {form.menus.map((m) => {
              const q = qty[m.id] ?? 0
              const badges = (m.allergens ?? []).map((k) => allergenLabel(k, currentLang)).join(', ')
              const capped = !!m.quota && m.quota > 0 && q >= m.quota
              return (
                <div key={m.id} className={'orderform__menu' + (q > 0 ? ' is-on' : '')}>
                  <span className="orderform__menu-emoji" aria-hidden>
                    {m.emoji}
                  </span>
                  <div className="orderform__menu-body">
                    <div className="orderform__menu-name">{m.name}</div>
                    {m.desc && <div className="orderform__menu-desc">{m.desc}</div>}
                    {badges && <div className="orderform__menu-allergen">⚠ {badges}</div>}
                    <div className="orderform__menu-price">
                      {formatMoney(m.price, form.currency)}
                      {m.quota && m.quota > 0 && <span className="of-max">{t.max(m.quota)}</span>}
                    </div>
                  </div>
                  <div className="orderform__stepper">
                    <button type="button" aria-label={`− ${m.name}`} onClick={() => bump(m.id, -1)} disabled={q === 0}>
                      −
                    </button>
                    <span aria-live="polite">{q}</span>
                    <button type="button" aria-label={`+ ${m.name}`} onClick={() => bump(m.id, 1)} disabled={q >= capOf(m)}>
                      +
                    </button>
                  </div>
                  {capped && <div className="orderform__menu-cap">{t.maxReached(m.quota!)}</div>}
                </div>
              )
            })}
          </div>
        </section>

        <section className="of-section">
          <Step n={3} title={t.stepGet} />
          <div className="orderform__fulfill" role="radiogroup" aria-label={t.fulfillment}>
            <button
              type="button"
              role="radio"
              aria-checked={fulfillment === 'pickup'}
              className={'orderform__mode' + (fulfillment === 'pickup' ? ' is-on' : '')}
              onClick={() => setFulfillment('pickup')}
            >
              🏠 {t.pickup}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={fulfillment === 'delivery'}
              className={'orderform__mode' + (fulfillment === 'delivery' ? ' is-on' : '')}
              onClick={() => setFulfillment('delivery')}
            >
              🚚 {t.delivery}
            </button>
          </div>
          {fulfillment === 'delivery' && (
            <label className="of-field">
              <span>{t.address}</span>
              <input className="of-input" placeholder={t.addressPh} autoComplete="street-address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </label>
          )}
        </section>

        <section className="of-section">
          <Step n={4} title={t.stepNote} hint={t.optional} />
          <label className="of-field">
            <span className="sr-only">{t.note}</span>
            <input className="of-input" placeholder={t.notePh} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </section>

        {form.faq && form.faq.length > 0 && (
          <details className="orderform__faq">
            <summary>{t.faq}</summary>
            {form.faq.map((f, i) => (
              <div key={i} className="orderform__faq-item">
                <div className="orderform__faq-q">{f.q}</div>
                <div className="orderform__faq-a">{f.a}</div>
              </div>
            ))}
          </details>
        )}

        <div className="of-bar">
          {error && (
            <p className="orderform__error" role="alert">
              {error}
            </p>
          )}
          <div className="of-bar__row">
            <div className="of-bar__total">
              <span>
                {t.total}
                {count > 0 && ` · ${t.items_n(count)}`}
              </span>
              <strong>{formatMoney(total, form.currency)}</strong>
            </div>
            <button type="button" className="btn btn--primary of-bar__submit" onClick={handleFinish}>
              {t.finish}
            </button>
          </div>
        </div>
      </div>
      <MadeWith t={t} />
    </div>
  )
}

/** Jejak merek di setiap formulir pembeli — juga pintu masuk penjual baru ke aplikasi. */
function MadeWith({ t }: { t: { madeWith: string; tagline: string } }) {
  return (
    <a className="of-made" href={import.meta.env.BASE_URL} target="_blank" rel="noopener">
      <span>{t.madeWith}</span>
      <img src={brandLogo} alt="Chip!n Order" />
      <span className="of-made__tag">{t.tagline}</span>
    </a>
  )
}
