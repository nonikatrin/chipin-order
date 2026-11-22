import { useMemo, useState } from 'react'
import AppBar from '../components/AppBar'
import { Ic } from '../components/icons'
import { useLangStore } from '../utils/langStore'
import { usePOStore } from '../po/store'
import { useProfileStore } from '../utils/profileStore'
import { useFaqStore } from '../utils/faqStore'
import { useToast } from '../components/Toast'
import { formatMoney } from '../utils/format'
import { allergenLabel } from '../utils/allergens'
import { sharePO } from '../po/whatsapp'
import {
  encodeForm,
  formLink,
  findOrderCode,
  type OrderFormData,
  type FormMenu,
} from '../utils/orderLink'
import type { POEvent } from '../po/types'

const STR = {
  id: {
    title: 'Formulir Pesanan',
    subtitle: 'Bagikan tautan, terima pesanan — nomor pribadi tetap privat',
    pickPo: 'Pilih Buku Pesanan',
    noPo: 'Belum ada PO aktif. Buat dulu satu Buku Pesanan.',
    linkTitle: 'Tautan Formulir Pesan',
    linkHint: 'Tetangga buka tautan ini, isi pesanan, lalu kirim balik kode pesanannya. Nomor WA-mu tidak ikut dibagikan.',
    copyLink: 'Salin tautan',
    shareLink: 'Bagikan',
    copied: 'Tautan disalin',
    faqTitle: 'FAQ (bisa diedit)',
    faqHint: 'Ikut ditempel di tautan formulir. Pertanyaan di luar ini kamu jawab sendiri — jangan menebak (alergen/halal).',
    seedFaq: 'Isi contoh dari PO ini',
    addFaq: 'Tambah pertanyaan',
    q: 'Pertanyaan',
    a: 'Jawaban',
    save: 'Simpan',
    cancel: 'Batal',
    del: 'Hapus',
    edit: 'Edit',
    importTitle: 'Terima Kode Pesanan',
    importHint: 'Tempel kode pesanan yang dikirim pembeli. Akan ditambahkan sebagai pesanan di PO yang sesuai.',
    importPh: 'Tempel kode pesanan di sini…',
    importBtn: 'Tambahkan ke PO',
    importBad: 'Kode pesanan tidak valid.',
    importNoPo: 'PO untuk kode ini tidak ditemukan.',
    importNoItems: 'Kode ini tidak berisi item yang cocok dengan menu PO.',
    importOk: 'Pesanan ditambahkan',
    faqEmpty: 'Belum ada FAQ.',
    pickup: 'Ambil sendiri',
    delivery: 'Diantar',
  },
  en: {
    title: 'Order Form',
    subtitle: 'Share a link, receive orders — your private number stays private',
    pickPo: 'Pick Order Book',
    noPo: 'No active PO yet. Create an Order Book first.',
    linkTitle: 'Order Form Link',
    linkHint: 'Neighbours open this link, fill an order, then send back the order code. Your WhatsApp number is not shared.',
    copyLink: 'Copy link',
    shareLink: 'Share',
    copied: 'Link copied',
    faqTitle: 'FAQ (editable)',
    faqHint: 'Bundled into the form link. Questions outside this you answer yourself — never guess (allergens/halal).',
    seedFaq: 'Seed from this PO',
    addFaq: 'Add question',
    q: 'Question',
    a: 'Answer',
    save: 'Save',
    cancel: 'Cancel',
    del: 'Delete',
    edit: 'Edit',
    importTitle: 'Receive Order Code',
    importHint: 'Paste the order code a buyer sent you. It will be added as an order to the matching PO.',
    importPh: 'Paste order code here…',
    importBtn: 'Add to PO',
    importBad: 'Invalid order code.',
    importNoPo: 'No PO found for this code.',
    importNoItems: 'This code has no items matching the PO menu.',
    importOk: 'Order added',
    faqEmpty: 'No FAQ yet.',
    pickup: 'Pickup',
    delivery: 'Delivery',
  },
} as const

