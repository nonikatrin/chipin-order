import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppBar from '../components/AppBar'
import { Ic } from '../components/icons'
import { MenuThumb } from '../components/MenuThumb'
import { useLangStore } from '../utils/langStore'
import { usePOStore } from '../po/store'
import { useProfileStore } from '../utils/profileStore'
import { useFaqStore } from '../utils/faqStore'
import { formatMoney } from '../utils/format'
import { ALLERGENS } from '../utils/allergens'
import { sharePO } from '../po/whatsapp'
import { useToast } from '../components/Toast'
import { encodeForm, formLink, type OrderFormData } from '../utils/orderLink'
import type { POEvent, POMenu } from '../po/types'

const STR = {
  id: {
    title: 'Promosi',
    subtitle: 'Buat flyer dari data menu',
    pickPo: 'Pilih Buku Pesanan',
    noPoTitle: 'Buat flyer PO dalam 1 klik',
    noPoDesc: 'Aktifkan dulu satu Buku Pesanan untuk mulai membuat flyer promosi.',
    noPoCta: 'Buat Buku Pesanan',
    previewMini: 'Pratinjau Mini',
    previewCaption: 'Begini tampilan flyer kamu',
    items: 'Item yang ditampilkan',
    all: 'Semua',
    none: 'Kosongkan',
    print: 'Cetak PDF',
    share: 'Bagikan',
    copy: 'Salin',
    copied: 'Teks flyer disalin',
    heroTitle: 'OPEN PO',
    heroSub: 'PRE-ORDER',
    lHarga: 'Harga',
    lDeadline: 'Batas Pesan',
    lReady: 'Siap / Ambil',
    lLoc: 'Lokasi',
    lHub: 'Hub',
    caraPesan: 'CARA PESAN',
    step1: 'Buka link pesanan',
    step2: 'Pilih menu & isi data diri',
    step3wa: (n: string) => `Kirim kode pesanan ke WA ${n}`,
    step3: 'Kirim kode pesanan ke admin',
    orderCta: 'Buka Form Pesanan',
    selectHint: 'Centang menu yang mau dipromosikan.',
    accentLabel: 'Warna Aksen',
    emptyFlyer: 'Pilih minimal satu menu untuk melihat flyer.',
    pcs: (n: number) => `isi ${n} pcs`,
  },
  en: {
    title: 'Promotion',
    subtitle: 'Generate a flyer from menu data',
    pickPo: 'Pick Order Book',
    noPoTitle: 'Create a PO flyer in 1 click',
    noPoDesc: 'Activate an Order Book first to start making promo flyers.',
    noPoCta: 'Create Order Book',
    previewMini: 'Mini Preview',
    previewCaption: 'This is what your flyer will look like',
    items: 'Items to feature',
    all: 'All',
    none: 'Clear',
    print: 'Print PDF',
    share: 'Share',
    copy: 'Copy',
    copied: 'Flyer text copied',
    heroTitle: 'OPEN PO',
    heroSub: 'PRE-ORDER',
    lHarga: 'Price',
    lDeadline: 'Order by',
    lReady: 'Ready / Pickup',
    lLoc: 'Location',
    lHub: 'Contact',
    caraPesan: 'HOW TO ORDER',
    step1: 'Open the order link',
    step2: 'Pick items & fill your details',
    step3wa: (n: string) => `Send the order code to WA ${n}`,
    step3: 'Send the order code to the admin',
    orderCta: 'Open Order Form',
    selectHint: 'Tick the menus you want to promote.',
    accentLabel: 'Accent Color',
    emptyFlyer: 'Pick at least one menu to preview the flyer.',
    pcs: (n: number) => `${n} pcs`,
  },
} as const

type L = (typeof STR)['id'] | (typeof STR)['en']

/** Pilihan warna aksen flyer (per-PO, persist di localStorage). Oranye = brand default. */
const FLYER_ACCENTS = [
  { key: 'orange', accent: '#F4722B', dark: '#d1560f', soft: '#fdece0' },
  { key: 'teal', accent: '#00897B', dark: '#00695c', soft: '#e3f1ee' },
  { key: 'purple', accent: '#7C3AED', dark: '#5b21b6', soft: '#f0e9fd' },
  { key: 'red', accent: '#D3304B', dark: '#a61f38', soft: '#fdeaee' },
  { key: 'blue', accent: '#2563EB', dark: '#1e46b5', soft: '#e7eefd' },
  { key: 'navy', accent: '#1F2937', dark: '#111827', soft: '#e8eaef' },
] as const
const ACCENT_STORE_KEY = 'chipinorder-flyer-accent'

