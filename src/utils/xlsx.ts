/**
 * Penulis .xlsx minimal — TANPA dependensi.
 *
 * Proyek ini sengaja hanya bergantung pada react/router/zustand, jadi pustaka spreadsheet
 * bukan pilihan. Untungnya .xlsx hanyalah berkas ZIP berisi XML: di sini ZIP ditulis dengan
 * metode "store" (tanpa kompresi) sehingga tak perlu deflate sama sekali. Hasilnya berkas
 * .xlsx asli yang bisa dibuka Excel, Numbers, maupun Google Sheets.
 */

export type CellValue = string | number | null | undefined

export interface Cell {
  v: CellValue
  /** Gaya bawaan: judul besar, tebal, uang, tebal+uang, atau teks miring abu. */
  s?: 'title' | 'head' | 'money' | 'moneyBold' | 'bold' | 'muted'
}

export type Row = (Cell | CellValue)[]

export interface Sheet {
  name: string
  rows: Row[]
  /** Lebar kolom (karakter). */
  cols?: number[]
}

// ---------------------------------------------------------------- ZIP (store)

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c >>> 0
  }
  return t
})()

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

interface ZipEntry {
  name: string
  data: Uint8Array
}

function zipStore(entries: ZipEntry[]): Blob {
  const enc = new TextEncoder()
  const chunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  const u16 = (n: number) => [n & 0xff, (n >>> 8) & 0xff]
  const u32 = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]

  for (const e of entries) {
    const nameBytes = enc.encode(e.name)
    const crc = crc32(e.data)
    const size = e.data.length

    const local = new Uint8Array([
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), // waktu/tanggal — tak dipakai
      ...u32(crc), ...u32(size), ...u32(size),
      ...u16(nameBytes.length), ...u16(0),
      ...nameBytes,
    ])
    chunks.push(local, e.data)

    central.push(new Uint8Array([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0),
      ...u32(crc), ...u32(size), ...u32(size),
      ...u16(nameBytes.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0), ...u32(offset),
      ...nameBytes,
    ]))
    offset += local.length + size
  }

  const centralSize = central.reduce((s, c) => s + c.length, 0)
  const end = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(entries.length), ...u16(entries.length),
    ...u32(centralSize), ...u32(offset), ...u16(0),
  ])

  // Disatukan ke satu buffer supaya tipenya pasti Uint8Array<ArrayBuffer> (BlobPart yang sah).
  const all = [...chunks, ...central, end]
  const total = all.reduce((s, c) => s + c.length, 0)
  const out = new Uint8Array(total)
  let at = 0
  for (const c of all) {
    out.set(c, at)
    at += c.length
  }
  return new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

// ---------------------------------------------------------------- XML sheet

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Excel menolak karakter kontrol; buang agar berkas tak dianggap rusak.
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
}

function colName(i: number): string {
  let s = ''
  let n = i + 1
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

const STYLE_ID: Record<NonNullable<Cell['s']>, number> = {
  title: 1,
  head: 2,
  money: 3,
  moneyBold: 4,
  bold: 5,
  muted: 6,
}

function cellXml(ref: string, cell: Cell): string {
  const style = cell.s ? ` s="${STYLE_ID[cell.s]}"` : ''
  const v = cell.v
  if (v == null || v === '') return `<c r="${ref}"${style}/>`
  if (typeof v === 'number' && Number.isFinite(v)) {
    // Biaya basis-persen menghasilkan galat IEEE754 (16.99 × 0.3 = 5.0969999999999995).
    // Dibulatkan ke 6 desimal: cukup untuk membuang derau, tanpa memangkas presisi
    // asli seperti 11.893 yang memang dipakai pada harga satuan bagi-hasil.
    const n = Math.round(v * 1e6) / 1e6
    return `<c r="${ref}"${style}><v>${n}</v></c>`
  }
  return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`
}

function sheetXml(sheet: Sheet): string {
  const cols = sheet.cols?.length
    ? `<cols>${sheet.cols
        .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
        .join('')}</cols>`
    : ''
  const rows = sheet.rows
    .map((row, ri) => {
      const cells = row
        .map((c, ci) => {
          const cell: Cell = c != null && typeof c === 'object' && 'v' in c ? (c as Cell) : { v: c as CellValue }
          return cellXml(colName(ci) + (ri + 1), cell)
        })
        .join('')
      return `<row r="${ri + 1}">${cells}</row>`
    })
    .join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${rows}</sheetData></worksheet>`
}

/** Nama sheet Excel: maks 31 karakter, tanpa : \ / ? * [ ] */
function safeSheetName(name: string, i: number): string {
  const s = name.replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31)
  return s || `Sheet${i + 1}`
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts>
<fonts count="5">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="14"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
<font><i/><sz val="10"/><color rgb="FF888888"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF4722B"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="7">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="4" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="2" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
</styleSheet>`

/** Rangkai sheet menjadi satu Blob .xlsx. */
export function buildXlsx(sheets: Sheet[]): Blob {
  const enc = new TextEncoder()
  const named = sheets.map((s, i) => ({ ...s, name: safeSheetName(s.name, i) }))

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${named.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n')}
</Types>`

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${named.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
</workbook>`

  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${named.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('\n')}
<Relationship Id="rId${named.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`

  const entries: ZipEntry[] = [
    { name: '[Content_Types].xml', data: enc.encode(contentTypes) },
    { name: '_rels/.rels', data: enc.encode(rootRels) },
    { name: 'xl/workbook.xml', data: enc.encode(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', data: enc.encode(wbRels) },
    { name: 'xl/styles.xml', data: enc.encode(STYLES_XML) },
    ...named.map((s, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: enc.encode(sheetXml(s)),
    })),
  ]
  return zipStore(entries)
}

/** Unduh workbook sebagai berkas. */
export function downloadXlsx(sheets: Sheet[], filename: string): void {
  const blob = buildXlsx(sheets)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
