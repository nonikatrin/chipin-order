import { create } from 'zustand'

/** Aksi opsional pada toast (mis. "Urungkan"/Undo). */
interface ToastAction {
  label: string
  run: () => void
}

interface ToastState {
  message: string | null
  action: ToastAction | null
  /**
   * Tampilkan toast. Beri `action` untuk menyelipkan tombol (mis. Undo);
   * toast beraksi bertahan lebih lama (5 dtk) agar sempat ditekan.
   */
  show: (msg: string, action?: ToastAction) => void
  clear: () => void
}

let timer: ReturnType<typeof setTimeout> | undefined

export const useToast = create<ToastState>((set) => ({
  message: null,
  action: null,
  show: (msg, action) => {
    set({ message: msg, action: action ?? null })
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => set({ message: null, action: null }), action ? 5000 : 2400)
  },
  clear: () => {
    if (timer) clearTimeout(timer)
    set({ message: null, action: null })
  },
}))

export function Toaster() {
  const message = useToast((s) => s.message)
  const action = useToast((s) => s.action)
  const clear = useToast((s) => s.clear)
  if (!message) return null
  return (
    <div className="toast" role="status" aria-live="polite">
      <span className="toast__msg">{message}</span>
      {action && (
        <button
          type="button"
          className="toast__action"
          onClick={() => {
            action.run()
            clear()
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
