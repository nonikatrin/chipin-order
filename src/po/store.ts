import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ID } from '../types'
import type { POEvent, POMenu, POBuyer, POLine, Currency, VendorPayout, JastipTrip } from './types'
import { sanitizeAllergens } from '../utils/allergens'
import { priceJastipMenu, sanitizeTrip } from './jastip'

function uid(): ID {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

// 1. Unified Interface definitions
export interface OperatorSession {
  operatorId: string | null;
  operatorName: string | null;
}

export interface NewMenuInput {
  name: string
  emoji?: string
  buyPrice: number
  sellPrice: number
  maxQuota?: number
  vendor?: string
  description?: string
  allergens?: string[]
  piecesPerUnit?: number
  costBasis?: POMenu['costBasis']
  costValue?: number
  donated?: boolean
  photo?: string
  foreignPrice?: number
  weightGrams?: number
  shop?: string
}

export interface NewBuyerInput {
  name: string
  phone?: string
  lines: POLine[]
  paid: number
  settled?: boolean
  note?: string
  statedTotal?: number
  paymentMethod?: POBuyer['paymentMethod']
  paymentStatus?: POBuyer['paymentStatus']
  amountReceived?: number
  confirmation?: POBuyer['confirmation']
  reviewReasons?: string[]
  donation?: number
  waitlist?: boolean
  fulfillment?: POBuyer['fulfillment']
  fulfillmentStatus?: POBuyer['fulfillmentStatus']
  deliveryAddress?: string
  deliveryNote?: string
  deliveryFee?: number
  courierCost?: number
}

/** Detail event yang boleh diubah dari wizard/form edit (bukan menus/buyers). */
export type POEventDetailsPatch = Partial<
  Pick<
    POEvent,
    'name' | 'emoji' | 'currency' | 'deliveryDate' | 'orderDeadline' | 'place' | 'description' | 'recurrence'
  >
>

interface POState {
  // Operator Session State
  activeOperator: OperatorSession;
  setOperator: (id: string | null, name: string | null) => void;
  logoutOperator: () => void;

  // Core Events State
  events: POEvent[]

  createEvent: (
    name: string,
    emoji: string,
    currency: Currency,
    deliveryDate?: string,
    place?: string,
  ) => ID
  deleteEvent: (eventId: ID) => void
  closeEvent: (eventId: ID) => void
  reopenEvent: (eventId: ID) => void
  duplicateEvent: (eventId: ID) => ID | undefined
  importEvents: (incoming: POEvent[]) => number
  restoreEvent: (event: POEvent, index: number) => void
  renameEvent: (eventId: ID, name: string, emoji: string) => void
  updateEventDetails: (eventId: ID, patch: POEventDetailsPatch) => void

  addMenu: (eventId: ID, input: NewMenuInput) => void
  updateMenu: (eventId: ID, menuId: ID, patch: Partial<POMenu>) => void
  removeMenu: (eventId: ID, menuId: ID) => void
  /** Jadikan PO jastip (atau kembali biasa) + simpan trip; semua harga item dihitung ulang. */
  setJastip: (eventId: ID, trip: JastipTrip | null) => void

  addBuyer: (eventId: ID, input: NewBuyerInput) => void
  updateBuyer: (eventId: ID, buyerId: ID, patch: Partial<POBuyer>) => void
  removeBuyer: (eventId: ID, buyerId: ID) => void
  toggleSettled: (eventId: ID, buyerId: ID) => void
  importBuyers: (eventId: ID, inputs: NewBuyerInput[]) => void

  toggleVendorPaid: (eventId: ID, vendor: string) => void
  setVendorPaidBy: (eventId: ID, vendor: string, name: string) => void
  setVendorPayMethod: (eventId: ID, vendor: string, method: VendorPayout['method']) => void
  setSettlement: (eventId: ID, patch: Partial<POEvent['settlement']> & { status: 'not-deposited' | 'deposited' }) => void
  setRoles: (eventId: ID, roles: { organizerName?: string; bendaharaName?: string }) => void

  seedDemo: () => ID
  
}

const DEMO_EVENT_ID = 'demo-po-event'

const DEMO_MENUS: POMenu[] = [
  { id: 'demo-m-bakso', name: 'Bakso Urat', emoji: '🍜', buyPrice: 6, sellPrice: 10, maxQuota: 30, vendor: 'Dapur Bu Sri' },
  { id: 'demo-m-siomay', name: 'Siomay Bandung', emoji: '🥟', buyPrice: 5, sellPrice: 8, maxQuota: 20, vendor: 'Dapur Bu Sri', piecesPerUnit: 4 },
  { id: 'demo-m-cendol', name: 'Es Cendol', emoji: '🥤', buyPrice: 2, sellPrice: 4, maxQuota: 25, vendor: 'Kedai Manis' },
  { id: 'demo-m-risoles', name: 'Risoles Mayo', emoji: '🥠', buyPrice: 0, sellPrice: 3, maxQuota: 40, vendor: 'Kedai Manis', costBasis: 'percent', costValue: 0.5 },
]

function demoBuyers(now: number): POBuyer[] {
  const min = 60_000
  return [
    {
      id: 'demo-b-andi', name: 'Andi Wijaya', phone: '8121110001',
      lines: [{ menuId: 'demo-m-bakso', qty: 2 }, { menuId: 'demo-m-cendol', qty: 1 }],
      paid: 24, settled: true, paymentMethod: 'zelle', paymentStatus: 'paid', confirmation: 'auto',
      fulfillment: 'pickup', fulfillmentStatus: 'picked-up',
      createdAt: now - 1 * min,
    },
    {
      id: 'demo-b-citra', name: 'Citra Lestari', phone: '8121110002',
      lines: [{ menuId: 'demo-m-risoles', qty: 3 }],
      paid: 9, settled: true, paymentMethod: 'venmo', paymentStatus: 'paid', donation: 2, confirmation: 'auto',
      fulfillment: 'delivery', fulfillmentStatus: 'pending',
      deliveryAddress: 'Jl. Merpati No.12, Blok C', deliveryNote: 'Telepon sebelum sampai',
      createdAt: now - 2 * min,
    },
    {
      id: 'demo-b-budi', name: 'Budi Santoso', phone: '8121110003',
      lines: [{ menuId: 'demo-m-siomay', qty: 1 }],
      paid: 0, settled: false, paymentMethod: 'cash', paymentStatus: 'promised-cash', amountReceived: 8, confirmation: 'auto',
      fulfillment: 'pickup', fulfillmentStatus: 'pending',
      createdAt: now - 3 * min,
    },
    {
      id: 'demo-b-dewi', name: 'Dewi',
      lines: [{ menuId: 'demo-m-bakso', qty: 1 }],
      paid: 0, settled: false, paymentStatus: 'unpaid', confirmation: 'needs-review',
      reviewReasons: ['Nama kurang lengkap', 'Total tidak cocok'], statedTotal: 12,
      createdAt: now - 4 * min,
    },
    {
      id: 'demo-b-eka', name: 'Eka Putri', phone: '8121110005',
      lines: [{ menuId: 'demo-m-cendol', qty: 4 }],
      paid: 0, settled: false, paymentStatus: 'unpaid', waitlist: true, note: 'Nambah kalau kuota cukup',
      createdAt: now - 5 * min,
    },
  ]
}

function mapEvent(events: POEvent[], eventId: ID, fn: (e: POEvent) => POEvent): POEvent[] {
  return events.map((e) => (e.id === eventId ? fn(e) : e))
}

/** Batas wajar input menu — dipakai editor (maxLength/max), parser bulk, dan store. */
export const MENU_LIMITS = {
  name: 60,
  vendor: 40,
  description: 160,
  price: 100_000_000, // per porsi; typo "kelebihan nol" tertahan di sini
  quota: 10_000,
  pieces: 1_000,
} as const

/**
 * Batas wajar data pembeli. Menu sudah dijaga MENU_LIMITS; baris & pembeli dulu tidak —
 * padahal KODE PESANAN datang dari pembeli (teks yang bisa disunting siapa saja), jadi
 * qty/nama harus dijepit di sini, bukan dipercaya.
 */
export const BUYER_LIMITS = {
  name: 80,
  note: 300,
  address: 200,
  qty: 10_000, // per baris; sejalan dgn MENU_LIMITS.quota
  money: 1_000_000_000,
} as const

function clampPrice(v?: number): number {
  return Math.min(MENU_LIMITS.price, Math.max(0, v || 0))
}

/** Uang yang selalu terhingga & tak negatif (menahan 1e308/Infinity/NaN dari data impor). */
function clampMoney(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.min(BUYER_LIMITS.money, Math.max(0, n))
}

/** Qty selalu bilangan bulat positif & terhingga — sumbernya bisa kode pesanan/berkas impor. */
export function normalizeQty(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.min(BUYER_LIMITS.qty, Math.round(n))
}

function cleanText(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined
  const s = v.trim().slice(0, max)
  return s || undefined
}

function normalizeLines(lines: unknown): POLine[] {
  if (!Array.isArray(lines)) return []
  const out: POLine[] = []
  for (const l of lines) {
    if (!l || typeof (l as POLine).menuId !== 'string') continue
    const qty = normalizeQty((l as POLine).qty)
    if (qty > 0) out.push({ menuId: (l as POLine).menuId, qty })
  }
  return out
}

/** Rapikan satu pembeli dari sumber tak tepercaya (impor cadangan / kode pesanan). */
function normalizeBuyer(b: Partial<POBuyer>, i: number): POBuyer {
  return {
    ...b,
    id: typeof b.id === 'string' && b.id ? b.id : uid() + '-' + i,
    name: cleanText(b.name, BUYER_LIMITS.name) ?? 'Tanpa Nama',
    phone: cleanText(b.phone, 40),
    lines: normalizeLines(b.lines),
    paid: clampMoney(b.paid),
    settled: Boolean(b.settled),
    note: cleanText(b.note, BUYER_LIMITS.note),
    donation: b.donation != null ? clampMoney(b.donation) || undefined : undefined,
    deliveryAddress: cleanText(b.deliveryAddress, BUYER_LIMITS.address),
    deliveryNote: cleanText(b.deliveryNote, BUYER_LIMITS.note),
    deliveryFee: b.deliveryFee != null ? clampMoney(b.deliveryFee) || undefined : undefined,
    courierCost: b.courierCost != null ? clampMoney(b.courierCost) || undefined : undefined,
    createdAt: Number.isFinite(b.createdAt) ? (b.createdAt as number) : Date.now(),
  } as POBuyer
}

/**
 * Jaminan bentuk satu event. Tanpa ini, satu berkas cadangan terpotong (menus/buyers/lines
 * hilang) membuat computePO melempar → seluruh aplikasi layar putih dan TIDAK bisa dipulihkan
 * dari dalam aplikasi, karena datanya sudah terlanjur tersimpan.
 */
export function normalizeEvent(e: Partial<POEvent>, i = 0): POEvent {
  const menus = Array.isArray(e.menus) ? e.menus.filter((m) => m && typeof m.id === 'string') : []
  const buyers = Array.isArray(e.buyers) ? e.buyers.filter(Boolean) : []
  return {
    ...e,
    id: typeof e.id === 'string' && e.id ? e.id : uid() + '-e' + i,
    name: cleanText(e.name, 120) ?? 'PO Bersama',
    emoji: typeof e.emoji === 'string' && e.emoji ? e.emoji : '🍲',
    currency: (e.currency || 'IDR') as Currency,
    menus: menus.map((m) => ({
      ...m,
      name: cleanText(m.name, MENU_LIMITS.name) ?? 'Menu',
      emoji: typeof m.emoji === 'string' && m.emoji ? m.emoji : '🍱',
      buyPrice: clampPrice(m.buyPrice),
      sellPrice: clampPrice(m.sellPrice),
      vendor: cleanText(m.vendor, MENU_LIMITS.vendor),
      // bagi hasil hanya masuk akal di 0..1 — editor sudah menjaga, impor belum
      costValue:
        m.costBasis === 'percent'
          ? Math.min(1, Math.max(0, Number(m.costValue) || 0))
          : m.costValue,
    })),
    buyers: buyers.map((b, bi) => normalizeBuyer(b as POBuyer, bi)),
    kind: e.kind === 'jastip' ? 'jastip' : undefined,
    jastip: e.jastip ? sanitizeTrip(e.jastip) : undefined,
    createdAt: Number.isFinite(e.createdAt) ? (e.createdAt as number) : Date.now(),
  } as POEvent
}

function cleanQuota(q?: number): number | undefined {
  return q != null && q > 0 ? Math.min(MENU_LIMITS.quota, Math.round(q)) : undefined
}

/** Rapikan patch menu: potong panjang teks + jepit angka ke MENU_LIMITS (hanya field yang ada). */
function sanitizeMenuPatch(patch: Partial<POMenu>): Partial<POMenu> {
  const p = { ...patch }
  if (p.name != null) p.name = p.name.trim().slice(0, MENU_LIMITS.name) || 'Menu'
  if ('vendor' in p) p.vendor = p.vendor?.trim().slice(0, MENU_LIMITS.vendor) || undefined
  if ('boughtQty' in p)
    p.boughtQty = p.boughtQty != null && p.boughtQty >= 0 ? Math.min(MENU_LIMITS.quota, Math.round(p.boughtQty)) : undefined
  if ('shop' in p) p.shop = p.shop?.trim().slice(0, MENU_LIMITS.vendor) || undefined
  if ('description' in p) p.description = p.description?.trim().slice(0, MENU_LIMITS.description) || undefined
  if ('allergens' in p) p.allergens = sanitizeAllergens(p.allergens)
  if (p.buyPrice != null) p.buyPrice = clampPrice(p.buyPrice)
  if (p.sellPrice != null) p.sellPrice = clampPrice(p.sellPrice)
  if ('donated' in p) p.donated = p.donated || undefined
  if ('maxQuota' in p) p.maxQuota = cleanQuota(p.maxQuota)
  if ('piecesPerUnit' in p)
    p.piecesPerUnit =
      p.piecesPerUnit && p.piecesPerUnit > 1
        ? Math.min(MENU_LIMITS.pieces, Math.round(p.piecesPerUnit))
        : undefined
  return p
}

/**
 * Kunci pencocokan nama supplier. Nama diketik tangan per menu, jadi "Sri" dan "sri"
 * dulu jadi DUA supplier: dua kartu, dua tombol bayar, dua langkah checklist. Spasi sudah
 * ditangani `trim()`; beda huruf besar/kecil belum.
 */
export function vendorKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Cari entri payout yang cocok walau ejaan kapitalnya berbeda (data lama tetap terbaca). */
export function findVendorPayout(
  event: Pick<POEvent, 'vendorPayouts'> | undefined,
  vendor: string,
): VendorPayout | undefined {
  const p = event?.vendorPayouts
  if (!p) return undefined
  if (p[vendor]) return p[vendor]
  const k = vendorKey(vendor)
  const hit = Object.keys(p).find((x) => vendorKey(x) === k)
  return hit ? p[hit] : undefined
}

/** Nama kunci yang harus DITULIS: pakai entri lama bila hanya beda kapital, agar tak kembar. */
function payoutKey(event: POEvent, vendor: string): string {
  const p = event.vendorPayouts
  if (!p) return vendor
  if (p[vendor]) return vendor
  const k = vendorKey(vendor)
  return Object.keys(p).find((x) => vendorKey(x) === k) ?? vendor
}

function makeBuyer(input: NewBuyerInput): POBuyer {
  return {
    id: uid(),
    // Nama & qty bisa berasal dari KODE PESANAN buatan pembeli — jepit, jangan percaya.
    name: cleanText(input.name, BUYER_LIMITS.name) ?? 'Tanpa Nama',
    phone: cleanText(input.phone?.replace(/[\s-]/g, ''), 40),
    lines: normalizeLines(input.lines),
    paid: clampMoney(input.paid),
    settled: input.settled ?? false,
    note: cleanText(input.note, BUYER_LIMITS.note),
    statedTotal: input.statedTotal,
    paymentMethod: input.paymentMethod,
    paymentStatus: input.paymentStatus,
    amountReceived: input.amountReceived,
    confirmation: input.confirmation,
    reviewReasons: input.reviewReasons?.length ? input.reviewReasons : undefined,
    donation: clampMoney(input.donation) || undefined,
    waitlist: input.waitlist || undefined,
    fulfillment: input.fulfillment,
    fulfillmentStatus: input.fulfillmentStatus ?? (input.fulfillment ? 'pending' : undefined),
    deliveryAddress: cleanText(input.deliveryAddress, BUYER_LIMITS.address),
    deliveryNote: cleanText(input.deliveryNote, BUYER_LIMITS.note),
    deliveryFee: clampMoney(input.deliveryFee) || undefined,
    courierCost: clampMoney(input.courierCost) || undefined,
    createdAt: Date.now(),
  }
}

// 2. Single persist implementation with operator configurations safely grouped together
export const usePOStore = create<POState>()(
  persist(
    (set, get) => ({
      // Operator Session Initial State
      activeOperator: { operatorId: null, operatorName: null },
      
      setOperator: (id, name) => 
        set({ activeOperator: { operatorId: id, operatorName: name } }),
        
      logoutOperator: () => 
        set({ activeOperator: { operatorId: null, operatorName: null } }),

      // Core System Events
      events: [],

      createEvent: (name, emoji, currency, deliveryDate, place) => {
        const id = uid()
        const event: POEvent = {
          id,
          name: name.trim() || 'PO Bersama',
          emoji: emoji || '🍲',
          currency,
          deliveryDate: deliveryDate || undefined,
          place: place?.trim() || undefined,
          menus: [],
          buyers: [],
          createdAt: Date.now(),
        }
        set({ events: [event, ...get().events] })
        return id
      },

      deleteEvent: (eventId) =>
        set({ events: get().events.filter((e) => e.id !== eventId) }),

      closeEvent: (eventId) =>
        set({
          events: mapEvent(get().events, eventId, (e) => ({
            ...e,
            status: 'closed',
            closedAt: Date.now(),
          })),
        }),

      reopenEvent: (eventId) =>
        set({
          events: mapEvent(get().events, eventId, (e) => ({
            ...e,
            status: 'active',
            closedAt: undefined,
          })),
        }),

      duplicateEvent: (eventId) => {
        const src = get().events.find((e) => e.id === eventId)
        if (!src) return undefined
        const id = uid()
        const copy: POEvent = {
          ...src,
          id,
          name: `${src.name} (salinan)`,
          menus: src.menus.map((m) => ({ ...m, id: uid(), shopStatus: undefined, boughtQty: undefined })),
          buyers: [],
          settlement: undefined,
          vendorPayouts: {},
          status: 'active',
          closedAt: undefined,
          createdAt: Date.now(),
        }
        set({ events: [copy, ...get().events] })
        return id
      },

      importEvents: (incoming) => {
        if (!Array.isArray(incoming)) return 0
        const existing = new Set(get().events.map((e) => e.id))
        // Berkas cadangan bisa terpotong/berbeda versi — bentuknya dipaksa aman dulu,
        // karena event cacat membuat computePO melempar & mengunci aplikasi.
        const fresh = incoming
          .filter((e) => e && typeof e === 'object' && e.id && !existing.has(e.id))
          .map((e, i) => normalizeEvent(e, i))
        if (fresh.length) set({ events: [...fresh, ...get().events] })
        return fresh.length
      },

      restoreEvent: (event, index) =>
        set((s) => {
          if (s.events.some((e) => e.id === event.id)) return s
          const next = s.events.slice()
          next.splice(Math.min(Math.max(index, 0), next.length), 0, event)
          return { events: next }
        }),

      renameEvent: (eventId, name, emoji) =>
        set({
          events: mapEvent(get().events, eventId, (e) => ({
            ...e,
            name: name.trim() || e.name,
            emoji: emoji || e.emoji,
          })),
        }),

      updateEventDetails: (eventId, patch) =>
        set({
          events: mapEvent(get().events, eventId, (e) => ({
            ...e,
            ...patch,
            name: patch.name !== undefined ? patch.name.trim() || e.name : e.name,
            emoji: patch.emoji !== undefined ? patch.emoji || e.emoji : e.emoji,
            place: patch.place !== undefined ? patch.place.trim() || undefined : e.place,
            description:
              patch.description !== undefined ? patch.description.trim() || undefined : e.description,
            deliveryDate: patch.deliveryDate !== undefined ? patch.deliveryDate || undefined : e.deliveryDate,
            orderDeadline:
              patch.orderDeadline !== undefined ? patch.orderDeadline || undefined : e.orderDeadline,
          })),
        }),

      addMenu: (eventId, input) =>
        set({
          events: mapEvent(get().events, eventId, (e) => ({
            ...e,
            menus: [
              ...e.menus,
              {
                id: uid(),
                name: input.name.trim().slice(0, MENU_LIMITS.name) || 'Menu',
                emoji: input.emoji || '🍱',
                buyPrice: clampPrice(input.buyPrice),
                sellPrice: clampPrice(input.sellPrice),
                maxQuota: cleanQuota(input.maxQuota),
                vendor: input.vendor?.trim().slice(0, MENU_LIMITS.vendor) || undefined,
                description: input.description?.trim().slice(0, MENU_LIMITS.description) || undefined,
                allergens: sanitizeAllergens(input.allergens),
                piecesPerUnit:
                  input.piecesPerUnit && input.piecesPerUnit > 1
                    ? Math.min(MENU_LIMITS.pieces, Math.round(input.piecesPerUnit))
                    : undefined,
                costBasis: input.costBasis,
                costValue: input.costValue,
                donated: input.donated || undefined,
                photo: input.photo,
                foreignPrice: input.foreignPrice,
                weightGrams: input.weightGrams,
                shop: input.shop?.trim().slice(0, MENU_LIMITS.vendor) || undefined,
              },
            ].map((m) => priceJastipMenu(m, e)),
          })),
        }),

      updateMenu: (eventId, menuId, patch) =>
        set({
          events: mapEvent(get().events, eventId, (e) => ({
            ...e,
            menus: e.menus.map((m) =>
              m.id === menuId ? priceJastipMenu({ ...m, ...sanitizeMenuPatch(patch) }, e) : m,
            ),
          })),
        }),

      setJastip: (eventId, trip) =>
        set({
          events: mapEvent(get().events, eventId, (e) => {
            // kembali ke PO biasa: status belanja tak berlaku lagi (item 'habis' jangan diam-diam tak ditagih)
            if (!trip) return { ...e, kind: 'po', menus: e.menus.map((m) => ({ ...m, shopStatus: undefined, boughtQty: undefined })) }
            const next: POEvent = { ...e, kind: 'jastip', jastip: sanitizeTrip(trip) }
            return { ...next, menus: next.menus.map((m) => priceJastipMenu(m, next)) }
          }),
        }),

      removeMenu: (eventId, menuId) =>
        set({
          events: mapEvent(get().events, eventId, (e) => ({
            ...e,
            menus: e.menus.filter((m) => m.id !== menuId),
            buyers: e.buyers.map((b) => ({
              ...b,
              lines: b.lines.filter((l) => l.menuId !== menuId),
            })),
          })),
        }),

      addBuyer: (eventId, input) =>
        set({
          events: mapEvent(get().events, eventId, (e) => ({
            ...e,
            buyers: [makeBuyer(input), ...e.buyers],
          })),
        }),

      updateBuyer: (eventId, buyerId, patch) =>
        set({
          events: mapEvent(get().events, eventId, (e) => ({
            ...e,
            buyers: e.buyers.map((b) =>
              b.id === buyerId ? { ...b, ...patch } : b,
            ),
          })),
        }),

      removeBuyer: (eventId, buyerId) =>
        set({
          events: mapEvent(get().events, eventId, (e) => ({
            ...e,
            buyers: e.buyers.filter((b) => b.id !== buyerId),
          })),
        }),

      toggleSettled: (eventId, buyerId) =>
        set({
          events: mapEvent(get().events, eventId, (e) => {
            const menus = new Map(e.menus.map((m) => [m.id, m]))
            return {
              ...e,
              buyers: e.buyers.map((b) => {
                if (b.id !== buyerId) return b
                if (b.settled) return { ...b, settled: false }
                const itemsBill = b.lines.reduce(
                  (s, l) =>
                    s +
                    (menus.get(l.menuId)?.sellPrice ?? 0) *
                      Math.max(0, Math.round(l.qty)),
                  0,
                )
                return { ...b, settled: true, paid: Math.max(b.paid, itemsBill) }
              }),
            }
          }),
        }),

      importBuyers: (eventId, inputs) =>
        set({
          events: mapEvent(get().events, eventId, (e) => ({
            ...e,
            buyers: [...inputs.map(makeBuyer), ...e.buyers],
          })),
        }),

      toggleVendorPaid: (eventId, vendor) =>
        set({
          events: mapEvent(get().events, eventId, (e) => {
            const key = payoutKey(e, vendor)
            const cur = e.vendorPayouts?.[key]
            const next: VendorPayout = cur?.paid
              ? { paid: false }
              : { paid: true, paidDate: new Date().toISOString().slice(0, 10), paidBy: cur?.paidBy, method: cur?.method }
            return { ...e, vendorPayouts: { ...e.vendorPayouts, [key]: next } }
          }),
        }),

      setVendorPaidBy: (eventId, vendor, name) =>
        set({
          events: mapEvent(get().events, eventId, (e) => {
            const key = payoutKey(e, vendor)
            const cur = e.vendorPayouts?.[key] ?? { paid: false }
            const next: VendorPayout = { ...cur, paidBy: name.trim() || undefined }
            return { ...e, vendorPayouts: { ...e.vendorPayouts, [key]: next } }
          }),
        }),

      setVendorPayMethod: (eventId, vendor, method) =>
        set({
          events: mapEvent(get().events, eventId, (e) => {
            const key = payoutKey(e, vendor)
            const cur = e.vendorPayouts?.[key] ?? { paid: false }
            const next: VendorPayout = { ...cur, method }
            return { ...e, vendorPayouts: { ...e.vendorPayouts, [key]: next } }
          }),
        }),

      setSettlement: (eventId, patch) =>
        set({
          events: mapEvent(get().events, eventId, (e) => ({
            ...e,
            settlement: {
              status: patch.status,
              depositedAmount: patch.depositedAmount ?? e.settlement?.depositedAmount,
              depositedDate:
                patch.status === 'deposited'
                  ? patch.depositedDate ?? new Date().toISOString().slice(0, 10)
                  : undefined,
            },
          })),
        }),

      setRoles: (eventId, roles) =>
        set({
          events: mapEvent(get().events, eventId, (e) => ({
            ...e,
            organizerName: roles.organizerName?.trim() || e.organizerName,
            bendaharaName: roles.bendaharaName?.trim() || e.bendaharaName,
          })),
        }),

      seedDemo: () => {
        if (get().events.some((e) => e.id === DEMO_EVENT_ID)) return DEMO_EVENT_ID
        const now = Date.now()
        const event: POEvent = {
          id: DEMO_EVENT_ID,
          name: 'PO Bakso Malam Minggu',
          emoji: '🍜',
          currency: 'USD',
          deliveryDate: new Date(now + 3 * 86_400_000).toISOString().slice(0, 10),
          place: 'Balai Warga, Sunnyvale',
          menus: DEMO_MENUS.map((m) => ({ ...m })),
          buyers: demoBuyers(now),
          organizerName: 'Rina',
          bendaharaName: 'Rina',
          settlement: { status: 'not-deposited' },
          vendorPayouts: {},
          createdAt: now,
        }
        set({ events: [event, ...get().events] })
        return DEMO_EVENT_ID
      },
    }),
    {
      name: 'chipinorder-po-v1',
      version: 1,
      /**
       * Penyembuhan-diri di SETIAP pemuatan (merge, bukan migrate — migrate hanya jalan saat
       * versi berubah). Data cacat yang terlanjur tersimpan (mis. dari cadangan terpotong)
       * dirapikan di sini, bukan meledak di computePO. Tanpa ini, sekali data rusak masuk,
       * aplikasi layar putih di SETIAP rute tanpa jalan pulih dari dalam aplikasi.
       */
      merge: (persisted, current) => {
        const s = (persisted ?? {}) as Partial<POState>
        const events = Array.isArray(s.events) ? s.events : []
        return {
          ...current,
          ...s,
          events: events.map((e, i) => normalizeEvent(e as POEvent, i)),
        }
      },
    },
  ),
)

export function usePOEvent(eventId: ID | undefined): POEvent | undefined {
  return usePOStore((s) => s.events.find((e) => e.id === eventId))
}