import { create } from 'zustand'
import { supabase } from './supabase'
import { usePOStore, normalizeEvent } from '../po/store'
import { useProfileStore, defaultProfile } from '../utils/profileStore'
import { useOperatorStore } from '../utils/operatorStore'
import type { POEvent } from '../po/types'

/**
 * Sinkronisasi local-first ⇄ cloud.
 *
 * Store zustand tetap jadi sumber kebenaran di layar (aplikasi tetap jalan offline). Modul ini
 * mencatat event mana yang berubah secara lokal ("dirty"), mendorongnya ke tabel `po_events`
 * (satu baris JSON per PO, milik satu penjual), dan menarik perubahan dari perangkat lain.
 *
 * Aturan konflik sederhana: perubahan lokal yang belum terkirim MENANG; selain itu versi cloud
 * yang dipakai. Hapus dikirim sebagai tombstone (`deleted = true`) agar ikut hilang di perangkat lain.
 *
 * Privasi perangkat bersama: saat keluar, data lokal dihapus setelah terkirim, sehingga akun
 * berikutnya di perangkat yang sama tak pernah melihat (atau mengunggah) data penjual sebelumnya.
 */

const META_KEY = 'chipinorder-sync'
const NOTES_KEY = 'chipinorder-notes'
const PUSH_DELAY = 1200
const PULL_EVERY = 60_000

interface SyncMeta {
  owner: string | null
  dirty: string[] // id event yang berubah lokal & belum terkirim
  deleted: string[] // id event yang dihapus lokal & tombstone-nya belum terkirim
  synced: string[] // id yang pernah ada di cloud (utk mendeteksi hapus keras di cloud)
  profileDirty: boolean
}

const emptyMeta = (): SyncMeta => ({ owner: null, dirty: [], deleted: [], synced: [], profileDirty: false })

function loadMeta(): SyncMeta {
  try {
    const m = JSON.parse(localStorage.getItem(META_KEY) || 'null')
    return m && typeof m === 'object' ? { ...emptyMeta(), ...m } : emptyMeta()
  } catch {
    return emptyMeta()
  }
}
function saveMeta() {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta))
  } catch {
    /* penyimpanan penuh/diblokir — sinkron tetap jalan di memori */
  }
}

let meta: SyncMeta = loadMeta()

export type SyncState = 'off' | 'syncing' | 'synced' | 'offline' | 'error'
export const useSyncStatus = create<{ state: SyncState; lastSyncedAt: number | null; pending: number }>(() => ({
  state: 'off',
  lastSyncedAt: null,
  pending: 0,
}))
function status(state: SyncState) {
  useSyncStatus.setState({
    state,
    pending: meta.dirty.length + meta.deleted.length + (meta.profileDirty ? 1 : 0),
    ...(state === 'synced' ? { lastSyncedAt: Date.now() } : {}),
  })
}

// --- penerapan data dari cloud tanpa memicu "dirty" ---------------------------------------

let applyingRemote = false
function applyRemote(fn: () => void) {
  applyingRemote = true
  try {
    fn()
  } finally {
    applyingRemote = false
  }
}

/** Fungsi (bukan ekspresi) agar TS tak "menyempitkan" nilainya di antara dua await. */
const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false

const addUnique = (arr: string[], id: string) => (arr.includes(id) ? arr : [...arr, id])

// --- siklus hidup -------------------------------------------------------------------------

let owner: string | null = null
let unsubs: (() => void)[] = []
let pushTimer: ReturnType<typeof setTimeout> | undefined
let pushing: Promise<void> | null = null
let pullOk = false

/**
 * Tarik & dorong TIDAK boleh tumpang-tindih: dorong mengosongkan antrean "dirty" sebelum
 * menunggu jaringan, jadi tarikan yang jalan bersamaan akan mengira PO itu bersih dan
 * menimpanya dengan versi cloud yang lama — dan bila dorongan lalu gagal, versi lama itulah
 * yang dikirim ulang (suntingan hilang). Semua operasi jaringan antre di satu rantai.
 */
let chain: Promise<unknown> = Promise.resolve()
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn)
  chain = run.catch(() => undefined)
  return run
}

