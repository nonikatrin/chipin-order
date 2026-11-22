import { useEffect, useState } from 'react'
import type { POMenu } from '../po/types'

/**
 * Ubin ikon menu: foto (thumbnail data-URL) bila ada, selain itu emoji.
 * Foto rusak/terpotong (data-URL tak valid) dulu tampil sebagai ikon "gambar rusak" —
 * termasuk di flyer yang dicetak. Sekarang jatuh kembali ke emoji, yang selalu ada.
 */
export function MenuThumb({ menu }: { menu: Pick<POMenu, 'emoji' | 'photo' | 'name'> }) {
  const [failed, setFailed] = useState(false)

  // Ganti foto → beri kesempatan foto baru dimuat.
  useEffect(() => setFailed(false), [menu.photo])

  if (menu.photo && !failed) {
    return (
      <img
        src={menu.photo}
        alt={menu.name}
        className="cat-badge menu-thumb"
        onError={() => setFailed(true)}
      />
    )
  }
  return <div className="cat-badge">{menu.emoji}</div>
}