/**
 * Foto menu di flyer: gambar asli bila ada; jika belum, bingkai foto kosong (bukan emoji).
 * Foto rusak juga jatuh ke bingkai kosong — flyer ini dicetak & dibagikan, jadi ikon
 * "gambar rusak" tak boleh sampai ikut tercetak.
 */
function FlyerThumb({ menu }: { menu: POMenu }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [menu.photo])
  if (menu.photo && !failed) {
    return (
      <img
        className="flyer__photo"
        src={menu.photo}
        alt={menu.name}
        onError={() => setFailed(true)}
      />
    )
  }
  return (
    <span className="flyer__photo flyer__photo--empty" aria-hidden>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="8.5" cy="10" r="1.5" />
        <path d="M21 15l-5-5L5 19" />
      </svg>
    </span>
  )
}

/** Snapshot PO untuk tautan formulir (Path C) — dipasang di flyer sebagai "Cara Pesan". */
function buildOrderForm(
  event: POEvent,
  menus: POMenu[],
  store: string,
  faq: { q: string; a: string }[],
): OrderFormData {
  return {
    v: 1,
    poId: event.id,
    name: event.name,
    emoji: event.emoji,
    currency: event.currency,
    place: event.place,
    deadline: event.orderDeadline,
    delivery: event.deliveryDate,
    store: store || undefined,
    menus: menus.map((m) => ({
      id: m.id,
      name: m.name,
      emoji: m.emoji,
      price: m.sellPrice,
      desc: m.description,
      allergens: m.allergens,
      quota: m.maxQuota,
    })),
    faq: faq.length ? faq : undefined,
  }
}

/** ISO yyyy-mm-dd → tanggal ramah flyer ("22 Mei 2025" / "22 May 2025"). */
function flyerDate(iso: string | undefined, lang: 'id' | 'en'): string | undefined {
  if (!iso) return undefined
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return iso
  try {
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d)
  } catch {
    return iso
  }
}

/** Rentang harga menu terpilih: satu harga → "Rp X"; beragam → "Rp min – Rp max". */
function priceRangeText(menus: POMenu[], currency: string): string | null {
  const prices = menus.map((m) => m.sellPrice).filter((p) => p > 0)
  if (prices.length === 0) return null
  const lo = Math.min(...prices)
  const hi = Math.max(...prices)
  return lo === hi ? formatMoney(lo, currency) : `${formatMoney(lo, currency)} – ${formatMoney(hi, currency)}`
}

/** Teks flyer untuk dibagikan (WhatsApp / share sheet) — memuat tautan formulir pesanan. */
function buildFlyerText(
  event: POEvent,
  menus: POMenu[],
  store: string,
  wa: string,
  link: string,
  t: L,
  lang: 'id' | 'en',
): string {
  const out: string[] = []
  out.push(`📣 *${t.heroTitle} — ${t.heroSub}*`)
  if (store) out.push(store)
  out.push('')
  out.push(`*${event.emoji} ${event.name}*`)
  if (event.description) out.push(`_${event.description}_`)
  out.push('')
  for (const m of menus) {
    const pcs = m.piecesPerUnit && m.piecesPerUnit > 1 ? ` (${t.pcs(m.piecesPerUnit)})` : ''
    out.push(`• ${m.emoji} ${m.name}${pcs} — *${formatMoney(m.sellPrice, event.currency)}*`)
  }
  out.push('')
  const range = priceRangeText(menus, event.currency)
  if (range) out.push(`${t.lHarga}: ${range}`)
  if (event.orderDeadline) out.push(`${t.lDeadline}: ${flyerDate(event.orderDeadline, lang)}`)
  if (event.deliveryDate) out.push(`${t.lReady}: ${flyerDate(event.deliveryDate, lang)}`)
  if (event.place) out.push(`${t.lLoc}: ${event.place}`)
  if (wa) out.push(`${t.lHub}: ${wa}`)
  out.push('')
  out.push(`*${t.caraPesan}*`)
  out.push(`1. ${t.step1}: ${link}`)
  out.push(`2. ${t.step2}`)
  out.push(`3. ${wa ? t.step3wa(wa) : t.step3}`)
  out.push('')
  out.push('_via Chip!n_')
  return out.join('\n')
}

