import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import AppBar from '../components/AppBar'
import AccountCard from '../components/AccountCard'
import { Ic } from '../components/icons'
import { useProfileStore } from '../utils/profileStore'
import { useSettingsStore } from '../utils/settingsStore'
import { useLangStore } from '../utils/langStore'
import { useToast } from '../components/Toast'
import { downloadBackup } from '../utils/backup'
import { COMMON_CURRENCIES, currencyName } from '../utils/format'
import type { BusinessProfile } from '../po/types'

const STR = {
  id: {
    title: 'Pengaturan',
    biz: 'Profil Bisnis',
    bizHint: 'Data ini dipakai saat bikin PO dan kirim recap.',
    storeName: 'Nama toko',
    street: 'Nama jalan',
    city: 'Kota',
    province: 'Propinsi',
    contactNumber: 'Nomor kontak',
    email: 'Email',
    currency: 'Mata uang',
    bankName: 'Nama bank',
    bankAccountName: 'Nama rekening',
    bankAccountNumber: 'Nomor rekening',
    prefs: 'Preferensi',
    lang: 'Bahasa',
    stats: 'Statistik',
    vendor: 'Supplier',
    intake: 'Formulir Pesan',
    notes: 'Catatan',
    importFrom: 'Impor dari Chip!n',
    backup: 'Cadangkan Data',
    backupOk: (n: number) => `Cadangan tersimpan — ${n} buku pesanan`,
    backupEmpty: 'Belum ada data untuk dicadangkan',
    danger: 'Zona berbahaya',
    wipe: 'Reset profil',
    saveBtn: 'Simpan Data',
    savedBtn: 'Tersimpan',
    eraseTitle: 'Hapus Semua Data',
    eraseDesc: 'Menghapus permanen semua data',
    saved: 'Profil disimpan',
    wipeDone: 'Profil direset',
  },
  en: {
    title: 'Settings',
    biz: 'Business Profile',
    bizHint: 'This is used when creating POs and sharing recaps.',
    storeName: 'Store name',
    street: 'Street',
    city: 'City',
    province: 'Province',
    contactNumber: 'Contact Number',
    email: 'Email',
    currency: 'Currency',
    bankName: 'Bank name',
    bankAccountName: 'Account name',
    bankAccountNumber: 'Account number',
    prefs: 'Preferences',
    lang: 'Language',
    stats: 'Statistics',
    vendor: 'Supplier',
    intake: 'Order Form',
    notes: 'Notes',
    importFrom: 'Import from Chip!n',
    backup: 'Back Up Data',
    backupOk: (n: number) => `Backup saved — ${n} order book${n === 1 ? '' : 's'}`,
    backupEmpty: 'No data to back up yet',
    danger: 'Danger zone',
    wipe: 'Reset profile',
    saveBtn: 'Save Data',
    savedBtn: 'Saved',
    eraseTitle: 'Erase All Data',
    eraseDesc: 'Permanently deletes all data',
    saved: 'Profile saved',
    wipeDone: 'Profile reset',
  },
} as const

type ProfileFieldKey = keyof BusinessProfile

