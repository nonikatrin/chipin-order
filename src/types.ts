export type ID = string

/** Kode mata uang ISO 4217, mis. 'IDR', 'USD', 'EUR'. Bukan lagi dibatasi dua. */
export type Currency = string

export interface Member {
  id: ID
  name: string
  color: string // warna avatar
  photo?: string // data URL foto (opsional)
}

export type CategoryKey =
  | 'makan'
  | 'transportasi'
  | 'penginapan'
  | 'tiket'
  | 'belanja'
  | 'kesehatan'
  | 'oleh2'
  | 'lainnya'

/** Jenis catatan: uang keluar (expense) atau uang masuk (income). */
export type EntryKind = 'expense' | 'income'

export interface Expense {
  id: ID
  /** Pengeluaran atau pemasukan. Catatan lama tanpa `kind` dianggap 'expense'. */
  kind: EntryKind
  amount: number // rupiah, bilangan bulat
  paidBy: ID // expense: yang membayar · income: yang menerima
  category: CategoryKey
  note?: string
  receipt?: string // data URL foto struk (opsional)
  splitAmong: ID[] // id anggota yang ikut menanggung (kosong utk income)
  date?: number // tanggal catatan (ms); fallback ke createdAt
  createdAt: number
}

export interface Trip {
  id: ID
  name: string
  emoji: string
  currency: Currency
  category?: string // Trip / Gift / Foods / Entertainment / Others
  members: Member[]
  expenses: Expense[]
  createdAt: number
}
