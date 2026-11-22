/**
 * Angka dari kolom teks, mengikuti kebiasaan menulis di Indonesia.
 *
 * `Number("25.000")` = 25 — padahal penjual menulis titik sebagai pemisah ribuan, jadi fee
 * "25.000" atau kurs SGD "12.000" diam-diam jadi 25 / 12 dan seluruh harga jual salah.
 * Aturan:
 * - ada titik DAN koma → yang terakhir adalah desimal ("1.250,5" = 1250.5, "1,250.5" = 1250.5)
 * - satu jenis pemisah, muncul > 1 kali → ribuan ("1.250.000" = 1250000)
 * - satu jenis pemisah, muncul sekali, diikuti tepat 3 angka → ribuan ("25.000", "12,000"),
 *   kecuali bagian depannya 0 ("0.125" = 0.125)
 * - selain itu → desimal ("10.5", "11,5", "12.99")
 * - akhiran: rb/ribu/k ×1.000 · jt/juta ×1.000.000 ("25rb" = 25000, "1,5jt" = 1500000)
 * Hasil tak valid / negatif → 0.
 */
export function parseNumberID(input: string): number {
  let s = String(input ?? '').toLowerCase().replace(/\s+/g, '')
  let mult = 1
  const suffix = s.match(/(rb|ribu|k|jt|juta)$/)
  if (suffix) {
    mult = suffix[1] === 'jt' || suffix[1] === 'juta' ? 1_000_000 : 1_000
    s = s.slice(0, -suffix[1].length)
  }
  s = s.replace(/[^\d.,]/g, '')
  if (!s) return 0

  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = lastDot > lastComma ? '.' : ','
    const thou = dec === '.' ? ',' : '.'
    s = s.split(thou).join('').replace(dec, '.')
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? '.' : ','
    const parts = s.split(sep)
    const thousands =
      parts.length > 2 || (parts.length === 2 && parts[1].length === 3 && parts[0] !== '0' && parts[0] !== '')
    s = thousands ? parts.join('') : parts.join('.')
  }
  const n = Number(s) * mult
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Tampilkan angka kembali di kolom teks tanpa pemisah (aman untuk diketik ulang). */
export function numberToInput(n?: number): string {
  return n ? String(n) : ''
}

/**
 * Format untuk ditampilkan kembali di kolom (gaya Indonesia: 12.000 · 10,5). Selalu bisa dibaca
 * ulang oleh `parseNumberID` — termasuk tepat 3 desimal, yang diberi nol ekstra ("1,1250")
 * agar tak tertukar dengan pemisah ribuan.
 */
export function formatInputID(n?: number, maxFrac = 4): string {
  if (!n || !Number.isFinite(n)) return ''
  let s = new Intl.NumberFormat('id-ID', { maximumFractionDigits: maxFrac }).format(n)
  const dec = s.split(',')[1]
  if (dec && dec.length === 3) s += '0'
  return s
}
