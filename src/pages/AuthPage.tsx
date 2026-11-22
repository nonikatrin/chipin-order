import { useState, type FormEvent } from 'react'
import { supabase } from '../cloud/supabase'
import { useLangStore } from '../utils/langStore'
import { useProfileStore } from '../utils/profileStore'
import brandLogo from '../assets/branding/chipin-order-lockup.jpg'

const STR = {
  id: {
    signIn: 'Masuk',
    signUp: 'Daftar',
    titleIn: 'Masuk ke akun penjual',
    titleUp: 'Buat akun penjual',
    subIn: 'Data PO kamu tersimpan aman di akunmu dan bisa dibuka dari HP atau laptop mana saja.',
    subUp: 'Gratis. Data PO tersimpan di akunmu dan tetap bisa dipakai saat sinyal hilang.',
    email: 'Email',
    password: 'Kata sandi',
    passwordHint: 'Minimal 8 karakter.',
    store: 'Nama usaha / komunitas',
    storePh: 'mis. Dapur Bu Rina',
    optional: 'opsional',
    show: 'Lihat',
    hide: 'Sembunyikan',
    submitIn: 'Masuk',
    submitUp: 'Buat akun',
    working: 'Sebentar…',
    noAccount: 'Belum punya akun?',
    haveAccount: 'Sudah punya akun?',
    forgot: 'Lupa kata sandi? Hubungi admin Chip!n Order untuk mengatur ulang.',
    errInvalid: 'Email atau kata sandi salah.',
    errExists: 'Email ini sudah terdaftar — silakan masuk.',
    errWeak: 'Kata sandi terlalu pendek (minimal 8 karakter).',
    errEmail: 'Format email belum benar.',
    errNetwork: 'Tidak ada koneksi. Periksa internet lalu coba lagi.',
    errRate: 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.',
    errGeneric: 'Gagal masuk. Coba lagi sebentar lagi.',
    checkEmail: 'Akun dibuat. Cek email untuk konfirmasi, lalu masuk.',
  },
  en: {
    signIn: 'Sign in',
    signUp: 'Sign up',
    titleIn: 'Sign in to your seller account',
    titleUp: 'Create a seller account',
    subIn: 'Your PO data is stored safely in your account and opens on any phone or laptop.',
    subUp: 'Free. Your PO data lives in your account and still works when the signal drops.',
    email: 'Email',
    password: 'Password',
    passwordHint: 'At least 8 characters.',
    store: 'Business / community name',
    storePh: 'e.g. Rina’s Kitchen',
    optional: 'optional',
    show: 'Show',
    hide: 'Hide',
    submitIn: 'Sign in',
    submitUp: 'Create account',
    working: 'One moment…',
    noAccount: 'No account yet?',
    haveAccount: 'Already have an account?',
    forgot: 'Forgot your password? Contact the Chip!n Order admin to reset it.',
    errInvalid: 'Wrong email or password.',
    errExists: 'This email is already registered — please sign in.',
    errWeak: 'Password is too short (at least 8 characters).',
    errEmail: 'That email address doesn’t look right.',
    errNetwork: 'No connection. Check your internet and try again.',
    errRate: 'Too many attempts. Wait a moment and try again.',
    errGeneric: 'Couldn’t sign in. Please try again shortly.',
    checkEmail: 'Account created. Check your email to confirm, then sign in.',
  },
} as const

type Mode = 'in' | 'up'
type T = (typeof STR)['id'] | (typeof STR)['en']

/** Pesan galat Supabase → kalimat yang dimengerti penjual. */
function friendlyError(err: { message?: string; status?: number; code?: string }, t: T): string {
  const m = (err.message || '').toLowerCase()
  const code = err.code || ''
  if (code === 'invalid_credentials' || m.includes('invalid login')) return t.errInvalid
  if (code === 'user_already_exists' || m.includes('already registered')) return t.errExists
  if (code === 'weak_password' || m.includes('password should be')) return t.errWeak
  if (code === 'email_address_invalid' || m.includes('invalid format') || m.includes('email address')) return t.errEmail
  if (code === 'over_request_rate_limit' || err.status === 429) return t.errRate
  if (m.includes('fetch') || m.includes('network')) return t.errNetwork
  return t.errGeneric
}

