/**
 * Foto menu disimpan local-first sebagai data-URL thumbnail kecil di dalam
 * store PO (localStorage) — karena itu WAJIB dikecilkan dulu. Persegi 128px
 * JPEG ±6–12 KB per foto; emoji tetap jadi fallback ikon (dipakai teks WA).
 */
export const MENU_PHOTO_SIZE = 128

export async function fileToThumb(file: File, size = MENU_PHOTO_SIZE): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('Gagal membaca gambar'))
      i.src = url
    })
    // Crop tengah ke persegi, lalu skala ke `size`.
    const s = Math.min(img.naturalWidth, img.naturalHeight)
    const sx = (img.naturalWidth - s) / 2
    const sy = (img.naturalHeight - s) / 2
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas tidak tersedia')
    ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size)
    return canvas.toDataURL('image/jpeg', 0.75)
  } finally {
    URL.revokeObjectURL(url)
  }
}
