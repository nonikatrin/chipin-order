import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import AppBar from '../../components/AppBar'
import { Ic } from '../../components/icons'
import { useToast } from '../../components/Toast'
import { usePOStore, usePOEvent } from '../../po/store'
import { computePO } from '../../po/calc'
import {
  DEFAULT_TRIP,
  NO_SHOP,
  buildShoppingList,
  buildSoldOutNotice,
  isJastip,
  partialBought,
  jastipRefunds,
  jastipUnitPrice,
  sanitizeTrip,
  shoppingProgress,
} from '../../po/jastip'
import { sharePO } from '../../po/whatsapp'
import { useLangStore } from '../../utils/langStore'
import { allCurrencies, currencyName, currencySymbol, formatMoney } from '../../utils/format'
import { formatInputID, parseNumberID } from '../../utils/parseNumber'
import type { JastipTrip, POEvent, POMenu } from '../../po/types'

const STR = {
  id: {
    title: 'Jastip',
    secTrip: 'Perjalanan',
    secCost: 'Kurs & biaya',
    datesBad: 'Tanggal pulang sebelum tanggal berangkat.',
    currencyChanged: 'Harga item tidak dikonversi — angka yang sama dibaca dalam mata uang baru. Periksa daftar item.',
    feePercentSuffix: '% harga',
    example: 'Contoh',
    unsaved: 'Ada perubahan yang belum disimpan',
    savedState: 'Tersimpan',
    shopPh: 'mis. Don Quijote',
    addTitle: 'Tambah item titipan',
    itemPh: 'mis. Tokyo Banana 8 pcs',
    addHint: 'Isi nama & harga toko',
    introTitle: 'Jadikan PO ini Jastip ✈️',
    introText:
      'Untuk titip beli dari luar negeri: masukkan harga di toko (mis. ¥), kurs, fee jastip, dan ongkos bagasi per kg — harga jual dihitung otomatis. Di hari belanja, centang yang dibeli; item habis langsung jadi refund.',
    enable: 'Aktifkan Mode Jastip',
    disable: 'Matikan Mode Jastip',
    disableConfirm: 'Kembali ke PO biasa? Status belanja (dibeli/habis) akan direset; harga item tetap.',
    tabTrip: 'Trip & Harga',
    tabShop: 'Belanja',
    tabRefund: 'Refund',
    destination: 'Tujuan',
    destinationPh: 'mis. Tokyo, Jepang',
    foreignCur: 'Mata uang toko',
    rate: 'Kurs',
    fee: 'Fee jastip per item',
    feeFixed: 'Nominal',
    feePercent: 'Persen',
    shipping: 'Ongkos bagasi per kg',
    shippingHint: 'Dibebankan sesuai berat item. Kosongkan bila sudah termasuk fee.',
    depart: 'Berangkat',
    back: 'Pulang',
    save: 'Simpan & hitung ulang harga',
    saved: 'Trip disimpan — harga item dihitung ulang',
    items: 'Item titipan',
    noItems: 'Belum ada item. Tambahkan di bawah.',
    itemName: 'Nama item',
    shop: 'Toko',
    price: 'Harga toko',
    weight: 'Berat per unit',
    add: 'Tambah item',
    breakdown: 'barang',
    feeShort: 'fee',
    shipShort: 'bagasi',
    sell: 'Harga jual',
    remove: 'Hapus item',
    progress: 'unit dibeli',
    soldOut: 'habis',
    pending: 'belum',
    bought: 'Dibeli',
    habis: 'Habis',
    partial: 'Sebagian',
    got: 'dapat',
    of: 'dari',
    less: 'Kurangi',
    more: 'Tambah',
    fifoHint: 'Dibagi ke pemesan paling awal dulu; sisanya jadi refund.',
    undo: 'Batal',
    ordered: 'dipesan',
    noOrders: 'Belum ada pesanan untuk dibelanjakan.',
    unordered: 'item tanpa pesanan disembunyikan',
    customsTitle: 'Total belanja',
    customsHint:
      'Bea Cukai membebaskan barang bawaan penumpang hingga USD 500 per orang; di atas itu kena bea masuk & pajak. Hitung biayanya di harga, jangan dipecah-pecah.',
    planned: 'rencana',
    spent: 'sudah dibeli',
    noRefund: 'Belum ada item habis atau pembayaran berlebih.',
    refundTotal: 'Total refund',
    refundTo: 'Kembalikan',
    newBill: 'Tagihan baru',
    notify: 'Kabari via WA',
    markedSoldOut: 'Ditandai habis — tagihan pemesan diperbarui',
    markedPartial: 'Jumlah terbeli disimpan — tagihan pemesan diperbarui',
  },
  en: {
    title: 'Jastip',
    secTrip: 'Trip',
    secCost: 'Rate & costs',
    datesBad: 'Return date is before the departure date.',
    currencyChanged: 'Item prices are not converted — the same numbers are read in the new currency. Check your items.',
    feePercentSuffix: '% of price',
    example: 'Example',
    unsaved: 'Unsaved changes',
    savedState: 'Saved',
    shopPh: 'e.g. Don Quijote',
    addTitle: 'Add an item',
    itemPh: 'e.g. Tokyo Banana 8 pcs',
    addHint: 'Enter a name & store price',
    introTitle: 'Turn this PO into a Jastip ✈️',
    introText:
      'For personal-shopper trips abroad: enter the store price (e.g. ¥), exchange rate, jastip fee and baggage cost per kg — the selling price is calculated for you. On shopping day, tick what you bought; sold-out items turn into refunds.',
    enable: 'Turn on Jastip mode',
    disable: 'Turn off Jastip mode',
    disableConfirm: 'Back to a regular PO? Shopping status (bought/sold out) is reset; item prices stay.',
    tabTrip: 'Trip & Prices',
    tabShop: 'Shopping',
    tabRefund: 'Refunds',
    destination: 'Destination',
    destinationPh: 'e.g. Tokyo, Japan',
    foreignCur: 'Store currency',
    rate: 'Exchange rate',
    fee: 'Jastip fee per item',
    feeFixed: 'Fixed',
    feePercent: 'Percent',
    shipping: 'Baggage cost per kg',
    shippingHint: 'Charged by item weight. Leave empty if it is part of the fee.',
    depart: 'Depart',
    back: 'Return',
    save: 'Save & recalculate prices',
    saved: 'Trip saved — item prices recalculated',
    items: 'Items',
    noItems: 'No items yet. Add one below.',
    itemName: 'Item name',
    shop: 'Store',
    price: 'Store price',
    weight: 'Weight per unit',
    add: 'Add item',
    breakdown: 'item',
    feeShort: 'fee',
    shipShort: 'baggage',
    sell: 'Selling price',
    remove: 'Remove item',
    progress: 'units bought',
    soldOut: 'sold out',
    pending: 'to buy',
    bought: 'Bought',
    habis: 'Sold out',
    partial: 'Partial',
    got: 'got',
    of: 'of',
    less: 'Fewer',
    more: 'More',
    fifoHint: 'Shared with the earliest orders first; the rest become refunds.',
    undo: 'Undo',
    ordered: 'ordered',
    noOrders: 'No orders to shop for yet.',
    unordered: 'items without orders hidden',
    customsTitle: 'Shopping total',
    customsHint:
      'Indonesian customs exempts passenger goods up to USD 500 per person; above that, import duty and tax apply. Price that in rather than splitting goods.',
    planned: 'planned',
    spent: 'bought',
    noRefund: 'No sold-out items or overpayments yet.',
    refundTotal: 'Total refunds',
    refundTo: 'Refund',
    newBill: 'New bill',
    notify: 'Notify on WA',
    markedSoldOut: 'Marked sold out — buyer bills updated',
    markedPartial: 'Bought quantity saved — buyer bills updated',
  },
} as const