export async function startSync(userId: string): Promise<void> {
  if (!supabase || owner === userId) return
  stopSync()

  // Sisa data akun lain di perangkat ini (mis. sesi berganti tanpa "Keluar") → buang dulu.
  if (meta.owner && meta.owner !== userId) wipeLocal()

  // Pertama kali perangkat ini tertaut ke akun: data lokal lama ikut diunggah ke akun ini.
  if (meta.owner !== userId) {
    meta = emptyMeta()
    meta.owner = userId
    meta.dirty = usePOStore.getState().events.map((e) => e.id)
    meta.profileDirty = JSON.stringify(useProfileStore.getState().profile) !== JSON.stringify(defaultProfile)
    saveMeta()
  }
  owner = userId

  unsubs.push(
    usePOStore.subscribe((s, prev) => {
      if (applyingRemote || s.events === prev.events) return
      const before = new Map(prev.events.map((e) => [e.id, e]))
      const now = new Set<string>()
      for (const e of s.events) {
        now.add(e.id)
        if (before.get(e.id) !== e) {
          meta.dirty = addUnique(meta.dirty, e.id)
          meta.deleted = meta.deleted.filter((x) => x !== e.id)
        }
      }
      for (const id of before.keys()) {
        if (!now.has(id)) {
          meta.deleted = addUnique(meta.deleted, id)
          meta.dirty = meta.dirty.filter((x) => x !== id)
        }
      }
      saveMeta()
      schedulePush()
    }),
    useProfileStore.subscribe((s, prev) => {
      if (applyingRemote || s.profile === prev.profile) return
      meta.profileDirty = true
      saveMeta()
      schedulePush()
    }),
  )

  const onVisible = () => document.visibilityState === 'visible' && void syncNow()
  const onOnline = () => void syncNow()
  const onHide = () => void push()
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('online', onOnline)
  window.addEventListener('pagehide', onHide)
  const timer = setInterval(() => document.visibilityState === 'visible' && void pull(), PULL_EVERY)
  unsubs.push(() => {
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('online', onOnline)
    window.removeEventListener('pagehide', onHide)
    clearInterval(timer)
  })

  await syncNow()
}

export function stopSync() {
  unsubs.forEach((u) => u())
  unsubs = []
  clearTimeout(pushTimer)
  owner = null
  pullOk = false
  status('off')
}

/** Tarik dari cloud lalu dorong perubahan lokal. */
export async function syncNow(): Promise<void> {
  await pull()
  await push()
}

function schedulePush() {
  clearTimeout(pushTimer)
  status(isOffline() ? 'offline' : 'syncing')
  pushTimer = setTimeout(() => void push(), PUSH_DELAY)
}

// --- tarik --------------------------------------------------------------------------------

function pull(): Promise<void> {
  return exclusive(doPull)
}

async function doPull(): Promise<void> {
  if (!supabase || !owner) return
  if (isOffline()) return status('offline')
  status('syncing')
  const [ev, pr] = await Promise.all([
    supabase.from('po_events').select('id, data, deleted'),
    supabase.from('seller_profiles').select('data').maybeSingle(),
  ])
  pullOk = !ev.error && !pr.error
  if (!pullOk) return status(isOffline() ? 'offline' : 'error')

  const remote = new Map((ev.data ?? []).map((r) => [r.id as string, r as { id: string; data: POEvent; deleted: boolean }]))
  const local = usePOStore.getState().events
  const localIds = new Set(local.map((e) => e.id))
  const dirty = new Set(meta.dirty)
  const pendingDelete = new Set(meta.deleted)
  const wasSynced = new Set(meta.synced)

  const next: POEvent[] = []
  for (const e of local) {
    const r = remote.get(e.id)
    if (dirty.has(e.id)) next.push(e) // perubahan lokal menang; dikirim sebentar lagi
    else if (!r) {
      if (wasSynced.has(e.id)) continue // dihapus keras di cloud
      meta.dirty = addUnique(meta.dirty, e.id) // belum pernah terkirim
      next.push(e)
    } else if (r.deleted) continue // dihapus di perangkat lain
    else {
      // Bandingkan versi yang SUDAH dinormalisasi; kalau sama, pertahankan objek lokal agar
      // layar tak dirender ulang setiap tarikan berkala.
      const n = normalizeEvent(r.data)
      next.push(JSON.stringify(n) === JSON.stringify(e) ? e : n)
    }
  }
  // PO baru dari perangkat lain — taruh di depan, terbaru dulu (sesuai urutan dasbor)
  const incoming = [...remote.values()]
    .filter((r) => !r.deleted && !localIds.has(r.id) && !pendingDelete.has(r.id))
    .map((r) => normalizeEvent(r.data))
    .sort((a, b) => b.createdAt - a.createdAt)

  const changed = incoming.length > 0 || next.length !== local.length || next.some((e, i) => e !== local[i])
  if (changed) applyRemote(() => usePOStore.setState({ events: [...incoming, ...next] }))

  if (pr.data && !meta.profileDirty) {
    const profile = { ...defaultProfile, ...(pr.data.data as object) }
    if (JSON.stringify(profile) !== JSON.stringify(useProfileStore.getState().profile))
      applyRemote(() => useProfileStore.setState({ profile }))
  }

  meta.synced = [...remote.keys()].filter((id) => !remote.get(id)!.deleted)
  saveMeta()
  status(meta.dirty.length || meta.deleted.length || meta.profileDirty ? 'syncing' : 'synced')
}