/** FAQ contoh yang auto-terjawab dari data PO. */
function starterFaq(event: POEvent, lang: 'id' | 'en'): { q: string; a: string }[] {
  const priceList = event.menus
    .map((m) => `${m.name} ${formatMoney(m.sellPrice, event.currency)}`)
    .join(', ')
  const allergenKeys = Array.from(new Set(event.menus.flatMap((m) => m.allergens ?? [])))
  const allergenText = allergenKeys.length
    ? allergenKeys.map((k) => allergenLabel(k, lang)).join(', ')
    : lang === 'en'
      ? 'none marked'
      : 'tidak ada yang ditandai'
  if (lang === 'en') {
    return [
      { q: 'How much are the items?', a: priceList || 'See the menu list above.' },
      { q: 'When is the order deadline?', a: event.orderDeadline || 'Please ask — deadline not set.' },
      { q: 'When is delivery/pickup?', a: event.deliveryDate || 'To be confirmed.' },
      { q: 'Pickup or delivery?', a: 'Both — choose on the form. Delivery needs an address.' },
      { q: 'Any allergen info?', a: `Marked allergens across menus: ${allergenText}. For halal/other, I'll confirm personally.` },
    ]
  }
  return [
    { q: 'Berapa harganya?', a: priceList || 'Lihat daftar menu di atas.' },
    { q: 'Batas pesan sampai kapan?', a: event.orderDeadline || 'Silakan tanya — batas belum diatur.' },
    { q: 'Kapan dikirim/diambil?', a: event.deliveryDate || 'Menyusul dikonfirmasi.' },
    { q: 'Bisa diantar atau ambil sendiri?', a: 'Dua-duanya — pilih di formulir. Diantar perlu alamat.' },
    { q: 'Ada info alergen?', a: `Alergen yang ditandai di menu: ${allergenText}. Untuk halal/lainnya, saya konfirmasi langsung.` },
  ]
}