type Tab = 'trip' | 'shop' | 'refund'
type T = (typeof STR)['id'] | (typeof STR)['en']

/** Kolom angka: baca gaya Indonesia ("25.000", "11,5", "25rb"), tampil rapi saat ditinggalkan. */
const num = parseNumberID

export default function JastipPage() {
  const { poId } = useParams()
  const { currentLang } = useLangStore()
  const t: T = STR[currentLang] ?? STR.id
  const event = usePOEvent(poId)
  const setJastip = usePOStore((s) => s.setJastip)
  const [tab, setTab] = useState<Tab>('trip')

  if (!event) return <Navigate to="/" replace />
  const on = isJastip(event) && !!event.jastip
  const refunds = on ? jastipRefunds(event) : []

  function enable() {
    const idr = event!.currency === 'IDR'
    setJastip(event!.id, {
      ...DEFAULT_TRIP,
      ...(event!.jastip ?? {}),
      // default fee/ongkir dalam rupiah tak masuk akal utk PO berdolar
      ...(event!.jastip || idr ? {} : { rate: 1, feeValue: 0, shippingPerKg: 0 }),
    })
  }

  return (
    <>
      <AppBar title={`✈️ ${t.title} · ${event.name}`} backTo={`/po/${event.id}`} />
      <main className="page jst">
        {!on ? (
          <div className="card card--flat jst-intro">
            <h2 className="jst-intro__title">{t.introTitle}</h2>
            <p className="jst-intro__text">{t.introText}</p>
            <button type="button" className="btn btn--primary" onClick={enable}>
              {Ic.sparkles} {t.enable}
            </button>
          </div>
        ) : (
          <>
            <div className="chips jst-tabs" role="tablist">
              {(
                [
                  ['trip', t.tabTrip],
                  ['shop', t.tabShop],
                  ['refund', `${t.tabRefund}${refunds.length ? ` (${refunds.length})` : ''}`],
                ] as [Tab, string][]
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={tab === k}
                  className={'chip' + (tab === k ? ' chip--on' : '')}
                  onClick={() => setTab(k)}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === 'trip' && <TripTab event={event} t={t} />}
            {tab === 'shop' && <ShopTab event={event} t={t} />}
            {tab === 'refund' && <RefundTab event={event} t={t} />}

            {tab === 'trip' && (
              <button
                type="button"
                className="btn btn--ghost btn--sm jst-off"
                onClick={() => window.confirm(t.disableConfirm) && setJastip(event.id, null)}
              >
                {t.disable}
              </button>
            )}
          </>
        )}
      </main>
    </>
  )
}

// --- Trip & harga ------------------------------------------------------------

/** Label + isi + petunjuk opsional — satu pola untuk semua kolom formulir jastip. */
function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="cf-field">
      <span className="cf-field__label">{label}</span>
      {children}
      {hint && <span className="cf-field__hint">{hint}</span>}
    </label>
  )
}

