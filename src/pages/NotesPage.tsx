import { useState } from 'react'
import AppBar from '../components/AppBar'
import { useLangStore } from '../utils/langStore'

/** Catatan bebas organizer (local-first, key `chipinorder-notes`) — tersimpan saat mengetik. */
const NOTES_KEY = 'chipinorder-notes'

const STR = {
  id: {
    title: 'Catatan',
    ph: 'Tulis apa saja: daftar belanja, janji supplier, ide menu minggu depan…',
    hint: 'Tersimpan otomatis di perangkat ini.',
  },
  en: {
    title: 'Notes',
    ph: 'Write anything: shopping list, supplier promises, next week menu ideas…',
    hint: 'Saved automatically on this device.',
  },
} as const

export default function NotesPage() {
  const { currentLang } = useLangStore()
  const t = STR[currentLang]
  const [text, setText] = useState(() => localStorage.getItem(NOTES_KEY) ?? '')

  return (
    <>
      <AppBar title={t.title} backTo="/" />
      <main className="page" style={{ paddingTop: 20 }}>
        <textarea
          className="input"
          style={{ minHeight: '55vh', resize: 'vertical', lineHeight: 1.5 }}
          placeholder={t.ph}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            localStorage.setItem(NOTES_KEY, e.target.value)
          }}
        />
        <p className="field__hint" style={{ marginTop: 8 }}>
          ✓ {t.hint}
        </p>
      </main>
    </>
  )
}
