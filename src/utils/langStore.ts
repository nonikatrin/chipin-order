import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Language } from './i18n'

interface LangState {
  currentLang: Language
  setLang: (lang: Language) => void
  toggleLanguage: () => void
}

/** Sumber tunggal bahasa aplikasi (id / en), disimpan agar pilihan diingat. */
export const useLangStore = create<LangState>()(
  persist(
    (set, get) => ({
      currentLang: 'id',
      setLang: (lang) => set({ currentLang: lang }),
      toggleLanguage: () =>
        set({ currentLang: get().currentLang === 'id' ? 'en' : 'id' }),
    }),
    { name: 'chipinorder-lang' },
  ),
)
