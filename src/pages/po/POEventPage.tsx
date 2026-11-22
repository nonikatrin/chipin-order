import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import AppBar from '../../components/AppBar'
import MoneyKeypad from '../../components/MoneyKeypad'
import PaymentSuccessModal from '../../components/PaymentSuccessModal'
import { Ic } from '../../components/icons'
import { usePOStore, usePOEvent } from '../../po/store'
import { useToast } from '../../components/Toast'
import { useLangStore } from '../../utils/langStore'
import { computePO, costPerUnit } from '../../po/calc'
import type { POBuyerCalc } from '../../po/calc'
import { MenuThumb } from '../../components/MenuThumb'
import { buildBuyerNudgeText, buildRecapReport, sharePO } from '../../po/whatsapp'
import { formatMoney, formatDate, currencyName, currencySymbol } from '../../utils/format'
import type { ID, POBuyer, POMenu, PaymentMethod, Currency } from '../../po/types'

const strings = {
  id: {
    draftSummaryTitle: 'Ringkasan Draf Buku Pemesanan',
    rowName: 'Judul Buku Pemesanan',
    rowAdmin: 'Admin Pemesanan',
    rowPlace: 'Tempat',
    rowCur: 'Mata uang',
    rowDate: 'Tanggal Kirim',
    rowDeadline: 'Batas Pesan',
    rowRepeat: 'Pengulangan',
    rowMenus: 'Item Menu',
    none: '—',
    cur: 'Mata uang',
    netLabel: 'TOTAL UNTUNG BERSIH',
    danaMasuk: 'Dana masuk',
    pemasak: 'Portal Supplier',
    pemasakSelf: 'HPP',
    porsi: 'porsi',
    needMenu: 'Belum ada menu',
    needMenuSub: 'Atur menu & harga dulu sebelum mencatat pesanan.',
    setupMenu: 'Atur Menu',
    editMenu: 'Menu',
    tabSummary: 'Ringkasan',
    tabBuyers: 'Pemesan',
    menuPricesTitle: 'Menu & Harga',
    jualLabel: 'Jual',
    beliLabel: 'Beli',
    hppLabel: 'HPP',
    sold: 'terjual',
    mOmzet: 'Omzet',
    mModal: 'Modal',
    mMargin: 'Margin',
    buyers: 'Pemesan',
    addManual: 'Pesanan Baru',
    jastip: 'Jastip',
    jastipStart: 'Atau buat sebagai Jastip',
    showReview: 'Tinjau',
    showAll: 'Semua',
    noBuyers: 'Belum ada pesanan',
    noBuyersSub: 'Salin data pesanan atau tambah satu per satu.',
    lunas: '🟢 Lunas',
    sebagian: '🟡 Sebagian',
    belum: '🔴 Belum',
    total: 'Total',
    lebih: 'Lebih Bayar',
    kurang: 'Kurang',
    cashPromised: 'COD (bayar di tempat)',
    method: {
      zelle: 'Zelle',
      venmo: 'Venmo',
      cash: 'Tunai',
      transfer: 'Transfer',
      other: 'Lainnya',
      unstated: '',
    } as Record<string, string>,
    review: 'Perlu ditinjau',
    reviewBanner: (n: number) => `🔎 ${n} pesanan perlu ditinjau`,
    waitlist: 'Waitlist',
    waitlistBanner: (n: number) => `⏳ ${n} pesanan menunggu konfirmasi kuota`,
    confirmWaitlist: 'Konfirmasi (keluar waitlist)',
    paste: 'Salin Pesanan',
    rekap: 'Rekap & Setoran',
    rekapSelf: 'Rekap',
    noItems: 'Belum ada pesanan',
    phone: 'Nomor WhatsApp (opsional)',
    phonePh: 'Contoh: 0812xxxx',
    note: 'Catatan (opsional)',
    notePh: 'Contoh: sama kerupuknya ya',
    paidLabel: 'Jumlah dibayar',
    editPaid: 'Ubah jumlah bayar',
    markLunas: 'Tandai Lunas',
    markBelum: 'Tandai Belum',
    nudge: 'Tagih via WhatsApp',
    del: 'Hapus Pesanan',
    confirmDel: 'Yakin hapus pesanan ini?',
    yes: 'Ya, Hapus',
    cancel: 'Batal',
    done: '✓ Selesai',
    close: 'Tutup',
    saved: '✓ Tersimpan',
    fulfillTitle: 'Penyerahan Pesanan',
    fulfillHint: 'Penyerahan terpisah dari pembayaran.',
    pickup: 'Ambil Sendiri',
    delivery: 'Diantar',
    fPending: 'Belum diserahkan',
    fPickedUp: 'Sudah Diambil',
    fDelivered: 'Terantar',
    markPickedUp: 'Tandai Sudah Diambil',
    markDelivered: 'Tandai Terantar',
    undoFulfill: 'Batalkan status serah',
    address: 'Alamat pengantaran',
    addressPh: 'Contoh: Jl. Merpati No.12, Blok C',
    deliveryNote: 'Catatan pengantaran',
    deliveryNotePh: 'Contoh: telepon sebelum sampai',
    deliveryFee: 'Ongkir',
    courierCost: 'Biaya kurir',
    deliveryDetails: 'Detail Pengantaran',
    edit: 'Ubah',
    saveShort: '✓ Simpan',
    payActions: 'AKSI PEMBAYARAN',
    fulfillActions: 'AKSI PENYERAHAN',
    remind: 'Ingatkan',
    paidShort: '✓ Lunas',
    pickMethod: '-- Pilih Metode --',
    share: 'Bagikan',
    // chips + workspace
    chipAll: 'Semua',
    chipUnpaid: 'Belum Bayar',
    chipPaid: 'Lunas',
    chipPending: 'Menunggu',
    chipDelivery: 'Diantar',
    chipPicked: 'Diambil',
    // terima pembayaran
    payNow: 'Terima Bayar',
    received: 'Uang diterima',
    changeLabel: 'Kembalian',
    shortBy: 'Masih kurang',
    receiveSettle: '✓ Terima & Lunas',
    partialSave: 'Catat Sebagian',
    paySuccess: 'Pembayaran Berhasil!',
    paySuccessSub: 'Jangan lupa ucapkan terima kasih 🙏',
    payDetails: 'RINCIAN PEMBAYARAN',
    customerPays: 'Dibayar warga',
    methodLabel: 'Metode',
    // status serah
    statusLabel: 'STATUS',
    markedAt: 'Ditandai',
    undo: 'Urungkan',
    toDelivery: 'Ubah ke Diantar',
    toPickup: 'Ubah ke Ambil Sendiri',
    // ringkasan antar
    deliverySummary: (n: number, names: string) => `${n} pesanan diantar — ${names}`,
    viewDelivery: 'Lihat Daftar Antar',
    detailPh: 'Pilih pemesan di daftar untuk melihat detail.',
  },
  en: {
    draftSummaryTitle: 'Draft Order Book Summary',
    rowName: 'Order Book Title',
    rowAdmin: 'Order Admin',
    rowPlace: 'Venue',
    rowCur: 'Currency',
    rowDate: 'Delivery Date',
    rowDeadline: 'Order Closing Date',
    rowRepeat: 'Repeat',
    rowMenus: 'Menu Items',
    none: '—',
    cur: 'Currency',
    netLabel: 'TOTAL NET PROFIT',
    danaMasuk: 'Money in',
    pemasak: 'Supplier Portal',
    pemasakSelf: 'COGS',
    porsi: 'portions',
    needMenu: 'No menus yet',
    needMenuSub: 'Set up menus & pricing before recording orders.',
    setupMenu: 'Set Up Menu',
    editMenu: 'Menu',
    tabSummary: 'Summary',
    tabBuyers: 'Buyers',
    menuPricesTitle: 'Menu & Prices',
    jualLabel: 'Sell',
    beliLabel: 'Buy',
    hppLabel: 'COGS',
    sold: 'sold',
    mOmzet: 'Revenue',
    mModal: 'Cost',
    mMargin: 'Margin',
    buyers: 'Buyers',
    addManual: 'New Order',
    jastip: 'Jastip',
    jastipStart: 'Or set it up as a Jastip',
    showReview: 'Resolve now',
    showAll: 'Show all',
    noBuyers: 'No orders yet',
    noBuyersSub: 'Paste order data or add them one by one.',
    lunas: '🟢 Paid',
    sebagian: '🟡 Partial',
    belum: '🔴 Unpaid',
    total: 'Total',
    lebih: 'Overpaid',
    kurang: 'Short',
    cashPromised: 'Cash on Delivery',
    method: {
      zelle: 'Zelle',
      venmo: 'Venmo',
      cash: 'Cash',
      transfer: 'Transfer',
      other: 'Other',
      unstated: '',
    } as Record<string, string>,
    review: 'Needs review',
    reviewBanner: (n: number) => `🔎 ${n} order(s) need review`,
    waitlist: 'Waitlist',
    waitlistBanner: (n: number) => `⏳ ${n} order(s) awaiting quota confirmation`,
    confirmWaitlist: 'Confirm (leave waitlist)',
    paste: 'Paste Orders',
    rekap: 'Recap & Payout',
    rekapSelf: 'Recap',
    noItems: 'No items yet',
    phone: 'WhatsApp number (optional)',
    phonePh: 'e.g. 0812xxxx',
    note: 'Note (optional)',
    notePh: 'e.g. extra crackers please',
    paidLabel: 'Amount paid',
    editPaid: 'Edit amount paid',
    markLunas: 'Mark Paid',
    markBelum: 'Mark Unpaid',
    nudge: 'Remind via WhatsApp',
    del: 'Delete Order',
    confirmDel: 'Delete this order?',
    yes: 'Yes, Delete',
    cancel: 'Cancel',
    done: '✓ Done',
    close: 'Close',
    saved: '✓ Saved',
    fulfillTitle: 'Fulfillment',
    fulfillHint: 'Fulfillment is independent from payment.',
    pickup: 'Pickup',
    delivery: 'Delivery',
    fPending: 'Pending',
    fPickedUp: 'Picked Up',
    fDelivered: 'Delivered',
    markPickedUp: 'Mark Picked Up',
    markDelivered: 'Mark Delivered',
    undoFulfill: 'Undo handover status',
    address: 'Delivery address',
    addressPh: 'e.g. Jl. Merpati No.12, Blok C',
    deliveryNote: 'Delivery note',
    deliveryNotePh: 'e.g. call before arriving',
    deliveryFee: 'Delivery fee',
    courierCost: 'Courier cost',
    deliveryDetails: 'Delivery Details',
    edit: 'Edit',
    saveShort: '✓ Save',
    payActions: 'PAYMENT ACTIONS',
    fulfillActions: 'FULFILLMENT ACTIONS',
    remind: 'Remind',
    paidShort: '✓ Paid',
    pickMethod: '-- Select method --',
    share: 'Share',
    chipAll: 'All',
    chipUnpaid: 'Unpaid',
    chipPaid: 'Paid',
    chipPending: 'Pending',
    chipDelivery: 'Delivery',
    chipPicked: 'Picked Up',
    payNow: 'Pay',
    received: 'Cash received',
    changeLabel: 'Change',
    shortBy: 'Still short',
    receiveSettle: '✓ Receive & settle',
    partialSave: 'Record partial',
    paySuccess: 'Payment Successful!',
    paySuccessSub: "Don't forget to say thank you 🙏",
    payDetails: 'PAYMENT DETAILS',
    customerPays: 'Customer pays',
    methodLabel: 'Method',
    statusLabel: 'STATUS',
    markedAt: 'Marked',
    undo: 'Undo',
    toDelivery: 'Change to Delivery',
    toPickup: 'Change to Pickup',
    deliverySummary: (n: number, names: string) => `${n} delivery order(s) — ${names}`,
    viewDelivery: 'View Delivery List',
    detailPh: 'Select a buyer in the list to see details.',
  },
}