export default function PromotionPage() {
  const navigate = useNavigate()
  const { currentLang } = useLangStore()
  const t = STR[currentLang] ?? STR.id
  const toast = useToast()
  const events = usePOStore((s) => s.events)
  const profile = useProfileStore((s) => s.profile)
  const faqItems = useFaqStore((s) => s.items)

  const activeEvents = useMemo(() => events.filter((e) => e.status !== 'closed'), [events])
  const [poId, setPoId] = useState<string>(() => activeEvents[0]?.id ?? '')
  const event = activeEvents.find((e) => e.id === poId) ?? activeEvents[0]

  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const isOn = (id: string) => selected[id] ?? true
  const toggle = (id: string) => setSelected((cur) => ({ ...cur, [id]: !isOn(id) }))

  // Warna aksen flyer per-PO — persist supaya pilihan bertahan antar sesi.
  const [accents, setAccents] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(ACCENT_STORE_KEY) ?? '{}') as Record<string, string>
    } catch {
      return {}
    }
  })
  function pickAccent(poIdKey: string, key: string) {
    setAccents((cur) => {
      const next = { ...cur, [poIdKey]: key }
      localStorage.setItem(ACCENT_STORE_KEY, JSON.stringify(next))
      return next
    })
  }

  if (!event) {
    return (
      <>
        <AppBar title={t.title} subtitle={t.subtitle} backTo="/" />
        <main className="page" style={{ paddingTop: 20 }}>
          <div className="empty">
            <div className="empty__art" aria-hidden>📣</div>
            <h2 className="empty__title">{t.noPoTitle}</h2>
            <p className="empty__text">{t.noPoDesc}</p>
            <div className="empty__ctas">
              <button type="button" className="btn btn--primary" onClick={() => navigate('/po/buat')}>{t.noPoCta}</button>
            </div>
            <div className="empty-extra">
              <div className="what-card mini-flyer-card">
                <div className="section-label">{t.previewMini}</div>
                <div className="mini-flyer" aria-hidden>
                  <div className="mini-flyer__hero">OPEN PO<small>PRE-ORDER</small></div>
                  <div className="mini-flyer__row"><span className="mini-flyer__thumb" /><span className="mini-flyer__bar" /></div>
                  <div className="mini-flyer__row"><span className="mini-flyer__thumb" /><span className="mini-flyer__bar" /></div>
                  <div className="mini-flyer__row"><span className="mini-flyer__thumb" /><span className="mini-flyer__bar" /></div>
                  <div className="mini-flyer__row"><span className="mini-flyer__bar mini-flyer__bar--short" /><span className="mini-flyer__bar" /></div>
                  <div className="mini-flyer__qr" />
                </div>
                <p className="muted">{t.previewCaption}</p>
              </div>
            </div>
          </div>
        </main>
      </>
    )
  }

  const cur = event.currency
  const wa = profile.whatsappNumber
  const chosen = event.menus.filter((m) => isOn(m.id))
  const faqPairs = faqItems.map((f) => ({ q: f.q, a: f.a }))
  const orderLink =
    chosen.length > 0 ? formLink(encodeForm(buildOrderForm(event, chosen, profile.storeName, faqPairs))) : ''
  const flyerText = chosen.length > 0 ? buildFlyerText(event, chosen, profile.storeName, wa, orderLink, t, currentLang) : ''
  const range = priceRangeText(chosen, cur)

  const infoRows: { label: string; value: string }[] = []
  if (range) infoRows.push({ label: t.lHarga, value: range })
  const deadline = flyerDate(event.orderDeadline, currentLang)
  const ready = flyerDate(event.deliveryDate, currentLang)
  if (deadline) infoRows.push({ label: t.lDeadline, value: deadline })
  if (ready) infoRows.push({ label: t.lReady, value: ready })
  if (event.place) infoRows.push({ label: t.lLoc, value: event.place })
  if (wa) infoRows.push({ label: t.lHub, value: wa })

  return (
    <>
      <AppBar title={t.title} subtitle={t.subtitle} backTo="/" />
      <main className="page promo-page" style={{ paddingTop: 20 }}>
        <div className="promo-controls card" style={{ padding: 14 }}>
          <label className="field" style={{ display: 'grid', gap: 6 }}>
            <span className="field__label">{t.pickPo}</span>
            <select
              className="input input--select"
              value={event.id}
              onChange={(e) => {
                setPoId(e.target.value)
                setSelected({})
              }}
            >
              {activeEvents.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.emoji} {e.name}
                </option>
              ))}
            </select>
          </label>

          <div className="promo-items">
            <div className="promo-items__head">
              <span className="field__label">{t.items}</span>
              <span className="promo-items__bulk">
                <button type="button" className="linkish" onClick={() => setSelected(Object.fromEntries(event.menus.map((m) => [m.id, true])))}>{t.all}</button>
                <span aria-hidden> · </span>
                <button type="button" className="linkish" onClick={() => setSelected(Object.fromEntries(event.menus.map((m) => [m.id, false])))}>{t.none}</button>
              </span>
            </div>
            <p className="field__hint" style={{ margin: '0 0 8px' }}>{t.selectHint}</p>
            <div className="promo-items__grid">
              {event.menus.map((m) => (
                <label key={m.id} className={'promo-item' + (isOn(m.id) ? ' is-on' : '')}>
                  <input type="checkbox" checked={isOn(m.id)} onChange={() => toggle(m.id)} />
                  <MenuThumb menu={m} />
                  <span className="promo-item__name">{m.name}</span>
                  <span className="promo-item__price">{formatMoney(m.sellPrice, cur)}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="promo-accent">
            <span className="field__label">{t.accentLabel}</span>
            <div className="promo-accent__row" role="radiogroup" aria-label={t.accentLabel}>
              {FLYER_ACCENTS.map((a) => {
                const on = (accents[event.id] ?? 'orange') === a.key
                return (
                  <button
                    key={a.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={a.key}
                    className={'accent-swatch' + (on ? ' is-on' : '')}
                    style={{ background: a.accent }}
                    onClick={() => pickAccent(event.id, a.key)}
                  >
                    {on ? '✓' : ''}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* FLYER PREVIEW — juga area cetak (print CSS menyembunyikan sisanya) */}
        {chosen.length === 0 ? (
          <div className="card" style={{ padding: 20, marginTop: 14 }}>
            <p className="muted">{t.emptyFlyer}</p>
          </div>
        ) : (
          <div
            className="flyer"
            role="img"
            aria-label={`Flyer ${event.name}`}
            style={(() => {
              const a = FLYER_ACCENTS.find((x) => x.key === (accents[event.id] ?? 'orange')) ?? FLYER_ACCENTS[0]
              return {
                '--f-accent': a.accent,
                '--f-accent-dark': a.dark,
                '--f-accent-soft': a.soft,
              } as React.CSSProperties
            })()}
          >
            <header className="flyer__hero">
              {profile.storeName && <div className="flyer__kicker">{profile.storeName}</div>}
              <div className="flyer__hero-title">{t.heroTitle}</div>
              <div className="flyer__hero-sub">{t.heroSub}</div>
            </header>

            <div className="flyer__poname">
              <span>{event.name}</span>
            </div>
            {event.description && <div className="flyer__tagline">{event.description}</div>}

            <ul className="flyer__menus">
              {chosen.map((m) => {
                const badges = (m.allergens ?? [])
                  .map((k) => ALLERGENS.find((a) => a.key === k)?.emoji)
                  .filter(Boolean)
                const pcs = m.piecesPerUnit && m.piecesPerUnit > 1 ? ` · ${t.pcs(m.piecesPerUnit)}` : ''
                return (
                  <li key={m.id} className="flyer__mrow">
                    <FlyerThumb menu={m} />
                    <span className="flyer__mname">
                      {m.name}
                      <span className="flyer__msub">
                        {m.description ? m.description : ''}{pcs}
                        {badges.length > 0 && <span className="flyer__mbadges" aria-hidden> {badges.join(' ')}</span>}
                      </span>
                    </span>
                    <span className="flyer__leader" aria-hidden />
                    <span className="flyer__mprice">{formatMoney(m.sellPrice, cur)}</span>
                  </li>
                )
              })}
            </ul>

            <div className="flyer__info">
              {infoRows.map((r) => (
                <div key={r.label} className="flyer__inforow">
                  <span className="flyer__infolabel">{r.label}</span>
                  <span className="flyer__infoval">{r.value}</span>
                </div>
              ))}
            </div>

            <div className="flyer__order">
              <div className="flyer__order-title">{t.caraPesan}</div>
              <ol className="flyer__steps">
                <li>{t.step1}</li>
                <li>{t.step2}</li>
                <li>{wa ? t.step3wa(wa) : t.step3}</li>
              </ol>
              <a className="flyer__order-link" href={orderLink} target="_blank" rel="noreferrer">
                {t.orderCta}
              </a>
            </div>

            <div className="flyer__foot">via Chip!n</div>
          </div>
        )}

        {chosen.length > 0 && (
          <div className="promo-actions">
            <button type="button" className="btn btn--primary btn--sm" onClick={() => window.print()}>
              {Ic.download} {t.print}
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => void sharePO(flyerText, wa)}>
              {Ic.share} {t.share}
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                void navigator.clipboard?.writeText(flyerText)
                toast.show(t.copied)
              }}
            >
              {Ic.copy} {t.copy}
            </button>
          </div>
        )}
      </main>
    </>
  )
}