export default function IntakePage() {
  const { currentLang } = useLangStore()
  const t = STR[currentLang] ?? STR.id
  const toast = useToast()
  const events = usePOStore((s) => s.events)
  const addBuyer = usePOStore((s) => s.addBuyer)
  const profile = useProfileStore((s) => s.profile)
  const faq = useFaqStore()

  const activeEvents = useMemo(() => events.filter((e) => e.status !== 'closed'), [events])
  const [poId, setPoId] = useState<string>(() => activeEvents[0]?.id ?? '')
  const event = activeEvents.find((e) => e.id === poId) ?? activeEvents[0]

  // FAQ editor state
  const [draftQ, setDraftQ] = useState('')
  const [draftA, setDraftA] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editQ, setEditQ] = useState('')
  const [editA, setEditA] = useState('')

  // Import state
  const [importText, setImportText] = useState('')

  if (!event) {
    return (
      <>
        <AppBar title={t.title} subtitle={t.subtitle} backTo="/" />
        <main className="page" style={{ paddingTop: 20 }}>
          <div className="card" style={{ padding: 20 }}>
            <p className="muted">{t.noPo}</p>
          </div>
        </main>
      </>
    )
  }

  const formData: OrderFormData = {
    v: 1,
    poId: event.id,
    name: event.name,
    emoji: event.emoji,
    currency: event.currency,
    place: event.place,
    deadline: event.orderDeadline,
    delivery: event.deliveryDate,
    store: profile.storeName,
    menus: event.menus.map<FormMenu>((m) => ({
      id: m.id,
      name: m.name,
      emoji: m.emoji,
      price: m.sellPrice,
      desc: m.description,
      allergens: m.allergens,
      quota: m.maxQuota,
    })),
    faq: faq.items.map((it) => ({ q: it.q, a: it.a })),
  }
  const link = formLink(encodeForm(formData))

  function handleImport() {
    const order = findOrderCode(importText)
    if (!order) {
      toast.show(t.importBad)
      return
    }
    const target = events.find((e) => e.id === order.poId)
    if (!target) {
      toast.show(t.importNoPo)
      return
    }
    const validLines = order.lines
      .filter((l) => target.menus.some((m) => m.id === l.menuId) && l.qty > 0)
      .map((l) => ({ menuId: l.menuId, qty: Math.round(l.qty) }))
    if (validLines.length === 0) {
      toast.show(t.importNoItems)
      return
    }
    addBuyer(target.id, {
      name: order.name || 'Tanpa Nama',
      phone: order.phone,
      lines: validLines,
      paid: 0,
      settled: false,
      paymentStatus: 'unpaid',
      confirmation: 'auto',
      fulfillment: order.fulfillment,
      fulfillmentStatus: 'pending',
      deliveryAddress: order.fulfillment === 'delivery' ? order.address : undefined,
      deliveryNote: order.note,
    })
    setImportText('')
    toast.show(`${t.importOk} · ${target.name}`)
  }

  return (
    <>
      <AppBar title={t.title} subtitle={t.subtitle} backTo="/" />
      <main className="page" style={{ paddingTop: 20 }}>
        <label className="field" style={{ display: 'grid', gap: 6, marginBottom: 14 }}>
          <span className="field__label">{t.pickPo}</span>
          <select className="input input--select" value={event.id} onChange={(e) => setPoId(e.target.value)}>
            {activeEvents.map((e) => (
              <option key={e.id} value={e.id}>{e.emoji} {e.name}</option>
            ))}
          </select>
        </label>

        {/* A. Order form link */}
        <div className="section-label">{Ic.link} {t.linkTitle}</div>
        <div className="card" style={{ padding: 14 }}>
          <p className="field__hint" style={{ margin: '0 0 10px' }}>{t.linkHint}</p>
          <input className="input" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              style={{ flex: 1 }}
              onClick={() => { void navigator.clipboard?.writeText(link); toast.show(t.copied) }}
            >
              {Ic.copy} {t.copyLink}
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              style={{ flex: 1 }}
              onClick={() => void sharePO(link)}
            >
              {Ic.share} {t.shareLink}
            </button>
          </div>
        </div>

        {/* B. FAQ editor */}
        <div className="section-label" style={{ marginTop: 22 }}>{t.faqTitle}</div>
        <div className="card" style={{ padding: 14 }}>
          <p className="field__hint" style={{ margin: '0 0 10px' }}>{t.faqHint}</p>

          {faq.items.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span className="muted">{t.faqEmpty}</span>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => faq.seed(starterFaq(event, currentLang))}>
                {t.seedFaq}
              </button>
            </div>
          ) : (
            <div className="faq-list">
              {faq.items.map((it) =>
                editId === it.id ? (
                  <div key={it.id} className="faq-item faq-item--edit">
                    <input className="input" value={editQ} onChange={(e) => setEditQ(e.target.value)} placeholder={t.q} />
                    <textarea className="input" value={editA} onChange={(e) => setEditA(e.target.value)} placeholder={t.a} rows={2} />
                    <div className="faq-item__actions">
                      <button type="button" className="btn btn--primary btn--sm" onClick={() => { faq.update(it.id, { q: editQ, a: editA }); setEditId(null) }}>{t.save}</button>
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditId(null)}>{t.cancel}</button>
                    </div>
                  </div>
                ) : (
                  <div key={it.id} className="faq-item">
                    <div className="faq-item__body">
                      <div className="faq-item__q">{it.q}</div>
                      <div className="faq-item__a">{it.a}</div>
                    </div>
                    <div className="faq-item__actions">
                      <button type="button" className="iconbtn iconbtn--soft" aria-label={t.edit} title={t.edit} onClick={() => { setEditId(it.id); setEditQ(it.q); setEditA(it.a) }}>{Ic.edit}</button>
                      <button type="button" className="iconbtn iconbtn--soft" aria-label={t.del} title={t.del} onClick={() => faq.remove(it.id)}>{Ic.trash}</button>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}

          <div className="faq-add">
            <input className="input" placeholder={t.q} value={draftQ} onChange={(e) => setDraftQ(e.target.value)} />
            <textarea className="input" placeholder={t.a} value={draftA} onChange={(e) => setDraftA(e.target.value)} rows={2} />
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={!draftQ.trim() || !draftA.trim()}
              onClick={() => { faq.add(draftQ, draftA); setDraftQ(''); setDraftA('') }}
            >
              {Ic.plus} {t.addFaq}
            </button>
          </div>
        </div>

        {/* C. Import order code */}
        <div className="section-label" style={{ marginTop: 22 }}>{Ic.inbox} {t.importTitle}</div>
        <div className="card" style={{ padding: 14 }}>
          <p className="field__hint" style={{ margin: '0 0 10px' }}>{t.importHint}</p>
          <textarea
            className="input"
            style={{ minHeight: 90, resize: 'vertical', fontFamily: 'monospace', fontSize: '0.8rem' }}
            placeholder={t.importPh}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
          />
          <button
            type="button"
            className="btn btn--primary btn--sm"
            style={{ marginTop: 10 }}
            disabled={!importText.trim()}
            onClick={handleImport}
          >
            {Ic.check} {t.importBtn}
          </button>
        </div>
      </main>
    </>
  )
}