function QuickLink({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" className="quick-link" onClick={onClick}>
      <span className="quick-link__icon" aria-hidden>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const { currentLang, setLang } = useLangStore()
  const t = STR[currentLang] ?? STR.id
  const toast = useToast()

  const { profile, updateProfile } = useProfileStore()
  const setDefaultCurrency = useSettingsStore((s) => s.setDefaultCurrency)
  const [draft, setDraft] = useState<BusinessProfile>(profile)
  const [confirmWipe, setConfirmWipe] = useState(false)
  const [isSavedState, setIsSavedState] = useState(false)

  const handleSave = () => {
    updateProfile(draft)
    setDefaultCurrency(draft.currency)
    setIsSavedState(true)
    toast.show(t.saved)
  }

  const handleWipe = () => {
    const reset: BusinessProfile = {
      storeName: '',
      street: '',
      city: '',
      province: '',
      whatsappNumber: '',
      email: '',
      currency: 'IDR',
      bankName: '',
      bankAccountName: '',
      bankAccountNumber: '',
    }
    setDraft(reset)
    setConfirmWipe(false)
    setIsSavedState(false)
    toast.show(t.wipeDone)
  }

  const field = (key: ProfileFieldKey, label: string, placeholder = '', type = 'text') => (
    <label key={key} className="field" style={{ display: 'grid', gap: 6 }}>
      <span className="field__label">{label}</span>
      <input
        className="input"
        type={type}
        placeholder={placeholder}
        value={String(draft[key] ?? '')}
        onChange={(event) => {
          setDraft((current) => ({ ...current, [key]: event.target.value }))
          setIsSavedState(false)
        }}
      />
    </label>
  )

  return (
    <>
      <AppBar title={t.title} backTo="/" />

      <main className="page page--settings" style={{ paddingTop: 20 }}>
        <AccountCard />
        <div className="section-label">SECTION 01 — {t.biz}</div>
        <div className="card settings-biz-card">
          <div className="card__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong className="settings-block-title">Business Profile</strong>
              <p className="field__hint" style={{ margin: 0 }}>{t.bizHint}</p>
            </div>
            <button
              type="button"
              className={`btn btn--sm settings-save-btn ${isSavedState ? 'btn--primary' : 'btn--ghost settings-save-btn--clear'}`}
              onClick={handleSave}
            >
              {isSavedState ? `✓ ${t.savedBtn}` : t.saveBtn}
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            {field('storeName', t.storeName)}
            {/* Alamat toko — 3 field: nama jalan (satu baris) + kota & propinsi (dua kolom) */}
            <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 12 }}>
              <label className="field" style={{ display: 'grid', gap: 6 }}>
                <span className="field__label">{t.street}</span>
                <input
                  className="input"
                  placeholder="Jl. …"
                  value={String(draft.street ?? '')}
                  onChange={(event) => {
                    setDraft((current) => ({ ...current, street: event.target.value }))
                    setIsSavedState(false)
                  }}
                />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {field('city', t.city)}
                {field('province', t.province)}
              </div>
            </div>
            {field('whatsappNumber', t.contactNumber, '0812xxxx', 'tel')}
            {field('email', t.email, 'nama@email.com', 'email')}
            <label className="field" style={{ display: 'grid', gap: 6 }}>
              <span className="field__label">{t.currency}</span>
              <select
                className="input input--select"
                value={draft.currency}
                onChange={(event) => {
                  setDraft((current) => ({ ...current, currency: event.target.value as BusinessProfile['currency'] }))
                  setIsSavedState(false)
                }}
              >
                {COMMON_CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {currencyName(code)} ({code})
                  </option>
                ))}
              </select>
            </label>
            <div className="settings-bank-row">
              <div className="settings-bank-row__title settings-block-title">Bank Details</div>
              {field('bankName', t.bankName)}
              {field('bankAccountName', t.bankAccountName)}
              {field('bankAccountNumber', t.bankAccountNumber)}
            </div>
          </div>
        </div>

        {/* Section 02: Preferences */}
<div className="section-label">SECTION 02 — PREFERENCES</div>
<div className="card">
  <div className="msheet__row" style={{ alignItems: 'center', gap: 10 }}>
    <span>{t.lang}</span>
    <select
      className="input input--compact input--select"
      style={{ marginLeft: 'auto', width: '160px' }}
      value={currentLang}
      onChange={(e) => setLang(e.target.value as 'id' | 'en')}
    >
      <option value="id">Indonesia</option>
      <option value="en">English</option>
    </select>
  </div>
</div>

        <div className="section-label" style={{ marginTop: 24 }}>SECTION 03 — QUICK LINKS</div>
        <div className="card">
          <div className="quick-links">
            <QuickLink icon={Ic.barChart} label={t.stats} onClick={() => navigate('/stats')} />
            <QuickLink icon={Ic.inbox} label={t.intake} onClick={() => navigate('/intake')} />
            <QuickLink icon={Ic.bank} label={t.vendor} onClick={() => navigate('/supplier')} />
            <QuickLink icon={Ic.edit} label={t.notes} onClick={() => navigate('/catatan')} />
            <QuickLink icon={Ic.download} label={t.importFrom} onClick={() => navigate('/import')} />
            <QuickLink
              icon={Ic.copy}
              label={t.backup}
              onClick={() => {
                const { count } = downloadBackup()
                toast.show(count > 0 ? t.backupOk(count) : t.backupEmpty)
              }}
            />
          </div>
        </div>

        <div className="section-label" style={{ marginTop: 24, color: 'var(--bad)' }}>SECTION 04 — {t.danger}</div>
        <div className="card card--danger">
          {!confirmWipe ? (
            <div className="settings-reset-row">
              <div className="settings-reset-head">
                <strong className="settings-reset-title">{t.eraseTitle}</strong>
                <p className="settings-reset-desc">{t.eraseDesc}</p>
              </div>
              <button type="button" className="msheet__row settings-reset-btn" onClick={() => setConfirmWipe(true)}>
                <span className="settings-reset-btn__icon" aria-hidden>{Ic.trash}</span>
                <span className="settings-reset-btn__copy">
                  <strong>{t.wipe}</strong>
                </span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              <div className="field__hint">This will clear the current profile draft.</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirmWipe(false)}>
                  Cancel
                </button>
                <button type="button" className="btn btn--warm btn--sm" onClick={handleWipe}>
                  Reset
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  )
}