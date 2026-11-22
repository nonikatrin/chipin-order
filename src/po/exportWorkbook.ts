/**
 * Ekspor satu PO ke .xlsx dengan susunan yang sama seperti berkas kerja komunitas
 * ("Pemesanan Makanan - <tanggal>.xlsx"), supaya hasilnya langsung terasa familiar:
 *
 *   Daftar Makanan & Harga · Daftar Pesanan · Status Pembayaran ·
 *   Pivot Pesanan · Pembayaran ke Pemasak
 *
 * Bedanya dengan berkas manual: seluruh angka DIHITUNG dari data yang sama dengan layar
 * Rekap (computePO), jadi tak ada lagi #N/A saat daftar menu berubah tapi daftar pesanan
 * belum — persoalan yang membuat berkas Juli 2026 kehilangan Total Revenue & Total Profit.
 */
import type { POEvent } from './types'
import { computePO, costPerUnit, shippedQtyOf, shippedRows } from './calc'
import { NO_VENDOR_LABEL } from './whatsapp'
import { vendorKey, findVendorPayout } from './store'
import type { Row, Sheet } from '../utils/xlsx'

type Lang = 'id' | 'en'

const L = {
  id: {
    menus: 'Daftar Makanan & Harga',
    orders: 'Daftar Pesanan',
    payments: 'Status Pembayaran',
    pivot: 'Pivot Pesanan',
    payout: 'Pembayaran ke Pemasak',
    summary: 'Ringkasan',
    mTitle: 'Daftar Makanan dan Harga',
    mName: 'Nama', mPrice: 'Harga', mForKas: 'Untuk Kas', mNotes: 'Notes',
    mCook: 'Pemasak', mQty: 'Jumlah Pesanan', mProfit: 'Keuntungan untuk Kas',
    mPay: 'Pembayaran untuk Pemasak', mQuota: 'Batas Porsi',
    oTitle: 'Pesanan Makanan',
    oName: 'Name', oItem: 'Pesanan', oQty: 'Jumlah Pesanan', oUnit: 'Harga per unit',
    oMargin: 'Untung per unit', oRev: 'Revenue', oProfit: 'Profit',
    totalOrders: 'Total Pesanan', totalRev: 'Total Revenue', totalProfit: 'Total Profit',
    pName: 'Nama', pBill: 'Tagihan', pPaid: 'Dibayar', pDiff: 'Selisih',
    pMethod: 'Metode', pStatus: 'Status Pembayaran', pFulfil: 'Penyerahan',
    stPaid: 'LUNAS', stPartial: 'SEBAGIAN', stUnpaid: 'BELUM',
    vName: 'Pemasak', vPorsi: 'Porsi', vOwed: 'Yang dibayarkan ke Pemasak',
    vStatus: 'Status', vBy: 'Dibayar oleh', vMethod: 'Metode',
    vPaid: 'SUDAH', vUnpaid: 'BELUM',
    deposit: 'Diserahkan ke Bendahara',
    total: 'Total', cash: 'Tunai / Donasi', item: 'Item', grand: 'TOTAL',
    generated: 'Dibuat dengan Chip!n Order',
    donated: 'Disumbang',
    po: 'PO', date: 'Tanggal Kirim', place: 'Tempat', organizer: 'Admin Pemesanan',
    bendahara: 'Bendahara', currency: 'Mata Uang', buyers: 'Jumlah Pemesan',
    porsi: 'Total Porsi', danaMasuk: 'Total Dana Masuk', over: 'Total Lebih Bayar', refund: 'Refund ke Pemesan (jastip)',
    short: 'Total Kurang Bayar', owed: 'Wajib Bayar Supplier', net: 'Untung Bersih Kas',
    donation: 'Donasi / Tunai',
  },
  en: {
    menus: 'Menu & Pricing',
    orders: 'Order List',
    payments: 'Payment Status',
    pivot: 'Order Pivot',
    payout: 'Supplier Payout',
    summary: 'Summary',
    mTitle: 'Menu and Pricing',
    mName: 'Name', mPrice: 'Price', mForKas: 'For Kas', mNotes: 'Notes',
    mCook: 'Supplier', mQty: 'Qty Ordered', mProfit: 'Profit for Kas',
    mPay: 'Payment to Supplier', mQuota: 'Portion Limit',
    oTitle: 'Food Orders',
    oName: 'Name', oItem: 'Item', oQty: 'Qty', oUnit: 'Unit Price',
    oMargin: 'Margin per unit', oRev: 'Revenue', oProfit: 'Profit',
    totalOrders: 'Total Portions', totalRev: 'Total Revenue', totalProfit: 'Total Profit',
    pName: 'Name', pBill: 'Bill', pPaid: 'Paid', pDiff: 'Difference',
    pMethod: 'Method', pStatus: 'Payment Status', pFulfil: 'Fulfillment',
    stPaid: 'PAID', stPartial: 'PARTIAL', stUnpaid: 'UNPAID',
    vName: 'Supplier', vPorsi: 'Portions', vOwed: 'Owed to Supplier',
    vStatus: 'Status', vBy: 'Paid by', vMethod: 'Method',
    vPaid: 'PAID', vUnpaid: 'NOT YET',
    deposit: 'Deposited to Treasurer',
    total: 'Total', cash: 'Cash / Donation', item: 'Item', grand: 'TOTAL',
    generated: 'Generated with Chip!n Order',
    donated: 'Donated',
    po: 'PO', date: 'Delivery Date', place: 'Place', organizer: 'Order Admin',
    bendahara: 'Treasurer', currency: 'Currency', buyers: 'Buyers',
    porsi: 'Total Portions', danaMasuk: 'Total Money In', over: 'Total Overpaid', refund: 'Refunds to Buyers (jastip)',
    short: 'Total Short', owed: 'Owed to Suppliers', net: 'Net Profit (Kas)',
    donation: 'Donation / Cash',
  },
} as const

