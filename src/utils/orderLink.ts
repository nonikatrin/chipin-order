/**
 * Path C "asisten", tetap LOCAL-FIRST (tanpa backend, nomor pribadi tetap privat).
 *
 * Alur:
 *  1. Penjual membuat *tautan formulir* — snapshot menu PO di-encode ke dalam hash URL
 *     (`#/pesan/<code>`). Tak ada server: pembeli cukup membuka tautannya.
 *  2. Pembeli mengisi formulir (nama, item, ambil/antar) lalu mendapat *kode pesanan*
 *     yang bisa disalin — dikirim balik ke penjual lewat kanal apa pun.
 *  3. Penjual menempel kode itu; ter-decode jadi buyer via `addBuyer`. Nomor WA penjual
 *     tak pernah muncul di formulir — transportnya kode, bukan nomor.
 *
 * Encoding = base64url dari JSON UTF-8 (aman untuk emoji & non-ASCII). Foto SENGAJA
 * tidak disertakan (emoji fallback) agar tautan tetap pendek.
 */

import type { Currency, FulfillmentMode } from '../po/types'

export interface FormMenu {
  id: string
  name: string
  emoji: string
  price: number
  desc?: string
  allergens?: string[]
  quota?: number
}

/** Snapshot PO yang di-encode ke tautan formulir. */
export interface OrderFormData {
  v: 1
  poId: string
  name: string
  emoji: string
  currency: Currency
  place?: string
  deadline?: string
  delivery?: string // tanggal kirim PO (ISO) — dipakai utk prefiks kode pesanan
  store?: string
  menus: FormMenu[]
  faq?: { q: string; a: string }[]
}

/** Satu baris pesanan pembeli. */
export interface SubmittedLine {
  menuId: string
  qty: number
}

/** Payload yang dikembalikan pembeli sebagai "kode pesanan". */
export interface SubmittedOrder {
  v: 1
  poId: string
  name: string
  phone?: string
  lines: SubmittedLine[]
  fulfillment: FulfillmentMode
  address?: string
  note?: string
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function encode(obj: unknown): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(obj)))
}

function decode<T>(code: string): T | null {
  try {
    return JSON.parse(new TextDecoder().decode(fromBase64Url(code.trim()))) as T
  } catch {
    return null
  }
}

export const encodeForm = (data: OrderFormData): string => encode(data)
export const decodeForm = (code: string): OrderFormData | null => {
  const d = decode<OrderFormData>(code)
  return d && d.v === 1 && Array.isArray(d.menus) ? d : null
}

/**
 * Prefiks kode yang terbaca manusia: 3 huruf pertama nama PO + tanggal kirim (DDMM),
 * mis. "PON-1207". Sisanya tetap payload data — tanpa backend, kode HARUS membawa
 * isi pesanannya sendiri; prefiks hanya membuat kode dikenali sekilas.
 */
function poPrefix(poName?: string, deliveryIso?: string): string {
  const letters = (poName ?? '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || 'PO'
  const dm = deliveryIso && /^\d{4}-\d{2}-\d{2}/.test(deliveryIso)
    ? deliveryIso.slice(8, 10) + deliveryIso.slice(5, 7)
    : '0000'
  return `${letters}-${dm}`
}

/** Payload ringkas (array posisi, bukan objek berkunci) supaya kodenya jauh lebih pendek. */
type CompactOrder = [
  1,
  string, // poId
  string, // name
  string | 0, // phone
  [string, number][], // lines: [menuId, qty]
  0 | 1, // delivery?
  string | 0, // address
  string | 0, // note
]

export const encodeOrder = (
  order: SubmittedOrder,
  po?: { name?: string; delivery?: string },
): string => {
  const compact: CompactOrder = [
    1,
    order.poId,
    order.name,
    order.phone || 0,
    order.lines.map((l) => [l.menuId, l.qty] as [string, number]),
    order.fulfillment === 'delivery' ? 1 : 0,
    order.address || 0,
    order.note || 0,
  ]
  return `${poPrefix(po?.name, po?.delivery)}-${encode(compact)}`
}

export const decodeOrder = (code: string): SubmittedOrder | null => {
  const trimmed = code.trim()
  // Format baru: "PON-1207-<payload>"
  const m = trimmed.match(/^[A-Z0-9]{1,3}-\d{4}-(.+)$/s)
  if (m) {
    const arr = decode<CompactOrder>(m[1])
    if (!Array.isArray(arr) || arr[0] !== 1 || typeof arr[1] !== 'string' || !Array.isArray(arr[4]))
      return null
    return {
      v: 1,
      poId: arr[1],
      name: arr[2] || '',
      phone: arr[3] || undefined,
      lines: arr[4].map(([menuId, qty]) => ({ menuId, qty })),
      fulfillment: arr[5] ? 'delivery' : 'pickup',
      address: arr[6] || undefined,
      note: arr[7] || undefined,
    }
  }
  // Format lama (base64url JSON penuh) — kode yang sudah beredar tetap terbaca.
  const o = decode<SubmittedOrder>(trimmed)
  return o && o.v === 1 && Array.isArray(o.lines) && o.poId ? o : null
}

/**
 * Cari kode pesanan DI DALAM teks bebas — pembeli hampir selalu membungkus kodenya
 * dengan sapaan ("Halo kak, ini pesananku 🙏 PON-1207-… makasih"). Coba teks utuh
 * dulu, lalu setiap kandidat token (format baru berprefiks, lalu base64url panjang lama).
 */
export function findOrderCode(text: string): SubmittedOrder | null {
  const direct = decodeOrder(text)
  if (direct) return direct
  const candidates = [
    ...text.matchAll(/[A-Z0-9]{1,3}-\d{4}-[A-Za-z0-9_-]{8,}/g),
    ...text.matchAll(/[A-Za-z0-9_-]{60,}/g), // format lama tanpa prefiks
  ]
  for (const m of candidates) {
    const o = decodeOrder(m[0])
    if (o) return o
  }
  return null
}

/** Tautan formulir absolut untuk dibagikan (BrowserRouter → path). */
export function formLink(code: string): string {
  // BASE_URL = '/' saat lokal, '/chipin-order/' di GitHub Pages — tautan harus ikut awalannya.
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}${import.meta.env.BASE_URL}pesan/${code}`
}
