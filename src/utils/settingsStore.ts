import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Ukuran teks dasar: kecil · sedang (bawaan) · besar. */
export type TextSize = 'small' | 'normal' | 'large'

interface SettingsState {
  /** Ukuran teks dasar — menyetel `font-size` pada :root (semua rem ikut). */
  textSize: TextSize
  setTextSize: (s: TextSize) => void
  /** Notifikasi pengingat (disimpan lokal; reminder dijadwalkan di perangkat). */
  notifications: boolean
  setNotifications: (v: boolean) => void
  toggleNotifications: () => void
  /** Mata uang default untuk form buat baru (kode ISO 4217). */
  defaultCurrency: string
  setDefaultCurrency: (code: string) => void
}

/**
 * Preferensi tampilan (local-first), key `chipinorder-settings`.
 * `textSize` menyetel font dasar → semua ukuran berbasis rem ikut menyesuaikan
 * (kecil/sedang/besar agar nyaman untuk semua usia, bukan hanya lansia).
 * `notifications` & `defaultCurrency` disimpan agar diingat antar sesi.
 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      textSize: 'normal',
      setTextSize: (s) => set({ textSize: s }),
      notifications: true,
      setNotifications: (v) => set({ notifications: v }),
      toggleNotifications: () => set((st) => ({ notifications: !st.notifications })),
      defaultCurrency: 'IDR',
      setDefaultCurrency: (code) => set({ defaultCurrency: code }),
    }),
    {
      name: 'chipinorder-settings',
      version: 1,
      // v0 hanya punya `largeText: boolean` → petakan ke `textSize`.
      migrate: (persisted, version) => {
        const s = (persisted ?? {}) as Record<string, unknown>
        if (version < 1) {
          s.textSize = s.largeText ? 'large' : 'normal'
          delete s.largeText
        }
        return s as unknown as SettingsState
      },
    },
  ),
)

/** Piksel font dasar per ukuran ('' = pakai bawaan 20px dari :root). */
export const TEXT_SIZE_PX: Record<TextSize, string> = {
  small: '17px',
  normal: '',
  large: '25px',
}