/** Catatan model biaya, dalam bahasa yang dipakai berkas kerja aslinya. */
function costNote(menu: POEvent['menus'][number], lang: Lang): string {
  const t = L[lang]
  if (menu.costBasis === 'percent') {
    const supplier = Math.round((menu.costValue ?? 0) * 100)
    if (supplier === 0) return lang === 'id' ? 'Donasi' : 'Donated'
    return `${100 - supplier}-${supplier}` // porsi kas - porsi supplier, spt "50-50"
  }
  if (!menu.buyPrice) return lang === 'id' ? 'Donasi' : 'Donated'
  return (lang === 'id' ? 'Modal ' : 'Cost ') + menu.buyPrice
  void t
}

/**
 * `orgName` = penyelenggara PO (mis. "Paguyuban") — pihak yang menyimpan margin, BUKAN supplier
 * dan bukan tempat. Judul kolom mengikuti nama itu ("Untuk Paguyuban") persis seperti sheet
 * milik pengguna; kosong → jatuh ke kata generik "Kas".
 */
export function buildEventWorkbook(event: POEvent, lang: Lang = 'id', orgName?: string): Sheet[] {
  const t = L[lang]
  const org = (orgName || '').trim() || (lang === 'id' ? 'Kas' : 'Kas')
  const forOrg = lang === 'id' ? `Untuk ${org}` : `For ${org}`
  const profitOrg = lang === 'id' ? `Keuntungan untuk ${org}` : `Profit for ${org}`
  const d = computePO(event)
  const menuById = new Map(event.menus.map((m) => [m.id, m]))
  const calcById = new Map(d.buyers.map((b) => [b.buyerId, b]))
  const recapById = new Map(d.menus.map((r) => [r.menuId, r]))

  // ---- 1. Daftar Makanan & Harga -------------------------------------------
  const menuRows: Row[] = [
    [{ v: `${event.emoji} ${event.name} — ${t.mTitle}`, s: 'title' }],
    [],
    [
      { v: t.mName, s: 'head' }, { v: t.mPrice, s: 'head' }, { v: forOrg, s: 'head' },
      { v: t.mNotes, s: 'head' }, { v: t.mCook, s: 'head' }, { v: t.mQuota, s: 'head' },
      { v: t.mQty, s: 'head' }, { v: profitOrg, s: 'head' }, { v: t.mPay, s: 'head' },
    ],
  ]
  for (const m of event.menus) {
    const r = recapById.get(m.id)
    const cpu = costPerUnit(m)
    menuRows.push([
      m.name,
      { v: m.sellPrice, s: 'money' },
      { v: m.sellPrice - cpu, s: 'money' },
      costNote(m, lang),
      m.vendor ?? NO_VENDOR_LABEL,
      m.maxQuota ?? '',
      r?.qtyTotal ?? 0,
      { v: (r?.revenue ?? 0) - (r?.cost ?? 0), s: 'money' },
      { v: r?.cost ?? 0, s: 'money' },
    ])
  }
  menuRows.push([
    { v: t.grand, s: 'bold' }, '', '', '', '', '',
    { v: d.totalPorsi, s: 'bold' },
    { v: d.menus.reduce((s, r) => s + r.revenue - r.cost, 0), s: 'moneyBold' },
    { v: d.wajibBayarPemasak, s: 'moneyBold' },
  ])

  // ---- 2. Daftar Pesanan (satu baris per pemesan × item) --------------------
  const orderRows: Row[] = [
    [{ v: `${t.oTitle} — ${event.name}`, s: 'title' }],
    [],
    [
      '', '', { v: t.totalOrders, s: 'bold' }, '', '',
      { v: t.totalRev, s: 'bold' }, { v: t.totalProfit, s: 'bold' },
    ],
    [
      '', '', { v: d.totalPorsi, s: 'bold' }, '', '',
      { v: d.revenue, s: 'moneyBold' }, { v: d.untungBersih, s: 'moneyBold' },
    ],
    [
      { v: t.oName, s: 'head' }, { v: t.oItem, s: 'head' }, { v: t.oQty, s: 'head' },
      { v: t.oUnit, s: 'head' }, { v: t.oMargin, s: 'head' },
      { v: t.oRev, s: 'head' }, { v: t.oProfit, s: 'head' },
    ],
  ]
  // Qty DITERIMA (bukan dipesan): item jastip habis/sebagian ikut terpotong, sama seperti rekap.
  const rowsByBuyer = new Map<string, ReturnType<typeof shippedRows>>()
  for (const r of shippedRows(event)) rowsByBuyer.set(r.buyer.id, [...(rowsByBuyer.get(r.buyer.id) ?? []), r])
  for (const b of event.buyers) {
    for (const { menu: m, qty: q } of rowsByBuyer.get(b.id) ?? []) {
      const cpu = costPerUnit(m)
      orderRows.push([
        b.name, m.name, q,
        { v: m.sellPrice, s: 'money' },
        { v: m.sellPrice - cpu, s: 'money' },
        { v: m.sellPrice * q, s: 'money' },
        { v: (m.sellPrice - cpu) * q, s: 'money' },
      ])
    }
    // Donasi/tunai tanpa item — di berkas manual ditulis sebagai baris "Cash".
    const don = Math.max(0, b.donation ?? 0)
    if (don > 0) {
      orderRows.push([
        b.name, t.cash, 0, '', '',
        { v: don, s: 'money' }, { v: don, s: 'money' },
      ])
    }
  }

  // ---- 3. Status Pembayaran ------------------------------------------------
  const payRows: Row[] = [
    [{ v: `${t.payments} — ${event.name}`, s: 'title' }],
    [],
    [
      { v: t.pName, s: 'head' }, { v: t.pBill, s: 'head' }, { v: t.pPaid, s: 'head' },
      { v: t.pDiff, s: 'head' }, { v: t.pMethod, s: 'head' },
      { v: t.pStatus, s: 'head' }, { v: t.pFulfil, s: 'head' },
    ],
  ]
  for (const b of event.buyers) {
    const c = calcById.get(b.id)
    if (!c) continue
    const status = c.kurangBayar <= 0 ? t.stPaid : c.paid > 0 ? t.stPartial : t.stUnpaid
    payRows.push([
      b.name,
      { v: c.bill, s: 'money' },
      { v: c.paid, s: 'money' },
      { v: c.lebihBayar > 0 ? c.lebihBayar : -c.kurangBayar, s: 'money' },
      b.paymentMethod ?? '',
      status,
      b.fulfillmentStatus ?? b.fulfillment ?? '',
    ])
  }
  payRows.push([
    { v: t.grand, s: 'bold' },
    { v: d.revenue, s: 'moneyBold' },
    { v: d.revenue + d.totalLebihBayar - d.totalKurangBayar, s: 'moneyBold' },
    { v: d.totalLebihBayar - d.totalKurangBayar, s: 'moneyBold' },
  ])

  // ---- 4. Pivot Pesanan (pemesan × item) -----------------------------------
  const activeMenus = event.menus.filter((m) => (recapById.get(m.id)?.qtyTotal ?? 0) > 0)
  const pivotRows: Row[] = [
    [{ v: `${t.pivot} — ${event.name}`, s: 'title' }],
    [],
    [
      { v: t.oName, s: 'head' },
      ...activeMenus.map((m) => ({ v: m.name, s: 'head' as const })),
      { v: t.porsi, s: 'head' as const },
      { v: t.oRev, s: 'head' as const },
    ],
  ]
  const shipped = shippedQtyOf(event)
  for (const b of event.buyers) {
    const c = calcById.get(b.id)
    const per = new Map<string, number>()
    for (const m of event.menus) {
      const q = shipped(b, m.id)
      if (q > 0) per.set(m.id, q)
    }
    if (!per.size && !(b.donation ?? 0)) continue
    pivotRows.push([
      b.name,
      ...activeMenus.map((m) => per.get(m.id) || ''),
      c?.qtyTotal ?? 0,
      { v: c?.bill ?? 0, s: 'money' },
    ])
  }
  pivotRows.push([
    { v: t.grand, s: 'bold' },
    ...activeMenus.map((m) => ({ v: recapById.get(m.id)?.qtyTotal ?? 0, s: 'bold' as const })),
    { v: d.totalPorsi, s: 'bold' as const },
    { v: d.revenue, s: 'moneyBold' as const },
  ])

  // ---- 5. Pembayaran ke Pemasak --------------------------------------------
  const groups = new Map<string, { name: string; porsi: number; owed: number }>()
  for (const r of d.menus) {
    if (r.qtyTotal <= 0) continue
    const m = menuById.get(r.menuId)
    const name = (m?.vendor && m.vendor.trim()) || NO_VENDOR_LABEL
    const k = vendorKey(name)
    const g = groups.get(k) ?? { name, porsi: 0, owed: 0 }
    g.porsi += r.qtyTotal
    g.owed += r.cost
    groups.set(k, g)
  }
  const payoutRows: Row[] = [
    [{ v: `${t.payout} — ${event.name}`, s: 'title' }],
    [],
    [
      { v: t.vName, s: 'head' }, { v: t.vPorsi, s: 'head' }, { v: t.vOwed, s: 'head' },
      { v: t.vStatus, s: 'head' }, { v: t.vBy, s: 'head' }, { v: t.vMethod, s: 'head' },
    ],
  ]
  for (const g of groups.values()) {
    const p = findVendorPayout(event, g.name)
    // Pemasak yang menyumbang tak punya tagihan — jangan ditulis "0 / BELUM"
    // seolah setoran tertunggak.
    const donatedOnly = g.owed <= 0
    payoutRows.push([
      g.name, g.porsi,
      donatedOnly ? { v: t.donated, s: 'muted' } : { v: g.owed, s: 'money' },
      donatedOnly ? '—' : p?.paid ? t.vPaid : t.vUnpaid,
      p?.paidBy ?? '',
      p?.method ?? '',
    ])
  }
  payoutRows.push([
    { v: t.grand, s: 'bold' },
    { v: d.totalPorsi, s: 'bold' },
    { v: d.wajibBayarPemasak, s: 'moneyBold' },
  ])
  payoutRows.push([])
  payoutRows.push([
    { v: t.deposit, s: 'bold' },
    '',
    { v: event.settlement?.status === 'deposited' ? d.untungBersih : 0, s: 'moneyBold' },
    event.settlement?.status === 'deposited' ? t.vPaid : t.vUnpaid,
    event.settlement?.depositedDate ?? '',
  ])

  // ---- 6. Ringkasan --------------------------------------------------------
  const sumRows: Row[] = [
    [{ v: `${event.emoji} ${event.name}`, s: 'title' }],
    [],
    [{ v: t.date, s: 'bold' }, event.deliveryDate ?? ''],
    [{ v: t.place, s: 'bold' }, event.place ?? ''],
    [{ v: t.organizer, s: 'bold' }, event.organizerName ?? ''],
    [{ v: t.bendahara, s: 'bold' }, event.bendaharaName ?? ''],
    [{ v: t.currency, s: 'bold' }, event.currency],
    [],
    [{ v: t.buyers, s: 'bold' }, event.buyers.length],
    [{ v: t.porsi, s: 'bold' }, d.totalPorsi],
    [{ v: t.totalRev, s: 'bold' }, { v: d.revenue, s: 'money' }],
    [{ v: t.donation, s: 'bold' }, { v: d.totalDonation, s: 'money' }],
    [{ v: t.over, s: 'bold' }, { v: d.totalLebihBayar, s: 'money' }],
    ...(d.totalRefund > 0 ? [[{ v: t.refund, s: 'bold' }, { v: d.totalRefund, s: 'money' }] as Row] : []),
    [{ v: t.short, s: 'bold' }, { v: d.totalKurangBayar, s: 'money' }],
    [{ v: t.danaMasuk, s: 'bold' }, { v: d.danaMasuk, s: 'money' }],
    [{ v: t.owed, s: 'bold' }, { v: d.wajibBayarPemasak, s: 'money' }],
    [{ v: t.net, s: 'bold' }, { v: d.untungBersih, s: 'moneyBold' }],
    [],
    [{ v: t.generated + ' · ' + new Date().toISOString().slice(0, 10), s: 'muted' }],
  ]

  return [
    { name: t.summary, rows: sumRows, cols: [26, 18] },
    { name: t.menus, rows: menuRows, cols: [30, 10, 12, 16, 18, 12, 14, 18, 20] },
    { name: t.orders, rows: orderRows, cols: [26, 26, 10, 14, 15, 12, 12] },
    { name: t.payments, rows: payRows, cols: [26, 12, 12, 12, 12, 16, 14] },
    { name: t.pivot, rows: pivotRows, cols: [26, ...activeMenus.map(() => 14), 12, 12] },
    { name: t.payout, rows: payoutRows, cols: [24, 10, 24, 12, 16, 12] },
  ]
}

/** Nama berkas mengikuti kebiasaan berkas kerja: "<PO> - <tanggal>.xlsx". */
export function workbookFilename(event: POEvent): string {
  const date = event.deliveryDate || new Date(event.createdAt).toISOString().slice(0, 10)
  const safe = event.name.replace(/[^\w\s-]/g, '').trim() || 'PO'
  return `${safe} - ${date}.xlsx`
}