// --- dorong -------------------------------------------------------------------------------

async function push(): Promise<void> {
  if (pushing) return pushing
  pushing = exclusive(doPush).finally(() => {
    pushing = null
  })
  return pushing
}

async function doPush(): Promise<void> {
  if (!supabase || !owner) return
  const dirtyIds = meta.dirty
  const deletedIds = meta.deleted
  const profileDirty = meta.profileDirty
  if (!dirtyIds.length && !deletedIds.length && !profileDirty) return status(pullOk ? 'synced' : useSyncStatus.getState().state)
  if (isOffline()) return status('offline')
  status('syncing')

  // Kosongkan antrean SEBELUM menunggu jaringan: perubahan selama upload masuk antrean baru.
  meta.dirty = []
  meta.deleted = []
  meta.profileDirty = false
  saveMeta()

  const events = new Map(usePOStore.getState().events.map((e) => [e.id, e]))
  const now = new Date().toISOString()
  const rows = [
    ...dirtyIds.filter((id) => events.has(id)).map((id) => ({ owner, id, data: events.get(id), deleted: false, updated_at: now })),
    ...deletedIds.map((id) => ({ owner, id, data: {}, deleted: true, updated_at: now })),
  ]
  const results = await Promise.all([
    rows.length ? supabase.from('po_events').upsert(rows, { onConflict: 'owner,id' }) : Promise.resolve({ error: null }),
    profileDirty
      ? supabase
          .from('seller_profiles')
          .upsert({ owner, data: useProfileStore.getState().profile, updated_at: now }, { onConflict: 'owner' })
      : Promise.resolve({ error: null }),
  ])

  if (results[0].error) {
    for (const id of dirtyIds) if (!deletedIds.includes(id)) meta.dirty = addUnique(meta.dirty, id)
    for (const id of deletedIds) if (!meta.dirty.includes(id)) meta.deleted = addUnique(meta.deleted, id)
  } else {
    for (const id of dirtyIds) meta.synced = addUnique(meta.synced, id)
    meta.synced = meta.synced.filter((id) => !deletedIds.includes(id))
  }
  if (results[1].error) meta.profileDirty = true
  saveMeta()

  if (results[0].error || results[1].error) return status(isOffline() ? 'offline' : 'error')
  status(meta.dirty.length || meta.deleted.length || meta.profileDirty ? 'syncing' : 'synced')
}

// --- keluar -------------------------------------------------------------------------------

/** Ada perubahan yang belum sampai ke cloud? (dipakai utk konfirmasi sebelum keluar) */
export function hasPending(): boolean {
  return meta.dirty.length > 0 || meta.deleted.length > 0 || meta.profileDirty
}

/** Kirim sisa perubahan, keluar dari akun, lalu bersihkan data penjual dari perangkat ini. */
export async function signOutAndWipe(): Promise<void> {
  clearTimeout(pushTimer)
  await push()
  stopSync()
  // scope 'local': keluar di perangkat INI tanpa panggilan jaringan. Versi default ('global')
  // gagal diam-diam saat offline dan sesi tetap tersimpan → "keluar" tapi masih masuk.
  await supabase?.auth.signOut({ scope: 'local' })
  wipeLocal()
}

function wipeLocal() {
  applyRemote(() => {
    usePOStore.setState({ events: [], activeOperator: { operatorId: null, operatorName: null } })
    useProfileStore.setState({ profile: defaultProfile })
    useOperatorStore.setState({ operators: [] })
  })
  try {
    localStorage.removeItem(NOTES_KEY)
  } catch {
    /* abaikan */
  }
  meta = emptyMeta()
  saveMeta()
}
