/**
 * Daftar alergen umum (dipilih di editor menu, langkah 2 wizard).
 * Disimpan sebagai array `key` di `POMenu.allergens` — machine-readable supaya
 * FAQ bot bisa menjawab "ada yang bebas kacang?" dan flyer bisa menandai badge.
 */
export interface Allergen {
  key: string
  id: string
  en: string
  emoji: string
}

export const ALLERGENS: Allergen[] = [
  { key: 'egg', id: 'Telur', en: 'Egg', emoji: '🥚' },
  { key: 'milk', id: 'Susu', en: 'Milk', emoji: '🥛' },
  { key: 'peanut', id: 'Kacang', en: 'Peanut', emoji: '🥜' },
  { key: 'gluten', id: 'Gluten', en: 'Gluten', emoji: '🌾' },
  { key: 'soy', id: 'Kedelai', en: 'Soy', emoji: '🫛' },
  { key: 'seafood', id: 'Makanan laut', en: 'Seafood', emoji: '🦐' },
  { key: 'fish', id: 'Ikan', en: 'Fish', emoji: '🐟' },
  { key: 'sesame', id: 'Wijen', en: 'Sesame', emoji: '🌰' },
]

export const ALLERGEN_KEYS: readonly string[] = ALLERGENS.map((a) => a.key)

/** Buang key tak dikenal + duplikat, urut sesuai daftar kanonik. */
export function sanitizeAllergens(keys?: string[]): string[] | undefined {
  if (!keys || keys.length === 0) return undefined
  const set = new Set(keys)
  const clean = ALLERGENS.filter((a) => set.has(a.key)).map((a) => a.key)
  return clean.length > 0 ? clean : undefined
}

/** Label alergen sesuai bahasa untuk ditampilkan (mis. di badge/FAQ). */
export function allergenLabel(key: string, lang: 'id' | 'en'): string {
  const a = ALLERGENS.find((x) => x.key === key)
  return a ? a[lang] : key
}
