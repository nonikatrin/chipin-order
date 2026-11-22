// src/po/calc.ts
import type { ID } from '../types'
import type { POEvent, POBuyer, POMenu, POLine } from './types'

/**
 * Mesin kalkulasi PO Bersama — fungsi murni (mirip src/utils/balances.ts).
 * Semua nilai turunan (lebih bayar, untung) dihitung di sini, tidak disimpan.
 */

export interface POBuyerCalc {
  buyerId: ID
  qtyTotal: number
  bill: number // total tagihan = Σ hargaJual·qty + donasi + ongkir
  cost: number // wajib bayar pemasak utk pesanan ini = Σ hargaBeli·qty
  deliveryFee: number // ongkir yang ditagih ke pembeli (pemasukan)
  courierCost: number // biaya kurir yang dibayar penjual (pengeluaran)
  grossMargin: number // bill - cost
  paid: number
  lebihBayar: number // max(0, paid - bill)
  kurangBayar: number // max(0, bill - paid)
  rowProfit: number // (hargaJual - hargaBeli)·qty + ongkir - kurir + lebihBayar  ← rumus baku
  /** Jastip: lebih bayar = uang yang harus dikembalikan (bukan untung). 0 utk PO biasa. */
  refund: number
}

export interface POMenuRecap {
  menuId: ID
  qtyTotal: number // porsi yang harus dimasak
  cost: number // setoran ke pemasak utk menu ini
  revenue: number
}

export interface POTotals {
  revenue: number // Revenue Komoditas (Σ tagihan)
  totalLebihBayar: number
  totalKurangBayar: number
  danaMasuk: number // Total Dana Masuk Warga = revenue + totalLebihBayar
  wajibBayarPemasak: number // Σ cost
  totalDeliveryFee: number // Σ ongkir yang ditagih (pemasukan)
  totalCourierCost: number // Σ biaya kurir yang dibayar penjual (pengeluaran)
  untungBersih: number // Untung Bersih = revenue - cost - kurir + lebihBayar (jastip: tanpa lebihBayar)
  totalRefund: number // jastip: Σ refund ke pembeli (item habis / bayar lebih)
  totalPorsi: number
  totalDonation: number // total donasi/tip tunai langsung
  buyers: POBuyerCalc[]
  menus: POMenuRecap[]
}

/**
 * Qty baku satu baris pesanan — SATU definisi dipakai semua tampilan & laporan.
 * Dulu calc membulatkan tapi pivot/laporan WA/tabel memakai `line.qty` mentah, sehingga
 * rincian per-pemesan tak menjumlah ke total porsi yang dikirim ke supplier (mis. header
 * "7 porsi" tapi rinciannya 1 + 2.5), dan qty berupa teks "3" tercetak jadi "03".
 */
export function lineQty(qty: unknown): number {
  const n = typeof qty === 'number' ? qty : Number(qty)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.round(n)
}

/**
 * Angka uang yang selalu terhingga. `Math.max(0, NaN)` = NaN dan 1e308 × qty = Infinity,
 * sehingga satu nilai rusak dari data impor/kode pesanan cukup untuk membuat SELURUH
 * rekap PO tampil "$NaN"/"$∞". Di sini nilai tak masuk akal jadi 0, bukan menular.
 */
function safeNum(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Daftar aman: sumber data (impor/localStorage) tak dijamin punya array. */
function list<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}

function menuMap(event: POEvent): Map<ID, POMenu> {
  const m = new Map<ID, POMenu>()
  for (const x of list<POMenu>(event.menus)) if (x && x.id) m.set(x.id, x)
  return m
}

/**
 * Biaya/modal per unit menu sesuai `costBasis`:
 * - 'percent' → fraksi × harga jual (mis. 0.5 → bagi hasil 50-50)
 * - 'perUnit' / default → `buyPrice` (termasuk "Modal $X" yang dihitung per-unit)
 */
export function costPerUnit(menu: POMenu): number {
  // Menu sumbangan: pemasak tak dibayar, apa pun basis biaya yang tersimpan.
  if (menu.donated) return 0
  if (menu.costBasis === 'percent') {
    return menu.sellPrice * (menu.costValue ?? 0)
  }
  return menu.buyPrice
}

/**
 * Item jastip yang habis di toko tak bisa dikirim → baris pesanannya tak ditagih.
 * Baris tetap disimpan (riwayat + pesan "maaf habis"), hanya tak dihitung.
 */
export function isSoldOut(menu: POMenu | undefined): boolean {
  return menu?.shopStatus === 'sold-out'
}

/**
 * Jatah unit per (pemesan, menu) untuk item jastip yang hanya terbeli sebagian.
 * Hanya berisi pasangan yang DIPOTONG; pasangan lain dapat penuh.
 */
export type Allocation = Map<string, number>
export const allocKey = (buyerId: ID, menuId: ID) => `${buyerId}|${menuId}`

