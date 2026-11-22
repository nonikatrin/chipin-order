import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import AppBar from '../../components/AppBar'
import { Ic } from '../../components/icons'
import { usePOStore, usePOEvent } from '../../po/store'
import { useToast } from '../../components/Toast'
import { useLangStore } from '../../utils/langStore'
import { parseOrders } from '../../po/parse'
import { findOrderCode } from '../../utils/orderLink'
import { formatMoney } from '../../utils/format'
import type { ID, POMenu } from '../../po/types'

const strings = {
  id: {
    title: 'Salin Pesanan',
    needMenu: 'Atur menu dulu sebelum menyalin pesanan.',
    setupMenu: 'Atur Menu',
    label: 'Salin chat WhatsApp atau baris spreadsheet',
    hint: 'Satu pemesan per baris. Sistem akan mencoba membaca nama, pesanan, dan jumlah bayar — Anda bisa periksa & buang baris yang salah sebelum menyimpan.',
    preview: 'Pratinjau deteksi',
    chat: '💬 Chat',
    table: '📊 Tabel',
    paid: 'Bayar',
    total: 'Total',
    include: 'Dipakai',
    skip: 'Diabaikan',
    save: (n: number) => `✅ Simpan ${n} pemesan`,
    saved: (n: number) => `✓ ${n} pemesan ditambahkan`,
    noItems: '⚠️ Tidak ada menu terbaca',
    cashPromised: 'COD (bayar di tempat)',
    review: 'Perlu ditinjau',
    auto: 'Otomatis',
    maybe: 'Mungkin maksud',
    note: 'Catatan (opsional)',
    codeDetected: (n: string, k: number) => `Kode pesanan terdeteksi: ${n} — ${k} item`,
    codeAdd: 'Tambahkan ke PO ini',
    codeWrongPo: 'Kode ini untuk PO lain — buka PO yang sesuai, atau tempel di Formulir Pesan.',
    codeAdded: '✓ Pesanan dari kode ditambahkan',
    method: {
      zelle: 'Zelle',
      venmo: 'Venmo',
      cash: 'Tunai',
      transfer: 'Transfer',
      other: 'Lainnya',
      unstated: '',
    } as Record<string, string>,
  },
  en: {
    title: 'Paste Orders',
    needMenu: 'Set up menus before pasting orders.',
    setupMenu: 'Set Up Menu',
    label: 'Paste WhatsApp chat or spreadsheet rows',
    hint: 'One buyer per line. The app tries to read name, items, and amount paid — review & drop wrong rows before saving.',
    preview: 'Detection preview',
    chat: '💬 Chat',
    table: '📊 Table',
    paid: 'Paid',
    total: 'Total',
    include: 'Included',
    skip: 'Skipped',
    save: (n: number) => `✅ Save ${n} buyers`,
    saved: (n: number) => `✓ ${n} buyers added`,
    noItems: '⚠️ No items detected',
    cashPromised: 'Cash on Delivery',
    review: 'Needs review',
    auto: 'Auto',
    maybe: 'Maybe',
    note: 'Note (optional)',
    codeDetected: (n: string, k: number) => `Order code detected: ${n} — ${k} items`,
    codeAdd: 'Add to this PO',
    codeWrongPo: 'This code belongs to another PO — open that PO, or paste it in the Order Form page.',
    codeAdded: '✓ Order from code added',
    method: {
      zelle: 'Zelle',
      venmo: 'Venmo',
      cash: 'Cash',
      transfer: 'Transfer',
      other: 'Other',
      unstated: '',
    } as Record<string, string>,
  },
}

