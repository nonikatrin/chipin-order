import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * FAQ yang bisa diedit penjual (Path C). Sebagian besar pertanyaan terjawab dari data
 * (harga/kuota/pickup-delivery/deadline/alergen) — item ini yang ikut ditempel ke tautan
 * formulir. Pertanyaan di luar FAQ = "tangkap & tunda" (dijawab manual), jangan menebak.
 */
export interface FaqItem {
  id: string
  q: string
  a: string
}

interface FaqState {
  items: FaqItem[]
  add: (q: string, a: string) => void
  update: (id: string, patch: Partial<Pick<FaqItem, 'q' | 'a'>>) => void
  remove: (id: string) => void
  seed: (items: { q: string; a: string }[]) => void
}

const fid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

export const useFaqStore = create<FaqState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (q, a) =>
        set({ items: [...get().items, { id: fid(), q: q.trim(), a: a.trim() }] }),
      update: (id, patch) =>
        set({
          items: get().items.map((it) =>
            it.id === id ? { ...it, ...patch, q: (patch.q ?? it.q).trim(), a: (patch.a ?? it.a).trim() } : it,
          ),
        }),
      remove: (id) => set({ items: get().items.filter((it) => it.id !== id) }),
      // Isi hanya bila kosong (jangan timpa editan penjual).
      seed: (items) =>
        set((s) =>
          s.items.length > 0
            ? s
            : { items: items.map((it) => ({ id: fid(), q: it.q.trim(), a: it.a.trim() })) },
        ),
    }),
    { name: 'chipinorder-faq' },
  ),
)
