import type { ID } from '../types'
import type { POMenu, POLine, Currency, PaymentMethod, PaymentStatus } from './types'
import { currencyDecimals } from '../utils/format'

// --- HELPER CONSTANTS & SYNONYMS ---

const PHONE_RE = /(\+?(?:62|0|1)\d[\d\s-]{6,}\d)/
const PAYMENT_AMOUNT_RE = /\b(zelle(?:'d|d)?|venmo(?:'d|ed)?|tf|transfer|cash)\b.*?(?:rp\.?\s*|\$)?(\d+(?:[.,]\d+)?(?:k|rb|ribu)?)\b/i;

const SYNONYM_MAP: Record<string, string> = {
  pastel: 'empanada',
}

/** Strip Indonesian fillers, greetings, and closings for cleaner parsing. */
function stripJunk(text: string): string {
  return text
    // Sapaan ke penjual di awal pesan ("Halo Kak,", "Dear Bu Sri,", "Hai,") — dulu hanya
    // satu nama penjual yang dikenali, jadi sapaan lain terbaca sebagai NAMA pemesan.
    .replace(/^(?:dear|halo|hallo|hello|hi|hai|hey)\b[^,\n]{0,25},\s*/i, '')
    .replace(/^(?:halo|hallo|hello|hi|hai|hey)\s+(?:kak|ka|kakak|mbak|mba|bu|ibu|sis|gan)\b\.?\s+/i, '')
    .replace(/(Makasih|Terima kasih|Thank you).*$/i, '')
    .replace(/\b(ya|dong|aja|deh|sih|kok|tuh|nih|jg|juga|yak)\b/gi, '')
    .trim()
}

function resolveSynonyms(text: string): string {
  let resolved = text.toLowerCase()
  for (const [key, value] of Object.entries(SYNONYM_MAP)) {
    resolved = resolved.replace(new RegExp(`\\b${key}\\b`, 'g'), value)
  }
  return resolved
}

// --- CORE PARSING LOGIC ---

export interface MenuCandidate {
  token: string
  options: { menuId: ID; name: string }[]
}

export interface ParsedRow {
  rawLine: string
  name: string
  phone?: string
  lines: POLine[]
  paid: number
  source: 'chat' | 'table'
  unmatched: string[]
  warnings: string[]
  statedTotal?: number
  paymentMethod?: PaymentMethod
  paymentStatus: PaymentStatus
  candidates: MenuCandidate[]
  needsName: boolean
  needsReview: boolean
  reviewReasons: string[]
}