export default function POPastePage() {
  const { poId } = useParams()
  const navigate = useNavigate()
  const event = usePOEvent(poId)
  const importBuyers = usePOStore((s) => s.importBuyers)
  const addBuyer = usePOStore((s) => s.addBuyer)
  const showToast = useToast((s) => s.show)
  const { currentLang } = useLangStore()
  const t = strings[currentLang] ?? strings.id

  const [text, setText] = useState('')
  const [skip, setSkip] = useState<Set<number>>(new Set())
  // Catatan per baris — terisi otomatis dari teks yang tak terbaca ("Item tak
  // dikenali") supaya pesan warga tidak hilang; boleh disunting sebelum simpan.
  const [notes, setNotes] = useState<Record<number, string>>({})

  const cur = event?.currency ?? 'IDR'
  const menus = event?.menus ?? []
  const menuMap = useMemo(() => {
    const m = new Map<ID, POMenu>()
    menus.forEach((x) => m.set(x.id, x))
    return m
  }, [menus])

  const rows = useMemo(() => parseOrders(text, menus, cur), [text, menus, cur])
  // Kode pesanan (dari formulir /pesan) yang tertempel di sini tetap dikenali —
  // jebakan umum: pembeli mengirim kode, penjual menempelnya di halaman ini.
  const codeOrder = useMemo(() => (text.trim() ? findOrderCode(text) : null), [text])

  if (!event) return <Navigate to="/" replace />

  const billOf = (lines: { menuId: ID; qty: number }[]) =>
    lines.reduce((s, l) => s + (menuMap.get(l.menuId)?.sellPrice ?? 0) * l.qty, 0)

  const importable = rows
    .map((r, i) => ({ r, i }))
    .filter(({ r, i }) => !skip.has(i) && r.lines.length > 0)

  const noteOf = (i: number, r: (typeof rows)[number]) =>
    notes[i] ?? (r.unmatched.length > 0 ? r.unmatched.join(', ') : '')

  function toggleSkip(i: number) {
    setSkip((prev) => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  function save() {
    if (importable.length === 0) return
    importBuyers(
      event!.id,
      importable.map(({ r, i }) => {
        const bill = billOf(r.lines)
        return {
          name: r.name,
          phone: r.phone,
          lines: r.lines,
          paid: r.paid,
          // Tunai = "janji bayar saat ambil" → belum lunas; lainnya lunas bila cukup.
          settled:
            r.paymentStatus === 'paid' && r.paid > 0 && r.paid >= bill,
          note: noteOf(i, r).trim() || undefined,
          statedTotal: r.statedTotal,
          paymentMethod: r.paymentMethod,
          paymentStatus: r.paymentStatus,
          amountReceived: r.paymentMethod === 'cash' ? r.paid || undefined : undefined,
          confirmation: r.needsReview ? 'needs-review' : 'auto',
          reviewReasons: r.reviewReasons,
        }
      }),
    )
    showToast(t.saved(importable.length))
    navigate(`/po/${event!.id}`, { replace: true })
  }

  if (menus.length === 0) {
    return (
      <>
        <AppBar title={t.title} backTo={`/po/${event.id}`} />
        <main className="page">
          <div className="empty">
            <div className="empty__emoji">🍱</div>
            <p className="empty__text">{t.needMenu}</p>
            <button
              type="button"
              className="btn btn--primary"
              style={{ marginTop: 18 }}
              onClick={() => navigate(`/po/${event.id}/menu`)}
            >
              {Ic.clipboard} {t.setupMenu}
            </button>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <AppBar title={t.title} backTo={`/po/${event.id}`} />

      <main className="page">
        <div className="field" style={{ marginTop: 16 }}>
          <label className="field__label">{t.label}</label>
          <p className="field__hint">{t.hint}</p>
          <textarea
            className="textarea"
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              // Baris berubah → indeks bergeser; buang suntingan catatan lama.
              setNotes({})
            }}
            placeholder={
              'Bu Yany, 2 Nasi Kuning, 1 Pepes, bayar 100rb\nPak Budi: Mie 2, Sate 1\nBu Sri\t3 Nasi Kuning\t45000'
            }
          />
        </div>

        {codeOrder && codeOrder.poId === event.id && (
          <div className="parsed-card" style={{ borderColor: 'var(--good)' }}>
            <b>
              {t.codeDetected(
                codeOrder.name || '—',
                codeOrder.lines.reduce((s2, l) => s2 + l.qty, 0),
              )}
            </b>
            <div style={{ marginTop: 6 }}>
              {codeOrder.lines.map((l, li) => (
                <span key={li} className="chip">
                  {l.qty}× {menuMap.get(l.menuId)?.name ?? '?'}
                </span>
              ))}
            </div>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              style={{ marginTop: 10, width: 'auto' }}
              onClick={() => {
                addBuyer(event.id, {
                  name: codeOrder.name || 'Tanpa Nama',
                  phone: codeOrder.phone,
                  lines: codeOrder.lines.filter((l) => menuMap.has(l.menuId) && l.qty > 0),
                  paid: 0,
                  settled: false,
                  paymentStatus: 'unpaid',
                  confirmation: 'auto',
                  fulfillment: codeOrder.fulfillment,
                  fulfillmentStatus: 'pending',
                  deliveryAddress: codeOrder.fulfillment === 'delivery' ? codeOrder.address : undefined,
                  deliveryNote: codeOrder.note,
                })
                showToast(t.codeAdded)
                navigate(`/po/${event.id}`, { replace: true })
              }}
            >
              {Ic.check} {t.codeAdd}
            </button>
          </div>
        )}
        {codeOrder && codeOrder.poId !== event.id && (
          <div className="card card--flat banner-warn">
            <span>{t.codeWrongPo}</span>
          </div>
        )}

        {!codeOrder && rows.length > 0 && (
          <>
            <div className="section-label">
              {t.preview} ({importable.length}/{rows.length})
            </div>
            {rows.map((row, idx) => {
              const skipped = skip.has(idx) || row.lines.length === 0
              const hasWarn = row.warnings.length > 0 || row.lines.length === 0
              const bill = billOf(row.lines)
              return (
                <div
                  key={idx}
                  className={'parsed-card' + (hasWarn ? ' has-warn' : '')}
                  style={skipped ? { opacity: 0.5 } : undefined}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <b style={{ fontSize: '1.1rem' }}>{row.name || '—'}</b>
                    <button
                      type="button"
                      className={
                        'tap-status ' +
                        (skipped ? 'tap-status--belum' : 'tap-status--lunas')
                      }
                      style={{ minHeight: 38, padding: '4px 12px' }}
                      onClick={() => toggleSkip(idx)}
                    >
                      {skipped ? t.skip : t.include}
                    </button>
                  </div>
                  <div style={{ marginTop: 2 }}>
                    {row.lines.map((l, li) => {
                      const menu = menuMap.get(l.menuId)
                      const ppu = menu?.piecesPerUnit ?? 1
                      return (
                        <span key={li} className="chip">
                          {l.qty}× {menu?.name ?? '?'}
                          {ppu > 1 ? ` (${l.qty * ppu} pcs)` : ''}
                        </span>
                      )
                    })}
                    {row.lines.length === 0 && (
                      <span className="chip chip--warn">{t.noItems}</span>
                    )}
                  </div>
                  <div className="ledger__bottom">
                    <span className="pill pill--neutral">
                      {row.source === 'chat' ? t.chat : t.table}
                    </span>
                    <span className="pill pill--neutral">
                      {t.total}: {formatMoney(bill, cur)}
                    </span>
                    {row.paid > 0 && (
                      <span
                        className={
                          'pill ' +
                          (row.paymentStatus === 'promised-cash'
                            ? 'pill--warm'
                            : 'pill--good')
                        }
                      >
                        {row.paymentStatus === 'promised-cash' ? t.cashPromised : t.paid}:{' '}
                        {formatMoney(row.paid, cur)}
                      </span>
                    )}
                    {row.paymentMethod && row.paymentMethod !== 'unstated' && (
                      <span className="pill pill--neutral">
                        {t.method[row.paymentMethod] ?? row.paymentMethod}
                      </span>
                    )}
                    <span
                      className={'pill ' + (row.needsReview ? 'pill--warn' : 'pill--good')}
                    >
                      {row.needsReview ? t.review : t.auto}
                    </span>
                  </div>
                  {row.candidates.length > 0 && (
                    <div className="warn-text" style={{ color: 'var(--info)' }}>
                      💡 {t.maybe}:{' '}
                      {row.candidates
                        .map((c) => `"${c.token}" → ${c.options.map((o) => o.name).join(' / ')}`)
                        .join(' · ')}
                    </div>
                  )}
                  {row.reviewReasons.length > 0 && (
                    <div className="warn-text">⚠️ {row.reviewReasons.join(' · ')}</div>
                  )}
                  {row.unmatched.length > 0 && !skipped && (
                    <div className="field" style={{ marginTop: 8, marginBottom: 0 }}>
                      <label className="field__label" htmlFor={`row-note-${idx}`}>
                        {t.note}
                      </label>
                      <input
                        id={`row-note-${idx}`}
                        className="input"
                        value={noteOf(idx, row)}
                        onChange={(e) =>
                          setNotes((prev) => ({ ...prev, [idx]: e.target.value }))
                        }
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </main>

      <div className="dock">
        <button
          type="button"
          className="btn btn--primary btn--lg"
          disabled={importable.length === 0}
          onClick={save}
        >
          {t.save(importable.length)}
        </button>
      </div>
    </>
  )
}
