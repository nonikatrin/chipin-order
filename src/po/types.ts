import type { ID, Currency } from '../types'

/**
 * Modul PO Bersama (Pre-Order makanan komunitas).
 * Data diisolasi dari Buku Kas Trip — lihat src/po/store.ts (key `chipinorder-po-v1`).
 */

// Re-export agar halaman PO bisa mengambil ID & Currency dari satu tempat.
export type { ID, Currency } from '../types'

/**
 * Dasar perhitungan modal/biaya vendor:
 * - 'perUnit'  → biaya tetap per porsi (pakai `buyPrice`). Termasuk "Modal $X"
 *   (per keputusan organizer: dihitung per unit, bukan sekali per kampanye).
 * - 'percent'  → biaya = `costValue` × harga jual (mis. 0.5 utk bagi hasil 50-50).
 */
export type CostBasis = 'perUnit' | 'percent'

export interface POMenu {
  id: ID
  name: string
  emoji: string
  buyPrice: number // modal ke pemasak per porsi (dipakai saat costBasis 'perUnit')
  sellPrice: number // harga jual ke warga per porsi
  maxQuota?: number // batas jumlah porsi (opsional)
  vendor?: string // pemasak/penjual menu ini — utk setoran akhir hari (opsional)
  description?: string // deskripsi singkat menu, mis. "Isi 10 pcs, level pedas 2" (opsional)
  allergens?: string[] // key alergen umum (lihat utils/allergens.ts) — machine-readable (opsional)
  /** 1 unit = N pcs (paket). Default 1. Mengatasi ambiguitas "3 x 10" → 3 unit (Npcs). */
  piecesPerUnit?: number
  costBasis?: CostBasis // default 'perUnit'
  costValue?: number // 'percent' → fraksi (0..1) dari harga jual yang jadi biaya
  /**
   * Menu disumbang: pemasak menyerahkan tanpa minta bayaran, jadi modal = 0 dan
   * tak ada setoran untuk item ini. Dibedakan dari "harga beli belum diisi" —
   * tanpa flag ini modal 0 selamanya ditandai "belum lengkap" dan supplier yang
   * berdonasi muncul di daftar bayar sebagai "$0.00" seolah data salah.
   */
  donated?: boolean
  /** Foto menu: data-URL thumbnail persegi ±128px (lihat utils/image.ts). Emoji tetap fallback. */
  photo?: string
  // --- Jastip (hanya dipakai bila event.kind === 'jastip') ---
  /** Harga barang di toko luar negeri, dalam `event.jastip.foreignCurrency`. */
  foreignPrice?: number
  /** Perkiraan berat per unit (gram) — utk ongkos bagasi per kg. */
  weightGrams?: number
  /** Nama toko tempat membeli (mis. "Uniqlo Ginza"). Sengaja BUKAN `vendor`: toko dibayar
   *  langsung di kasir, jadi tak boleh muncul di Portal Supplier / daftar setoran. */
  shop?: string
  /** Status belanja di hari-H: belum dicari · sudah dibeli · sebagian · habis (pesanan batal → refund). */
  shopStatus?: JastipShopStatus
  /** Status 'partial': jumlah unit yang berhasil dibeli. Dibagi ke pemesan paling awal dulu. */
  boughtQty?: number
}

export type JastipShopStatus = 'pending' | 'bought' | 'partial' | 'sold-out'

/**
 * Pengaturan trip jastip (jasa titip). Harga jual tiap item DIHITUNG dari sini lalu disimpan
 * ke `sellPrice`/`buyPrice`, sehingga seluruh alur yang sudah ada (tagihan, WA, rekap, ekspor)
 * langsung bekerja tanpa tahu apa-apa soal jastip.
 */
export interface JastipTrip {
  destination?: string // mis. "Tokyo, Jepang"
  foreignCurrency: Currency // mata uang toko, mis. JPY
  /** Kurs: 1 unit mata uang asing = `rate` unit mata uang PO. */
  rate: number
  /** Fee jastip per unit: nominal tetap (mata uang PO) atau persen dari harga barang. */
  feeMode: 'fixed' | 'percent'
  feeValue: number // 'fixed' → nominal · 'percent' → fraksi 0..1
  /** Ongkos bagasi per kg (mata uang PO), dibebankan ke pembeli sesuai berat item. */
  shippingPerKg?: number
  departDate?: string // ISO yyyy-mm-dd
  returnDate?: string // ISO yyyy-mm-dd
}

export interface POLine {
  menuId: ID
  qty: number // jumlah porsi (unit/paket)
}

/** Metode pembayaran yang dinyatakan warga. */
export type PaymentMethod = 'zelle' | 'cash' | 'venmo' | 'transfer' | 'other' | 'unstated'
/** Status uang: belum bayar / janji tunai (terima saat ambil) / lunas. */
export type PaymentStatus = 'unpaid' | 'promised-cash' | 'paid'

