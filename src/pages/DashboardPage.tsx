import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePOStore } from '../po/store'
import type { POEvent } from '../po/types'
import { computePO, type POBuyerCalc } from '../po/calc'
import { formatMoney } from '../utils/format'
import { useLangStore } from '../utils/langStore'
import { useProfileStore } from '../utils/profileStore'
import { useToast } from '../components/Toast'
import { Ic } from '../components/icons'
import { MenuThumb } from '../components/MenuThumb'
import { Calendar } from '../components/Calendar'
import { GettingStartedTour } from '../components/GettingStartedTour'
import { buildRecapReport, sharePO } from '../po/whatsapp'

const LOW_STOCK = 3 // sisa kuota ≤ ini → "stok menipis"

const STR = {
  id: {
    greetMorning: 'Selamat Pagi', greetAfternoon: 'Selamat Siang', greetEvening: 'Selamat Malam',
    newPO: '+ Buku Pesanan Baru', newOrder: 'Pesanan Baru', recap: 'Rekap', payVendor: 'Portal Supplier',
    remind: 'Ingatkan', share: 'Bagikan',
    statValue: 'Nilai Pemesanan Aktif', statCollected: 'Terkumpul', statOutstanding: 'Belum Dibayar',
    statParticipants: 'Peserta Aktif',
    activeTitle: 'Pre-Order Aktif', viewAll: (n: number) => `Lihat semua ${n} pemesanan aktif →`,
    paid: 'Lunas', partial: 'Sebagian', unpaid: 'Belum', open: 'Buka',
    overview: 'Ringkasan', alerts: 'Peringatan', notifications: 'Notifikasi',
    soldOut: 'Habis', lowStock: 'Stok menipis', allHealthy: 'Semua stok aman', noAlerts: 'Tidak ada peringatan',
    seeAll: 'Lihat semua', seeLess: 'Ringkas',
    notifPartial: (n: string) => `${n} membayar sebagian`,
    notifDelivery: (n: string, po: string) => `${n} minta diantar untuk ${po}`,
    notifSoldOut: (m: string) => `${m} sekarang habis`,
    noNotifs: 'Belum ada notifikasi',
    emptyTitle: 'Belum ada pemesanan', emptyDesc: 'Buat pemesanan pertama, atau impor data dari aplikasi Chip!n.',
    emptyCta: 'Buat Buku Pesanan Baru', emptyImport: 'Impor dari Chip!n',
    gsTitle: 'Mulai di Sini', gsMeta: (n: number) => `${n} langkah untuk mulai`,
    gsNameTitle: 'Atur nama bisnis',
    gsNameDesc: 'Dipakai di flyer, formulir pesanan, dan recap.', gsNamePh: 'Nama toko / bisnis',
    gsSave: 'Simpan', gsSaved: 'Tersimpan', gsNameToast: 'Nama bisnis disimpan',
    gsPoTitle: 'Buat buku pesanan pertama', gsPoDesc: 'Tambah menu & harga, lalu mulai terima pesanan.',
    gsBuyerTitle: 'Tambahkan pembeli', gsBuyerDesc: 'Setelah membuat PO, undang pembeli.',
    gsProgress: (n: number) => `${n} dari 3 langkah selesai`,
    gsTour: 'Lihat panduan', gsDemo: 'Coba demo',
    sheetEdit: 'Edit detail pemesanan', sheetDup: 'Duplikat pemesanan', sheetShare: 'Bagikan rekap',
    sheetClose: 'Tutup PO', sheetReopen: 'Buka lagi PO', sheetDelete: 'Hapus PO',
    dupDone: 'PO diduplikasi', closed: 'PO ditutup', reopened: 'PO dibuka kembali', deleted: 'PO dihapus',
    delTitle: 'Hapus PO ini?',
    delBody: (n: number) => n > 0 ? `Ini menghapus permanen ${n} pesanan pembeli dan tidak bisa dibatalkan.` : 'PO ini akan dihapus permanen.',
    delNudge: 'Pertimbangkan menutup PO alih-alih menghapus — riwayatnya tetap tersimpan.',
    keep: 'Simpan PO', yesDelete: 'Ya, Hapus', mixed: 'Beragam mata uang',
  },
  en: {
    greetMorning: 'Good Morning', greetAfternoon: 'Good Afternoon', greetEvening: 'Good Evening',
    newPO: '+ New Order Book', newOrder: 'New Order', recap: 'Recap', payVendor: 'Supplier Portal',
    remind: 'Remind', share: 'Share',
    statValue: 'Total Active PO Value', statCollected: 'Total Collected', statOutstanding: 'Outstanding Payments',
    statParticipants: 'Active Participants',
    activeTitle: 'Active Orders', viewAll: (n: number) => `View all ${n} active POs →`,
    paid: 'Paid', partial: 'Partial', unpaid: 'Unpaid', open: 'Open',
    overview: 'Overview', alerts: 'Alerts', notifications: 'Notifications',
    soldOut: 'Sold out', lowStock: 'Low stock', allHealthy: 'All stock healthy', noAlerts: 'No alerts',
    seeAll: 'See all', seeLess: 'See less',
    notifPartial: (n: string) => `${n} made a partial payment`,
    notifDelivery: (n: string, po: string) => `${n} requested delivery for ${po}`,
    notifSoldOut: (m: string) => `${m} is now sold out`,
    noNotifs: 'No notifications yet',
    emptyTitle: 'No POs yet', emptyDesc: 'Create your first PO, or import data from the Chip!n app.',
    emptyCta: 'Create New Order Book', emptyImport: 'Import from Chip!n',
    gsTitle: 'Start Here', gsMeta: (n: number) => `${n} steps to start`,
    gsNameTitle: 'Set your business name',
    gsNameDesc: 'Used on your flyer, order form, and recaps.', gsNamePh: 'Store / business name',
    gsSave: 'Save', gsSaved: 'Saved', gsNameToast: 'Business name saved',
    gsPoTitle: 'Create your first order book', gsPoDesc: 'Add menus & prices, then start taking orders.',
    gsBuyerTitle: 'Add buyers', gsBuyerDesc: 'After creating your PO, invite buyers.',
    gsProgress: (n: number) => `${n} of 3 steps done`,
    gsTour: 'Quick tour', gsDemo: 'Try the demo',
    sheetEdit: 'Edit PO details', sheetDup: 'Duplicate PO', sheetShare: 'Share recap',
    sheetClose: 'Close PO', sheetReopen: 'Reopen PO', sheetDelete: 'Delete PO',
    dupDone: 'PO duplicated', closed: 'PO closed', reopened: 'PO reopened', deleted: 'PO deleted',
    delTitle: 'Delete this PO?',
    delBody: (n: number) => n > 0 ? `This permanently deletes ${n} buyer orders and cannot be undone.` : 'This PO will be permanently deleted.',
    delNudge: "Consider closing instead of deleting — you'll keep the history.",
    keep: 'Keep PO', yesDelete: 'Yes, Delete', mixed: 'Mixed currencies',
  },
} as const