/** Kolom angka dengan satuan DI DALAM kotak (¥ … · … IDR/kg), dirapikan saat ditinggalkan. */
function NumInput({
  value,
  onChange,
  onCommit,
  prefix,
  suffix,
  decimals = 4,
  placeholder,
  ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  onCommit?: (n: number) => void
  prefix?: string
  suffix?: string
  decimals?: number
  placeholder?: string
  ariaLabel?: string
}) {
  return (
    <span className="cf-affix">
      {prefix && <span className="cf-affix__pre">{prefix}</span>}
      <input
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          const n = num(value)
          onChange(formatInputID(n, decimals))
          onCommit?.(n)
        }}
      />
      {suffix && <span className="cf-affix__suf">{suffix}</span>}
    </span>
  )
}

const POPULAR_CURRENCIES = ['JPY', 'KRW', 'SGD', 'MYR', 'THB', 'CNY', 'HKD', 'TWD', 'AUD', 'USD', 'EUR', 'GBP', 'SAR']

function TripTab({ event, t }: { event: POEvent; t: T }) {
  const setJastip = usePOStore((s) => s.setJastip)
  const showToast = useToast((s) => s.show)
  const trip = event.jastip!
  const initial = {
    destination: trip.destination ?? '',
    foreignCurrency: trip.foreignCurrency,
    rate: formatInputID(trip.rate),
    feeMode: trip.feeMode,
    feeValue: formatInputID(trip.feeMode === 'percent' ? Math.round(trip.feeValue * 10000) / 100 : trip.feeValue, 2),
    shippingPerKg: formatInputID(trip.shippingPerKg, 2),
    departDate: trip.departDate ?? '',
    returnDate: trip.returnDate ?? '',
  }
  const [d, setD] = useState(initial)
  const set = (patch: Partial<typeof d>) => setD((x) => ({ ...x, ...patch }))
  const currencies = [...POPULAR_CURRENCIES, ...allCurrencies().filter((c) => !POPULAR_CURRENCIES.includes(c))].filter(
    (c) => c !== event.currency,
  )

  const draftTrip = (): JastipTrip => {
    const fee = num(d.feeValue)
    return {
      destination: d.destination,
      foreignCurrency: d.foreignCurrency,
      rate: num(d.rate),
      feeMode: d.feeMode,
      feeValue: d.feeMode === 'percent' ? fee / 100 : fee,
      shippingPerKg: num(d.shippingPerKg),
      departDate: d.departDate,
      returnDate: d.returnDate,
    }
  }
  const dirty = JSON.stringify(sanitizeTrip(draftTrip())) !== JSON.stringify(sanitizeTrip(trip))
  const datesBad = !!(d.departDate && d.returnDate && d.returnDate < d.departDate)
  const currencyChanged = d.foreignCurrency !== trip.foreignCurrency && event.menus.length > 0

  // Contoh hidup dari isian yang BELUM disimpan: barang 1.000 mata uang asing, 200 g.
  const ex = jastipUnitPrice({ foreignPrice: 1000, weightGrams: 200 }, sanitizeTrip(draftTrip()), event.currency)
  const fm = (n: number) => formatMoney(n, event.currency)
  const fc = (n: number) => formatMoney(n, d.foreignCurrency)

  function save() {
    if (datesBad) return
    setJastip(event.id, draftTrip())
    showToast(t.saved)
  }

  return (
    <>
      <div className="card card--flat cf-card">
        <h3 className="cf-card__title">✈️ {t.secTrip}</h3>
        <Field label={t.destination}>
          <input
            className="cf-input"
            value={d.destination}
            placeholder={t.destinationPh}
            maxLength={60}
            onChange={(e) => set({ destination: e.target.value })}
          />
        </Field>
        <div className="cf-grid2">
          <Field label={t.depart}>
            <input className="cf-input" type="date" value={d.departDate} onChange={(e) => set({ departDate: e.target.value })} />
          </Field>
          <Field label={t.back} hint={datesBad ? t.datesBad : undefined}>
            <input
              className={'cf-input' + (datesBad ? ' is-bad' : '')}
              type="date"
              value={d.returnDate}
              min={d.departDate || undefined}
              onChange={(e) => set({ returnDate: e.target.value })}
            />
          </Field>
        </div>

        <div className="cf-card__divider" />
        <h3 className="cf-card__title">💱 {t.secCost}</h3>
        <div className="cf-grid2">
          <Field label={t.foreignCur} hint={currencyChanged ? t.currencyChanged : undefined}>
            <select className="cf-input cf-select" value={d.foreignCurrency} onChange={(e) => set({ foreignCurrency: e.target.value })}>
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c} — {currencyName(c)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t.rate}>
            <NumInput value={d.rate} onChange={(v) => set({ rate: v })} prefix={`1 ${d.foreignCurrency} =`} suffix={event.currency} />
          </Field>
        </div>
        <Field label={t.fee}>
          <span className="cf-fee">
            <span className="seg" role="group" aria-label={t.fee}>
              {(['fixed', 'percent'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={'seg__btn jst-seg' + (d.feeMode === m ? ' is-on' : '')}
                  aria-pressed={d.feeMode === m}
                  onClick={(e) => {
                    e.preventDefault()
                    set({ feeMode: m })
                  }}
                >
                  {m === 'fixed' ? t.feeFixed : t.feePercent}
                </button>
              ))}
            </span>
            <NumInput
              value={d.feeValue}
              onChange={(v) => set({ feeValue: v })}
              suffix={d.feeMode === 'percent' ? t.feePercentSuffix : event.currency}
              decimals={2}
              ariaLabel={t.fee}
            />
          </span>
        </Field>
        <Field label={t.shipping} hint={t.shippingHint}>
          <NumInput value={d.shippingPerKg} onChange={(v) => set({ shippingPerKg: v })} suffix={`${event.currency}/kg`} decimals={2} />
        </Field>

        <div className="cf-example" aria-live="polite">
          <span className="cf-example__label">{t.example}</span>
          <span>
            {fc(1000)} · 200 g → {fm(ex.cost)} + {fm(ex.fee)} {t.feeShort}
            {ex.shipping > 0 && ` + ${fm(ex.shipping)} ${t.shipShort}`} = <strong>{fm(ex.sell)}</strong>
          </span>
        </div>

        <div className="cf-actions">
          <span className="cf-actions__state">{dirty ? t.unsaved : `✓ ${t.savedState}`}</span>
          <button type="button" className="btn btn--primary btn--sm" disabled={!dirty || datesBad} onClick={save}>
            {Ic.check} {t.save}
          </button>
        </div>
      </div>

      <h3 className="section-label">
        {t.items} <span className="cf-count">{event.menus.length}</span>
      </h3>
      {event.menus.length === 0 && <p className="jst-muted">{t.noItems}</p>}
      {event.menus.map((m) => (
        <ItemRow key={m.id} event={event} menu={m} t={t} />
      ))}
      <AddItem event={event} t={t} />
    </>
  )
}