type Chip = 'all' | 'unpaid' | 'paid' | 'pending' | 'delivery' | 'picked' | 'review'

export default function POEventPage() {
  const { poId } = useParams()
  const navigate = useNavigate()
  const event = usePOEvent(poId)
  const { currentLang } = useLangStore()
  const { updateBuyer, toggleSettled, removeBuyer } = usePOStore()
  const showToast = useToast((s) => s.show)

  const t = strings[currentLang] ?? strings.id
  const locale = currentLang === 'id' ? 'id-ID' : 'en-US'
  const dateLabel = (iso?: string) => (iso ? formatDate(new Date(iso + 'T00:00:00').getTime()) : t.none)
  const repeatLabel = event?.recurrence ? `${event.recurrence.frequency} × ${event.recurrence.times}` : t.none
  const sumRow = (icon: string | undefined, label: string, value: string) => (
    <div className="sum-row">
      {icon ? <span className="sum-row__icon" aria-hidden>{icon}</span> : null}
      <span className="sum-row__label">{label}</span>
      <span className="sum-row__value">{value}</span>
    </div>
  )

  // Accordion / panel + editor states
  const [dtab, setDtab] = useState<'summary' | 'buyers'>('summary')
  const [expandedBuyerId, setExpandedBuyerId] = useState<ID | null>(null)
  const [editingPaidId, setEditingPaidId] = useState<ID | null>(null)
  const [confirmDelId, setConfirmDelId] = useState<ID | null>(null)
  const [editingDeliveryId, setEditingDeliveryId] = useState<string | null>(null)
  // Filter chips (mockup: All / Unpaid / Paid / Pending / Delivery / Picked Up)
  const [chip, setChip] = useState<Chip>('all')
  // Alur terima pembayaran tunai (adaptasi comp POS: keypad → kembalian → sukses)
  const [payingId, setPayingId] = useState<ID | null>(null)
  const [payDone, setPayDone] = useState<{
    name: string
    bill: number
    received: number
    method: string
  } | null>(null)

  const data = useMemo(() => (event ? computePO(event) : null), [event])

  const menuMap = useMemo(() => {
    const m = new Map<ID, POMenu>()
    event?.menus.forEach((x) => m.set(x.id, x))
    return m
  }, [event])

  const calcMap = useMemo(() => {
    const m = new Map<ID, POBuyerCalc>()
    data?.buyers.forEach((c) => m.set(c.buyerId, c))
    return m
  }, [data])

  if (!event || !data) return <Navigate to="/" replace />
  const cur = event.currency
  // Produksi sendiri (tak ada menu bersupplier) → biaya = modal sendiri, bukan setoran ke supplier.
  const hasSupplier = event.menus.some((m) => m.vendor && m.vendor.trim())

  const itemsLabel = (b: POBuyer) =>
    b.lines.map((l) => `${l.qty}× ${menuMap.get(l.menuId)?.name ?? '?'}`).join(' · ')

  /** Tagihan item saja (Σ harga jual × qty) — TANPA donasi; calc menambahkan donasi sendiri. */
  // Dari calc (bukan dihitung ulang di sini) agar item jastip habis/sebagian ikut terpotong.
  const itemsBillOf = (b: POBuyer) => {
    const c = calcMap.get(b.id)
    return c ? Math.max(0, c.bill - c.deliveryFee - Math.max(0, b.donation ?? 0)) : 0
  }

  const payStateOf = (b: POBuyer, c?: POBuyerCalc) =>
    b.settled
      ? 'lunas'
      : c && c.paid > 0 && c.kurangBayar > 0
        ? 'partial'
        : c && c.paid >= c.bill && c.bill > 0
          ? 'lunas'
          : 'belum'

  const isDone = (b: POBuyer) =>
    b.fulfillmentStatus === 'picked-up' || b.fulfillmentStatus === 'delivered'

  const reviewCount = event.buyers.filter((b) => b.confirmation === 'needs-review').length

  const shownBuyers = event.buyers.filter((b) => {
    const c = calcMap.get(b.id)
    switch (chip) {
      case 'unpaid':
        return payStateOf(b, c) !== 'lunas'
      case 'paid':
        return payStateOf(b, c) === 'lunas'
      case 'pending':
        return !isDone(b)
      case 'delivery':
        return b.fulfillment === 'delivery'
      case 'picked':
        return b.fulfillmentStatus === 'picked-up'
      case 'review':
        return b.confirmation === 'needs-review'
      default:
        return true
    }
  })

  // Ringkasan pengantaran yang belum jalan (mockup: "2 delivery orders — Winda, Rachel")
  const deliveryPending = event.buyers.filter(
    (b) => b.fulfillment === 'delivery' && !isDone(b),
  )

  const fmtWhen = (ts: number) =>
    new Date(ts).toLocaleString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  function handleHandoverToggle(b: POBuyer) {
    const mode = b.fulfillment ?? 'pickup'
    const done = isDone(b)
    updateBuyer(event!.id, b.id, {
      fulfillment: mode,
      fulfillmentStatus: done ? 'pending' : mode === 'delivery' ? 'delivered' : 'picked-up',
      fulfilledAt: done ? undefined : Date.now(),
    })
    showToast(t.saved)
  }

  function switchMode(b: POBuyer) {
    // ganti moda menyetel ulang status serah (status lama tidak relevan utk moda baru)
    updateBuyer(event!.id, b.id, {
      fulfillment: b.fulfillment === 'delivery' ? 'pickup' : 'delivery',
      fulfillmentStatus: 'pending',
      fulfilledAt: undefined,
    })
  }

  function confirmPay(b: POBuyer, received: number) {
    const bill = itemsBillOf(b)
    const method =
      b.paymentMethod && b.paymentMethod !== 'unstated' ? b.paymentMethod : 'cash'
    if (received >= bill && bill > 0) {
      updateBuyer(event!.id, b.id, {
        paid: Math.max(b.paid, bill),
        amountReceived: received,
        settled: true,
        paymentMethod: method,
        paymentStatus: 'paid',
      })
      setPayDone({ name: b.name, bill, received, method: t.method[method] || method })
    } else {
      // uang kurang dari tagihan → catat sebagai pembayaran sebagian, JANGAN lunas
      updateBuyer(event!.id, b.id, {
        paid: received,
        amountReceived: received,
        paymentMethod: method,
      })
      showToast(t.saved)
    }
    setPayingId(null)
  }

  /** Isi kartu detail satu pemesan — dipakai inline (mobile) & panel kanan (desktop). */
  function renderDetail(b: POBuyer) {
    const c = calcMap.get(b.id)
    const payState = payStateOf(b, c)
    const done = isDone(b)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* 1. Rincian item */}
        <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {b.lines.map((l, i) => {
            const m = menuMap.get(l.menuId)
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                <span style={{ color: 'var(--ink)' }}>
                  {l.qty}× {m?.name ?? '?'}
                </span>
                <span style={{ fontWeight: 600, color: 'var(--ink)' }}>
                  {formatMoney((m?.sellPrice ?? 0) * l.qty, cur)}
                </span>
              </div>
            )
          })}
          {b.note && (
            <div style={{ marginTop: 6, padding: '6px 10px', background: 'var(--warm-soft)', borderRadius: 6, fontSize: '0.85rem', color: '#92600a', fontStyle: 'italic' }}>
              📙 {b.note}
            </div>
          )}
        </div>

        {/* 2. Total + jumlah dibayar (✏️ → keypad) */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, fontSize: '1rem', padding: '0 4px' }}>
            <span style={{ color: 'var(--ink)' }}>
              {t.total}: {formatMoney(c?.bill ?? 0, cur)}
            </span>
            <div
              onClick={() => setEditingPaidId(b.id)}
              style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}
            >
              {c && b.paid > c.bill ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span style={{ color: 'var(--info)', fontSize: '0.95rem' }}>
                    {t.lebih}: {formatMoney(b.paid - c.bill, cur)}
                  </span>
                  <span style={{ color: 'var(--ink-soft)', fontSize: '0.75rem', fontWeight: 400 }}>
                    ({t.paidLabel}: {formatMoney(b.paid, cur)} ✏️)
                  </span>
                </div>
              ) : (
                <span style={{ color: 'var(--good)', fontSize: '0.95rem' }}>
                  {t.paidLabel}: {formatMoney(b.paid, cur)} ✏️
                </span>
              )}
            </div>
          </div>

          {/* metode bayar */}
          <div style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', padding: '6px 4px 0 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>💳</span>
            <select
              value={b.paymentMethod || 'unstated'}
              onChange={(e) => {
                const val = e.target.value as PaymentMethod
                updateBuyer(event!.id, b.id, {
                  paymentMethod: val === 'unstated' ? undefined : val,
                })
              }}
              style={{ border: 'none', background: 'transparent', fontSize: '0.85rem', fontWeight: 500, color: 'var(--ink)', cursor: 'pointer', padding: 0, outline: 'none', fontFamily: 'inherit' }}
            >
              <option value="unstated">{t.pickMethod}</option>
              <option value="cash">{t.method.cash}</option>
              <option value="transfer">{t.method.transfer}</option>
              <option value="venmo">{t.method.venmo}</option>
              <option value="zelle">{t.method.zelle}</option>
              <option value="other">{t.method.other}</option>
            </select>
          </div>
        </div>

        {/* 3. Kartu Detail Pengantaran (moda delivery) */}
        {b.fulfillment === 'delivery' && (
          <div style={{ background: 'var(--info-soft)', border: '1px solid rgba(29,111,184,.3)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, color: 'var(--info)', fontSize: '0.9rem' }}>{t.deliveryDetails}</div>
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: 'var(--info)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                onClick={() => setEditingDeliveryId(editingDeliveryId === b.id ? null : b.id)}
              >
                {editingDeliveryId === b.id ? t.saveShort : t.edit}
              </button>
            </div>
            <div>
              <label style={{ fontWeight: 700, color: 'var(--info)', fontSize: '0.75rem', display: 'block', marginBottom: 2 }}>{t.address}</label>
              {editingDeliveryId === b.id ? (
                <input
                  type="text"
                  style={{ width: '100%', fontSize: '0.9rem', color: 'var(--info)', background: 'var(--surface)', border: '1px solid var(--line)', padding: '8px 10px', borderRadius: 6, boxSizing: 'border-box', outline: 'none' }}
                  value={b.deliveryAddress || ''}
                  placeholder={t.addressPh}
                  onChange={(e) => updateBuyer(event!.id, b.id, { deliveryAddress: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && setEditingDeliveryId(null)}
                  autoFocus
                />
              ) : (
                <div style={{ fontSize: '0.9rem', color: 'var(--info)', background: 'var(--surface-2)', border: '1px solid var(--line)', padding: '8px 10px', borderRadius: 6 }}>
                  {b.deliveryAddress || <span style={{ color: 'var(--ink-soft)', fontStyle: 'italic' }}>{t.addressPh}</span>}
                </div>
              )}
            </div>
            <div>
              <label style={{ fontWeight: 700, color: 'var(--info)', fontSize: '0.75rem', display: 'block', marginBottom: 2 }}>{t.deliveryNote}</label>
              {editingDeliveryId === b.id ? (
                <input
                  type="text"
                  style={{ width: '100%', fontSize: '0.85rem', color: 'var(--info)', background: 'var(--surface)', border: '1px solid var(--line)', padding: '6px 10px', borderRadius: 6, boxSizing: 'border-box', outline: 'none' }}
                  value={b.deliveryNote || ''}
                  placeholder={t.deliveryNotePh}
                  onChange={(e) => updateBuyer(event!.id, b.id, { deliveryNote: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && setEditingDeliveryId(null)}
                />
              ) : (
                <div style={{ fontSize: '0.85rem', color: 'var(--info)', background: 'var(--surface-2)', border: '1px solid var(--line)', padding: '6px 10px', borderRadius: 6 }}>
                  {b.deliveryNote || <span style={{ color: 'var(--ink-soft)', fontStyle: 'italic' }}>{t.deliveryNotePh}</span>}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontWeight: 700, color: 'var(--info)', fontSize: '0.75rem', display: 'block', marginBottom: 2 }}>{t.deliveryFee}</label>
                {editingDeliveryId === b.id ? (
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    style={{ width: '100%', fontSize: '0.85rem', color: 'var(--info)', background: 'var(--surface)', border: '1px solid var(--line)', padding: '6px 10px', borderRadius: 6, boxSizing: 'border-box', outline: 'none' }}
                    value={b.deliveryFee || ''}
                    onChange={(e) => { const v = Math.max(0, Number(e.target.value) || 0); updateBuyer(event!.id, b.id, { deliveryFee: v > 0 ? v : undefined }) }}
                  />
                ) : (
                  <div style={{ fontSize: '0.85rem', color: 'var(--info)', background: 'var(--surface-2)', border: '1px solid var(--line)', padding: '6px 10px', borderRadius: 6 }}>
                    {b.deliveryFee ? formatMoney(b.deliveryFee, cur) : '—'}
                  </div>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontWeight: 700, color: 'var(--info)', fontSize: '0.75rem', display: 'block', marginBottom: 2 }}>{t.courierCost}</label>
                {editingDeliveryId === b.id ? (
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    style={{ width: '100%', fontSize: '0.85rem', color: 'var(--info)', background: 'var(--surface)', border: '1px solid var(--line)', padding: '6px 10px', borderRadius: 6, boxSizing: 'border-box', outline: 'none' }}
                    value={b.courierCost || ''}
                    onChange={(e) => { const v = Math.max(0, Number(e.target.value) || 0); updateBuyer(event!.id, b.id, { courierCost: v > 0 ? v : undefined }) }}
                  />
                ) : (
                  <div style={{ fontSize: '0.85rem', color: 'var(--info)', background: 'var(--surface-2)', border: '1px solid var(--line)', padding: '6px 10px', borderRadius: 6 }}>
                    {b.courierCost ? formatMoney(b.courierCost, cur) : '—'}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 4. Aksi pembayaran — Belum: Terima Bayar (alur tunai+kembalian) · Lunas: toggle balik */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--ink-soft)', letterSpacing: '0.05em' }}>{t.payActions}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button
              type="button"
              className="act-btn"
              style={
                payState === 'lunas'
                  ? { background: 'var(--brand)', color: '#fff', border: '1px solid var(--brand)' }
                  : { background: 'transparent', color: 'var(--brand)', border: '1px solid var(--brand)' }
              }
              onClick={() =>
                payState === 'lunas' ? toggleSettled(event!.id, b.id) : setPayingId(b.id)
              }
            >
              {payState === 'lunas' ? t.paidShort : t.payNow}
            </button>
            <button
              type="button"
              className="act-btn act-btn--ghost"
              onClick={() => sharePO(buildBuyerNudgeText(event!, b), b.phone ?? '')}
            >
              {t.remind}
            </button>
          </div>
        </div>

        {/* 5. Aksi penyerahan — status card + Undo saat selesai (mockup workspace) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--ink-soft)', letterSpacing: '0.05em' }}>{t.fulfillActions}</div>
          {done ? (
            <div className="fstatus">
              <div className="fstatus__label">{t.statusLabel}</div>
              <div className="fstatus__value">
                {b.fulfillmentStatus === 'delivered' ? `🚚 ${t.fDelivered}` : `✓ ${t.fPickedUp}`}
              </div>
              {b.fulfilledAt && (
                <div className="fstatus__time">
                  {t.markedAt} · {fmtWhen(b.fulfilledAt)}
                </div>
              )}
              <button type="button" className="fstatus__undo" onClick={() => handleHandoverToggle(b)}>
                ↩ {t.undo}
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                type="button"
                className="act-btn"
                style={{ background: 'transparent', color: 'var(--brand)', border: '1px solid var(--brand)' }}
                onClick={() => handleHandoverToggle(b)}
              >
                {b.fulfillment === 'delivery' ? t.markDelivered : t.markPickedUp}
              </button>
              <button type="button" className="act-btn act-btn--ghost" onClick={() => switchMode(b)}>
                {b.fulfillment === 'delivery' ? t.toPickup : t.toDelivery}
              </button>
            </div>
          )}
          {done && (
            <button type="button" className="act-btn act-btn--ghost" onClick={() => switchMode(b)}>
              {b.fulfillment === 'delivery' ? t.toPickup : t.toDelivery}
            </button>
          )}
        </div>

        {/* 5b. Konfirmasi kuota utk pesanan waitlist */}
        {b.waitlist && (
          <button
            type="button"
            className="btn btn--warm btn--sm"
            onClick={() => {
              updateBuyer(event!.id, b.id, { waitlist: false })
              showToast(t.saved)
            }}
          >
            {Ic.checkCircle} {t.confirmWaitlist}
          </button>
        )}

        {/* 6. Hapus pesanan (konfirmasi inline) */}
        <div style={{ marginTop: 4, display: 'flex', justifyContent: 'center' }}>
          {confirmDelId === b.id ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: '100%', padding: 10, background: 'var(--bad-soft)', borderRadius: 8, border: '1px solid var(--bad)' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--bad)', fontWeight: 600 }}>{t.confirmDel}</span>
              <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                <button
                  type="button"
                  className="btn btn--danger"
                  style={{ flex: 1, padding: '6px 0' }}
                  onClick={() => {
                    removeBuyer(event!.id, b.id)
                    showToast(t.saved)
                  }}
                >
                  {t.yes}
                </button>
                <button
                  type="button"
                  className="btn btn--secondary"
                  style={{ flex: 1, padding: '6px 0' }}
                  onClick={() => setConfirmDelId(null)}
                >
                  {t.cancel}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              style={{ background: 'transparent', border: 'none', color: 'var(--bad)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              onClick={() => setConfirmDelId(b.id)}
            >
              {Ic.trash} {t.del}
            </button>
          )}
        </div>
      </div>
    )
  }

  const expandedBuyer = event.buyers.find((b) => b.id === expandedBuyerId) ?? null
  const payingBuyer = event.buyers.find((b) => b.id === payingId) ?? null

  const CHIPS: { key: Chip; label: string }[] = [
    { key: 'all', label: t.chipAll },
    { key: 'unpaid', label: t.chipUnpaid },
    { key: 'paid', label: t.chipPaid },
    { key: 'pending', label: t.chipPending },
    { key: 'delivery', label: t.chipDelivery },
    { key: 'picked', label: t.chipPicked },
  ]

  return (
    <>
      <AppBar
        title={event.name}
        backTo="/"
        action={
          <>
            {event.menus.length > 0 && (
              <button
                type="button"
                className="appbar__cta dt-only"
                onClick={() => navigate(`/po/${event.id}/rekap`)}
              >
                {Ic.barChart} {t.rekap}
              </button>
            )}
            <button
              type="button"
              className="iconbtn"
              aria-label={t.editMenu}
              onClick={() => navigate(`/po/${event.id}/edit`)}
            >
              {Ic.edit}
            </button>
          </>
        }
      />

      <main className="page page--dial page--split">
        {event.menus.length > 0 && (
          <div className="stabs" role="tablist" style={{ marginTop: 16 }}>
            <button
              type="button"
              role="tab"
              aria-selected={dtab === 'summary'}
              className={'stab' + (dtab === 'summary' ? ' is-on' : '')}
              onClick={() => setDtab('summary')}
            >
              {Ic.barChart} {t.tabSummary}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={dtab === 'buyers'}
              className={'stab' + (dtab === 'buyers' ? ' is-on' : '')}
              onClick={() => setDtab('buyers')}
            >
              {Ic.users} {t.tabBuyers} ({event.buyers.length})
            </button>
            <button
              type="button"
              className="stab"
              onClick={() => navigate(`/po/${event.id}/pesanan/baru`)}
            >
              {Ic.plus} {t.addManual}
            </button>
            <button
              type="button"
              className={'stab' + (event.kind === 'jastip' ? ' stab--jastip' : '')}
              onClick={() => navigate(`/po/${event.id}/jastip`)}
            >
              ✈️ {t.jastip}
            </button>
            <span className="stabs__actions">
              <button
                type="button"
                className="act-icon act-icon--primary"
                aria-label={hasSupplier ? t.rekap : t.rekapSelf}
                title={hasSupplier ? t.rekap : t.rekapSelf}
                onClick={() => navigate(`/po/${event.id}/rekap`)}
              >
                {Ic.barChart}
              </button>
              <button
                type="button"
                className="act-icon"
                aria-label={t.share}
                title={t.share}
                onClick={() => sharePO(buildRecapReport(event))}
              >
                {Ic.share}
              </button>
            </span>
          </div>
        )}

        {(event.menus.length === 0 || dtab === 'summary') && (
        <div className="card card--flat wizard-draft-summary" style={{ marginTop: 16 }}>
          <h3 className="wizard-draft-summary__title">{t.draftSummaryTitle}</h3>
          <div className="sum-rows">
            {sumRow(undefined, t.rowName, event.name || t.none)}
            {sumRow(undefined, t.rowAdmin, event.organizerName || t.none)}
            {sumRow(undefined, t.rowPlace, event.place || t.none)}
            {sumRow(undefined, t.rowCur, `${currencySymbol(event.currency)} - ${currencyName(event.currency)}`)}
            {sumRow(undefined, t.rowDate, dateLabel(event.deliveryDate))}
            {sumRow(undefined, t.rowDeadline, dateLabel(event.orderDeadline))}
            {sumRow(undefined, t.rowRepeat, repeatLabel)}
            {sumRow(undefined, t.rowMenus, `${event.menus.length}`)}
          </div>
          {event.menus.length === 0 && (
            <>
              <div className="wizard-draft-summary__divider" />
              <div className="wizard-draft-summary__empty">
                <strong>{t.needMenu}</strong>
                <p>{t.needMenuSub}</p>
              </div>
            </>
          )}
        </div>
        )}

        {event.menus.length === 0 ? (
          <div className="empty">
            <div className="empty__emoji" />
            <h2 className="empty__title">{t.needMenu}</h2>
            <p className="empty__text">{t.needMenuSub}</p>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              style={{ marginTop: 18, width: 'fit-content', minHeight: 34, padding: '6px 10px' }}
              onClick={() => navigate(`/po/${event.id}/menu`)}
            >
              {Ic.clipboard} {t.setupMenu}
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              style={{ marginTop: 10, width: 'fit-content', minHeight: 34, padding: '6px 10px' }}
              onClick={() => navigate(`/po/${event.id}/jastip`)}
            >
              ✈️ {t.jastipStart}
            </button>
          </div>
        ) : (
          <>
            {dtab === 'summary' && (
              <>
            <section className="statgrid">
              <div className="stat stat--profit">
                <div className="stat__label">{t.netLabel}</div>
                <div className="stat__value">{formatMoney(data.untungBersih, cur)}</div>
              </div>
              <div className="stat">
                <div className="stat__label">{t.danaMasuk}</div>
                <div className="stat__value">{formatMoney(data.danaMasuk, cur)}</div>
              </div>
              <div className="stat stat--out">
                <div className="stat__label">{hasSupplier ? t.pemasak : t.pemasakSelf}</div>
                <div className="stat__value">{formatMoney(data.wajibBayarPemasak, cur)}</div>
              </div>
            </section>

            <div className="section-label">{Ic.clipboard} {t.menuPricesTitle}</div>
            <div className="card">
              {event.menus.map((m) => {
                const rec = data.menus.find((r) => r.menuId === m.id)
                const hasVendor = Boolean(m.vendor && m.vendor.trim())
                return (
                  <div className="supcard__row" key={m.id}>
                    <MenuThumb menu={m} />
                    <span className="supcard__row-name">
                      {m.name}
                      <span className="supcard__row-buyers">
                        {rec && rec.qtyTotal > 0 ? `${rec.qtyTotal} ${t.sold}` : '—'}
                        {m.maxQuota != null ? ` / ${m.maxQuota}` : ''}
                        {hasVendor ? ` · ${m.vendor}` : ''}
                      </span>
                      {rec && rec.qtyTotal > 0 && (
                        <span className="supcard__row-buyers mprice__math">
                          {t.mOmzet} {rec.qtyTotal} × {formatMoney(m.sellPrice, cur)} ={' '}
                          <b>{formatMoney(rec.revenue, cur)}</b>
                          {' · '}
                          {t.mModal} {rec.qtyTotal} × {formatMoney(costPerUnit(m), cur)} ={' '}
                          {formatMoney(rec.cost, cur)}
                          {' · '}
                          {t.mMargin}{' '}
                          <b style={{ color: 'var(--good)' }}>
                            {formatMoney(rec.revenue - rec.cost, cur)}
                          </b>
                        </span>
                      )}
                    </span>
                    <span className="mprice">
                      <span className="mprice__sell">
                        {t.jualLabel} {formatMoney(m.sellPrice, cur)}
                      </span>
                      <span className="mprice__buy">
                        {hasVendor ? t.beliLabel : t.hppLabel} {formatMoney(costPerUnit(m), cur)}
                      </span>
                    </span>
                  </div>
                )
              })}
            </div>
              </>
            )}

            {dtab === 'buyers' && (
              <>
            <div className="section-label" style={{ justifyContent: 'space-between' }}>
              <span>
                {Ic.users} {t.buyers} ({event.buyers.length}) · {data.totalPorsi} {t.porsi}
              </span>
            </div>

            <div className="action-zone">
              <button
                type="button"
                className="act-icon"
                aria-label={t.paste}
                title={t.paste}
                onClick={() => navigate(`/po/${event.id}/salin`)}
              >
                {Ic.clipboard}
              </button>
            </div>

            {event.buyers.length === 0 ? (
              <div className="card card--flat center">
                <div style={{ fontSize: '2.4rem' }}>🧾</div>
                <p style={{ fontWeight: 800, marginTop: 6 }}>{t.noBuyers}</p>
                <p className="muted">{t.noBuyersSub}</p>
              </div>
            ) : (
              <>
                {reviewCount > 0 && (
                  <div className="card card--flat banner-warn">
                    <span>{t.reviewBanner(reviewCount)}</span>
                    <button
                      type="button"
                      className="btn btn--sm btn--warm"
                      onClick={() => setChip(chip === 'review' ? 'all' : 'review')}
                    >
                      {chip === 'review' ? t.showAll : t.showReview}
                    </button>
                  </div>
                )}

                {event.buyers.some((b) => b.waitlist) && (
                  <div className="card card--flat banner-warn">
                    <span>{t.waitlistBanner(event.buyers.filter((b) => b.waitlist).length)}</span>
                  </div>
                )}

                {deliveryPending.length > 0 && chip !== 'delivery' && (
                  <div className="dsum">
                    <span>
                      🚚{' '}
                      {t.deliverySummary(
                        deliveryPending.length,
                        deliveryPending.map((b) => b.name.split(' ')[0]).join(', '),
                      )}
                    </span>
                    <button type="button" className="dsum__btn" onClick={() => setChip('delivery')}>
                      {t.viewDelivery}
                    </button>
                  </div>
                )}

                {/* Chip filter (mockup tablet) */}
                <div className="chips" role="tablist" aria-label="Filter pemesan">
                  {CHIPS.map((cdef) => (
                    <button
                      key={cdef.key}
                      type="button"
                      role="tab"
                      aria-selected={chip === cdef.key}
                      className={'chip' + (chip === cdef.key ? ' chip--on' : '')}
                      onClick={() => setChip(cdef.key)}
                    >
                      {cdef.label}
                    </button>
                  ))}
                </div>

                {/* ≥1024px: daftar kiri + panel detail kanan (mockup desktop) */}
                <div className="po-split">
                  <div className="po-list">
                    {shownBuyers.map((b) => {
                      const c = calcMap.get(b.id)
                      const isExpanded = expandedBuyerId === b.id
                      const payState = payStateOf(b, c)
                      return (
                        <div
                          key={b.id}
                          className="card card--flat"
                          style={{
                            marginBottom: 10,
                            padding: 14,
                            border: isExpanded ? '1px solid var(--brand)' : '1px solid var(--line)',
                            borderRadius: 12,
                            backgroundColor: isExpanded ? 'var(--brand-soft)' : 'var(--surface)',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedBuyerId(isExpanded ? null : b.id)
                              setEditingPaidId(null)
                              setConfirmDelId(null)
                            }}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer' }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--ink)' }}>{b.name}</div>
                              {b.phone && (
                                <div style={{ fontSize: '0.85rem', color: 'var(--ink-soft)' }}>{b.phone}</div>
                              )}
                              {!isExpanded && (
                                <div style={{ fontSize: '0.9rem', color: 'var(--ink-soft)', marginTop: 4 }}>
                                  {itemsLabel(b) || t.noItems}
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              <span className={`pill pill--${payState === 'lunas' ? 'good' : payState === 'partial' ? 'warm' : 'bad'}`}>
                                {payState === 'lunas' ? t.lunas : payState === 'partial' ? t.sebagian : t.belum}
                              </span>
                              <span className={`pill pill--${isDone(b) ? 'good' : 'neutral'}`}>
                                {b.fulfillmentStatus === 'picked-up'
                                  ? `✓ ${t.fPickedUp}`
                                  : b.fulfillmentStatus === 'delivered'
                                    ? `🚚 ${t.fDelivered}`
                                    : `⏳ ${t.fPending}`}
                              </span>
                            </div>
                          </button>

                          {isExpanded && (
                            <div
                              className="detail-inline"
                              style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed var(--line)' }}
                            >
                              {renderDetail(b)}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <aside className="dpanel">
                    {expandedBuyer ? (
                      <>
                        <div style={{ fontWeight: 800, fontSize: 'var(--fs-h3)', marginBottom: 12 }}>
                          {expandedBuyer.name}
                        </div>
                        {renderDetail(expandedBuyer)}
                      </>
                    ) : (
                      <p className="muted" style={{ margin: 0 }}>
                        {t.detailPh}
                      </p>
                    )}
                  </aside>
                </div>
              </>
            )}
              </>
            )}
          </>
        )}
      </main>

      {/* Sheet keypad: ubah jumlah bayar manual */}
      {editingPaidId && (
        <PaidSheet
          key={editingPaidId}
          title={t.editPaid}
          doneLabel={t.done}
          initial={event.buyers.find((x) => x.id === editingPaidId)?.paid ?? 0}
          currency={cur}
          onClose={() => setEditingPaidId(null)}
          onSave={(num) => {
            updateBuyer(event.id, editingPaidId, { paid: num })
            setEditingPaidId(null)
            showToast(t.saved)
          }}
        />
      )}

      {/* Sheet terima pembayaran tunai (adaptasi comp POS — kembalian dihitung) */}
      {payingBuyer && (
        <PaySheet
          key={payingBuyer.id}
          bill={itemsBillOf(payingBuyer)}
          currency={cur}
          labels={{
            title: t.payNow,
            total: t.total,
            received: t.received,
            change: t.changeLabel,
            shortBy: t.shortBy,
            settle: t.receiveSettle,
            partial: t.partialSave,
          }}
          onClose={() => setPayingId(null)}
          onConfirm={(received) => confirmPay(payingBuyer, received)}
        />
      )}

      {/* Modal sukses (rewrite komponen tempelan user — token oranye + bilingual) */}
      {payDone && (
        <PaymentSuccessModal
          title={t.paySuccess}
          subtitle={t.paySuccessSub}
          detailsLabel={t.payDetails}
          rows={[
            { label: `${t.total} (${payDone.name})`, value: formatMoney(payDone.bill, cur) },
            { label: t.methodLabel, value: payDone.method },
            { label: t.customerPays, value: formatMoney(payDone.received, cur) },
          ]}
          changeLabel={t.changeLabel}
          changeValue={formatMoney(Math.max(0, payDone.received - payDone.bill), cur)}
          doneLabel={t.done}
          onDone={() => setPayDone(null)}
        />
      )}

      {/* FAB "+ Pesanan Baru" — mobile; desktop pakai action-zone */}
      {event.menus.length > 0 && (
        <button
          type="button"
          className="fab m-only"
          onClick={() => navigate(`/po/${event.id}/pesanan/baru`)}
        >
          {Ic.plus} {t.addManual}
        </button>
      )}
    </>
  )
}

/** Sheet keypad kecil utk mengubah jumlah bayar satu pemesan. */
function PaidSheet({
  title,
  doneLabel,
  initial,
  currency,
  onClose,
  onSave,
}: {
  title: string
  doneLabel: string
  initial: number
  currency: Currency
  onClose: () => void
  onSave: (n: number) => void
}) {
  const [value, setValue] = useState(initial)
  return (
    <div
      className="sheet-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="sheet__handle" />
        <div className="sheet__title">{title}</div>
        <MoneyKeypad value={value} onChange={setValue} currency={currency} onEnter={() => onSave(value)} onEscape={onClose} />
        <button className="btn btn--primary" style={{ marginTop: 14 }} onClick={() => onSave(value)}>
          {doneLabel}
        </button>
      </div>
    </div>
  )
}

/** Sheet terima pembayaran: tagihan tampil, ketik uang diterima, kembalian dihitung langsung. */
function PaySheet({
  bill,
  currency,
  labels,
  onClose,
  onConfirm,
}: {
  bill: number
  currency: Currency
  labels: {
    title: string
    total: string
    received: string
    change: string
    shortBy: string
    settle: string
    partial: string
  }
  onClose: () => void
  onConfirm: (received: number) => void
}) {
  const [received, setReceived] = useState(bill) // mulai dari "uang pas"
  const diff = received - bill
  return (
    <div
      className="sheet-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="sheet__handle" />
        <div className="sheet__title">{labels.title}</div>
        <div className="detail-line" style={{ borderTop: 'none' }}>
          <span className="detail-line__label">{labels.total}</span>
          <span className="detail-line__value money">{formatMoney(bill, currency)}</span>
        </div>
        <div className="section-label" style={{ marginTop: 8 }}>{labels.received}</div>
        <MoneyKeypad
          value={received}
          onChange={setReceived}
          currency={currency}
          onEnter={() => received > 0 && onConfirm(received)}
          onEscape={onClose}
        />
        <div className="detail-line">
          <span
            className="detail-line__label"
            style={{ color: diff >= 0 ? 'var(--good)' : 'var(--bad)' }}
          >
            {diff >= 0 ? labels.change : labels.shortBy}
          </span>
          <span
            className="detail-line__value"
            style={{ color: diff >= 0 ? 'var(--good)' : 'var(--bad)', fontWeight: 800 }}
          >
            {formatMoney(Math.abs(diff), currency)}
          </span>
        </div>
        <button
          className="btn btn--primary"
          style={{ marginTop: 12 }}
          onClick={() => onConfirm(received)}
          disabled={received <= 0}
        >
          {diff >= 0 ? labels.settle : labels.partial}
        </button>
      </div>
    </div>
  )
}
