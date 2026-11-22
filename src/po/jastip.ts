// src/po/jastip.ts
import type { ID } from '../types'
import type { POEvent, POMenu, POBuyer, JastipTrip } from './types'
import { buildAllocation, computePO, lineQty, shipmentsOf } from './calc'
import { currencyDecimals, formatMoney, roundMoney } from '../utils/format'

/**
 * Jastip (jasa titip): harga jual item = harga toko × kurs + fee + ongkos bagasi.
 * Fungsi murni — store memakai `priceJastipMenu` untuk menulis hasilnya ke
 * `buyPrice`/`sellPrice`, jadi tagihan, WA, rekap, dan ekspor tetap memakai mesin yang sama.
 */

export function isJastip(event: Pick<POEvent, 'kind'> | undefined): boolean {
  return event?.kind === 'jastip'
}

export const DEFAULT_TRIP: JastipTrip = {
  foreignCurrency: 'JPY',
  rate: 105,
  feeMode: 'fixed',
  feeValue: 25000,
  shippingPerKg: 150000,
}

const LIMITS = { rate: 1_000_000, money: 100_000_000, weight: 100_000 }

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Rapikan trip dari form / berkas impor (kurs, fee, ongkir selalu terhingga & tak negatif). */
export function sanitizeTrip(t: Partial<JastipTrip> | undefined): JastipTrip {
  const feeMode = t?.feeMode === 'percent' ? 'percent' : 'fixed'
  const fee = num(t?.feeValue)
  return {
    destination: typeof t?.destination === 'string' ? t.destination.trim().slice(0, 60) || undefined : undefined,
    foreignCurrency: (typeof t?.foreignCurrency === 'string' && t.foreignCurrency) || DEFAULT_TRIP.foreignCurrency,
    rate: Math.min(LIMITS.rate, num(t?.rate)),
    feeMode,
    feeValue: feeMode === 'percent' ? Math.min(1, fee) : Math.min(LIMITS.money, fee),
    shippingPerKg: Math.min(LIMITS.money, num(t?.shippingPerKg)) || undefined,
    departDate: t?.departDate || undefined,
    returnDate: t?.returnDate || undefined,
  }
}

export interface JastipUnitPrice {
  cost: number // harga barang dalam mata uang PO (modal)
  fee: number
  shipping: number
  sell: number // dibulatkan ke atas agar "enak" dibayar
}

/** Bulatkan harga jual ke atas: IDR → kelipatan Rp100, mata uang lain → satuan terkecil. */
function roundUpPrice(n: number, currency: string): number {
  if (currency === 'IDR') return Math.ceil(n / 100) * 100
  const f = Math.pow(10, currencyDecimals(currency))
  return Math.ceil(Math.round(n * f * 1000) / 1000) / f
}

export function jastipUnitPrice(
  menu: Pick<POMenu, 'foreignPrice' | 'weightGrams'>,
  trip: JastipTrip,
  currency: string,
): JastipUnitPrice {
  const cost = roundMoney(num(menu.foreignPrice) * num(trip.rate), currency)
  const fee = roundMoney(trip.feeMode === 'percent' ? cost * num(trip.feeValue) : num(trip.feeValue), currency)
  const shipping = roundMoney((num(menu.weightGrams) / 1000) * num(trip.shippingPerKg), currency)
  return { cost, fee, shipping, sell: roundUpPrice(cost + fee + shipping, currency) }
}

/** Tulis ulang buyPrice/sellPrice satu menu dari pengaturan trip (no-op bila bukan jastip). */
export function priceJastipMenu(menu: POMenu, event: POEvent): POMenu {
  if (!isJastip(event) || !event.jastip) return menu
  const p = jastipUnitPrice(menu, event.jastip, event.currency)
  return {
    ...menu,
    foreignPrice: Math.min(LIMITS.money, num(menu.foreignPrice)),
    weightGrams: Math.min(LIMITS.weight, num(menu.weightGrams)) || undefined,
    buyPrice: p.cost,
    sellPrice: p.sell,
    costBasis: 'perUnit',
    costValue: undefined,
    donated: undefined,
  }
}

// --- Daftar belanja hari-H ---------------------------------------------------

export interface ShoppingItem {
  menu: POMenu
  qty: number // total unit yang dipesan
  foreignSubtotal: number
}

export interface ShoppingGroup {
  shop: string
  items: ShoppingItem[]
}

export const NO_SHOP = '—'