function ItemRow({ event, menu, t }: { event: POEvent; menu: POMenu; t: T }) {
  const updateMenu = usePOStore((s) => s.updateMenu)
  const removeMenu = usePOStore((s) => s.removeMenu)
  const trip = event.jastip!
  const [d, setD] = useState({
    shop: menu.shop ?? '',
    price: formatInputID(menu.foreignPrice, 2),
    weight: formatInputID(menu.weightGrams, 0),
  })
  // Data berubah dari luar (perangkat lain / sinkron) → ikuti, KECUALI kolom yang isinya sama.
  useEffect(() => {
    setD((cur) => ({
      shop: cur.shop.trim() === (menu.shop ?? '') ? cur.shop : menu.shop ?? '',
      price: num(cur.price) === (menu.foreignPrice ?? 0) ? cur.price : formatInputID(menu.foreignPrice, 2),
      weight: num(cur.weight) === (menu.weightGrams ?? 0) ? cur.weight : formatInputID(menu.weightGrams, 0),
    }))
  }, [menu.shop, menu.foreignPrice, menu.weightGrams])

  const p = jastipUnitPrice({ foreignPrice: num(d.price), weightGrams: num(d.weight) }, trip, event.currency)
  const fm = (n: number) => formatMoney(n, event.currency)
  const commit = (patch: Partial<POMenu>) => updateMenu(event.id, menu.id, patch)

  return (
    <div className="card card--flat cf-item">
      <div className="cf-item__head">
        <span className="cf-item__name">
          {menu.emoji} {menu.name}
        </span>
        <span className="cf-item__sell">
          <small>{t.sell}</small>
          <strong>{fm(p.sell)}</strong>
        </span>
        <button
          type="button"
          className="iconbtn cf-item__del"
          aria-label={`${t.remove}: ${menu.name}`}
          onClick={() => window.confirm(`${t.remove}: ${menu.name}?`) && removeMenu(event.id, menu.id)}
        >
          {Ic.trash}
        </button>
      </div>
      <div className="cf-item__fields">
        <Field label={t.shop}>
          <input
            className="cf-input"
            value={d.shop}
            maxLength={40}
            placeholder={t.shopPh}
            onChange={(e) => setD({ ...d, shop: e.target.value })}
            onBlur={() => commit({ shop: d.shop })}
          />
        </Field>
        <Field label={t.price}>
          <NumInput
            value={d.price}
            onChange={(v) => setD((x) => ({ ...x, price: v }))}
            onCommit={(n) => commit({ foreignPrice: n })}
            prefix={currencySymbol(trip.foreignCurrency)}
            decimals={2}
          />
        </Field>
        <Field label={t.weight}>
          <NumInput
            value={d.weight}
            onChange={(v) => setD((x) => ({ ...x, weight: v }))}
            onCommit={(n) => commit({ weightGrams: Math.round(n) })}
            suffix="g"
            decimals={0}
          />
        </Field>
      </div>
      <div className="cf-item__calc">
        {fm(p.cost)} {t.breakdown} + {fm(p.fee)} {t.feeShort}
        {p.shipping > 0 && ` + ${fm(p.shipping)} ${t.shipShort}`}
      </div>
    </div>
  )
}