/** Urutan siapa-cepat-dia-dapat: pesanan tercatat paling awal dulu. */
export function buyersByOrderTime(buyers: POBuyer[]): POBuyer[] {
  // `addBuyer` menaruh pesanan baru di DEPAN array, jadi saat createdAt sama, indeks besar = lebih awal.
  return list<POBuyer>(buyers)
    .map((b, i) => ({ b, i }))
    .sort((x, y) => safeNum(x.b.createdAt) - safeNum(y.b.createdAt) || y.i - x.i)
    .map((x) => x.b)
}

/** Qty dipesan per menu utk satu pemesan (baris ganda menu yang sama dijumlah). */
function orderedByMenu(buyer: POBuyer): Map<ID, number> {
  const m = new Map<ID, number>()
  for (const line of list<POLine>(buyer.lines)) {
    const q = lineQty(line.qty)
    if (q > 0) m.set(line.menuId, (m.get(line.menuId) ?? 0) + q)
  }
  return m
}

/** Bagi unit item 'partial' ke pemesan paling awal; sisanya tak kebagian (→ refund). */
export function buildAllocation(event: Pick<POEvent, 'menus' | 'buyers'>): Allocation {
  const out: Allocation = new Map()
  const partial = list<POMenu>(event.menus).filter((m) => m && m.shopStatus === 'partial')
  if (!partial.length) return out
  const order = buyersByOrderTime(list<POBuyer>(event.buyers)).map((b) => ({ b, ordered: orderedByMenu(b) }))
  for (const menu of partial) {
    let left = Math.max(0, Math.round(safeNum(menu.boughtQty)))
    for (const { b, ordered } of order) {
      const q = ordered.get(menu.id) ?? 0
      if (!q) continue
      const give = Math.min(q, left)
      left -= give
      if (give < q) out.set(allocKey(b.id, menu.id), give)
    }
  }
  return out
}

export interface MenuShipment {
  ordered: number
  shipped: number // yang benar-benar dikirim & ditagih
}

/** Per menu: dipesan vs dikirim (habis → 0, sebagian → jatah FIFO). */
export function shipmentsOf(
  buyer: POBuyer,
  menus: Map<ID, POMenu>,
  alloc?: Allocation,
): Map<ID, MenuShipment> {
  const out = new Map<ID, MenuShipment>()
  for (const [menuId, ordered] of orderedByMenu(buyer)) {
    const menu = menus.get(menuId)
    if (!menu) continue
    const shipped = isSoldOut(menu) ? 0 : (alloc?.get(allocKey(buyer.id, menuId)) ?? ordered)
    out.set(menuId, { ordered, shipped })
  }
  return out
}

/**
 * Qty yang benar-benar diterima tiap pemesan per menu (item jastip habis → 0, sebagian →
 * jatah FIFO). Dipakai tabel/pivot/ekspor agar rincian per pemesan menjumlah ke total rekap.
 */
export function shippedQtyOf(event: Pick<POEvent, 'menus' | 'buyers'>): (buyer: POBuyer, menuId: ID) => number {
  const menus = menuMap(event as POEvent)
  const alloc = buildAllocation(event)
  const cache = new Map<ID, Map<ID, MenuShipment>>()
  return (buyer, menuId) => {
    let s = cache.get(buyer.id)
    if (!s) cache.set(buyer.id, (s = shipmentsOf(buyer, menus, alloc)))
    return s.get(menuId)?.shipped ?? 0
  }
}

/** Baris (pemesan, menu, qty diterima) — satu per menu per pemesan, qty 0 dibuang. */
export function shippedRows(event: Pick<POEvent, 'menus' | 'buyers'>): { buyer: POBuyer; menu: POMenu; qty: number }[] {
  const menus = menuMap(event as POEvent)
  const alloc = buildAllocation(event)
  const out: { buyer: POBuyer; menu: POMenu; qty: number }[] = []
  for (const buyer of list<POBuyer>(event.buyers)) {
    for (const [menuId, s] of shipmentsOf(buyer, menus, alloc)) {
      if (s.shipped > 0) out.push({ buyer, menu: menus.get(menuId)!, qty: s.shipped })
    }
  }
  return out
}

export interface ComputeOptions {
  /** Jastip: lebih bayar dikembalikan ke pembeli, bukan dihitung sebagai untung/donasi. */
  refundOverpay?: boolean
  /** Jastip: jatah item yang hanya terbeli sebagian (lihat `buildAllocation`). */
  alloc?: Allocation
}

