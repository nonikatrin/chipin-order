import { Fragment, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import AppBar from '../../components/AppBar'
import { Ic } from '../../components/icons'
import { MenuThumb } from '../../components/MenuThumb'
import { usePOEvent, usePOStore, vendorKey, findVendorPayout } from '../../po/store'
import { useLangStore } from '../../utils/langStore'
import { computePO, shippedQtyOf, shippedRows } from '../../po/calc'
import { buildCookOrderText, buildRecapReport, buildVendorReport, sharePO, NO_VENDOR_LABEL } from '../../po/whatsapp'
import { formatMoney, currencySymbol } from '../../utils/format'
import { downloadXlsx } from '../../utils/xlsx'
import { useProfileStore } from '../../utils/profileStore'
import { buildEventWorkbook, workbookFilename } from '../../po/exportWorkbook'
import type { ID, POMenu } from '../../po/types'

type SettleTab = 'recap' | 'supplier' | 'cashbook' | 'orders' | 'pay'
type PayFilter = 'all' | 'paid' | 'partial' | 'unpaid'

const strings = {
  id: {
    title: 'Rekap & Setoran',
    tabRecap: 'Rekap',
    tabSupplier: 'Untuk Supplier',
    tabCashbook: 'Buku Kas',
    tabOrders: 'Pesanan',
    tabPay: 'Bayar & Setor',
    porsiTitle: 'Porsi untuk Supplier',
    donated: 'Disumbang',
    porsi: 'porsi',
    setoran: 'Total Setoran ke Supplier',
    vendorPay: 'Setor ke',
    cookDefault: 'Supplier',
    over: '⚠️ Lewat batas',
    auditTitle: 'Ringkasan Buku Kas',
    cbWhere: 'Ke mana uangnya?',
    revenue: 'Revenue Komoditas',
    donationShare: (pct: number) => `Donasi (${pct}% dari pemasukan)`,
    danaMasuk: 'Total Dana Masuk Warga',
    lebih: 'Total Lebih Bayar',
    kurang: 'Total Kurang Bayar (belum masuk)',
    kurangHint: 'Catatan, bukan pengurang — untung dihitung dari tagihan.',
    cbDetailTitle: 'Rincian Buku Kas',
    cbOverBy: 'Lebih Bayar per Pemesan',
    cbShortBy: 'Kurang Bayar per Pemesan',
    cbSupplierBy: 'Setoran per Supplier',
    cbSubtotal: 'Subtotal',
    pemasak: 'Wajib Bayar Supplier',
    courier: 'Biaya Kurir',
    refund: 'Refund ke Pemesan (jastip)',
    untung: 'Untung Bersih Kas',
    minus: 'dikurangi',
    empty: 'Belum ada pesanan untuk direkap.',
    sendCook: 'Kirim Pesanan ke Supplier',
    supWho: 'Siapa menyiapkan apa',
    vRev: 'pemasukan',
    vProfit: 'untung',
    vOwed: 'Setor ke supplier',
    vPaid: 'Sudah dibayar',
    vUnpaid: 'Belum dibayar',
    vMarkPaid: (v: string) => `Tandai ${v} Dibayar`,
    vSendDetail: 'Kirim Rincian',
    vPaidBy: 'Dibayar oleh',
    vPaidByPh: 'Dibayar oleh… (mis. Budi)',
    vMethod: '— Metode —',
    mCash: 'Tunai',
    mTransfer: 'Transfer',
    mOther: 'Lainnya',
    payAll: (amt: string) => `Bayar Semua Supplier (${amt})`,
    payAllTitle: 'Tandai semua supplier dibayar?',
    payAllBody: (n: number, amt: string) =>
      `${n} supplier akan ditandai sudah dibayar — total ${amt}.`,
    cancel: 'Batal',
    payAllYes: 'Ya, Tandai Dibayar',
    settlementTitle: 'Setoran ke Bendahara',
    settleAmount: 'Untung untuk disetor',
    settleDone: 'Tandai Sudah Disetor',
    settleUndo: 'Batalkan setoran',
    settledOn: 'Disetor pada',
    stepDeposit: 'Setor Untung ke Bendahara',
    depositHint: 'Untung bersih siap disetor ke Kas',
    progress: (a: number, b: number) => `${a} dari ${b} langkah selesai`,
    oSearch: 'Cari nama pembeli…',
    oAllStatus: 'Semua Status',
    oAllItems: 'Semua Item',
    oPaid: 'Lunas',
    oPartial: 'Sebagian',
    oUnpaid: 'Belum',
    oBuyer: 'Pembeli',
    oItem: 'Item',
    oQty: 'Jml',
    oAmount: 'Nilai',
    oStatus: 'Status',
    oShowing: (n: number, m: number) => `Menampilkan ${n} dari ${m} baris`,
    oNone: 'Tidak ada baris yang cocok.',
    shareReport: 'Bagikan Laporan',
    printReport: 'Cetak / Simpan PDF',
    printHint: 'Tip: pilih "Simpan sebagai PDF" di dialog cetak.',
    excelReport: 'Unduh Excel (.xlsx)',
    excelHint: 'Semua sheet: menu, pesanan, status bayar, pivot, setoran supplier.',
    printGenerated: 'Laporan dibuat dengan Chip!n',
    actionsOpen: 'Buka aksi laporan',
    actionsClose: 'Tutup aksi laporan',
    pemesan: 'pemesan',
  },
  en: {
    title: 'Recap & Payout',
    tabRecap: 'Recap',
    tabSupplier: 'For Supplier',
    tabCashbook: 'Cashbook',
    tabOrders: 'Orders',
    tabPay: 'Pay & Deposit',
    porsiTitle: 'Portions for the Supplier',
    donated: 'Donated',
    porsi: 'portions',
    setoran: 'Total Owed to Supplier',
    vendorPay: 'Pay',
    cookDefault: 'Supplier',
    over: '⚠️ Over limit',
    auditTitle: 'Cashbook Summary',
    cbWhere: 'Where did the money go?',
    revenue: 'Commodity Revenue',
    donationShare: (pct: number) => `Donations (${pct}% of income)`,
    danaMasuk: 'Total Money In',
    lebih: 'Total Overpaid',
    kurang: 'Total Short (not collected)',
    kurangHint: 'A note, not a deduction — profit is computed from bills.',
    cbDetailTitle: 'Cashbook Detail',
    cbOverBy: 'Overpaid by Buyer',
    cbShortBy: 'Short by Buyer',
    cbSupplierBy: 'Owed per Supplier',
    cbSubtotal: 'Subtotal',
    pemasak: 'Owed to Supplier',
    courier: 'Courier Cost',
    refund: 'Refunds to Buyers (jastip)',
    untung: 'Net Profit (Kas)',
    minus: 'minus',
    empty: 'No orders to recap yet.',
    sendCook: 'Send Order to Supplier',
    supWho: 'Who gets what to prepare',
    vRev: 'revenue',
    vProfit: 'profit',
    vOwed: 'Owed to supplier',
    vPaid: 'Paid',
    vUnpaid: 'Not paid yet',
    vMarkPaid: (v: string) => `Mark ${v} as Paid`,
    vSendDetail: 'Send Details',
    vPaidBy: 'Paid by',
    vPaidByPh: 'Paid by… (e.g. Budi)',
    vMethod: '— Method —',
    mCash: 'Cash',
    mTransfer: 'Transfer',
    mOther: 'Other',
    payAll: (amt: string) => `Pay All Suppliers (${amt})`,
    payAllTitle: 'Mark all suppliers as paid?',
    payAllBody: (n: number, amt: string) =>
      `${n} suppliers will be marked as paid — ${amt} total.`,
    cancel: 'Cancel',
    payAllYes: 'Yes, Mark as Paid',
    settlementTitle: 'Deposit to Treasurer',
    settleAmount: 'Profit to deposit',
    settleDone: 'Mark as Deposited',
    settleUndo: 'Undo deposit',
    settledOn: 'Deposited on',
    stepDeposit: 'Deposit Profit to Treasurer',
    depositHint: 'Net profit ready to deposit to Kas',
    progress: (a: number, b: number) => `${a} of ${b} steps complete`,
    oSearch: 'Search buyer name…',
    oAllStatus: 'All Status',
    oAllItems: 'All Items',
    oPaid: 'Paid',
    oPartial: 'Partial',
    oUnpaid: 'Unpaid',
    oBuyer: 'Buyer',
    oItem: 'Item',
    oQty: 'Qty',
    oAmount: 'Amount',
    oStatus: 'Status',
    oShowing: (n: number, m: number) => `Showing ${n} of ${m} rows`,
    oNone: 'No rows match.',
    shareReport: 'Share Report',
    printReport: 'Print / Save PDF',
    printHint: 'Tip: choose "Save as PDF" in the print dialog.',
    excelReport: 'Download Excel (.xlsx)',
    excelHint: 'All sheets: menu, orders, payment status, pivot, supplier payout.',
    printGenerated: 'Report generated with Chip!n',
    actionsOpen: 'Open report actions',
    actionsClose: 'Close report actions',
    pemesan: 'buyers',
  },
}

export default function POFinalizePage() {
  const { poId } = useParams()
  const event = usePOEvent(poId)
  const toggleVendorPaid = usePOStore((s) => s.toggleVendorPaid)
  const setVendorPaidBy = usePOStore((s) => s.setVendorPaidBy)
  const setVendorPayMethod = usePOStore((s) => s.setVendorPayMethod)
  const setSettlement = usePOStore((s) => s.setSettlement)
  const { currentLang } = useLangStore()
  // Penyelenggara = badan yang menjalankan PO (mis. "Paguyuban"), diambil dari profil usaha.
  // `event.organizerName` adalah ORANG yang mengurus (Admin Pemesanan) — bukan hal yang sama.
  const orgName = useProfileStore((s) => s.profile.storeName)
  const t = strings[currentLang] ?? strings.id

  const [tab, setTab] = useState<SettleTab>('recap')
  const [printAll, setPrintAll] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [payAllConfirm, setPayAllConfirm] = useState(false)
  const [oQuery, setOQuery] = useState('')
  const [oStatus, setOStatus] = useState<PayFilter>('all')
  const [oItem, setOItem] = useState<'all' | ID>('all')

  // Cetak → Simpan sebagai PDF (native browser, tanpa server). Semua tab dirender
  // sekaligus saat mencetak agar laporan lengkap, lalu kembali ke tab aktif.
  function printReport() {
    setPrintAll(true)
    setTimeout(() => {
      window.print()
      setPrintAll(false)
    }, 80)
  }

  const data = useMemo(() => (event ? computePO(event) : null), [event])
  const menuMap = useMemo(() => {
    const m = new Map<ID, POMenu>()
    event?.menus.forEach((x) => m.set(x.id, x))
    return m
  }, [event])

  if (!event || !data) return <Navigate to="/" replace />
  const cur = event.currency
  const fm = (n: number) => formatMoney(n, cur)
  // Harga satuan utk baris "unit × porsi = subtotal". Basis persen bisa punya satuan
  // pecahan (mis. $11.8925) — tampilkan 4 desimal bila pembulatan membuat hitungan
  // tak persis, supaya perkaliannya selalu jujur.
  const fmUnit = (cost: number, qty: number) => {
    const unit = cost / qty
    const dec2 = Math.round(unit * 100) / 100
    if (Math.abs(dec2 * qty - cost) < 0.005) return fm(unit)
    return `${currencySymbol(cur)} ${unit.toFixed(4)}`
  }

  const activeMenus = data.menus.filter((r) => r.qtyTotal > 0)
  const calcById = new Map(data.buyers.map((b) => [b.buyerId, b]))

  // Kelompokkan per supplier: baris menu (porsi + setoran) + subtotal — kartu prep sheet.
  const vendorGroups = (() => {
    const map = new Map<
      string,
      { vendor: string; rows: typeof activeMenus; subtotal: number; qty: number; revenue: number; donatedQty: number }
    >()
    for (const r of activeMenus) {
      const m = menuMap.get(r.menuId)
      const vendor = (m?.vendor && m.vendor.trim()) || NO_VENDOR_LABEL
      // Dikelompokkan tanpa peduli besar-kecil huruf: "Sri" & "sri" adalah satu orang.
      // Ejaan yang pertama muncul dipakai sebagai nama tampilan.
      const key = vendorKey(vendor)
      let g = map.get(key)
      if (!g) {
        g = { vendor, rows: [], subtotal: 0, qty: 0, revenue: 0, donatedQty: 0 }
        map.set(key, g)
      }
      g.rows.push(r)
      g.subtotal += r.cost
      g.qty += r.qtyTotal
      g.revenue += r.revenue
      if (m?.donated) g.donatedQty += r.qtyTotal
    }
    return [...map.values()]
  })()

  // Supplier tanpa tagihan (mis. semua itemnya disumbang) tak masuk antrean bayar —
  // "bayar $0" cuma langkah kosong yang mengaburkan progres.
  const unpaidVendors = vendorGroups.filter(
    (g) => g.subtotal > 0 && !findVendorPayout(event, g.vendor)?.paid,
  )
  const unpaidTotal = unpaidVendors.reduce((s, g) => s + g.subtotal, 0)

  // §2.3 Item × Buyer pivot (kuantitas per item per pemesan)
  // Qty DITERIMA per pemesan (jastip habis/sebagian terpotong) — menjumlah ke `r.qtyTotal`.
  const shipped = shippedQtyOf(event)
  const pivot = activeMenus.map((r) => {
    const m = menuMap.get(r.menuId)
    const cells = event.buyers.map((b) => ({
      name: b.name,
      qty: shipped(b, r.menuId),
    }))
    return { menu: m, total: r.qtyTotal, cells: cells.filter((c) => c.qty > 0) }
  })

  const pivotByMenu = new Map(pivot.filter((p) => p.menu).map((p) => [p.menu!.id, p.cells]))

  // Rincian buku kas: siapa lebih/kurang bayar (nama pembeli dari event, angka dari calc).
  const nameById = new Map(event.buyers.map((b) => [b.id, b.name]))
  const overBuyers = data.buyers.filter((c) => c.lebihBayar > 0)
  const shortBuyers = data.buyers.filter((c) => c.kurangBayar > 0)

  const outstanding = data.untungBersih
  const deposited = event.settlement?.status === 'deposited'

  // Status bayar per pembeli (sama dengan klasifikasi dasbor).
  function buyerStatus(buyerId: ID): PayFilter {
    const c = calcById.get(buyerId)
    if (!c) return 'unpaid'
    // Tak ada sisa tagihan = Lunas. Termasuk item gratis (tagihan 0): dulu jatuh ke
    // "Belum" sehingga pemesan yang tak berutang apa pun terlihat menunggak selamanya.
    if (c.kurangBayar <= 0) return 'paid'
    if (c.paid <= 0) return 'unpaid'
    return 'partial'
  }

  // Baris tabel Pesanan: satu baris per item per pembeli.
  const orderRows = shippedRows(event)
  const q = oQuery.trim().toLowerCase()
  const shownRows = orderRows.filter((r) => {
    if (q && !r.buyer.name.toLowerCase().includes(q)) return false
    if (oStatus !== 'all' && buyerStatus(r.buyer.id) !== oStatus) return false
    if (oItem !== 'all' && r.menu.id !== oItem) return false
    return true
  })

  // Checklist Bayar & Setor: satu langkah per supplier YANG PUNYA TAGIHAN + satu langkah setoran.
  // Supplier yang menyumbang tak punya langkah bayar, jadi tak ikut menghitung progres.
  const payableVendors = vendorGroups.filter((g) => g.subtotal > 0)
  const paySteps = payableVendors.length + 1
  const payDone = payableVendors.length - unpaidVendors.length + (deposited ? 1 : 0)

  const statusLabel: Record<Exclude<PayFilter, 'all'>, string> = {
    paid: t.oPaid,
    partial: t.oPartial,
    unpaid: t.oUnpaid,
  }
  const statusPill: Record<Exclude<PayFilter, 'all'>, string> = {
    paid: 'pill--good',
    partial: 'pill--warn',
    unpaid: 'pill--bad',
  }

  const show = (x: SettleTab) => printAll || tab === x

  function renderRecap() {
    return (
      <Fragment key="recap">
        <section className="summary" style={{ marginTop: 16 }}>
          <div className="summary__label">{t.untung}</div>
          <div className="summary__total">{fm(data!.untungBersih)}</div>
          <div className="summary__split">
            {Ic.users}
            <span>
              {data!.totalPorsi} {t.porsi} · {event!.buyers.length} {t.pemesan}
            </span>
          </div>
        </section>

        <div className="section-label">{Ic.clipboard} {t.porsiTitle}</div>
        <div className="card">
          {vendorGroups.map((g) => (
            <Fragment key={g.vendor}>
              {vendorGroups.length > 1 && (
                <div className="detail-line" style={{ borderBottom: '1px dashed rgba(0,0,0,0.12)' }}>
                  <span className="detail-line__label" style={{ fontWeight: 800 }}>{g.vendor}</span>
                </div>
              )}
              {g.rows.map((r) => {
                const m = menuMap.get(r.menuId)
                if (!m) return null
                const over = m.maxQuota != null && r.qtyTotal > m.maxQuota
                return (
                  <div className="detail-line" key={r.menuId}>
                    <span className="detail-line__label">
                      {m.emoji} {m.name}
                      <div className="row__sub" style={{ marginTop: 2 }}>
                        {r.qtyTotal}
                        {m.maxQuota != null ? ` / ${m.maxQuota}` : ''} {t.porsi}
                        {over && <span className="pill pill--bad" style={{ marginLeft: 8 }}>{t.over}</span>}
                      </div>
                    </span>
                    <span className="detail-line__value">
                      {m.donated ? <span className="pill pill--good">{t.donated}</span> : fm(r.cost)}
                    </span>
                  </div>
                )
              })}
            </Fragment>
          ))}
          <div className="detail-line" style={{ borderTop: '3px solid var(--ink)', marginTop: 6 }}>
            <span className="detail-line__label" style={{ color: 'var(--ink)' }}>{t.setoran}</span>
            <span className="detail-line__value money" style={{ color: 'var(--bad)', fontSize: '1.3rem' }}>
              {fm(data!.wajibBayarPemasak)}
            </span>
          </div>
        </div>
      </Fragment>
    )
  }

  function renderSupplier() {
    return (
      <Fragment key="supplier">
        <p className="muted" style={{ margin: '14px 0 0' }}>{t.supWho}</p>
        {vendorGroups.map((g) => {
          const payout = findVendorPayout(event!, g.vendor)
          const paid = payout?.paid
          return (
            <div key={g.vendor} className={'supcard' + (paid ? ' is-paid' : '')}>
              <div className="supcard__head">
                <span className="supcard__avatar" aria-hidden>
                  {g.vendor.charAt(0).toUpperCase()}
                </span>
                <span className="supcard__name">
                  {g.vendor}
                  <span className="supcard__meta">
                    {g.qty} {t.porsi} · {t.vRev} {fm(g.revenue)} · {t.vProfit} {fm(g.revenue - g.subtotal)}
                  </span>
                </span>
                <span className="supcard__pay">{fm(g.subtotal)}</span>
              </div>
              <div className="supcard__rows">
                {g.rows.map((r) => {
                  const m = menuMap.get(r.menuId)
                  if (!m) return null
                  const cells = pivotByMenu.get(m.id) ?? []
                  return (
                    <div className="supcard__row" key={r.menuId}>
                      <MenuThumb menu={m} />
                      <span className="supcard__row-name">
                        {m.name}
                        {cells.length > 0 && (
                          <span className="supcard__row-buyers">
                            {cells.map((c) => `${c.name} (${c.qty})`).join(' · ')}
                          </span>
                        )}
                      </span>
                      <span className="supcard__row-amt">
                        {m.donated ? (
                          <span className="pill pill--good">{t.donated}</span>
                        ) : (
                          <>
                            <span className="supcard__row-math">
                              {fmUnit(r.cost, r.qtyTotal)} × {r.qtyTotal}
                            </span>
                            <span>{fm(r.cost)}</span>
                          </>
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
              {!paid ? (
                <div className="supcard__actions">
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => toggleVendorPaid(event!.id, g.vendor)}
                  >
                    {Ic.checkCircle} {t.vMarkPaid(g.vendor)}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => sharePO(buildVendorReport(event!, g.vendor, NO_VENDOR_LABEL))}
                  >
                    {Ic.send} {t.vSendDetail}
                  </button>
                </div>
              ) : (
                <div className="supcard__paidrow">
                  <button
                    type="button"
                    className="btn btn--sm btn--ghost supcard__paidbtn"
                    title={payout?.paidDate}
                    onClick={() => toggleVendorPaid(event!.id, g.vendor)}
                  >
                    {Ic.checkCircle} {t.vPaid}
                    {payout?.paidDate ? ` · ${payout.paidDate}` : ''}
                  </button>
                  <input
                    className="input"
                    aria-label={t.vPaidBy}
                    value={payout?.paidBy ?? ''}
                    placeholder={t.vPaidByPh}
                    onChange={(ev) => setVendorPaidBy(event!.id, g.vendor, ev.target.value)}
                  />
                  <select
                    className="input input--select"
                    aria-label="Payment method"
                    value={payout?.method ?? ''}
                    onChange={(ev) =>
                      setVendorPayMethod(
                        event!.id,
                        g.vendor,
                        (ev.target.value || undefined) as 'cash' | 'transfer' | 'other' | undefined,
                      )
                    }
                  >
                    <option value="">{t.vMethod}</option>
                    <option value="cash">{t.mCash}</option>
                    <option value="transfer">{t.mTransfer}</option>
                    <option value="other">{t.mOther}</option>
                  </select>
                  <button
                    type="button"
                    className="btn btn--sm btn--ghost supcard__paidbtn"
                    onClick={() => sharePO(buildVendorReport(event!, g.vendor, NO_VENDOR_LABEL))}
                  >
                    {Ic.send} {t.vSendDetail}
                  </button>
                </div>
              )}
            </div>
          )
        })}
        {unpaidVendors.length > 1 && (
          <button
            type="button"
            className="btn btn--payall"
            style={{ marginTop: 14 }}
            onClick={() => setPayAllConfirm(true)}
          >
            {Ic.bank} {t.payAll(fm(unpaidTotal))}
          </button>
        )}

      </Fragment>
    )
  }

  function renderCashbook() {
    return (
      <Fragment key="cashbook">
        <p className="muted" style={{ margin: '14px 0 0' }}>{t.cbWhere}</p>
        <div className="card wfall">
          <div className="wfall__row">
            <span>{Ic.wallet} {t.revenue}</span>
            <span className="money">{fm(data!.revenue)}</span>
          </div>
          {data!.totalDonation > 0 && (
            <div className="wfall__row wfall__row--soft">
              <span>
                {t.donationShare(data!.revenue > 0 ? Math.round((data!.totalDonation / data!.revenue) * 100) : 0)}
              </span>
              <span className="money" style={{ color: 'var(--info)' }}>{fm(data!.totalDonation)}</span>
            </div>
          )}
          <div className="wfall__row">
            <span>＋ {t.lebih}</span>
            <span className="money" style={{ color: 'var(--good)' }}>{fm(data!.totalLebihBayar)}</span>
          </div>
          <div className="wfall__row wfall__row--sum">
            <span>{t.danaMasuk}</span>
            <span className="money">{fm(data!.danaMasuk)}</span>
          </div>
          <span className="wfall__op" aria-hidden>{t.minus}</span>
          <div className="wfall__row">
            <span>{t.pemasak}</span>
            <span className="money" style={{ color: 'var(--bad)' }}>− {fm(data!.wajibBayarPemasak)}</span>
          </div>
          {data!.totalCourierCost > 0 && (
            <>
              <span className="wfall__op" aria-hidden>{t.minus}</span>
              <div className="wfall__row">
                <span>{t.courier}</span>
                <span className="money" style={{ color: 'var(--bad)' }}>− {fm(data!.totalCourierCost)}</span>
              </div>
            </>
          )}
          {/* Jastip: lebih bayar dikembalikan, bukan untung — tanpa baris ini air terjun tak menjumlah. */}
          {data!.totalRefund > 0 && (
            <>
              <span className="wfall__op" aria-hidden>{t.minus}</span>
              <div className="wfall__row">
                <span>{t.refund}</span>
                <span className="money" style={{ color: 'var(--bad)' }}>− {fm(data!.totalRefund)}</span>
              </div>
            </>
          )}
          {data!.totalKurangBayar > 0 && (
            <div className="wfall__row wfall__row--warn" title={t.kurangHint}>
              <span>{Ic.alert} {t.kurang}</span>
              <span className="money">{fm(data!.totalKurangBayar)}</span>
            </div>
          )}
          <div className="wfall__row wfall__row--net">
            <span>{t.untung}</span>
            <span className="money" style={{ color: 'var(--good)' }}>{fm(data!.untungBersih)}</span>
          </div>
        </div>

        {/* Rincian di balik tiap baris air terjun: siapa lebih/kurang bayar, setoran per supplier. */}
        <div className="section-label" style={{ marginTop: 18 }}>{Ic.receipt} {t.cbDetailTitle}</div>
        <div className="card">
          {overBuyers.length > 0 && (
            <div className="cbgroup">
              <div className="cbgroup__title">{t.cbOverBy}</div>
              {overBuyers.map((c) => (
                <div className="detail-line" key={c.buyerId}>
                  <span className="detail-line__label">{nameById.get(c.buyerId)}</span>
                  <span className="detail-line__value money" style={{ color: 'var(--good)' }}>
                    ＋ {fm(c.lebihBayar)}
                  </span>
                </div>
              ))}
              <div className="detail-line cbgroup__sum">
                <span className="detail-line__label">{t.cbSubtotal}</span>
                <span className="detail-line__value money" style={{ color: 'var(--good)' }}>
                  {fm(data!.totalLebihBayar)}
                </span>
              </div>
            </div>
          )}
          {shortBuyers.length > 0 && (
            <div className="cbgroup">
              <div className="cbgroup__title">{t.cbShortBy}</div>
              {shortBuyers.map((c) => (
                <div className="detail-line" key={c.buyerId}>
                  <span className="detail-line__label">{nameById.get(c.buyerId)}</span>
                  <span className="detail-line__value money" style={{ color: 'var(--bad)' }}>
                    − {fm(c.kurangBayar)}
                  </span>
                </div>
              ))}
              <div className="detail-line cbgroup__sum">
                <span className="detail-line__label">{t.cbSubtotal}</span>
                <span className="detail-line__value money" style={{ color: 'var(--bad)' }}>
                  {fm(data!.totalKurangBayar)}
                </span>
              </div>
            </div>
          )}
          <div className="cbgroup">
            <div className="cbgroup__title">{t.cbSupplierBy}</div>
            {vendorGroups.map((g) => {
              const paid = findVendorPayout(event!, g.vendor)?.paid
              return (
                <div className="detail-line" key={g.vendor}>
                  <span className="detail-line__label">
                    {g.vendor}{' '}
                    <span className={'pill ' + (paid ? 'pill--good' : 'pill--bad')}>
                      {paid ? t.vPaid : t.vUnpaid}
                    </span>
                  </span>
                  <span className="detail-line__value money" style={{ color: 'var(--bad)' }}>
                    − {fm(g.subtotal)}
                  </span>
                </div>
              )
            })}
            <div className="detail-line cbgroup__sum">
              <span className="detail-line__label">{t.cbSubtotal}</span>
              <span className="detail-line__value money" style={{ color: 'var(--bad)' }}>
                {fm(data!.wajibBayarPemasak)}
              </span>
            </div>
          </div>
        </div>
      </Fragment>
    )
  }

  function renderOrders() {
    return (
      <Fragment key="orders">
        <div className="otable-tools">
          <input
            className="input"
            type="search"
            placeholder={t.oSearch}
            value={oQuery}
            onChange={(e) => setOQuery(e.target.value)}
          />
          <select className="input input--select" value={oStatus} onChange={(e) => setOStatus(e.target.value as PayFilter)}>
            <option value="all">{t.oAllStatus}</option>
            <option value="paid">{t.oPaid}</option>
            <option value="partial">{t.oPartial}</option>
            <option value="unpaid">{t.oUnpaid}</option>
          </select>
          <select className="input input--select" value={oItem} onChange={(e) => setOItem(e.target.value as 'all' | ID)}>
            <option value="all">{t.oAllItems}</option>
            {event!.menus.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div className="card" style={{ padding: '4px 14px 10px' }}>
          <div className="otable-wrap">
            <table className="otable">
              <thead>
                <tr>
                  <th>{t.oBuyer}</th>
                  <th>{t.oItem}</th>
                  <th className="num">{t.oQty}</th>
                  <th className="num">{t.oAmount}</th>
                  <th>{t.oStatus}</th>
                </tr>
              </thead>
              <tbody>
                {shownRows.map((r, i) => {
                  const st = buyerStatus(r.buyer.id)
                  return (
                    <tr key={r.buyer.id + '-' + i}>
                      <td>{r.buyer.name}</td>
                      <td>{r.menu.name}</td>
                      <td className="num">{r.qty}×</td>
                      <td className="num money">{fm(r.menu.sellPrice * r.qty)}</td>
                      <td>
                        <span className={'pill ' + statusPill[st as Exclude<PayFilter, 'all'>]}>
                          {statusLabel[st as Exclude<PayFilter, 'all'>]}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {shownRows.length === 0 && (
              <p className="muted" style={{ padding: '12px 4px' }}>{t.oNone}</p>
            )}
          </div>
          <p className="row__sub" style={{ marginTop: 8 }}>{t.oShowing(shownRows.length, orderRows.length)}</p>
        </div>
      </Fragment>
    )
  }

  function renderPay() {
    return (
      <Fragment key="pay">
        <div className="paysteps">
          {payableVendors.map((g, i) => {
            const payout = findVendorPayout(event!, g.vendor)
            const paid = payout?.paid
            return (
              <div key={g.vendor} className={'paystep' + (paid ? ' is-done' : '')}>
                <div className="paystep__eyebrow">
                  <span className="paystep__num">{paid ? '✓' : i + 1}</span>
                  {t.vendorPay} {g.vendor}
                </div>
                <div className="paystep__amount money">{fm(g.subtotal)}</div>
                <div className={'paystep__status' + (paid ? ' is-done' : '')}>
                  {paid ? `${t.vPaid}${payout?.paidBy ? ` · ${payout.paidBy}` : ''}${payout?.paidDate ? ` · ${payout.paidDate}` : ''}` : t.vUnpaid}
                </div>
                <button
                  type="button"
                  className={'btn btn--sm ' + (paid ? 'btn--ghost' : 'btn--primary')}
                  style={{ marginTop: 10 }}
                  onClick={() => toggleVendorPaid(event!.id, g.vendor)}
                >
                  {Ic.checkCircle} {paid ? t.vPaid : t.vMarkPaid(g.vendor)}
                </button>
              </div>
            )
          })}
          <div className={'paystep paystep--deposit' + (deposited ? ' is-done' : '')}>
            <div className="paystep__eyebrow">
              <span className="paystep__num">{deposited ? '✓' : payableVendors.length + 1}</span>
              {t.stepDeposit}
            </div>
            <div className="paystep__amount money">{fm(outstanding)}</div>
            <div className={'paystep__status' + (deposited ? ' is-done' : '')}>
              {deposited ? `${t.settledOn} ${event!.settlement?.depositedDate ?? ''}` : t.depositHint}
            </div>
            <button
              type="button"
              className={'btn btn--sm ' + (deposited ? 'btn--ghost' : 'btn--payall')}
              style={{ marginTop: 10 }}
              onClick={() =>
                setSettlement(event!.id, {
                  status: deposited ? 'not-deposited' : 'deposited',
                  depositedAmount: deposited ? undefined : outstanding,
                })
              }
            >
              {deposited ? t.settleUndo : <>{Ic.bank} {t.settleDone}</>}
            </button>
          </div>
        </div>

        <div className="payprog">
          <span className="payprog__label">{t.progress(payDone, paySteps)}</span>
          <span className="payprog__bar">
            <span className="payprog__fill" style={{ width: `${Math.round((payDone / paySteps) * 100)}%` }} />
          </span>
          <span className="payprog__pct">{Math.round((payDone / paySteps) * 100)}%</span>
        </div>
      </Fragment>
    )
  }

  return (
    <>
      <AppBar title={t.title} subtitle={`${event.emoji} ${event.name}`} backTo={`/po/${event.id}`} />

      <main className="page page--dial">
        {/* Kop laporan — hanya muncul saat dicetak/PDF (AppBar disembunyikan). */}
        <div className="print-head" aria-hidden="true">
          <div className="print-head__brand">Chip!n</div>
          <div className="print-head__title">
            {t.title} — {event.name}
          </div>
          <div className="print-head__meta">
            {[event.deliveryDate, event.place].filter(Boolean).join(' · ')}
          </div>
        </div>

        {activeMenus.length === 0 ? (
          <div className="empty">
            <div className="empty__art" aria-hidden>📊</div>
            <p className="empty__text">{t.empty}</p>
          </div>
        ) : (
          <>
            <div className="stabs" role="tablist">
              {(
                [
                  ['recap', Ic.barChart, t.tabRecap],
                  ['supplier', Ic.receipt, t.tabSupplier],
                  ['cashbook', Ic.wallet, t.tabCashbook],
                  ['orders', Ic.clipboard, t.tabOrders],
                  ['pay', Ic.bank, t.tabPay],
                ] as const
              ).map(([id, icon, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  className={'stab' + (tab === id ? ' is-on' : '')}
                  onClick={() => setTab(id)}
                >
                  {icon} {label}
                </button>
              ))}
            </div>

            {show('recap') && renderRecap()}
            {show('supplier') && renderSupplier()}
            {show('cashbook') && renderCashbook()}
            {show('orders') && renderOrders()}
            {show('pay') && renderPay()}

            {/* Catatan kaki laporan — hanya saat dicetak. */}
            <div className="print-foot" aria-hidden="true">
              {t.printGenerated} · {new Date().toLocaleDateString()}
            </div>
          </>
        )}
      </main>

      {payAllConfirm && (
        <div className="confirm-backdrop" onClick={() => setPayAllConfirm(false)}>
          <div className="confirm" role="alertdialog" onClick={(ev) => ev.stopPropagation()}>
            <div className="confirm__title">
              <span className="confirm__ico" aria-hidden>{Ic.bank}</span>
              {t.payAllTitle}
            </div>
            <p className="confirm__text">{t.payAllBody(unpaidVendors.length, fm(unpaidTotal))}</p>
            <div className="confirm__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setPayAllConfirm(false)}>
                {t.cancel}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  unpaidVendors.forEach((g) => toggleVendorPaid(event.id, g.vendor))
                  setPayAllConfirm(false)
                }}
              >
                {t.payAllYes}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeMenus.length > 0 && (
        <>
          {actionsOpen && (
            <div className="spd-backdrop" aria-hidden="true" onClick={() => setActionsOpen(false)} />
          )}
          <div className={'spd' + (actionsOpen ? ' spd--open' : '')}>
            <div className="spd__menu" role="menu" aria-label={t.title}>
              <button
                type="button"
                role="menuitem"
                className="spd__action"
                onClick={() => {
                  setActionsOpen(false)
                  sharePO(buildRecapReport(event))
                }}
              >
                <span className="spd__label">{t.shareReport}</span>
                <span className="spd__ico spd__ico--brand" aria-hidden="true">{Ic.share}</span>
              </button>

              <button
                type="button"
                role="menuitem"
                className="spd__action m-only-hidden"
                title={t.printHint}
                onClick={() => {
                  setActionsOpen(false)
                  printReport()
                }}
              >
                <span className="spd__label">{t.printReport}</span>
                <span className="spd__ico spd__ico--ink" aria-hidden="true">{Ic.receipt}</span>
              </button>

              <button
                type="button"
                role="menuitem"
                className="spd__action"
                onClick={() => {
                  setActionsOpen(false)
                  sharePO(buildCookOrderText(event))
                }}
              >
                <span className="spd__label">{t.sendCook}</span>
                <span className="spd__ico spd__ico--wa" aria-hidden="true">{Ic.send}</span>
              </button>

              <button
                type="button"
                role="menuitem"
                className="spd__action"
                title={t.excelHint}
                onClick={() => {
                  setActionsOpen(false)
                  downloadXlsx(buildEventWorkbook(event, currentLang, orgName), workbookFilename(event))
                }}
              >
                <span className="spd__label">{t.excelReport}</span>
                <span className="spd__ico spd__ico--ink" aria-hidden="true">{Ic.download}</span>
              </button>
            </div>

            <button
              type="button"
              className="spd__fab"
              aria-haspopup="menu"
              aria-expanded={actionsOpen}
              aria-label={actionsOpen ? t.actionsClose : t.actionsOpen}
              onClick={() => setActionsOpen((v) => !v)}
            >
              <span className="spd__fab-ico" aria-hidden="true">
                {actionsOpen ? Ic.x : Ic.share}
              </span>
            </button>
          </div>
        </>
      )}
    </>
  )
}
