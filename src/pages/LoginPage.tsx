import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePOStore } from '../po/store'
import {
  useOperatorStore,
  hashPin,
  isValidPin,
  PIN_MAX,
  PIN_MIN,
} from '../utils/operatorStore'
import { useLangStore } from '../utils/langStore'
import brandLogo from '../assets/branding/chipin-order-lockup.jpg'

const STR = {
  id: {
    who: 'Siapa yang bertugas?',
    pin: 'Masukkan PIN',
    start: 'Mulai',
    wrongPin: 'PIN salah — coba lagi.',
    setupTitle: 'Buat operator pertama',
    setupDesc: 'Login aktif setelah operator pertama dibuat. Kelola operator lain di Pengaturan.',
    name: 'Nama',
    newPin: `PIN (${PIN_MIN}–${PIN_MAX} angka)`,
    confirmPin: 'Ulangi PIN',
    create: 'Buat & Masuk',
    pinRule: `PIN harus ${PIN_MIN}–${PIN_MAX} angka.`,
    pinMismatch: 'PIN tidak sama.',
    nameNeeded: 'Isi nama dulu.',
    softLock: 'PIN adalah kunci lunak antar-operator di perangkat ini — bukan enkripsi data.',
  },
  en: {
    who: 'Who is on duty?',
    pin: 'Enter PIN',
    start: 'Start',
    wrongPin: 'Wrong PIN — try again.',
    setupTitle: 'Create the first operator',
    setupDesc: 'Login turns on once the first operator exists. Manage more operators in Settings.',
    name: 'Name',
    newPin: `PIN (${PIN_MIN}–${PIN_MAX} digits)`,
    confirmPin: 'Repeat PIN',
    create: 'Create & Sign in',
    pinRule: `PIN must be ${PIN_MIN}–${PIN_MAX} digits.`,
    pinMismatch: 'PINs do not match.',
    nameNeeded: 'Enter a name first.',
    softLock: 'The PIN is a soft lock between operators on this device — not data encryption.',
  },
} as const

export default function LoginPage() {
  const navigate = useNavigate()
  const { currentLang, toggleLanguage } = useLangStore()
  const t = STR[currentLang] ?? STR.id

  const operators = useOperatorStore((s) => s.operators)
  const addOperator = useOperatorStore((s) => s.addOperator)
  const setOperator = usePOStore((s) => s.setOperator)

  const [selectedId, setSelectedId] = useState<string | null>(operators[0]?.id ?? null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  // Form setup operator pertama
  const [newName, setNewName] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')

  const selected = operators.find((o) => o.id === selectedId) ?? operators[0]

  function pressDigit(d: string) {
    setError('')
    setPin((p) => (p.length < PIN_MAX ? p + d : p))
  }

  async function submitPin(candidate: string) {
    if (!selected || candidate.length < PIN_MIN) return
    if ((await hashPin(candidate)) === selected.pinHash) {
      setOperator(selected.id, selected.name)
      navigate('/', { replace: true })
    } else {
      setError(t.wrongPin)
      setPin('')
    }
  }

  async function createFirst() {
    if (!newName.trim()) return setError(t.nameNeeded)
    if (!isValidPin(newPin)) return setError(t.pinRule)
    if (newPin !== confirmPin) return setError(t.pinMismatch)
    const op = addOperator(newName, await hashPin(newPin))
    setOperator(op.id, op.name)
    navigate('/', { replace: true })
  }

  return (
    <main className="login">
      <div className="login__card card">
        <div className="login__head">
          <img
            src={brandLogo}
            alt="Chip!n Order"
            className="login__brand"
            style={{ mixBlendMode: 'multiply' }}
          />
          <button
            type="button"
            className="lang-chip"
            onClick={toggleLanguage}
            aria-label="Ganti bahasa / Switch language"
          >
            {currentLang.toUpperCase()}
          </button>
        </div>

        {operators.length === 0 ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void createFirst()
            }}
          >
            <h1 className="login__title">{t.setupTitle}</h1>
            <p className="muted" style={{ marginTop: 4 }}>{t.setupDesc}</p>

            <label className="field" style={{ display: 'grid', gap: 6, marginTop: 14 }}>
              <span className="field__label">{t.name}</span>
              <input
                className="input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
            </label>
            <label className="field" style={{ display: 'grid', gap: 6, marginTop: 10 }}>
              <span className="field__label">{t.newPin}</span>
              <input
                className="input"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={PIN_MAX}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              />
            </label>
            <label className="field" style={{ display: 'grid', gap: 6, marginTop: 10 }}>
              <span className="field__label">{t.confirmPin}</span>
              <input
                className="input"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={PIN_MAX}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              />
            </label>

            {error && <p className="login__error">{error}</p>}

            <button type="submit" className="btn btn--primary" style={{ marginTop: 16 }}>
              {t.create}
            </button>
            <p className="field__hint" style={{ marginTop: 10 }}>{t.softLock}</p>
          </form>
        ) : (
          <>
            <h1 className="login__title">{t.who}</h1>
            <div className="login__ops" role="radiogroup" aria-label={t.who}>
              {operators.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={o.id === selected?.id}
                  className={'login__op' + (o.id === selected?.id ? ' is-active' : '')}
                  onClick={() => {
                    setSelectedId(o.id)
                    setPin('')
                    setError('')
                  }}
                >
                  {o.name}
                </button>
              ))}
            </div>

            <div className="section-label" style={{ marginTop: 16 }}>{t.pin}</div>
            <div className="login__dots" aria-label={t.pin}>
              {Array.from({ length: PIN_MAX }, (_, i) => (
                <span
                  key={i}
                  className={'login__dot' + (i < pin.length ? ' is-filled' : '')}
                />
              ))}
            </div>
            {error && <p className="login__error">{error}</p>}

            <div className="keypad" style={{ marginTop: 12 }}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <button key={d} type="button" onClick={() => pressDigit(d)}>
                  {d}
                </button>
              ))}
              <button
                type="button"
                className="key--action"
                onClick={() => {
                  setPin('')
                  setError('')
                }}
              >
                C
              </button>
              <button type="button" onClick={() => pressDigit('0')}>
                0
              </button>
              <button
                type="button"
                className="key--action"
                aria-label="Hapus satu angka"
                onClick={() => setPin((p) => p.slice(0, -1))}
              >
                ⌫
              </button>
            </div>

            <button
              type="button"
              className="btn btn--primary"
              style={{ marginTop: 14 }}
              disabled={pin.length < PIN_MIN}
              onClick={() => void submitPin(pin)}
            >
              {t.start}
            </button>
          </>
        )}
      </div>
    </main>
  )
}