/** Hitung angka satu pembeli (tagihan, lebih/kurang bayar, untung baris). */
export function computeBuyer(
  buyer: POBuyer,
  menus: Map<ID, POMenu>,
  opts: ComputeOptions = {},
): POBuyerCalc {
  let qtyTotal = 0
  let bill = 0
  let cost = 0
  for (const [menuId, { shipped: qty }] of shipmentsOf(buyer, menus, opts.alloc)) {
    const menu = menus.get(menuId)!
    qtyTotal += qty
    bill += safeNum(menu.sellPrice) * qty
    cost += safeNum(costPerUnit(menu)) * qty
  }
  // Donasi/tip tunai langsung: tambah ke tagihan & dianggap sudah diterima (untung penuh).
  const donation = Math.max(0, safeNum(buyer.donation))
  // Ongkir (pemasukan) + biaya kurir (pengeluaran) — hanya utk pesanan antar. Pembeli MEMBAYAR
  // ongkir (masuk tagihan, tidak auto-lunas seperti donasi); kurir mengurangi untung. Jika kurir
  // kosong (antar sendiri) → ongkir jadi untung; jika ongkir = kurir → titip kurir, untung netral.
  const isDelivery = buyer.fulfillment === 'delivery'
  const deliveryFee = isDelivery ? Math.max(0, safeNum(buyer.deliveryFee)) : 0
  const courierCost = isDelivery ? Math.max(0, safeNum(buyer.courierCost)) : 0
  bill += donation + deliveryFee
  const grossMargin = bill - cost
  const paid = Math.max(0, safeNum(buyer.paid)) + donation
  const lebihBayar = Math.max(0, paid - bill)
  const kurangBayar = Math.max(0, bill - paid)
  return {
    buyerId: buyer.id,
    qtyTotal,
    bill,
    cost,
    deliveryFee,
    courierCost,
    grossMargin,
    paid,
    lebihBayar,
    kurangBayar,
    rowProfit: grossMargin - courierCost + (opts.refundOverpay ? 0 : lebihBayar),
    refund: opts.refundOverpay ? lebihBayar : 0,
  }
}

/** Hitung seluruh ringkasan PO: per pembeli, per menu, dan total acara. */
export function computePO(event: POEvent): POTotals {
  const menus = menuMap(event)
  const evBuyers = list<POBuyer>(event.buyers)
  const evMenus = list<POMenu>(event.menus)
  const opts: ComputeOptions = { refundOverpay: event.kind === 'jastip', alloc: buildAllocation(event) }
  const buyers = evBuyers.map((b) => computeBuyer(b, menus, opts))

  // rekap porsi & uang per menu (utk finalisasi ke pemasak)
  const recap = new Map<ID, POMenuRecap>()
  for (const menu of evMenus) {
    recap.set(menu.id, { menuId: menu.id, qtyTotal: 0, cost: 0, revenue: 0 })
  }
  for (const b of evBuyers) {
    for (const [menuId, { shipped: qty }] of shipmentsOf(b, menus, opts.alloc)) {
      const r = recap.get(menuId)
      const menu = menus.get(menuId)
      if (!r || !menu) continue
      r.qtyTotal += qty
      r.cost += safeNum(costPerUnit(menu)) * qty
      r.revenue += safeNum(menu.sellPrice) * qty
    }
  }

  let revenue = 0
  let totalLebihBayar = 0
  let totalKurangBayar = 0
  let wajibBayarPemasak = 0
  let totalDeliveryFee = 0
  let totalCourierCost = 0
  let totalPorsi = 0
  let totalRefund = 0
  for (const c of buyers) {
    totalRefund += c.refund
    revenue += c.bill
    totalLebihBayar += c.lebihBayar
    totalKurangBayar += c.kurangBayar
    wajibBayarPemasak += c.cost
    totalDeliveryFee += c.deliveryFee
    totalCourierCost += c.courierCost
    totalPorsi += c.qtyTotal
  }

  const totalDonation = evBuyers.reduce((s, b) => s + Math.max(0, safeNum(b.donation)), 0)

  return {
    revenue,
    totalLebihBayar,
    totalKurangBayar,
    danaMasuk: revenue + totalLebihBayar,
    wajibBayarPemasak,
    totalDeliveryFee,
    totalCourierCost,
    untungBersih: revenue - wajibBayarPemasak - totalCourierCost + totalLebihBayar - totalRefund,
    totalRefund,
    totalPorsi,
    totalDonation,
    buyers,
    menus: evMenus.map((m) => recap.get(m.id)!),
  }
}

// =========================================================================
// 🔌 Bridges for UI files (POEventPage & POFinalizePage)
// =========================================================================

export function computePOEventTotals(orders: any[], menus: POMenu[]) {
  const mockEvent = { buyers: orders, menus } as unknown as POEvent
  const res = computePO(mockEvent)
  return {
    totalRevenue: res.revenue,
    totalCost: res.wajibBayarPemasak,
    totalLebihBayar: res.totalLebihBayar,
    netProfit: res.untungBersih
  }
}

export function computeBuyerBalances(orders: any[], menus: POMenu[]) {
  const mockEvent = { buyers: orders, menus } as unknown as POEvent
  const res = computePO(mockEvent)
  return res.buyers.map((b, idx) => ({
    name: orders[idx]?.name || `Citizen #${idx + 1}`,
    totalBill: b.bill,
    paid: b.paid,
    status: b.lebihBayar > 0 ? b.lebihBayar : -b.kurangBayar
  }))
}