export function parseMoney(input: string, currency: Currency): number | null {
  if (!input) return null
  let s = input.toLowerCase().trim().replace(/rp\.?|idr|usd|\$/g, '').trim()
  if (!s) return null

  const decimals = currencyDecimals(currency)
  if (decimals > 0) {
    s = s.replace(/,/g, '').replace(/[^0-9.]/g, '')
    if (!s) return null
    const v = parseFloat(s)
    if (!isFinite(v)) return null
    const f = Math.pow(10, decimals)
    return Math.round(v * f) / f
  }

  let mult = 1
  const unit = s.match(/(jt|juta|rb|ribu|k)\b/)
  if (unit) {
    mult = unit[1] === 'jt' || unit[1] === 'juta' ? 1_000_000 : 1_000
    s = s.slice(0, unit.index!).trim()
  }
  s = s.replace(/[^0-9.,]/g, '')
  if (!s) return null
  const value =
    mult > 1
      ? parseFloat(s.replace(/\./g, '').replace(',', '.'))
      : parseInt(s.replace(/[.,]/g, ''), 10)
  return isFinite(value) ? Math.round(value * mult) : null
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function isPurelyMoney(col: string, currency: Currency): boolean {
  const s = col
    .toLowerCase()
    .replace(/\b(bayar|bayaran|transfer|tf|setor|lunas|paid|zelle|venmo|cash|tunai|cod|sent|sudah|total|semua|all|jumlah|rp|idr|usd)\b/g, '')
    .replace(/\$/g, '').replace(/[\s:]/g, '')
  if (!/\d/.test(s)) return false
  const decimals = currencyDecimals(currency)
  return decimals > 0
    ? new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`).test(s.replace(/,/g, ''))
    : /^\d+([.,]?\d+)*(rb|ribu|jt|juta|k)?$/.test(s)
}

function extractQty(phrase: string): { qty: number; rest: string; found: boolean; unitPrice?: number } {
  let qty = 1
  let found = false
  let unitPrice: number | undefined
  let rest = phrase
  let m: RegExpMatchArray | null
  
  if ((m = rest.match(/(\d+)\s*[x×]\s*(\d[\d.,]*)/i))) {
    qty = +m[1]
    const second = m[2]
    if (/[.,]/.test(second) || second.replace(/[.,]/g, '').length >= 3) {
      unitPrice = parseFloat(second.replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'))
    }
    found = true
    rest = rest.replace(m[0], ' ')
  } else if ((m = rest.match(/(\d+)\s*[x×]/i)) || (m = rest.match(/[x×]\s*(\d+)/i)) || (m = rest.match(/^\s*(\d+)\s+/)) || (m = rest.match(/\s+(\d+)\s*$/))) {
    qty = +m[1]
    found = true
    rest = rest.replace(m[0], ' ')
  }
  return { qty: qty > 0 ? qty : 1, rest: rest.trim(), found, unitPrice }
}

function scoreMenu(p: string, menu: POMenu): number {
  const nm = normalize(menu.name)
  if (!nm) return 0
  if (p === nm) return 1
  if (p.includes(nm) || nm.includes(p)) return 0.92
  const pt = new Set(p.split(' '))
  const mt = nm.split(' ')
  const overlap = mt.filter((t) => pt.has(t)).length / mt.length
  return Math.max(overlap * 0.9, (1 - (([a,b]: string[]) => {
      const m = a.length, n = b.length;
      if (!m) return n; if (!n) return m;
      const dp = Array.from({ length: n + 1 }, (_, j) => j);
      for (let i = 1; i <= m; i++) {
          let prev = dp[0]; dp[0] = i;
          for (let j = 1; j <= n; j++) {
              const tmp = dp[j];
              dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
              prev = tmp;
          }
      }
      return dp[n] / Math.max(m, n);
  })([p, nm])) * 0.8)
}

function rankMenus(phrase: string, menus: POMenu[]): { menu: POMenu; score: number }[] {
  // Apply synonym resolution and filler stripping
  const p = normalize(stripJunk(resolveSynonyms(phrase)))
  if (!p) return []
  return menus
    .map((menu) => ({ menu, score: scoreMenu(p, menu) }))
    .sort((a, b) => b.score - a.score)
}

function matchMenu(phrase: string, menus: POMenu[]): POMenu | null {
  const ranked = rankMenus(phrase, menus)
  return ranked[0] && ranked[0].score >= 0.5 ? ranked[0].menu : null
}

function splitCols(line: string): string[] {
  let parts: string[]
  if (line.includes('\t')) parts = line.split('\t')
  else if (line.includes('|')) parts = line.split('|')
  else if (line.includes(';')) parts = line.split(';')
  else if (line.includes(',')) parts = line.split(',')
  else if (/\s{2,}/.test(line)) parts = line.split(/\s{2,}/)
  else parts = [line]
  return parts.map((p) => p.trim()).filter(Boolean)
}

function detectPaymentMethod(line: string): PaymentMethod | undefined {
  const s = line.toLowerCase()
  // Ignore negative constraints
  if (/\b(tidak|tanpa|no|bukan)\b/.test(s)) return undefined
  if (/\bzelle\b/.test(s)) return 'zelle'
  if (/\bvenmo\b/.test(s)) return 'venmo'
  if (/\b(cash|tunai|cod)\b/.test(s)) return 'cash'
  if (/\b(transfer|tf|setor)\b/.test(s)) return 'transfer'
  return undefined
}

function emptyRow(line: string, phone: string | undefined): ParsedRow {
  return {
    rawLine: line, name: '', phone, lines: [], paid: 0, source: 'chat', unmatched: [],
    warnings: ['Baris kosong'], paymentStatus: 'unpaid', candidates: [],
    needsName: true, needsReview: true, reviewReasons: ['Baris kosong'],
  }
}

function parseLine(line: string, menus: POMenu[], currency: Currency): ParsedRow {
  let rest = stripJunk(line) // Clean junk immediately
  
  // 1. Phone
  let phone: string | undefined
  const pm = rest.match(PHONE_RE)
  if (pm) {
    phone = pm[1].replace(/[\s-]/g, '')
    rest = rest.replace(pm[1], ' ')
  }

  // 2. Intercept Payment Amounts
  let amountFromPaymentString = 0
  const payMatch = rest.match(PAYMENT_AMOUNT_RE)
  if (payMatch) {
    amountFromPaymentString = parseMoney(payMatch[2], currency) ?? 0
    rest = rest.replace(payMatch[0], ' ').trim()
  }

  // 3. Name/Order extraction
  let forcedName: string | null = null
  const nameMatch = rest.match(/^(.+?)\s+(?:pesan|order|memesan)/i)
  if (nameMatch) {
    forcedName = nameMatch[1].trim()
    rest = rest.replace(nameMatch[0], '').trim()
  }

  const paymentMethod = detectPaymentMethod(line)
  const cols = splitCols(rest)
  if (cols.length === 0 && !forcedName) return emptyRow(line, phone)

  let name = forcedName ?? ''
  let startIdx = forcedName ? 0 : 1
  if (!forcedName) {
    const first = cols[0] ?? ''
    const firstAsItem = extractQty(first)
    if (/^\s*\d+\s*[x×]/i.test(first) || matchMenu(firstAsItem.rest || first, menus) !== null) {
      name = ''
      startIdx = 0
    } else {
      name = first
    }
  }

  let paid = amountFromPaymentString
  let statedTotalTagged = 0
  let statedFromLines = 0
  const unmatched: string[] = []
  const candidates: MenuCandidate[] = []
  const rawLines: POLine[] = []
  let lastIdx = -1
  let lastExplicit = false

  for (let i = startIdx; i < cols.length; i++) {
    const col = cols[i]
    if (isPurelyMoney(col, currency)) {
      const v = parseMoney(col, currency) ?? 0
      if (!/\b(bayar|total|jumlah)\b/i.test(col) && /^\d{1,2}$/.test(col.trim()) && lastIdx >= 0 && !lastExplicit) {
        rawLines[lastIdx].qty = v || 1
        lastExplicit = true
      } else {
        paid = Math.max(paid, v)
      }
      continue
    }
    
    const { qty, rest: namePart, found, unitPrice } = extractQty(col)
    const menu = matchMenu(namePart || col, menus)
    if (menu) {
      rawLines.push({ menuId: menu.id, qty: found ? qty : 1 }) // Default to 1 if no qty found[cite: 1]
      lastIdx = rawLines.length - 1
      lastExplicit = found
      if (unitPrice) statedFromLines += qty * unitPrice
    } else if (col.trim().length > 2) {
      unmatched.push(col)
      const top = rankMenus(namePart || col, menus).filter((r) => r.score > 0.2).slice(0, 2)
      if (top.length) candidates.push({ token: col, options: top.map((r) => ({ menuId: r.menu.id, name: r.menu.name })) })
    }
  }

  const merged = new Map<ID, number>()
  for (const l of rawLines) merged.set(l.menuId, (merged.get(l.menuId) ?? 0) + l.qty)
  const lines: POLine[] = [...merged].map(([menuId, qty]) => ({ menuId, qty }))

  const menuById = new Map(menus.map((m) => [m.id, m]))
  const bill = lines.reduce((s, l) => s + (menuById.get(l.menuId)?.sellPrice ?? 0) * l.qty, 0)
  const statedTotal = statedTotalTagged || statedFromLines || undefined

  const paymentStatus: PaymentStatus = paymentMethod === 'cash' ? 'promised-cash' : paid > 0 ? 'paid' : 'unpaid'
  const reviewReasons: string[] = []
  if (!name.trim()) reviewReasons.push('Nama kosong — isi manual')
  if (lines.length === 0) reviewReasons.push('Tidak ada menu terbaca')
  const needsReview = reviewReasons.length > 0 || unmatched.length > 0

  return {
    rawLine: line, name, phone, lines, paid, source: 'chat', unmatched,
    warnings: [...reviewReasons], statedTotal, paymentMethod, paymentStatus,
    candidates, needsName: !name.trim(), needsReview, reviewReasons,
  }
}

export function parseOrders(text: string, menus: POMenu[], currency: Currency): ParsedRow[] {
  return text.split(/\r?\n/).filter(line => line.trim()).map(line => parseLine(line, menus, currency))
}