/** Item yang dipesan, dikelompokkan per toko; item tanpa pesanan tetap tampil (qty 0). */
export function buildShoppingList(event: POEvent): ShoppingGroup[] {
  const qtyByMenu = new Map<ID, number>()
  for (const b of event.buyers) {
    for (const l of b.lines) qtyByMenu.set(l.menuId, (qtyByMenu.get(l.menuId) ?? 0) + lineQty(l.qty))
  }
  const groups = new Map<string, ShoppingItem[]>()
  for (const menu of event.menus) {
    const shop = menu.shop?.trim() || NO_SHOP
    const qty = qtyByMenu.get(menu.id) ?? 0
    const item = { menu, qty, foreignSubtotal: num(menu.foreignPrice) * qty }
    groups.set(shop, [...(groups.get(shop) ?? []), item])
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === NO_SHOP ? 1 : b === NO_SHOP ? -1 : a.localeCompare(b)))
    .map(([shop, items]) => ({ shop, items }))
}

export interface ShoppingProgress {
  totalQty: number
  bought: number // unit terbeli ('bought' penuh + jumlah terbeli dari 'partial')
  soldOut: number // unit tak terbeli ('sold-out' + kekurangan dari 'partial')
  pending: number
  /** Total belanja (mata uang asing) dari item yang sudah dibeli — utk cek batas bea cukai. */
  foreignSpent: number
  foreignPlanned: number
}

export function shoppingProgress(event: POEvent): ShoppingProgress {
  const p: ShoppingProgress = { totalQty: 0, bought: 0, soldOut: 0, pending: 0, foreignSpent: 0, foreignPlanned: 0 }
  for (const g of buildShoppingList(event)) {
    for (const it of g.items) {
      if (it.qty === 0) continue
      p.totalQty += it.qty
      const s = it.menu.shopStatus ?? 'pending'
      if (s === 'sold-out') p.soldOut += it.qty
      else if (s === 'partial') {
        const got = Math.min(it.qty, partialBought(it.menu))
        const foreign = num(it.menu.foreignPrice) * got
        p.bought += got
        p.soldOut += it.qty - got
        p.foreignSpent += foreign
        p.foreignPlanned += foreign
      } else {
        p.foreignPlanned += it.foreignSubtotal
        if (s === 'bought') {
          p.bought += it.qty
          p.foreignSpent += it.foreignSubtotal
        } else p.pending += it.qty
      }
    }
  }
  return p
}

/** Unit terbeli utk item 'partial' (tak terhingga/negatif → 0). */
export function partialBought(menu: POMenu): number {
  return Math.max(0, Math.round(num(menu.boughtQty)))
}

// --- Item habis / kurang → refund --------------------------------------------

export interface ShortItem {
  menu: POMenu
  ordered: number
  shipped: number // 0 = habis seluruhnya
}

export interface JastipRefund {
  buyer: POBuyer
  /** Item yang tak terkirim penuh (habis atau hanya kebagian sebagian). */
  shortItems: ShortItem[]
  refund: number // uang yang sudah dibayar melebihi tagihan baru
}

/** Pembeli yang kena item habis/kurang, beserta refund (lebih bayar setelah dipotong). */
export function jastipRefunds(event: POEvent): JastipRefund[] {
  const menus = new Map(event.menus.map((m) => [m.id, m]))
  const alloc = buildAllocation(event)
  const calc = new Map(computePO(event).buyers.map((c) => [c.buyerId, c]))
  const out: JastipRefund[] = []
  for (const buyer of event.buyers) {
    const shortItems: ShortItem[] = []
    for (const [menuId, sh] of shipmentsOf(buyer, menus, alloc)) {
      if (sh.shipped < sh.ordered) shortItems.push({ menu: menus.get(menuId)!, ...sh })
    }
    const refund = calc.get(buyer.id)?.lebihBayar ?? 0
    if (shortItems.length || refund > 0) out.push({ buyer, shortItems, refund })
  }
  return out
}

/** Pesan WA ke pembeli: item habis + tagihan baru / refund. */
export function buildSoldOutNotice(event: POEvent, r: JastipRefund): string {
  const fm = (n: number) => formatMoney(n, event.currency)
  const c = computePO(event).buyers.find((x) => x.buyerId === r.buyer.id)
  const L: string[] = []
  L.push(`Halo ${r.buyer.name} 🙏`)
  L.push(`Update jastip *${event.emoji} ${event.name}*${event.jastip?.destination ? ` (${event.jastip.destination})` : ''}:`)
  if (r.shortItems.length) {
    L.push('')
    L.push('Mohon maaf, stok di toko tidak mencukupi:')
    for (const it of r.shortItems) {
      if (it.shipped === 0) L.push(`• ${it.ordered}× ${it.menu.name} — habis`)
      else L.push(`• ${it.menu.name} — dapat ${it.shipped} dari ${it.ordered}`)
    }
  }
  L.push('')
  if (c) L.push(`Tagihan terbaru: *${fm(c.bill)}*`)
  if (r.refund > 0) L.push(`Uang kakak akan kami kembalikan *${fm(r.refund)}* 🙏`)
  else if (c && c.kurangBayar > 0) L.push(`Sisa yang perlu dibayar: *${fm(c.kurangBayar)}*`)
  L.push('')
  L.push('_via Chip!n Order 🧡_')
  return L.join('\n')
}
