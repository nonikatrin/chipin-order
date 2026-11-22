import React from 'react'

/**
 * Jaring pengaman render. Sebelum ada ini, satu event cacat (mis. dari berkas cadangan
 * terpotong) membuat computePO melempar di Sidebar/Dashboard → React melepas SELURUH pohon
 * → layar putih di semua rute, termasuk /import & /pengaturan, jadi tak ada jalan pulih
 * dari dalam aplikasi. Sekarang errornya tertahan dan pengguna diberi jalan keluar.
 */
interface Props {
  children: React.ReactNode
  lang?: 'id' | 'en'
}
interface State {
  error: Error | null
}

const STR = {
  id: {
    title: 'Aduh, ada yang tidak beres',
    body: 'Aplikasi gagal menampilkan halaman ini. Data pesanan kamu masih tersimpan.',
    reload: 'Muat ulang halaman',
    home: 'Kembali ke Beranda',
    backup: 'Unduh cadangan data',
    backupHint: 'Simpan dulu cadangannya sebelum mencoba langkah lain.',
    detail: 'Detail teknis',
  },
  en: {
    title: 'Something went wrong',
    body: "The app couldn't render this page. Your order data is still saved.",
    reload: 'Reload the page',
    home: 'Back to Home',
    backup: 'Download a data backup',
    backupHint: 'Save a backup first before trying anything else.',
    detail: 'Technical details',
  },
} as const

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    // Biarkan tetap terlihat di konsol utk diagnosa, tapi jangan sampai menjatuhkan UI.
    console.error('[Chip!n Order] render error ditahan ErrorBoundary:', error)
  }

  /** Cadangan mentah — supaya data bisa diselamatkan walau UI sedang tidak bisa dipakai. */
  downloadBackup = () => {
    try {
      const data: Record<string, string> = {}
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith('chipinorder-')) data[k] = localStorage.getItem(k) ?? ''
      }
      const blob = new Blob([JSON.stringify({ app: 'chipinorder', data }, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `chipinorder-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      /* penyelamatan terbaik yang bisa dilakukan */
    }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const t = STR[this.props.lang ?? 'id']
    return (
      <div className="errboundary">
        <div className="errboundary__card">
          <h1 className="errboundary__title">{t.title}</h1>
          <p className="errboundary__body">{t.body}</p>
          <p className="errboundary__hint">{t.backupHint}</p>
          <div className="errboundary__actions">
            <button type="button" className="btn btn--primary" onClick={this.downloadBackup}>
              {t.backup}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => window.location.reload()}
            >
              {t.reload}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                window.location.href = import.meta.env.BASE_URL
              }}
            >
              {t.home}
            </button>
          </div>
          <details className="errboundary__detail">
            <summary>{t.detail}</summary>
            <pre>{String(error?.message || error)}</pre>
          </details>
        </div>
      </div>
    )
  }
}
