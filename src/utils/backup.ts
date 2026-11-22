/**
 * Cadangan data Chip!n Order.
 *
 * Aplikasi ini local-first: seluruh data hidup di localStorage, yang terikat pada SATU
 * peramban dan SATU origin. Tanpa berkas cadangan, membersihkan data situs = kehilangan
 * semua PO, dan tak ada cara memindahkan arsip ke perangkat lain. Sebelumnya aplikasi
 * hanya bisa MENGIMPOR dari Chip!n, tapi tak bisa mengeluarkan datanya sendiri.
 *
 * Bentuk berkas sengaja dibuat sama dengan cadangan Chip!n supaya `/import` yang sudah
 * ada bisa membacanya kembali (lihat pages/ImportPage.tsx):
 *
 *   { app: 'chipin-order', version: 1, exportedAt: '<ISO>', data: { '<key>': '<json>' } }
 */

/** Kunci localStorage milik aplikasi. Semua diawali `chipinorder-`. */
const BACKUP_KEYS = [
  'chipinorder-po-v1', // PO, menu, pemesan — inti data
  'chipinorder-profile', // profil usaha
  'chipinorder-settings',
  'chipinorder-lang',
  'chipinorder-notes',
  'chipinorder-faq',
  'chipinorder-flyer-accent',
] as const

export interface BackupFile {
  app: 'chipin-order'
  version: number
  exportedAt: string
  data: Record<string, string>
}

/** Kumpulkan seluruh kunci aplikasi yang ada menjadi satu objek cadangan. */
export function buildBackup(): BackupFile {
  const data: Record<string, string> = {}
  for (const key of BACKUP_KEYS) {
    const raw = localStorage.getItem(key)
    if (raw != null) data[key] = raw
  }
  return {
    app: 'chipin-order',
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  }
}

/** Berapa PO yang ikut tersalin — dipakai untuk pesan konfirmasi yang jujur. */
export function backupEventCount(backup: BackupFile): number {
  try {
    const raw = backup.data['chipinorder-po-v1']
    if (!raw) return 0
    const events = JSON.parse(raw)?.state?.events
    return Array.isArray(events) ? events.length : 0
  } catch {
    return 0
  }
}

/** Unduh cadangan sebagai .json bertanggal. */
export function downloadBackup(): { count: number; filename: string } {
  const backup = buildBackup()
  const count = backupEventCount(backup)
  const stamp = new Date().toISOString().slice(0, 10)
  const filename = `chipin-order-backup-${stamp}.json`

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)

  return { count, filename }
}