export interface POBuyer {
  id: ID
  name: string
  phone?: string // utk nudge WhatsApp (opsional)
  lines: POLine[] // pesanan bisa lebih dari satu menu
  paid: number // uang yang sudah diserahkan warga; 0 = belum bayar
  settled: boolean // 🟢 Lunas / 🔴 Belum (konfirmasi uang diterima)
  note?: string
  /** Total yang ditulis warga sendiri (utk dibandingkan dgn hitungan katalog). */
  statedTotal?: number
  paymentMethod?: PaymentMethod
  paymentStatus?: PaymentStatus
  amountReceived?: number // nominal tunai yang dijanjikan/diterima (opsional)
  /** Hasil parsing: 'auto' lolos bersih · 'needs-review' perlu cek koordinator. */
  confirmation?: 'auto' | 'needs-review'
  reviewReasons?: string[] // alasan masuk antrean tinjau (mis. "Nama kosong")
  /** Donasi tunai langsung (tanpa item) — masuk ke total pembeli & untung. */
  donation?: number
  /**
   * Pesanan melebihi kuota menu saat dicatat → menunggu konfirmasi koordinator
   * (daftar tunggu). Tetap tersimpan, tapi ditandai belum dikonfirmasi kuotanya.
   */
  waitlist?: boolean
  /** Fulfillment: pickup (default) atau delivery. */
  fulfillment?: FulfillmentMode
  fulfillmentStatus?: FulfillmentStatus
  fulfilledAt?: number // kapan ditandai diambil/terantar ("Ditandai · Jul 3, 3:45 PM" + Undo)
  deliveryAddress?: string // wajib bila fulfillment = 'delivery'
  deliveryNote?: string // mis. "Telepon sebelum sampai"
  /** Ongkir yang dibayar pembeli (pemasukan) — hanya berlaku saat fulfillment 'delivery'. */
  deliveryFee?: number
  /** Biaya kurir yang dibayar penjual (pengeluaran, opsional). Kosong = antar sendiri → ongkir jadi untung. */
  courierCost?: number
  createdAt: number
}

/** Cara warga menerima pesanan (lapis fulfillment — independen dari pembayaran). */
export type FulfillmentMode = 'pickup' | 'delivery'
/** Status penyerahan pesanan: belum · sudah diambil · sudah diantar. */
export type FulfillmentStatus = 'pending' | 'picked-up' | 'delivered'

/** Status setoran dari organizer ke bendahara (alur dua tingkat). */
export interface POSettlement {
  status: 'not-deposited' | 'deposited'
  depositedAmount?: number
  depositedDate?: string // ISO yyyy-mm-dd
}

/** Status bayar ke satu vendor (di-keyed berdasarkan nama vendor pada event). */
export interface VendorPayout {
  paid: boolean
  paidDate?: string
  paidBy?: string // orang yang benar-benar membayar vendor (boleh beda dari organizer)
  method?: 'cash' | 'transfer' | 'other' // metode pembayaran ke vendor
}

/** Pengulangan PO (wizard step 2 "Repeat this order?") — metadata di event.
 *  Pembuatan PO berikutnya masih manual (Duplikat); belum ada auto-create. */
export interface PORecurrence {
  frequency: 'weekly' | 'monthly'
  times: number // berapa kali diulang (mis. Weekly × 4)
}

export interface POEvent {
  id: ID
  name: string
  emoji: string
  currency: Currency // mata uang acara ini (kode ISO, mis. IDR / USD / EUR)
  deliveryDate?: string // tanggal pengiriman (ISO yyyy-mm-dd)
  orderDeadline?: string // batas terima pesanan (ISO; default H-1 pengiriman)
  place?: string // tempat pengiriman / pengambilan
  description?: string // deskripsi bebas ("Monthly group pre-order for RT residents")
  recurrence?: PORecurrence
  menus: POMenu[]
  buyers: POBuyer[]
  organizerName?: string // penyelenggara PO (mis. Rina)
  bendaharaName?: string // bendahara tujuan setoran akhir
  settlement?: POSettlement // status setoran organizer → bendahara
  vendorPayouts?: Record<string, VendorPayout> // status bayar per vendor (key = nama vendor)
  /** Jenis PO: 'po' (default — makanan/komunitas) atau 'jastip' (titip beli dari luar negeri). */
  kind?: 'po' | 'jastip'
  jastip?: JastipTrip
  /** Siklus hidup PO: aktif (default) atau ditutup (riwayat — tab "Past"). */
  status?: 'active' | 'closed'
  closedAt?: number
  createdAt: number
}
/**
 * Persona penjual = per-ITEM, bukan mode global: item tanpa supplier = buatan sendiri,
 * item bersupplier = jual-ulang (spektrum, satu PO bisa campur). Visibilitas Portal Supplier
 * diturunkan otomatis dari ada/tidaknya menu bersupplier (lihat Sidebar) — tak ada toggle.
 */
export interface BusinessProfile {
  storeName: string;
  // Alamat toko dipecah jadi 3 field (opsional) — dipakai di flyer/kontak.
  street?: string;        // nama jalan
  city?: string;          // kota
  province?: string;      // propinsi
  whatsappNumber: string; // Crucial for formatting the native "Remind" API strings
  email: string;
  currency: Currency;     // Enforces alignment with POEvent.currency
  bankName: string;       // For auto-filling Vendor Payout templates
  bankAccountName: string;
  bankAccountNumber: string;
}