function AddItem({ event, t }: { event: POEvent; t: T }) {
  const addMenu = usePOStore((s) => s.addMenu)
  const [d, setD] = useState({ name: '', shop: '', price: '', weight: '' })
  const trip = event.jastip!
  const ok = d.name.trim() !== '' && num(d.price) > 0
  const p = jastipUnitPrice({ foreignPrice: num(d.price), weightGrams: num(d.weight) }, trip, event.currency)

  function add(e?: FormEvent) {
    e?.preventDefault()
    if (!ok) return
    addMenu(event.id, {
      name: d.name,
      emoji: '🛍️',
      buyPrice: 0,
      sellPrice: 0,
      shop: d.shop,
      foreignPrice: num(d.price),
      weightGrams: Math.round(num(d.weight)),
    })
    // toko sering sama untuk beberapa item berturut-turut → dipertahankan
    setD({ name: '', shop: d.shop, price: '', weight: '' })
  }

  return (
    <form className="card card--flat cf-item cf-add" onSubmit={add}>
      <h4 className="cf-add__title">
        {Ic.plus} {t.addTitle}
      </h4>
      <div className="cf-item__fields cf-add__fields">
        <Field label={t.itemName}>
          <input
            className="cf-input"
            value={d.name}
            maxLength={60}
            placeholder={t.itemPh}
            onChange={(e) => setD({ ...d, name: e.target.value })}
          />
        </Field>
        <Field label={t.shop}>
          <input
            className="cf-input"
            value={d.shop}
            maxLength={40}
            placeholder={t.shopPh}
            onChange={(e) => setD({ ...d, shop: e.target.value })}
          />
        </Field>
        <Field label={t.price}>
          <NumInput
            value={d.price}
            onChange={(v) => setD((x) => ({ ...x, price: v }))}
            prefix={currencySymbol(trip.foreignCurrency)}
            decimals={2}
          />
        </Field>
        <Field label={t.weight}>
          <NumInput value={d.weight} onChange={(v) => setD((x) => ({ ...x, weight: v }))} suffix="g" decimals={0} />
        </Field>
      </div>
      <div className="cf-actions">
        <span className="cf-actions__state">{ok ? `${t.sell}: ${formatMoney(p.sell, event.currency)}` : t.addHint}</span>
        <button type="submit" className="btn btn--primary btn--sm" disabled={!ok}>
          {Ic.plus} {t.add}
        </button>
      </div>
    </form>
  )
}

