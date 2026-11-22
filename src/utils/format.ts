const idr = new Intl.NumberFormat('id-ID')

/** "Rp 150.000" */
export function formatRupiah(n: number): string {
  return 'Rp ' + idr.format(Math.round(n))
}

/** "150.000" tanpa awalan Rp */
export function formatNumber(n: number): string {
  return idr.format(Math.round(n))
}

/** Versi ringkas untuk angka besar: "Rp 1,2 jt" */
export function formatRupiahShort(n: number): string {
  const v = Math.round(n)
  if (v >= 1_000_000) {
    const jt = v / 1_000_000
    return 'Rp ' + jt.toFixed(jt % 1 === 0 ? 0 : 1).replace('.', ',') + ' jt'
  }
  if (v >= 1_000) {
    const rb = v / 1_000
    return 'Rp ' + rb.toFixed(rb % 1 === 0 ? 0 : 0).replace('.', ',') + 'rb'
  }
  return formatRupiah(v)
}

const dateLong = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const dateShort = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
})

export function formatDate(ts: number): string {
  return dateLong.format(ts)
}

export function formatDateShort(ts: number): string {
  return dateShort.format(ts)
}

/** Inisial dari nama, maksimal 2 huruf. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
// --- FORMATTER KHUSUS USD (MODULE 2) ---

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const usdShort = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/** "$884.00" — Format USD Standar & Presisi untuk Audit Keuangan */
export function formatUSD(n: number): string {
  return usd.format(n)
}

/** "$884" atau "$10.50" — Tanpa .00 jika angkanya bulat murni */
export function formatUSDClean(n: number): string {
  if (n % 1 === 0) {
    return usdShort.format(n)
  }
  return usd.format(n)
}

/** 
 * Teks keterangan sisa bayar terstruktur ramah lansia.
 * Menyelaraskan tata bahasa Modul 1 ("Perlu bayar") & Modul 2 ("Lebih Bayar").
 */
export function formatStatusBayarUSD(selisih: number): string {
  if (selisih > 0) {
    return `↑ Lebih Bayar ${formatUSDClean(selisih)}`
  }
  if (selisih < 0) {
    // Menggunakan istilah kesopanan lansia "Perlu bayar" agar seragam dengan modul trip
    return `↓ Perlu bayar ${formatUSDClean(Math.abs(selisih))}`
  }
  return 'Lunas'
}

// --- META MATA UANG GENERIK (Module 2 mendukung mata uang apa pun) ---

/** Mata uang umum — ditaruh di atas dropdown agar mudah dipilih. */
export const COMMON_CURRENCIES = [
  // Featured first so they're easy to reach: Rp · $ · € · £ · ¥ · CHF
  'IDR', 'USD', 'EUR', 'GBP', 'JPY', 'CHF',
  'SGD', 'MYR', 'AUD', 'CNY', 'SAR', 'AED', 'THB', 'PHP', 'VND', 'INR',
  'KRW', 'HKD', 'CAD', 'NZD',
]

/** Semua kode ISO 4217 (fallback ke daftar umum bila Intl tak mendukung). */
export function allCurrencies(): string[] {
  try {
    const v = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
      .supportedValuesOf?.('currency')
    if (v && v.length) return v
  } catch {
    /* abaikan — pakai fallback */
  }
  return COMMON_CURRENCIES
}

const curNames = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'currency' })
  } catch {
    return null
  }
})()

/** Nama tampil mata uang, mis. 'IDR' → 'Indonesian Rupiah'. */
export function currencyName(code: string): string {
  try {
    return curNames?.of(code) ?? code
  } catch {
    return code
  }
}

const decimalsCache = new Map<string, number>()

/** Jumlah desimal standar: IDR/JPY → 0, USD/EUR → 2, KWD → 3. */
export function currencyDecimals(code: string): number {
  let d = decimalsCache.get(code)
  if (d == null) {
    try {
      d = new Intl.NumberFormat('en', { style: 'currency', currency: code })
        .resolvedOptions().maximumFractionDigits ?? 2
    } catch {
      d = 2
    }
    decimalsCache.set(code, d)
  }
  return d
}

/** Simbol mata uang ('Rp', '$', '€', …); fallback ke kode. */
export function currencySymbol(code: string): string {
  try {
    const part = new Intl.NumberFormat('en', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
    })
      .formatToParts(0)
      .find((p) => p.type === 'currency')
    return part?.value ?? code
  } catch {
    return code
  }
}

const moneyFmtCache = new Map<string, Intl.NumberFormat>()
function moneyFormatter(code: string): Intl.NumberFormat {
  let f = moneyFmtCache.get(code)
  if (!f) {
    f = new Intl.NumberFormat(code === 'IDR' ? 'id-ID' : 'en-US', {
      style: 'currency',
      currency: code,
    })
    moneyFmtCache.set(code, f)
  }
  return f
}

/** Format sesuai mata uang acara: IDR → "Rp 100.000", USD → "$100.50", lain via Intl. */
export function formatMoney(n: number, currency: string): string {
  if (currency === 'IDR') return formatRupiah(n)
  if (currency === 'USD') return formatUSD(n)
  try {
    return moneyFormatter(currency).format(roundMoney(n, currency))
  } catch {
    return formatRupiah(n)
  }
}

/** Versi ringkas (tanpa desimal bila angkanya bulat). */
export function formatMoneyClean(n: number, currency: string): string {
  if (currency === 'IDR') return formatRupiah(n)
  if (currency === 'USD') return formatUSDClean(n)
  if (currencyDecimals(currency) > 0 && n % 1 === 0) {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(n)
    } catch {
      /* fallthrough */
    }
  }
  return formatMoney(n, currency)
}

/** Bulatkan ke satuan terkecil mata uang (IDR → bulat, USD → sen, KWD → 3 desimal). */
export function roundMoney(n: number, currency: string): number {
  const f = Math.pow(10, currencyDecimals(currency))
  return Math.round(n * f) / f
}