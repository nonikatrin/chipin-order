import type { CategoryKey } from '../types'

export interface Category {
  key: CategoryKey
  label: string
  emoji: string
}

export const CATEGORIES: Category[] = [
  { key: 'makan', label: 'Makan', emoji: '🍽️' },
  { key: 'transportasi', label: 'Transportasi', emoji: '🚌' },
  { key: 'penginapan', label: 'Penginapan', emoji: '🏨' },
  { key: 'tiket', label: 'Tiket Masuk', emoji: '🎟️' },
  { key: 'belanja', label: 'Belanja', emoji: '🛍️' },
  { key: 'kesehatan', label: 'Kesehatan', emoji: '💊' },
  { key: 'oleh2', label: 'Oleh-oleh', emoji: '🎁' },
  { key: 'lainnya', label: 'Lainnya', emoji: '📝' },
]

const BY_KEY: Record<CategoryKey, Category> = CATEGORIES.reduce(
  (acc, c) => {
    acc[c.key] = c
    return acc
  },
  {} as Record<CategoryKey, Category>,
)

export function getCategory(key: CategoryKey): Category {
  return BY_KEY[key] ?? BY_KEY.lainnya
}

/** Emoji pilihan untuk memberi nama Buku Kas / perjalanan. */
export const TRIP_EMOJIS = [
  '🏝️',
  '⛰️',
  '🚌',
  '🕌',
  '🌊',
  '🏞️',
  '🎏',
  '🍲',
  '🎉',
  '☕',
  '🛕',
  '🚗',
]

/** Emoji pilihan untuk acara PO Bersama (tema makanan). */
export const PO_EMOJIS = [
  '🍲',
  '🍛',
  '🍱',
  '🥘',
  '🍜',
  '🍢',
  '🥟',
  '🧁',
  '🍰',
  '☕',
  '🥗',
  '🫔',
]

/** Emoji pilihan untuk Arisan (tema uang & kebersamaan). */
export const ARISAN_EMOJIS = [
  '💰',
  '🤝',
  '🧧',
  '🪙',
  '👛',
  '🎁',
  '🏆',
  '🌸',
  '☕',
  '🏠',
  '👵',
  '🎀',
]

/** Emoji pilihan untuk Raffle (tema undian & hadiah). */
export const RAFFLE_EMOJIS = [
  '🎟️',
  '🎁',
  '🎉',
  '🏆',
  '🎊',
  '🍀',
  '⭐',
  '🎯',
  '🥇',
  '💝',
  '🎲',
  '✨',
]