// --- Belanja hari-H ----------------------------------------------------------

function ShopTab({ event, t }: { event: POEvent; t: T }) {
  const updateMenu = usePOStore((s) => s.updateMenu)
  const showToast = useToast((s) => s.show)
  const fc = event.jastip!.foreignCurrency
  const groups = buildShoppingList(event)
  const prog = shoppingProgress(event)
  const hidden = event.menus.length - groups.reduce((n, g) => n + g.items.filter((i) => i.qty > 0).length, 0)
  const pct = prog.totalQty ? Math.round(((prog.bought + prog.soldOut) / prog.totalQty) * 100) : 0

  const setStatus = (m: POMenu, s: POMenu['shopStatus'], boughtQty?: number) => {
    updateMenu(event.id, m.id, { shopStatus: s, boughtQty: s === 'partial' ? boughtQty : undefined })
    if (s === 'sold-out') showToast(t.markedSoldOut)
    if (s === 'partial') showToast(t.markedPartial)
  }

  if (prog.totalQty === 0) return <p className="jst-muted">{t.noOrders}</p>

  return (
    <>
      <div className="card card--flat jst-prog">
        <div className="jst-prog__nums">
          <strong>
            {prog.bought}/{prog.totalQty - prog.soldOut}
          </strong>{' '}
          {t.progress}
          {prog.soldOut > 0 && <span className="pill pill--bad">{prog.soldOut} {t.soldOut}</span>}
          {prog.pending > 0 && <span className="pill pill--neutral">{prog.pending} {t.pending}</span>}
        </div>
        <div className="jst-bar" aria-hidden>
          <span style={{ width: `${pct}%` }} />
        </div>
        <div className="jst-customs">
          <strong>{t.customsTitle}:</strong> {formatMoney(prog.foreignSpent, fc)} {t.spent} ·{' '}
          {formatMoney(prog.foreignPlanned, fc)} {t.planned}
          <p>{t.customsHint}</p>
        </div>
      </div>

      {groups.map((g) => {
        const items = g.items.filter((i) => i.qty > 0)
        if (!items.length) return null
        return (
          <section key={g.shop}>
            <h3 className="section-label">
              {Ic.receipt} {g.shop === NO_SHOP ? '—' : g.shop}
            </h3>
            {items.map(({ menu, qty, foreignSubtotal }) => {
              // 'Sebagian' yang jatahnya kini ≥ pesanan (mis. ada pesanan dihapus) = terbeli penuh;
              // dulu tampil "dapat 0 dari 1" padahal tagihan menghitung penuh.
              const raw = menu.shopStatus ?? 'pending'
              const s = raw === 'partial' && (qty <= 1 || partialBought(menu) >= qty) ? 'bought' : raw
              // jatah tersimpan bisa lebih besar dari pesanan kini (pesanan dihapus) → jepit ke qty-1
              const got = Math.min(qty - 1, Math.max(1, partialBought(menu)))
              return (
                <div key={menu.id} className={'jst-shop' + (s !== 'pending' ? ` is-${s}` : '')}>
                  <div className="jst-shop__main">
                    <span className="jst-shop__qty">{qty}×</span>
                    <span className="jst-shop__name">{menu.name}</span>
                    <span className="jst-shop__sub">{formatMoney(foreignSubtotal, fc)}</span>
                  </div>
                  <div className="jst-shop__acts">
                    {s === 'pending' && (
                      <>
                        <button type="button" className="btn btn--sm jst-btn-good" onClick={() => setStatus(menu, 'bought')}>
                          {Ic.check} {t.bought}
                        </button>
                        {qty > 1 && (
                          <button
                            type="button"
                            className="btn btn--sm jst-btn-warn"
                            onClick={() => setStatus(menu, 'partial', qty - 1)}
                          >
                            ½ {t.partial}
                          </button>
                        )}
                        <button type="button" className="btn btn--sm jst-btn-bad" onClick={() => setStatus(menu, 'sold-out')}>
                          {Ic.x} {t.habis}
                        </button>
                      </>
                    )}
                    {s === 'partial' && (
                      <>
                        <div className="jst-step" role="group" aria-label={t.partial}>
                          <button
                            type="button"
                            aria-label={t.less}
                            disabled={got <= 1}
                            onClick={() => setStatus(menu, 'partial', got - 1)}
                          >
                            −
                          </button>
                          <span>
                            {t.got} <strong>{got}</strong> {t.of} {qty}
                          </span>
                          <button
                            type="button"
                            aria-label={t.more}
                            disabled={got >= qty - 1}
                            onClick={() => setStatus(menu, 'partial', got + 1)}
                          >
                            +
                          </button>
                        </div>
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setStatus(menu, undefined)}>
                          {t.undo}
                        </button>
                      </>
                    )}
                    {(s === 'bought' || s === 'sold-out') && (
                      <>
                        <span className={'pill ' + (s === 'bought' ? 'pill--good' : 'pill--bad')}>
                          {s === 'bought' ? `✓ ${t.bought}` : `✕ ${t.habis}`}
                        </span>
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setStatus(menu, undefined)}>
                          {t.undo}
                        </button>
                      </>
                    )}
                  </div>
                  {s === 'partial' && <p className="jst-shop__hint">{t.fifoHint}</p>}
                </div>
              )
            })}
          </section>
        )
      })}
      {hidden > 0 && (
        <p className="jst-muted">
          {hidden} {t.unordered}
        </p>
      )}
    </>
  )
}

