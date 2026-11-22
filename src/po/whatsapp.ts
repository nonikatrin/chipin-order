import type { POEvent, POBuyer } from './types'
import { computePO, computeBuyer, buildAllocation, shipmentsOf, shippedQtyOf } from './calc'
import { formatMoney } from '../utils/format'

/** Ubah nomor lokal jadi format wa.me (asumsi Indonesia: 08… → 628…). */
function waNumber(phone?: string): string | null {
  if (!phone) return null
  let p = phone.replace(/\D/g, '')
  if (!p) return null
  if (p.startsWith('0')) p = '62' + p.slice(1)
  else if (!p.startsWith('62') && !p.startsWith('1')) p = '62' + p
  return p
}

/**
 * Label satu-satunya untuk menu tanpa supplier. HARUS sama dengan grup di POFinalizePage,
 * karena `vendorPayouts` di-key berdasarkan label ini — dulu UI menulis "Supplier" tapi
 * laporan membaca "Vendor", jadi status "sudah dibayar" tak pernah terbaca di laporan.
 */
export const NO_VENDOR_LABEL = 'Supplier'

function menuMapOf(event: POEvent) {
  return new Map(event.menus.map((m) => [m.id, m]))
}

/** Pesan penagihan personal (nudge) untuk satu pemesan. */
export function buildBuyerNudgeText(event: POEvent, buyer: POBuyer): string {
  const menus = menuMapOf(event)
  const jastip = event.kind === 'jastip'
  const alloc = buildAllocation(event)
  const c = computeBuyer(buyer, menus, { refundOverpay: jastip, alloc })
  const fm = (n: number) => formatMoney(n, event.currency)
  const L: string[] = []
  L.push(`Halo ${buyer.name} 🙏`)
  L.push(`Pesanan *${event.emoji} ${event.name}*:`)
  for (const [menuId, { ordered, shipped }] of shipmentsOf(buyer, menus, alloc)) {
    const m = menus.get(menuId)!
    if (shipped === 0) L.push(`• ~${ordered}× ${m.name}~ — habis`)
    else if (shipped < ordered)
      L.push(`• ${shipped}× ${m.name} — ${fm(m.sellPrice * shipped)} (dari ${ordered}, sisanya habis)`)
    else L.push(`• ${shipped}× ${m.name} — ${fm(m.sellPrice * shipped)}`)
  }
  L.push('')
  L.push(`Total tagihan: *${fm(c.bill)}*`)
  // Sama dgn payStateOf di POEventPage: bayar penuh = lunas walau belum dicentang manual.
  if (buyer.settled || (c.bill > 0 && c.paid >= c.bill)) {
    L.push('Status: ✅ Lunas — terima kasih!')
    if (c.refund > 0) L.push(`Kami kembalikan ${fm(c.refund)} 🙏`)
    else if (c.lebihBayar > 0) L.push(`Ada lebih bayar ${fm(c.lebihBayar)} 🙏`)
  } else if (c.paid > 0 && c.kurangBayar > 0) {
    L.push(`Sudah dibayar ${fm(c.paid)}, kurang *${fm(c.kurangBayar)}* ya 🙏`)
  } else {
    L.push('Status: 🔴 Belum bayar 🙏')
  }
  L.push('')
  L.push('_via Chip!n 💚_')
  return L.join('\n')
}

/** Daftar porsi & setoran untuk dikirim ke pemasak, dikelompokkan per vendor. */
export function buildCookOrderText(event: POEvent): string {
  const t = computePO(event)
  const fm = (n: number) => formatMoney(n, event.currency)
  const menuById = new Map(event.menus.map((m) => [m.id, m]))

  const groups = new Map<string, { porsi: number; cost: number; lines: string[] }>()
  for (const r of t.menus) {
    if (r.qtyTotal === 0) continue
    const m = menuById.get(r.menuId)
    if (!m) continue
    const vendor = (m.vendor && m.vendor.trim()) || NO_VENDOR_LABEL
    let g = groups.get(vendor)
    if (!g) {
      g = { porsi: 0, cost: 0, lines: [] }
      groups.set(vendor, g)
    }
    g.lines.push(`• ${m.name}: *${r.qtyTotal} porsi*`)
    g.porsi += r.qtyTotal
    g.cost += r.cost
  }

  const multi = groups.size > 1
  const L: string[] = []
  L.push(`*${event.emoji} ${event.name} — Pesanan untuk Supplier*`)
  if (event.deliveryDate || event.place) {
    const info: string[] = []
    if (event.deliveryDate) info.push(`📅 ${event.deliveryDate}`)
    if (event.place) info.push(`📍 ${event.place}`)
    L.push(info.join('   '))
  }
  for (const [vendor, g] of groups) {
    L.push('')
    if (multi) L.push(`👩‍🍳 *${vendor}*`)
    L.push(...g.lines)
    L.push(`Setoran: *${fm(g.cost)}* (${g.porsi} porsi)`)
  }
  L.push('')
  L.push(`Total: *${t.totalPorsi} porsi* · Setoran *${fm(t.wajibBayarPemasak)}*`)
  L.push('')
  L.push('_via Chip!n 💚_')
  return L.join('\n')
}

/**
 * Laporan rinci untuk SATU vendor/supplier: porsi per menu + rincian pemesan per menu
 * + setoran per menu dan totalnya. `fallbackLabel` harus sama dengan label grup di UI
 * untuk menu tanpa vendor (POFinalizePage memakai "Supplier").
 */
