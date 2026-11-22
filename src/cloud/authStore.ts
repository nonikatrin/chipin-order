import { create } from 'zustand'
import { supabase } from './supabase'
import { startSync, stopSync } from './sync'

export type AuthStatus = 'loading' | 'signed-out' | 'signed-in'

interface AuthState {
  status: AuthStatus
  userId: string | null
  email: string | null
}

export const useAuthStore = create<AuthState>(() => ({
  status: supabase ? 'loading' : 'signed-out',
  userId: null,
  email: null,
}))

let started = false

/** Dipanggil sekali saat aplikasi mulai: pulihkan sesi & ikuti perubahan masuk/keluar. */
export function initAuth() {
  if (!supabase || started) return
  started = true
  const apply = (session: { user: { id: string; email?: string | null } } | null) => {
    if (session) {
      useAuthStore.setState({ status: 'signed-in', userId: session.user.id, email: session.user.email ?? null })
      void startSync(session.user.id)
    } else {
      stopSync()
      useAuthStore.setState({ status: 'signed-out', userId: null, email: null })
    }
  }
  void supabase.auth.getSession().then(({ data }) => apply(data.session))
  // Callback auth Supabase tak boleh menunggu panggilan Supabase lain → tunda ke tick berikutnya.
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'INITIAL_SESSION') return
    setTimeout(() => apply(session), 0)
  })
}
