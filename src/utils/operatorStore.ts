import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ID } from '../types'

/**
 * Daftar operator (local-first, key `chipinorder-operators`).
 * PIN disimpan sebagai hash SHA-256 — ini kunci lunak antar-operator di satu
 * perangkat, BUKAN proteksi data (semua data PO tetap terbaca via devtools).
 * Gerbang login hanya aktif bila ada minimal satu operator terdaftar.
 */
export interface Operator {
  id: ID
  name: string
  pinHash: string
  createdAt: number
}

interface OperatorState {
  operators: Operator[]
  addOperator: (name: string, pinHash: string) => Operator
  removeOperator: (id: ID) => void
}

export const PIN_MIN = 4
export const PIN_MAX = 6

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_MIN},${PIN_MAX}}$`).test(pin)
}

export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`chipinorder:${pin}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const useOperatorStore = create<OperatorState>()(
  persist(
    (set, get) => ({
      operators: [],

      addOperator: (name, pinHash) => {
        const op: Operator = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
          name: name.trim() || 'Operator',
          pinHash,
          createdAt: Date.now(),
        }
        set({ operators: [...get().operators, op] })
        return op
      },

      removeOperator: (id) =>
        set({ operators: get().operators.filter((o) => o.id !== id) }),
    }),
    { name: 'chipinorder-operators' },
  ),
)
