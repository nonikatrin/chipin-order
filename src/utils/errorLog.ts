import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Catatan error sisi-klien (local-first) untuk laporan developer.
 * Diisi oleh handler global di main.tsx; ditampilkan di halaman /dev.
 * Hanya error di perangkat ini — tidak ada agregasi lintas pengguna (tanpa backend).
 */
export interface LoggedError {
  id: string
  message: string
  stack?: string
  source?: string // 'error' | 'unhandledrejection' | 'manual'
  at: number
}

const CAP = 50 // simpan 50 error terbaru saja

interface ErrorLogState {
  errors: LoggedError[]
  add: (e: Pick<LoggedError, 'message'> & Partial<LoggedError>) => void
  clear: () => void
}

const newId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

export const useErrorLog = create<ErrorLogState>()(
  persist(
    (set, get) => ({
      errors: [],
      add: (e) => {
        const entry: LoggedError = {
          id: newId(),
          message: e.message,
          stack: e.stack,
          source: e.source ?? 'manual',
          at: e.at ?? Date.now(),
        }
        set({ errors: [entry, ...get().errors].slice(0, CAP) })
      },
      clear: () => set({ errors: [] }),
    }),
    { name: 'chipinorder-errors' },
  ),
)

/** Pasang handler global sekali saat startup (dipanggil dari main.tsx). */
export function installErrorCapture(): void {
  if (typeof window === 'undefined') return
  const add = (msg: string, stack: string | undefined, source: string) =>
    useErrorLog.getState().add({ message: msg, stack, source })

  window.addEventListener('error', (ev) => {
    const where = ev.filename ? ` (${ev.filename}:${ev.lineno})` : ''
    add((ev.message || 'Unknown error') + where, ev.error?.stack, 'error')
  })
  window.addEventListener('unhandledrejection', (ev) => {
    const reason = ev.reason
    const msg =
      reason instanceof Error ? reason.message : String(reason ?? 'Unhandled rejection')
    add(msg, reason instanceof Error ? reason.stack : undefined, 'unhandledrejection')
  })
}