// --- Refund ------------------------------------------------------------------

function RefundTab({ event, t }: { event: POEvent; t: T }) {
  const refunds = jastipRefunds(event)
  const totals = computePO(event)
  const bills = new Map(totals.buyers.map((c) => [c.buyerId, c]))
  const fm = (n: number) => formatMoney(n, event.currency)

  if (!refunds.length) return <p className="jst-muted">{t.noRefund}</p>

  return (
    <>
      <div className="card card--flat jst-prog">
        <div>
          <strong>{t.refundTotal}:</strong> {fm(totals.totalRefund)}
        </div>
      </div>
      {refunds.map((r) => {
        const c = bills.get(r.buyer.id)
        return (
          <div key={r.buyer.id} className="card card--flat jst-item">
            <div className="jst-item__head">
              <span className="jst-item__name">{r.buyer.name}</span>
              {r.refund > 0 && (
                <span className="pill pill--warn">
                  {t.refundTo} {fm(r.refund)}
                </span>
              )}
            </div>
            {r.shortItems.map((it) => (
              <div key={it.menu.id} className="jst-refund__line">
                {it.shipped === 0 ? (
                  <>
                    <s>
                      {it.ordered}× {it.menu.name}
                    </s>{' '}
                    · {t.habis}
                  </>
                ) : (
                  <>
                    {it.menu.name} · {t.got} {it.shipped} {t.of} {it.ordered}
                  </>
                )}
              </div>
            ))}
            {c && (
              <div className="jst-item__calc">
                <span>
                  {t.newBill}: {fm(c.bill)}
                </span>
              </div>
            )}
            <button
              type="button"
              className="btn btn--wa btn--sm"
              onClick={() => sharePO(buildSoldOutNotice(event, r), r.buyer.phone)}
            >
              {Ic.send} {t.notify}
            </button>
          </div>
        )
      })}
    </>
  )
}
