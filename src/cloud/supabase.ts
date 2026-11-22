import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Klien Supabase (akun penjual + salinan data di cloud). Kunci "publishable" aman ada di
 * browser: setiap tabel dilindungi Row Level Security (penjual hanya melihat datanya sendiri).
 * Tanpa env (mis. build lokal tanpa .env) aplikasi tetap jalan seperti dulu: lokal saja.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

// VITE_CLOUD_OFF=1 → jalankan tanpa akun (pengujian lokal saja; build produksi tak menyetelnya).
const off = import.meta.env.VITE_CLOUD_OFF === '1'

export const supabase: SupabaseClient | null =
  url && key && !off
    ? createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: 'chipinorder-auth' },
      })
    : null

export const cloudEnabled = supabase !== null