type PayStatus = 'paid' | 'partial' | 'unpaid'

function classify(b: POBuyerCalc): PayStatus | null {
  if (b.bill <= 0 && b.paid <= 0) return null // pembeli tanpa pesanan → tak dihitung
  if (b.paid <= 0) return 'unpaid'
  if (b.kurangBayar <= 0) return 'paid'
  return 'partial'
}

function isClosed(e: POEvent): boolean {
  return e.status === 'closed'
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { currentLang, toggleLanguage } = useLangStore()
  const t = STR[currentLang]
  const toast = useToast()

  const events = usePOStore((s) => s.events)
  const seedDemo = usePOStore((s) => s.seedDemo)
  const activeOperator = usePOStore((s) => s.activeOperator)
  const storeName = useProfileStore((s) => s.profile.storeName)
  const updateProfile = useProfileStore((s) => s.updateProfile)
  const { deleteEvent, closeEvent, duplicateEvent } = usePOStore()

  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [confirmFor, setConfirmFor] = useState<POEvent | null>(null)

  // Getting-started: nama bisnis inline + tour. Nama default 'Chip!n Mitra' dianggap belum di-set.
  const [nameDraft, setNameDraft] = useState(() => (storeName === 'Chip!n Mitra' ? '' : storeName))
  const step1Done = storeName !== 'Chip!n Mitra' && storeName.trim() !== ''
  const [nameSaved, setNameSaved] = useState(step1Done)
  const [tourOpen, setTourOpen] = useState(false)
  useEffect(() => {
    if (events.length === 0 && !localStorage.getItem('chipinorder-tour-seen')) setTourOpen(true)
    // sekali saja saat mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  function closeTour() {
    setTourOpen(false)
    localStorage.setItem('chipinorder-tour-seen', '1')
  }
  function saveBusinessName() {
    const v = nameDraft.trim()
    if (!v) return
    updateProfile({ storeName: v })
    setNameSaved(true)
    toast.show(t.gsNameToast)
  }

  const [calDate, setCalDate] = useState(() => new Date())
  const calYear = calDate.getFullYear()
  const calMonth = calDate.getMonth()

  useEffect(() => {
    if (!openMenuId) return
    const onDown = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement | null
      if (target?.closest('.pocard__menu-wrap')) return
      setOpenMenuId(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [openMenuId])

  const active = useMemo(() => events.filter((e) => !isClosed(e)), [events])

  // Ringkasan per PO aktif + agregat dasbor (semua diturunkan dari computePO).
  const model = useMemo(() => {
    const rows = active.map((e) => {
      const totals = computePO(e)
      let paid = 0, partial = 0, unpaid = 0
      for (const b of totals.buyers) {
        const s = classify(b)
        if (s === 'paid') paid++
        else if (s === 'partial') partial++
        else if (s === 'unpaid') unpaid++
      }
      const counted = paid + partial + unpaid
      const collected = totals.revenue - totals.totalKurangBayar
      // Menu habis / menipis
      const soldById = new Map(totals.menus.map((m) => [m.menuId, m.qtyTotal]))
      const stockAlerts = e.menus
        .filter((m) => m.maxQuota != null)
        .map((m) => ({ menu: m, remaining: (m.maxQuota as number) - (soldById.get(m.id) ?? 0) }))
        .filter((x) => x.remaining <= LOW_STOCK)
      return { e, totals, paid, partial, unpaid, counted, collected, stockAlerts }
    })

    const currencies = new Set(active.map((e) => e.currency))
    const singleCur = currencies.size === 1 ? active[0]?.currency ?? null : null
    const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0)

    const totalValue = sum((r) => r.totals.revenue)
    const totalCollected = sum((r) => r.collected)
    const totalOutstanding = sum((r) => r.totals.totalKurangBayar)
    const participants = sum((r) => r.counted)
    const paidN = sum((r) => r.paid)
    const partialN = sum((r) => r.partial)
    const unpaidN = sum((r) => r.unpaid)

    return { rows, singleCur, totalValue, totalCollected, totalOutstanding, participants, paidN, partialN, unpaidN }
  }, [active])

  const money = (n: number) => (model.singleCur ? formatMoney(n, model.singleCur) : '—')

  // Notifikasi turunan — menu habis diutamakan (paling mendesak), lalu antar, lalu bayar sebagian.
  const notifications = useMemo(() => {
    const soldOut: { icon: string; text: string; poId: string }[] = []
    const rest: { icon: string; text: string; poId: string }[] = []
    for (const r of model.rows) {
      for (const a of r.stockAlerts) {
        if (a.remaining <= 0) soldOut.push({ icon: '🚫', text: t.notifSoldOut(a.menu.name), poId: r.e.id })
      }
      for (const b of r.e.buyers) {
        if (b.fulfillment === 'delivery' && b.fulfillmentStatus === 'pending')
          rest.push({ icon: '🚚', text: t.notifDelivery(b.name, r.e.name), poId: r.e.id })
        const calc = r.totals.buyers.find((x) => x.buyerId === b.id)
        if (calc && classify(calc) === 'partial') rest.push({ icon: '💵', text: t.notifPartial(b.name), poId: r.e.id })
      }
    }
    return [...soldOut, ...rest]
  }, [model.rows, t])

  // Alerts card: menu habis dulu (remaining terkecil), lalu stok menipis.
  const allAlerts = useMemo(
    () =>
      model.rows
        .flatMap((r) => r.stockAlerts.map((a) => ({ ...a, poId: r.e.id, poName: r.e.name })))
        .sort((a, b) => a.remaining - b.remaining),
    [model.rows],
  )

  const greeting = (() => {
    const h = new Date().getHours()
    return h < 11 ? t.greetMorning : h < 17 ? t.greetAfternoon : t.greetEvening
  })()
  const who = activeOperator.operatorName || 'Admin'
  const todayLabel = new Date().toLocaleDateString(currentLang === 'id' ? 'id-ID' : 'en-US', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })

  async function shareRecap(e: POEvent) {
    await sharePO(buildRecapReport(e))
  }
  const firstActive = active[0]

  function openPOActions(ev: ReactMouseEvent<HTMLButtonElement>, e: POEvent) {
    ev.preventDefault()
    ev.stopPropagation()
    setOpenMenuId((cur) => (cur === e.id ? null : e.id))
  }

  function openActiveOrder(e: POEvent) {
    navigate(`/po/${e.id}`)
  }

  // Donut ring (paid/partial/unpaid)
  const totalStatus = model.paidN + model.partialN + model.unpaidN || 1
  const pct = { paid: model.paidN / totalStatus, partial: model.partialN / totalStatus, unpaid: model.unpaidN / totalStatus }
  const R = 52, C = 2 * Math.PI * R
  const seg = (frac: number, offsetFrac: number) => ({
    strokeDasharray: `${frac * C} ${C}`,
    strokeDashoffset: `${-offsetFrac * C}`,
  })

  if (events.length === 0) {
    return (
      <div className="dash">
        {/* Header oranye (sama seperti dashboard terisi) */}
        <section className="dash-hero">
          <div className="dash-hero__text">
            <h1 className="dash-hero__greet">{greeting}, {who}! 🌤️</h1>
            <p className="dash-hero__sub">{storeName} · {todayLabel}</p>
          </div>
          <button type="button" className="btn btn--newpo" onClick={() => navigate('/po/buat')}>{t.newPO}</button>
        </section>

        {/* Getting started */}
        <section className="card getting-started">
          <div className="gs-head">
            <h2 className="gs-title">{t.gsTitle}</h2>
            <span className="gs-head__meta">{t.gsMeta(3 - (step1Done ? 1 : 0))}</span>
          </div>
          <div className="gs-steps">
            <div className={'gs-step' + (step1Done ? ' gs-step--done' : '')}>
              <span className="gs-step__num">{step1Done ? '✓' : '1'}</span>
              <div className="gs-step__body">
                <strong>{t.gsNameTitle}</strong>
                <p>{t.gsNameDesc}</p>
                <div className="gs-name-row">
                  <input
                    className="input"
                    placeholder={t.gsNamePh}
                    value={nameDraft}
                    onChange={(e) => { setNameDraft(e.target.value); setNameSaved(false) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveBusinessName() }}
                  />
                  <button
                    type="button"
                    className={'btn btn--sm ' + (nameSaved ? 'btn--ghost btn--saved' : 'btn--primary')}
                    disabled={!nameDraft.trim()}
                    onClick={saveBusinessName}
                  >
                    {nameSaved ? `✓ ${t.gsSaved}` : t.gsSave}
                  </button>
                </div>
              </div>
            </div>
            <div className="gs-step">
              <span className="gs-step__num">2</span>
              <div className="gs-step__body">
                <strong>{t.gsPoTitle}</strong>
                <p>{t.gsPoDesc}</p>
                <button type="button" className="btn btn--primary btn--sm gs-step__cta" onClick={() => navigate('/po/buat')}>
                  {t.emptyCta}
                </button>
              </div>
            </div>
            <div className="gs-step gs-step--todo">
              <span className="gs-step__num">3</span>
              <div className="gs-step__body">
                <strong>{t.gsBuyerTitle}</strong>
                <p style={{ marginBottom: 0 }}>{t.gsBuyerDesc}</p>
              </div>
            </div>
          </div>

          <div className="empty__actions gs-actions">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setTourOpen(true)}>{t.gsTour}</button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('/import')}>{t.emptyImport}</button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate(`/po/${seedDemo()}`)}>{t.gsDemo}</button>
          </div>

          <div className="gs-progress">
            <span className="gs-progress__label">{t.gsProgress(step1Done ? 1 : 0)}</span>
            <span className="gs-progress__bar">
              <span className="gs-progress__fill" style={{ width: `${Math.round(((step1Done ? 1 : 0) / 3) * 100)}%` }} />
            </span>
            <span className="gs-progress__pct">{Math.round(((step1Done ? 1 : 0) / 3) * 100)}%</span>
          </div>
        </section>

        {tourOpen && <GettingStartedTour onClose={closeTour} />}
      </div>
    )
  }

  return (
    <div className="dash">
      {/* Hero */}
      <section className="dash-hero">
        <div className="dash-hero__text">
          <h1 className="dash-hero__greet">{greeting}, {who}! 🌤️</h1>
          <p className="dash-hero__sub">{storeName} · {todayLabel}</p>
        </div>
        <button type="button" className="btn btn--newpo" onClick={() => navigate('/po/buat')}>{t.newPO}</button>
      </section>

      {/* Stat strip */}
      <section className="dash-stats">
        <div className="dstat dstat--accent">
          <div className="dstat__value" style={{ color: 'var(--brand)' }}>{money(model.totalValue)}</div>
          <div className="dstat__label">{t.statValue}</div>
        </div>
        <div className="dstat">
          <div className="dstat__value">{money(model.totalCollected)}</div>
          <div className="dstat__label">{t.statCollected}</div>
        </div>
        <div className="dstat dstat--warn">
          <div className="dstat__value" style={{ color: 'var(--bad)' }}>{money(model.totalOutstanding)}</div>
          <div className="dstat__label">{t.statOutstanding}</div>
        </div>
        <div className="dstat">
          <div className="dstat__value">{model.participants}</div>
          <div className="dstat__label">{t.statParticipants}</div>
        </div>
      </section>

      {/* Quick actions */}
      <section className="dash-actions">
        <button
          type="button"
          className="qact qact--primary"
          disabled={!firstActive}
          onClick={() => firstActive && navigate(`/po/${firstActive.id}/pesanan/baru`)}
        >
          {Ic.plus} {t.newOrder}
        </button>
        <button type="button" className="qact" disabled={!firstActive} onClick={() => firstActive && navigate(`/po/${firstActive.id}/rekap`)}>{Ic.clipboard} {t.recap}</button>
        <button type="button" className="qact" onClick={() => navigate('/supplier')}>{Ic.bank} {t.payVendor}</button>
        <button type="button" className="qact" disabled={!firstActive} onClick={() => firstActive && navigate(`/po/${firstActive.id}`)}>{Ic.bell} {t.remind}</button>
        <button type="button" className="qact" disabled={!firstActive} onClick={() => firstActive && void shareRecap(firstActive)}>{Ic.share} {t.share}</button>
        <div className="dash-actions__quick" aria-label="Quick tools">
          {import.meta.env.DEV && (
            <button type="button" className="iconbtn iconbtn--soft" title="Seed demo (DEV)" onClick={() => navigate(`/po/${seedDemo()}`)}>⚡</button>
          )}
          <button type="button" className="iconbtn iconbtn--soft" title={t.emptyImport} onClick={() => navigate('/import')}>{Ic.download}</button>
          <button type="button" className="iconbtn iconbtn--soft" title="Bahasa / Language" onClick={toggleLanguage}>{currentLang.toUpperCase()}</button>
          <button type="button" className="iconbtn iconbtn--soft dash__bell" title={t.notifications}>
            {Ic.bell}
            {notifications.length > 0 && <span className="dash__bell-badge">{notifications.length}</span>}
          </button>
        </div>
      </section>

      {/* Main grid */}
      <div className="dash-grid">
        {/* Active POs */}
        <section className="card dash-card">
          <h2 className="dash-card__title">
            {t.activeTitle}
            {model.rows.length > 0 && <span className="dash-card__count">{model.rows.length}</span>}
            <button type="button" className="dash-card__link" onClick={() => navigate('/orders')}>{t.seeAll} →</button>
          </h2>
          <div className="dash-polist dash-scroll">
            {model.rows.map((r) => {
              const progress = r.counted > 0 ? Math.round((r.paid / r.counted) * 100) : 0
              return (
                <div key={r.e.id} className="porow">
                  <button
                    type="button"
                    className="porow__main"
                    aria-label={`${t.open} ${r.e.name}`}
                    onClick={() => openActiveOrder(r.e)}
                  >
                    <MenuThumb menu={r.e.menus[0] ?? { emoji: r.e.emoji, name: r.e.name }} />
                    <div className="porow__body">
                      <div className="porow__top">
                        <span className="porow__name">{r.e.name}</span>
                      </div>
                      <div className="porow__progress">
                        <div className="porow__bar"><span style={{ width: `${progress}%` }} /></div>
                        <span className="porow__pct">{progress}%</span>
                      </div>
                      <div className="porow__foot">
                        <span className="pcount pcount--paid">● {r.paid} {t.paid}</span>
                        <span className="pcount pcount--partial">● {r.partial} {t.partial}</span>
                        <span className="pcount pcount--unpaid">● {r.unpaid} {t.unpaid}</span>
                      </div>
                    </div>
                    <span className="porow__val">{formatMoney(r.totals.revenue, r.e.currency)}</span>
                  </button>
                  <div className="pocard__menu-wrap porow__menu-wrap">
                    <button type="button" className="pocard__more" aria-label="Menu PO" onClick={(ev) => openPOActions(ev, r.e)}>{Ic.more}</button>
                    {openMenuId === r.e.id && (
                      <div className="pocard__menu" role="menu">
                        <button type="button" className="pocard__menu-row" onClick={() => { setOpenMenuId(null); navigate(`/po/${r.e.id}`) }}>{Ic.edit} {t.sheetEdit}</button>
                        <button type="button" className="pocard__menu-row" onClick={() => { const id = duplicateEvent(r.e.id); setOpenMenuId(null); toast.show(t.dupDone); if (id) navigate(`/po/${id}`) }}>{Ic.copy} {t.sheetDup}</button>
                        <button type="button" className="pocard__menu-row" onClick={() => { setOpenMenuId(null); void shareRecap(r.e) }}>{Ic.share} {t.sheetShare}</button>
                        <button type="button" className="pocard__menu-row" onClick={() => { closeEvent(r.e.id); setOpenMenuId(null); toast.show(t.closed) }}>{Ic.lock} {t.sheetClose}</button>
                        <button type="button" className="pocard__menu-row pocard__menu-row--danger" onClick={() => { setOpenMenuId(null); setConfirmFor(r.e) }}>{Ic.trash} {t.sheetDelete}</button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            {model.rows.length === 0 && <p className="muted" style={{ padding: '8px 4px' }}>—</p>}
          </div>
        </section>

        {/* Calendar */}
        <section className="card dash-card">
          <Calendar year={calYear} month={calMonth} onNext={() => setCalDate(new Date(calYear, calMonth + 1, 1))} onPrev={() => setCalDate(new Date(calYear, calMonth - 1, 1))} onPickDate={(iso) => navigate(`/po/buat?date=${iso}`)} />
        </section>

        {/* Overview + Alerts */}
        <section className="card dash-card">
          <h2 className="dash-card__title">{t.overview}</h2>
          <div className="dash-overview">
            <div className="donut">
              <svg viewBox="0 0 120 120" className="donut__svg">
                <circle cx="60" cy="60" r={R} className="donut__track" />
                <circle cx="60" cy="60" r={R} className="donut__seg donut__seg--paid" style={seg(pct.paid, 0)} />
                <circle cx="60" cy="60" r={R} className="donut__seg donut__seg--partial" style={seg(pct.partial, pct.paid)} />
                <circle cx="60" cy="60" r={R} className="donut__seg donut__seg--unpaid" style={seg(pct.unpaid, pct.paid + pct.partial)} />
              </svg>
            </div>
            <div className="donut-legend">
              <span><span className="dot dot--paid" /> {t.paid} <strong>{Math.round(pct.paid * 100)}%</strong></span>
              <span><span className="dot dot--partial" /> {t.partial} <strong>{Math.round(pct.partial * 100)}%</strong></span>
              <span><span className="dot dot--unpaid" /> {t.unpaid} <strong>{Math.round(pct.unpaid * 100)}%</strong></span>
            </div>
          </div>
          <div className="dash-alerts">
            <h3 className="dash-alerts__title">🚫 {t.alerts}{allAlerts.length > 0 && <span className="dash-card__count">{allAlerts.length}</span>}</h3>
            {allAlerts.length === 0 ? (
              <p className="muted">{t.allHealthy}</p>
            ) : (
              <div className="dash-alerts__list dash-scroll">
                {allAlerts.map((a, i) => (
                  <button key={a.poId + a.menu.id + i} type="button" className="alert-row" onClick={() => navigate(`/po/${a.poId}/menu`)}>
                    <MenuThumb menu={a.menu} />
                    <span className="alert-row__body">
                      <span className="alert-row__name">{a.menu.name}</span>
                      <span className="alert-row__po">{a.poName}</span>
                    </span>
                    <span className={'alert-row__tag ' + (a.remaining <= 0 ? 'is-out' : 'is-low')}>
                      {a.remaining <= 0 ? t.soldOut : t.lowStock}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Notifications */}
        <section className="card dash-card">
          <h2 className="dash-card__title">
            🔔 {t.notifications}
            {notifications.length > 0 && <span className="dash-card__count">{notifications.length}</span>}
          </h2>
          <div className="dash-notifs dash-scroll">
            {notifications.length === 0 ? (
              <p className="muted">{t.noNotifs}</p>
            ) : (
              notifications.map((n, i) => (
                <button key={i} type="button" className="notif-row" onClick={() => navigate(`/po/${n.poId}`)}>
                  <span className="notif-row__icon" aria-hidden>{n.icon}</span>
                  <span className="notif-row__text">{n.text}</span>
                  <span className="notif-row__go">→</span>
                </button>
              ))
            )}
          </div>
        </section>
      </div>

      {confirmFor && (
        <div className="confirm-backdrop" onClick={() => setConfirmFor(null)}>
          <div className="confirm" role="alertdialog" onClick={(ev) => ev.stopPropagation()}>
            <div className="confirm__title"><span className="confirm__ico" aria-hidden>{Ic.trash}</span>{t.delTitle}</div>
            <div className="confirm__name">{confirmFor.name}</div>
            <p className="confirm__text">{t.delBody(confirmFor.buyers.length)}</p>
            {!isClosed(confirmFor) && <div className="nudge">{Ic.alert}<span>{t.delNudge}</span></div>}
            <div className="confirm__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setConfirmFor(null)}>{t.keep}</button>
              <button type="button" className="btn btn--danger" onClick={() => { deleteEvent(confirmFor.id); setConfirmFor(null); toast.show(t.deleted) }}>{t.yesDelete}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