export function buildVendorReport(
  event: POEvent,
  vendorName: string,
  fallbackLabel = NO_VENDOR_LABEL,
): string {
  const t = computePO(event)
  const fm = (n: number) => formatMoney(n, event.currency)
  const menuById = menuMapOf(event)

  const L: string[] = []
  L.push(`*${event.emoji} ${event.name} — Rincian untuk ${vendorName}*`)
  if (event.deliveryDate || event.place) {
    const info: string[] = []
    if (event.deliveryDate) info.push(`📅 ${event.deliveryDate}`)
    if (event.place) info.push(`📍 ${event.place}`)
    L.push(info.join('   '))
  }

  let porsi = 0
  let cost = 0
  const shipped = shippedQtyOf(event)
  for (const r of t.menus) {
    if (r.qtyTotal === 0) continue
    const m = menuById.get(r.menuId)
    if (!m) continue
    const vendor = (m.vendor && m.vendor.trim()) || fallbackLabel
    if (vendor !== vendorName) continue
    L.push('')
    L.push(`*${m.name}* — ${r.qtyTotal} porsi · setoran ${fm(r.cost)}`)
    for (const b of event.buyers) {
      const qty = shipped(b, r.menuId)
      if (qty > 0) L.push(`   • ${b.name}: ${qty}`)
    }
    porsi += r.qtyTotal
    cost += r.cost
  }

  L.push('')
  L.push(`Total: *${porsi} porsi* · Setoran *${fm(cost)}*`)
  const payout = event.vendorPayouts?.[vendorName]
  if (payout?.paid) {
    const method =
      payout.method === 'cash' ? ' · Tunai' : payout.method === 'transfer' ? ' · Transfer' : ''
    L.push(
      `✅ Sudah dibayar${payout.paidBy ? ` oleh ${payout.paidBy}` : ''}${payout.paidDate ? ` (${payout.paidDate})` : ''}${method}`,
    )
  }
  L.push('')
  L.push('_via Chip!n 💚_')
  return L.join('\n')
}

/**
 * Laporan ringkas ("bukti keterbukaan") untuk dibagikan ke komunitas:
 * pemasukan, untung untuk kas, setoran per vendor, dan status setoran ke bendahara.
 */
export function buildRecapReport(event: POEvent): string {
  const t = computePO(event)
  const fm = (n: number) => formatMoney(n, event.currency)
  const menuById = new Map(event.menus.map((m) => [m.id, m]))

  // agregasi per vendor: pendapatan, untung, setoran (owed = revenue - profit = cost)
  const groups = new Map<string, { revenue: number; owed: number; qty: number }>()
  for (const r of t.menus) {
    if (r.qtyTotal === 0) continue
    const m = menuById.get(r.menuId)
    const vendor = (m?.vendor && m.vendor.trim()) || NO_VENDOR_LABEL
    let g = groups.get(vendor)
    if (!g) {
      g = { revenue: 0, owed: 0, qty: 0 }
      groups.set(vendor, g)
    }
    g.revenue += r.revenue
    g.owed += r.cost
    g.qty += r.qtyTotal
  }

  const L: string[] = []
  L.push(`*${event.emoji} ${event.name} — Laporan*`)
  if (event.deliveryDate) L.push(`📅 ${event.deliveryDate}`)
  L.push('')
  L.push('*Ringkasan*')
  L.push(`• Pemesan: ${event.buyers.length}`)
  L.push(`• Total pemasukan: *${fm(t.revenue)}*`)
  if (t.totalDonation > 0) {
    const pct = t.revenue > 0 ? Math.round((t.totalDonation / t.revenue) * 100) : 0
    L.push(`• Donasi: ${fm(t.totalDonation)} (${pct}% dari pemasukan)`)
  }
  L.push(`• 💚 Untung untuk kas: *${fm(t.untungBersih)}*`)
  if (event.buyers.length > 0 && event.buyers.every((b) => b.settled)) {
    L.push('• ✅ Semua pembayaran LUNAS')
  }

  L.push('')
  L.push('*Setoran ke Supplier*')
  for (const [vendor, g] of groups) {
    const payout = event.vendorPayouts?.[vendor]
    const by = payout?.paid && payout.paidBy ? ` (oleh ${payout.paidBy})` : ''
    L.push(
      `• ${vendor}: setor *${fm(g.owed)}* (${g.qty} porsi) ${payout?.paid ? '✅ sudah' : '⏳ belum'}${by}`,
    )
  }

  if (event.bendaharaName || event.settlement) {
    L.push('')
    L.push('*Setoran ke Bendahara*')
    if (event.bendaharaName) L.push(`Bendahara: ${event.bendaharaName}`)
    if (event.settlement?.status === 'deposited') {
      L.push(`✅ Disetor ${fm(event.settlement.depositedAmount ?? t.untungBersih)}`)
      if (event.settlement.depositedDate) L.push(`📅 ${event.settlement.depositedDate}`)
    } else {
      L.push(`⏳ Belum disetor (${fm(t.untungBersih)})`)
    }
  }

  L.push('')
  L.push('_via Chip!n 💚 — transparan_')
  return L.join('\n')
}

/**
 * Bagikan teks. Jika ada nomor → langsung ke kontak via wa.me/<no>.
 * Tanpa nomor → coba Web Share, lalu wa.me umum.
 */
export async function sharePO(text: string, phone?: string): Promise<void> {
  const num = waNumber(phone)
  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>
  }
  if (!num && nav.share) {
    try {
      await nav.share({ text })
      return
    } catch {
      // dibatalkan → lanjut ke wa.me
    }
  }
  const base = num ? `https://wa.me/${num}` : 'https://wa.me/'
  window.open(base + '?text=' + encodeURIComponent(text), '_blank', 'noopener,noreferrer')
}
