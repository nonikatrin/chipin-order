import { useState, useEffect, useRef, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import AppBar from '../../components/AppBar'
import { Stepper } from '../../components/Stepper'
import { MenuCard } from '../../components/MenuCard'
import { usePOStore, usePOEvent } from '../../po/store'
import { useSettingsStore } from '../../utils/settingsStore'
import { useLangStore } from '../../utils/langStore'
import { Ic } from '../../components/icons'
import { COMMON_CURRENCIES, currencyName, currencySymbol, formatMoney } from '../../utils/format'
import { costPerUnit } from '../../po/calc'
import { MenuStep } from './MenuStep.tsx'
import type { Currency, PORecurrence } from '../../po/types'

const STR = {
  id: {
    title: 'Buat Pemesanan',
    steps: ['Detail Pesanan', 'Order Set-up', 'Ringkasan'],
    draftSummaryTitle: 'Ringkasan Draf Buku Pemesanan',
    noMenusYet: 'Belum ada order',
    noMenusYetSub: 'Lanjut ke Order Set-up untuk menambahkan item order.',
    s1Eyebrow: 'LANGKAH 1', s1Title: 'Detail Pesanan', s1Sub: 'Semua detail inti dalam satu layar',
    orderbooktitle: 'Judul Buku Pemesanan', orderid: 'ID Pemesanan', orderadmin: 'Admin Pemesanan', venue: 'Tempat', currency: 'Mata uang', desc: 'Deskripsi',
    descPh: 'Mis. PO bulanan warga RT…',
    s1Tip: 'Isi kolom wajib dulu, lalu lengkapi opsi tambahan seperlunya.', nextMenu: 'Lanjut: Atur menu',
    reqHint: '* wajib diisi agar lanjut ke order set-up',
    date: 'Tanggal Kirim', deadline: 'Batas Pesan', deadlineHint: '(H-1 pengiriman)', reportdate: 'Tanggal Laporan', reportdateHint: '(H+1 pengiriman)',
    repeat: 'Ulangi pesanan ini?', repeatEvery: 'Ulangi tiap', weekly: 'Mingguan', monthly: 'Bulanan',
    timesLabel: 'sebanyak', times: 'kali',
    s3Eyebrow: 'LANGKAH 3', s3Title: 'Ringkasan', s3Sub: 'Periksa sebelum membuat',
    rowName: 'Judul Buku Pemesanan', rowPlace: 'Tempat', rowCur: 'Mata uang', rowDate: 'Tanggal Kirim',
    rowDeadline: 'Batas Pesan', rowRepeat: 'Pengulangan', rowMenus: 'Item Order', rowAdmin: 'Admin Pemesanan',
    metricsTitle: 'Metrik Order', metricRevenue: 'Potensi Omzet', metricCost: 'Estimasi Biaya Vendor',
    metricProfit: 'Estimasi Profit Kotor', metricVendors: 'Vendor Aktif', vendorBreakdown: 'Ringkasan Vendor',
    items: 'item', none: '—', s4Tip: 'Detail ini masih bisa diubah setelah Pemesanan dibuat',
    create: '✓ Buat Pemesanan', back: 'Kembali',
    secAbout: 'Tentang PO', secSchedule: 'Jadwal & tempat', secMore: 'Lainnya',
    titlePh: 'mis. PO Natal Bersama', adminPh: 'Nama yang mengurus pesanan', venuePh: 'mis. Balai RT 05 / Silver Spring, MD',
    deadlineAuto: 'Otomatis sehari sebelum kirim — bisa diubah.',
    deadlineBad: 'Batas pesan harus sebelum atau sama dengan tanggal kirim.',
    needTitle: 'Isi judul dulu.', needDate: 'Pilih tanggal kirim.',
    metricHint: (n: number) => `Dihitung bila semua kuota terjual${n ? ` · ${n} item tanpa kuota tidak dihitung` : ''}.`,
  },
  en: {
    title: 'Create Order',
    steps: ['Order Details', 'Order Setup', 'Summary'],
    draftSummaryTitle: 'Draft Order Book Summary',
    noMenusYet: 'No orders yet',
    noMenusYetSub: 'Continue to Order Setup to add order items.',
    s1Eyebrow: 'STEP 1', s1Title: 'Order Details', s1Sub: 'All core details in one screen',
    orderbooktitle: 'Order Book Title', orderid: 'Order ID', orderadmin: 'Order Admin', venue: 'Venue', currency: 'Currency', desc: 'Description',
    descPh: 'E.g. Monthly group pre-order for RT residents…',
    s1Tip: 'Fill required fields first, then add optional details as needed.', nextMenu: 'Next: Set up menu',
    reqHint: '* required to continue to order setup',
    date: 'Delivery Date', deadline: 'Order Closing Date', deadlineHint: '(day before delivery)', 
    repeat: 'Repeat this order?', repeatEvery: 'Repeat every', weekly: 'Weekly', monthly: 'Monthly',
    timesLabel: 'for', times: 'times',
    s3Eyebrow: 'STEP 3', s3Title: 'Summary', s3Sub: 'Review before creating',
    rowName: 'Order Book Title', rowPlace: 'Venue', rowCur: 'Currency', rowDate: 'Delivery Date',
    rowDeadline: 'Order Closing Date', rowRepeat: 'Repeat', rowMenus: 'Order Items', rowAdmin: 'Order Admin',
    metricsTitle: 'Order Metrics', metricRevenue: 'Potential Revenue', metricCost: 'Estimated Vendor Cost',
    metricProfit: 'Estimated Gross Profit', metricVendors: 'Active Vendors', vendorBreakdown: 'Vendor Breakdown',
    items: 'items', none: '—', s4Tip: 'You can edit these details after creating the Order',
    create: '✓ Create Order', back: 'Back',
    secAbout: 'About this PO', secSchedule: 'Schedule & place', secMore: 'More',
    titlePh: 'e.g. Christmas Group PO', adminPh: 'Who handles the orders', venuePh: 'e.g. Community hall / Silver Spring, MD',
    deadlineAuto: 'Set to the day before delivery — you can change it.',
    deadlineBad: 'The closing date must be on or before the delivery date.',
    needTitle: 'Enter a title first.', needDate: 'Pick a delivery date.',
    metricHint: (n: number) => `Assumes every quota sells out${n ? ` · ${n} item(s) without a quota not counted` : ''}.`,
  },
} as const

const DEFAULT_EVENT_EMOJI = '🍲'
const ORDER_BOOK_MAX_CHARS = 60
const ORDER_ADMIN_MAX_CHARS = 40
const VENUE_MAX_CHARS = 50
const DESCRIPTION_MAX_CHARS = 160

/** ISO yyyy-mm-dd sehari sebelumnya (default batas pesan H-1). */
function dayBefore(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return ''
  d.setDate(d.getDate() - 1)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function formatUniversalDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/** Wizard buat-PO 3 langkah. Bisa jadi halaman sendiri (POCreatePage) atau ditanam
 *  di halaman lain (Pesanan). `onExit` dipanggil saat pengguna keluar dari langkah 1
 *  (tombol back AppBar / footer) — halaman induk yang memutuskan tujuannya. */
export function POWizard({ onExit, eventId, initialDate }: { onExit: () => void; eventId?: string; initialDate?: string }) {
  const navigate = useNavigate()
  const createEvent = usePOStore((s) => s.createEvent)
  const deleteEvent = usePOStore((s) => s.deleteEvent)
  const updateEventDetails = usePOStore((s) => s.updateEventDetails)
  const setRoles = usePOStore((s) => s.setRoles)
  const existingEvent = usePOEvent(eventId)
  const { currentLang } = useLangStore()
  const t = STR[currentLang] ?? STR.id
  const isEditing = Boolean(eventId)

  const [step, setStep] = useState(1)
  const [orderName, setOrderName] = useState('')
  const [orderAdmin, setOrderAdmin] = useState('')
  const [currency, setCurrency] = useState<Currency>(useSettingsStore((s) => s.defaultCurrency))
  const [venue, setVenue] = useState('')
  const [description, setDescription] = useState('')
  // Tanggal dari kalender (initialDate) → prefill tanggal kirim + batas pesan H-1.
  const [deliveryDate, setDeliveryDate] = useState(() => initialDate ?? '')
  const [orderDeadline, setOrderDeadline] = useState(() => dayBefore(initialDate))
  const [isRecurring, setIsRecurring] = useState(false)
  const [frequency, setFrequency] = useState<PORecurrence['frequency']>('weekly')
  const [times, setTimes] = useState(4)

  const [draftId, setDraftId] = useState<string | null>(eventId ?? null)
  // Draf disimpan permanen begitu wizard selesai; hanya draf yang ditinggalkan yang dihapus.
  const committedRef = useRef(false)
  const hydratedRef = useRef(false)
  const draft = usePOEvent(draftId ?? undefined)

  useEffect(() => {
    if (!isEditing || !existingEvent || hydratedRef.current) return
    setOrderName(existingEvent.name ?? '')
    setOrderAdmin(existingEvent.organizerName ?? '')
    setCurrency(existingEvent.currency)
    setVenue(existingEvent.place ?? '')
    setDescription(existingEvent.description ?? '')
    setDeliveryDate(existingEvent.deliveryDate ?? '')
    setOrderDeadline(existingEvent.orderDeadline ?? '')
    setIsRecurring(Boolean(existingEvent.recurrence))
    setFrequency(existingEvent.recurrence?.frequency ?? 'weekly')
    setTimes(existingEvent.recurrence?.times ?? 4)
    setDraftId(existingEvent.id)
    hydratedRef.current = true
  }, [isEditing, existingEvent])

  // Batas pesan sesudah tanggal kirim tak masuk akal (input tanggal masih bisa diketik manual).
  const deadlineBad = !!(deliveryDate && orderDeadline && orderDeadline > deliveryDate)
  const canNext1 = orderName.trim().length > 0 && (isEditing || deliveryDate.length > 0) && !deadlineBad
  const [tried, setTried] = useState(false)

  /** Ganti tanggal kirim: batas pesan ikut (H-1) bila kosong atau masih nilai otomatis lama. */
  function changeDelivery(next: string) {
    setOrderDeadline((cur) => (!cur || cur === dayBefore(deliveryDate) || (next && cur > next) ? dayBefore(next) : cur))
    setDeliveryDate(next)
  }

  const detailsPatch = () => ({
    name: orderName, currency, deliveryDate, orderDeadline, place: venue, description,
    recurrence: isRecurring ? { frequency, times } : undefined,
  })

  function goToMenuStep() {
    if (!canNext1) {
      setTried(true)
      return
    }
    if (!draftId && !isEditing) {
      const id = createEvent(orderName || 'Draft PO', DEFAULT_EVENT_EMOJI, currency, deliveryDate, venue)
      setDraftId(id)
    }
    setStep(2)
  }

  function save() {
    if (!canNext1) return
    const targetId = eventId ?? draftId ?? createEvent(orderName, DEFAULT_EVENT_EMOJI, currency, deliveryDate, venue)
    // Draf dibuat saat masuk step 2 — sinkronkan SEMUA detail final ke event tersebut.
    updateEventDetails(targetId, detailsPatch())
    setRoles(targetId, { organizerName: orderAdmin.trim() || undefined })
    committedRef.current = true
    navigate(`/po/${targetId}`, { replace: true })
  }

  // Cleanup an abandoned draft if the user leaves the wizard without finishing
  useEffect(() => {
    return () => {
      if (!isEditing && draftId && !committedRef.current) deleteEvent(draftId)
    }
  }, [isEditing, draftId, deleteEvent])

  const dateLabel = (iso?: string) => formatUniversalDate(iso) || t.none

  const sumRow = (icon: string | undefined, label: string, value: ReactNode, wrapValue = false) => (
    <div className={`sum-row${wrapValue ? ' sum-row--multiline' : ''}`}>
      {icon ? <span className="sum-row__icon" aria-hidden>{icon}</span> : null}
      <span className="sum-row__label">{label}</span>
      <span className={`sum-row__value${wrapValue ? ' sum-row__value--wrap' : ''}`}>{value}</span>
    </div>
  )

  const menus = draft?.menus ?? []
  // Potensi = bila SEMUA kuota terjual. Item tanpa kuota tak bisa diproyeksikan (dulu dihitung
  // 1 porsi — angka yang tampak pasti padahal tebakan). Biaya lewat costPerUnit agar menu
  // sumbangan (modal 0) & bagi hasil persen ikut benar.
  const quotaMenus = menus.filter((m) => (m.maxQuota ?? 0) > 0)
  const noQuotaCount = menus.length - quotaMenus.length
  const grossRevenue = quotaMenus.reduce((sum, m) => sum + m.sellPrice * (m.maxQuota ?? 0), 0)
  const vendorCost = quotaMenus.reduce((sum, m) => sum + costPerUnit(m) * (m.maxQuota ?? 0), 0)
  const grossProfit = grossRevenue - vendorCost
  const vendorMap = menus.reduce<Record<string, { menus: number; projectedProfit: number }>>((acc, m) => {
    const key = m.vendor?.trim() || t.none
    const projectedProfit = (m.sellPrice - costPerUnit(m)) * (m.maxQuota ?? 0)
    const prev = acc[key] ?? { menus: 0, projectedProfit: 0 }
    acc[key] = { menus: prev.menus + 1, projectedProfit: prev.projectedProfit + projectedProfit }
    return acc
  }, {})
  const vendorRows = Object.entries(vendorMap)

  return (
    <>
      <AppBar title={t.title} onBack={onExit} />
      <Stepper currentStep={step} labels={[...t.steps]} />

      <main className="page page--wizard">
        {step === 1 && (
          <MenuCard
            className="menu-card--center wizard-details-card"
            eyebrow={t.s1Eyebrow}
            title={t.s1Title}
          >
            <div className="cf-form wz-form">
              <h3 className="cf-card__title">📝 {t.secAbout}</h3>
              <label className="cf-field">
                <span className="cf-field__label">
                  {t.orderbooktitle} <span className="field__required">*</span>
                </span>
                <input
                  className={'cf-input' + (tried && !orderName.trim() ? ' is-bad' : '')}
                  maxLength={ORDER_BOOK_MAX_CHARS}
                  value={orderName}
                  placeholder={t.titlePh}
                  onChange={(e) => setOrderName(e.target.value.slice(0, ORDER_BOOK_MAX_CHARS))}
                  autoFocus
                />
                {tried && !orderName.trim() && <span className="cf-field__hint is-bad">{t.needTitle}</span>}
              </label>
              <label className="cf-field">
                <span className="cf-field__label">{t.orderadmin}</span>
                <input
                  className="cf-input"
                  maxLength={ORDER_ADMIN_MAX_CHARS}
                  value={orderAdmin}
                  placeholder={t.adminPh}
                  onChange={(e) => setOrderAdmin(e.target.value.slice(0, ORDER_ADMIN_MAX_CHARS))}
                />
              </label>
              <label className="cf-field">
                <span className="cf-field__label">{t.desc}</span>
                <textarea
                  className="cf-input cf-textarea"
                  rows={2}
                  maxLength={DESCRIPTION_MAX_CHARS}
                  placeholder={t.descPh}
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, DESCRIPTION_MAX_CHARS))}
                />
              </label>

              <div className="cf-card__divider" />
              <h3 className="cf-card__title">📅 {t.secSchedule}</h3>
              <div className="cf-grid2">
                <label className="cf-field">
                  <span className="cf-field__label">
                    {t.date} {!isEditing && <span className="field__required">*</span>}
                  </span>
                  <input
                    type="date"
                    className={'cf-input' + (tried && !isEditing && !deliveryDate ? ' is-bad' : '')}
                    value={deliveryDate}
                    onChange={(e) => changeDelivery(e.target.value)}
                  />
                  {tried && !isEditing && !deliveryDate && <span className="cf-field__hint is-bad">{t.needDate}</span>}
                </label>
                <label className="cf-field">
                  <span className="cf-field__label">{t.deadline}</span>
                  <input
                    type="date"
                    className={'cf-input' + (deadlineBad ? ' is-bad' : '')}
                    max={deliveryDate || undefined}
                    value={orderDeadline}
                    onChange={(e) => setOrderDeadline(e.target.value)}
                  />
                  <span className={'cf-field__hint' + (deadlineBad ? ' is-bad' : '')}>
                    {deadlineBad ? t.deadlineBad : t.deadlineAuto}
                  </span>
                </label>
              </div>
              <label className="cf-field">
                <span className="cf-field__label">{t.venue}</span>
                <input
                  className="cf-input"
                  maxLength={VENUE_MAX_CHARS}
                  value={venue}
                  placeholder={t.venuePh}
                  onChange={(e) => setVenue(e.target.value.slice(0, VENUE_MAX_CHARS))}
                />
              </label>

              <div className="cf-card__divider" />
              <h3 className="cf-card__title">⚙️ {t.secMore}</h3>
              <label className="cf-field">
                <span className="cf-field__label">{t.currency}</span>
                <select className="cf-input cf-select" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
                  {COMMON_CURRENCIES.map((cur) => (
                    <option key={cur} value={cur}>
                      {currencySymbol(cur)} — {currencyName(cur)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="cf-check">
                <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
                <span>{t.repeat}</span>
              </label>
              {isRecurring && (
                <div className="cf-grid2">
                  <label className="cf-field">
                    <span className="cf-field__label">{t.repeatEvery}</span>
                    <select className="cf-input cf-select" value={frequency} onChange={(e) => setFrequency(e.target.value as PORecurrence['frequency'])}>
                      <option value="weekly">{t.weekly}</option>
                      <option value="monthly">{t.monthly}</option>
                    </select>
                  </label>
                  <label className="cf-field">
                    <span className="cf-field__label">{t.timesLabel}</span>
                    <select className="cf-input cf-select" value={times} onChange={(e) => setTimes(Number(e.target.value))}>
                      {[2, 3, 4, 6, 8, 12].map((n) => (
                        <option key={n} value={n}>
                          {n} {t.times}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              <div className="wz-actions">
                <button type="button" className="btn btn--ghost btn--sm" onClick={onExit}>
                  {Ic.arrowLeft} {t.back}
                </button>
                <button type="button" className="btn btn--primary btn--sm" onClick={goToMenuStep} aria-disabled={!canNext1}>
                  {t.nextMenu} {Ic.arrowRight}
                </button>
              </div>
            </div>
          </MenuCard>
        )}

        {step === 2 && (
          <div className="step-content">
            {draftId ? (
              <MenuStep eventId={draftId} onBack={() => setStep(1)} onNext={() => setStep(3)} />
            ) : (
              <h3>…</h3>
            )}
          </div>
        )}

        {step === 3 && (
          <MenuCard
            className="menu-card--center"
            eyebrow={t.s3Eyebrow}
            title={t.s3Title}
            subtitle={t.s3Sub}
            tip={<span>💡 <strong>{t.s4Tip}</strong></span>}
          >
            <div className="sum-rows">
              {sumRow(undefined, t.rowName, <strong>{orderName.trim() || t.none}</strong>)}
              {sumRow(undefined, t.rowAdmin, orderAdmin.trim() || t.none)}
              {sumRow(undefined, t.rowPlace, venue.trim() || t.none)}
              {sumRow(undefined, t.rowCur, `${currencySymbol(currency)} - ${currencyName(currency)}`)}
              {sumRow(undefined, t.rowDate, dateLabel(deliveryDate))}
              {sumRow(undefined, t.rowDeadline, dateLabel(orderDeadline))}
              {sumRow(undefined, t.rowRepeat, isRecurring ? `${frequency === 'weekly' ? t.weekly : t.monthly} × ${times}` : t.none)}
              {sumRow(undefined, t.rowMenus, `${menus.length} ${t.items}`)}

              {menus.length > 0 && (
                <>
                  <div className="sum-metrics__title">{t.metricsTitle}</div>
                  <p className="cf-field__hint" style={{ margin: '0 0 8px' }}>{t.metricHint(noQuotaCount)}</p>
                  <div className="sum-metrics">
                    <div className="sum-metric-card">
                      <span>{t.metricRevenue}</span>
                      <strong>{formatMoney(grossRevenue, currency)}</strong>
                    </div>
                    <div className="sum-metric-card">
                      <span>{t.metricCost}</span>
                      <strong>{formatMoney(vendorCost, currency)}</strong>
                    </div>
                    <div className="sum-metric-card">
                      <span>{t.metricProfit}</span>
                      <strong>{formatMoney(grossProfit, currency)}</strong>
                    </div>
                    <div className="sum-metric-card">
                      <span>{t.metricVendors}</span>
                      <strong>{vendorRows.length}</strong>
                    </div>
                  </div>

                  <div className="sum-metrics__title">{t.vendorBreakdown}</div>
                  <div className="sum-vendors">
                    {vendorRows.map(([vendor, info]) => (
                      <div key={vendor} className="sum-vendors__row">
                        <span>{vendor}</span>
                        <span>{info.menus} {t.items} · {formatMoney(info.projectedProfit, currency)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {draft && draft.menus.length > 0 && (
                <div className="sum-menus">
                  {draft.menus.map((m) => (
                    <div key={m.id} className="sum-menus__row">
                      <span>{m.emoji} {m.name}</span>
                      <span>{formatMoney(m.sellPrice, currency)} · {m.maxQuota ?? 1}u</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="wz-actions">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setStep(2)}>
                {Ic.arrowLeft} {t.back}
              </button>
              <button type="button" className="btn btn--primary btn--sm" onClick={save} disabled={!canNext1}>
                {t.create}
              </button>
            </div>
          </MenuCard>
        )}
      </main>
    </>
  )
}