export default function AuthPage() {
  const { currentLang, toggleLanguage } = useLangStore()
  const t: T = STR[currentLang] ?? STR.id
  const updateProfile = useProfileStore((s) => s.updateProfile)
  const [mode, setMode] = useState<Mode>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [store, setStore] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const switchMode = (m: Mode) => {
    setMode(m)
    setError('')
    setInfo('')
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!supabase || busy) return
    setError('')
    setInfo('')
    if (mode === 'up' && password.length < 8) return setError(t.errWeak)
    setBusy(true)
    try {
      if (mode === 'in') {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (err) setError(friendlyError(err, t))
      } else {
        const { data, error: err } = await supabase.auth.signUp({ email: email.trim(), password })
        if (err) setError(friendlyError(err, t))
        // Nama usaha HANYA disimpan setelah akun jadi — kalau gagal, profil lokal jangan berubah
        // (profil "tidak default" dianggap data lokal dan akan menimpa profil akun yang sudah ada).
        else if (store.trim()) updateProfile({ storeName: store.trim().slice(0, 60) })
        if (!err && !data.session) {
          setInfo(t.checkEmail)
          setMode('in')
        }
      }
    } catch (err) {
      setError(friendlyError(err as Error, t))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login auth">
      <div className="login__card card auth__card">
        <div className="login__head">
          <img src={brandLogo} alt="Chip!n Order" className="login__brand" style={{ mixBlendMode: 'multiply' }} />
          <button type="button" className="lang-chip" onClick={toggleLanguage} aria-label="Ganti bahasa / Switch language">
            {currentLang.toUpperCase()}
          </button>
        </div>

        <div className="auth__tabs" role="tablist">
          {(['in', 'up'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              className={'auth__tab' + (mode === m ? ' is-on' : '')}
              onClick={() => switchMode(m)}
            >
              {m === 'in' ? t.signIn : t.signUp}
            </button>
          ))}
        </div>

        <h1 className="login__title">{mode === 'in' ? t.titleIn : t.titleUp}</h1>
        <p className="auth__sub">{mode === 'in' ? t.subIn : t.subUp}</p>

        <form className="auth__form" onSubmit={submit} noValidate>
          {mode === 'up' && (
            <label className="auth__field">
              <span>
                {t.store} <em>({t.optional})</em>
              </span>
              <input
                className="input"
                value={store}
                maxLength={60}
                placeholder={t.storePh}
                autoComplete="organization"
                onChange={(e) => setStore(e.target.value)}
              />
            </label>
          )}
          <label className="auth__field">
            <span>{t.email}</span>
            <input
              className="input"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="auth__field">
            <span>{t.password}</span>
            <div className="auth__pw">
              <input
                className="input"
                type={showPw ? 'text' : 'password'}
                autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                required
                minLength={mode === 'up' ? 8 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" className="auth__pw-toggle" onClick={() => setShowPw((v) => !v)} aria-pressed={showPw}>
                {showPw ? t.hide : t.show}
              </button>
            </div>
            {mode === 'up' && <small className="auth__hint">{t.passwordHint}</small>}
          </label>

          {error && (
            <p className="login__error" role="alert">
              {error}
            </p>
          )}
          {info && (
            <p className="auth__info" role="status">
              {info}
            </p>
          )}

          <button type="submit" className="btn btn--primary auth__submit" disabled={busy || !email.trim() || !password}>
            {busy ? t.working : mode === 'in' ? t.submitIn : t.submitUp}
          </button>
        </form>

        <p className="auth__switch">
          {mode === 'in' ? t.noAccount : t.haveAccount}{' '}
          <button type="button" onClick={() => switchMode(mode === 'in' ? 'up' : 'in')}>
            {mode === 'in' ? t.signUp : t.signIn}
          </button>
        </p>
        {mode === 'in' && <p className="auth__hint auth__forgot">{t.forgot}</p>}
      </div>
    </main>
  )
}
