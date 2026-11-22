import { useNavigate } from 'react-router-dom'
import { useLangStore } from '../utils/langStore'

interface AppBarProps {
  title: string
  subtitle?: string
  /** Tampilkan tombol kembali. Default: true */
  back?: boolean
  /** Tujuan tombol kembali; default: histori sebelumnya. */
  backTo?: string
  /** Handler kembali kustom — dipakai bila back harus batal aksi in-page (bukan navigasi). */
  onBack?: () => void
  /** Aksi di kanan (opsional) — mis. tombol kelola anggota. */
  action?: React.ReactNode
}

export default function AppBar({
  title,
  subtitle,
  back = true,
  backTo,
  onBack,
  action,
}: AppBarProps) {
  const navigate = useNavigate()
  const { currentLang, toggleLanguage } = useLangStore()

  return (
    <header className="appbar">
      {back && (
        <button
          type="button"
          className="iconbtn"
          aria-label="Kembali"
          onClick={() => (onBack ? onBack() : backTo ? navigate(backTo) : navigate(-1))}
        >
          ‹
        </button>
      )}
      <div className="appbar__title">
        {title}
        {subtitle && <div className="appbar__sub">{subtitle}</div>}
      </div>
      {action}
      <button
        type="button"
        className="iconbtn"
        style={{ fontSize: '0.95rem', fontWeight: 800 }}
        aria-label="Ganti bahasa / Switch language"
        onClick={toggleLanguage}
      >
        {currentLang.toUpperCase()}
      </button>
    </header>
  )
}
