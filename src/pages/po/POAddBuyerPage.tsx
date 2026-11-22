import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import AppBar from '../../components/AppBar'
import { Ic } from '../../components/icons'
import MoneyKeypad from '../../components/MoneyKeypad'
import { MenuThumb } from '../../components/MenuThumb'
import { usePOStore, usePOEvent } from '../../po/store'
import { useToast } from '../../components/Toast'
import { useLangStore } from '../../utils/langStore'
import { formatMoney } from '../../utils/format'
import type { ID, FulfillmentMode } from '../../po/types'

const strings = {
  id: {
    title: 'Pesanan Baru',
    name: 'Nama pemesan',
    namePh: 'Contoh: Bu Sri',
    phone: 'No. WhatsApp (opsional)',
    phonePh: '0812xxxx',
    note: 'Catatan (opsional)',
    notePh: 'Contoh: sama kerupuknya ya',
    posHint: 'Ketuk menu untuk menambah ke keranjang',
    left: (n: number) => `sisa ${n}`,
    soldOut: 'habis',
    summary: 'Ringkasan Pesanan',
    total: 'Total',
    tip: '💝 Tip / Donasi',
    payLabel: 'Pembayaran',
    payLunas: 'Lunas',
    payLater: 'Bayar nanti',
    payCustom: 'Nominal…',
    emptyCart: 'Keranjang kosong — ketuk menu di kiri',
    emptyCartMobile: 'Keranjang kosong — ketuk menu di atas',
    waitlistWarn: 'Sebagian melebihi kuota — masuk daftar tunggu (menunggu konfirmasi).',
    fulfillment: 'Pengambilan / Pengiriman',
    pickup: 'Ambil Sendiri',
    pickupSub: 'Pembeli mengambil',
    delivery: 'Diantar',
    deliverySub: 'Kamu mengantar',
    address: 'Alamat pengantaran',
    addressPh: 'Contoh: Jl. Merpati No.12',
    deliveryNote: 'Catatan pengantaran (opsional)',
    deliveryNotePh: 'Contoh: telepon sebelum sampai',
    deliveryFee: 'Ongkir (dibayar pembeli)',
    courierCost: 'Biaya kurir (opsional)',
    save: '✓ Simpan Pesanan',
    done: '✓ Selesai',
    saved: '✓ Pesanan tersimpan',
    needName: 'Isi nama pemesan dulu',
  },
  en: {
    title: 'New Order',
    name: 'Buyer name',
    namePh: 'e.g. Bu Sri',
    phone: 'WhatsApp no. (optional)',
    phonePh: '0812xxxx',
    note: 'Note (optional)',
    notePh: 'e.g. extra crackers please',
    posHint: 'Tap a menu to add it to the cart',
    left: (n: number) => `${n} left`,
    soldOut: 'sold out',
    summary: 'Order Summary',
    total: 'Total',
    tip: '💝 Tip / donation',
    payLabel: 'Payment',
    payLunas: 'Paid',
    payLater: 'Pay later',
    payCustom: 'Amount…',
    emptyCart: 'Cart is empty — tap a menu on the left',
    emptyCartMobile: 'Cart is empty — tap a menu above',
    waitlistWarn: 'Some items are over quota — will go to the waitlist (pending confirmation).',
    fulfillment: 'Fulfillment',
    pickup: 'Pickup',
    pickupSub: 'Buyer collects',
    delivery: 'Delivery',
    deliverySub: 'You deliver',
    address: 'Delivery address',
    addressPh: 'e.g. Jl. Merpati No.12',
    deliveryNote: 'Delivery note (optional)',
    deliveryNotePh: 'e.g. call before arriving',
    deliveryFee: 'Delivery fee (paid by buyer)',
    courierCost: 'Courier cost (optional)',
    save: '✓ Save Order',
    done: '✓ Done',
    saved: '✓ Order saved',
    needName: 'Enter the buyer name first',
  },
}

export default function POAddBuyerPage() {
  const { poId } = useParams()
  const navigate = useNavigate()
  const event = usePOEvent(poId)
  const addBuyer = usePOStore((s) => s.addBuyer)
  const showToast = useToast((s) => s.show)
  const { currentLang } = useLangStore()
  const t = strings[currentLang] ?? strings.id

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [qtys, setQtys] = useState<Record<ID, number>>({})
  const [paid, setPaid] = useState(0)
  const [settled, setSettled] = useState(false)
  const [keypad, setKeypad] = useState(false)
  const [donation, setDonation] = useState(0)
  const [fulfill, setFulfill] = useState<FulfillmentMode>('pickup')
  const [addr, setAddr] = useState('')
  const [dnote, setDnote] = useState('')
  const [dfee, setDfee] = useState(0)
  const [courier, setCourier] = useState(0)

  const bill = useMemo(() => {
    if (!event) return 0
    return event.menus.reduce((s, m) => s + m.sellPrice * (qtys[m.id] ?? 0), 0)
  }, [event, qtys])

  const remaining = useMemo(() => {
    const m = new Map<ID, number>()
    if (!event) return m
    for (const menu of event.menus) {
      if (menu.maxQuota == null) continue
      let used = 0
      for (const b of event.buyers) {
        if (b.waitlist) continue
        for (const l of b.lines) if (l.menuId === menu.id) used += l.qty
      }
      m.set(menu.id, Math.max(0, menu.maxQuota - used))
    }
    return m
  }, [event])

  const overQuota = useMemo(() => {
    for (const [id, q] of Object.entries(qtys)) {
      if (q > 0 && remaining.has(id) && q > (remaining.get(id) ?? 0)) return true
    }
    return false
  }, [qtys, remaining])

  if (!event) return <Navigate to="/" replace />
  const cur = event.currency

  const lineCount = Object.values(qtys).filter((q) => q > 0).length
  const deliveryFee = fulfill === 'delivery' ? dfee : 0
  const grandTotal = bill + deliveryFee
  const hasOrder = lineCount > 0 || donation > 0
  const canSave = name.trim().length > 0 && hasOrder && (fulfill !== 'delivery' || addr.trim().length > 0)
  const chosenMenus = event.menus.filter((m) => (qtys[m.id] ?? 0) > 0)

  // Functional updater → tap cepat POS menjumlah dengan benar, tak baca state basi.
  function bump(id: ID, delta: number) {
    setQtys((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }))
  }
  function addOne(id: ID) {
    if (!name.trim()) showToast(t.needName)
    bump(id, 1)
  }
  function markLunas() {
    setPaid(grandTotal)
    setSettled(true)
  }
  function markLater() {
    setPaid(0)
    setSettled(false)
  }

  function save() {
    if (!canSave || !event) return
    const lines = event.menus
      .filter((m) => (qtys[m.id] ?? 0) > 0)
      .map((m) => ({ menuId: m.id, qty: qtys[m.id] }))
    addBuyer(event.id, {
      name,
      phone,
      lines,
      note,
      paid,
      settled: lineCount === 0 && donation > 0 ? true : settled,
      donation: donation > 0 ? donation : undefined,
      waitlist: overQuota,
      fulfillment: fulfill,
      deliveryAddress: fulfill === 'delivery' ? addr : undefined,
      deliveryNote: fulfill === 'delivery' ? dnote : undefined,
      deliveryFee: fulfill === 'delivery' && dfee > 0 ? dfee : undefined,
      courierCost: fulfill === 'delivery' && courier > 0 ? courier : undefined,
    })
    showToast(t.saved)
    navigate(`/po/${event.id}`, { replace: true })
  }

  return (
    <>
      <AppBar title={t.title} backTo={`/po/${event.id}`} />

      <main className="page pos">
        <div className="pos-split">
          {/* LEFT — buyer + menu grid */}
          <section className="pos-main">
            <div className="pos-head">
              <input
                className="input"
                placeholder={t.namePh}
                aria-label={t.name}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
              />
              <input
                className="input"
                type="tel"
                inputMode="tel"
                placeholder={t.phonePh}
                aria-label={t.phone}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <p className="field__hint pos-hint">{Ic.clipboard} {t.posHint}</p>

            <div className="pos-grid">
              {event.menus.map((m) => {
                const q = qtys[m.id] ?? 0
                const left = remaining.get(m.id)
                const sold = left === 0
                return (
                  <div
                    key={m.id}
                    role="button"
                    tabIndex={0}
                    className={'pos-tile' + (q > 0 ? ' is-active' : '') + (sold ? ' is-sold' : '')}
                    onClick={() => addOne(m.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addOne(m.id) } }}
                  >
                    {q > 0 && <span className="pos-tile__qty">{q}</span>}
                    <MenuThumb menu={m} />
                    <div className="pos-tile__name">{m.name}</div>
                    <div className="pos-tile__price">{formatMoney(m.sellPrice, cur)}</div>
                    {left != null && (
                      <span className={'pill pos-tile__left ' + (sold ? 'pill--warn' : 'pill--neutral')}>
                        {sold ? t.soldOut : t.left(left)}
                      </span>
                    )}
                    {q > 0 && (
                      <button
                        type="button"
                        className="pos-tile__minus"
                        aria-label="−"
                        onClick={(e) => { e.stopPropagation(); bump(m.id, -1) }}
                      >
                        −
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* RIGHT — summary + checkout (split panel, always visible) */}
          <aside className="pos-summary">
            <div className="pos-summary__title">{t.summary}{name.trim() ? ` · ${name.trim()}` : ''}</div>

            <div className="pos-sum">
              {chosenMenus.map((m) => (
                <div key={m.id} className="pos-sum__row">
                  <span>{qtys[m.id]}× {m.name}</span>
                  <span>{formatMoney(m.sellPrice * qtys[m.id], cur)}</span>
                </div>
              ))}
              {fulfill === 'delivery' && dfee > 0 && (
                <div className="pos-sum__row"><span>{t.deliveryFee}</span><span>{formatMoney(dfee, cur)}</span></div>
              )}
              {donation > 0 && (
                <div className="pos-sum__row"><span>{t.tip}</span><span>{formatMoney(donation, cur)}</span></div>
              )}
              {lineCount === 0 && donation === 0 && <div className="pos-sum__empty">{t.emptyCart}</div>}
              <div className="pos-sum__total"><span>{t.total}</span><strong>{formatMoney(grandTotal, cur)}</strong></div>
            </div>

            {/* Payment quick actions */}
            <div className="field__label" style={{ marginTop: 8 }}>{t.payLabel}</div>
            <div className="pos-pay">
              <button type="button" className={'pos-pay__chip' + (settled && paid >= grandTotal ? ' is-on' : '')} onClick={markLunas}>
                ✓ {t.payLunas}
              </button>
              <button type="button" className={'pos-pay__chip' + (!settled && paid === 0 ? ' is-on' : '')} onClick={markLater}>
                {t.payLater}
              </button>
              <button type="button" className="pos-pay__chip" onClick={() => setKeypad(true)}>
                {t.payCustom} {paid > 0 && paid !== grandTotal ? `(${formatMoney(paid, cur)})` : ''}
              </button>
            </div>

            {/* Tip / donation */}
            <label className="field" style={{ marginTop: 12 }}>
              <span className="field__label">{t.tip}</span>
              <input className="input" type="number" inputMode="decimal" min={0} value={donation || ''} onChange={(e) => setDonation(Math.max(0, Number(e.target.value) || 0))} />
            </label>

            {/* Note */}
            <label className="field">
              <span className="field__label">{t.note}</span>
              <input className="input" placeholder={t.notePh} value={note} onChange={(e) => setNote(e.target.value)} autoComplete="off" />
            </label>

            {/* Fulfillment */}
            <div className="field__label" style={{ marginTop: 4 }}>{Ic.send} {t.fulfillment}</div>
            <div className="fulfill">
              <button type="button" className={'fulfill__opt' + (fulfill === 'pickup' ? ' fulfill__opt--on' : '')} onClick={() => setFulfill('pickup')}>
                <span className="fulfill__ico" aria-hidden>🏠</span>
                <span className="fulfill__name">{t.pickup}</span>
                <span className="fulfill__sub">{t.pickupSub}</span>
              </button>
              <button type="button" className={'fulfill__opt' + (fulfill === 'delivery' ? ' fulfill__opt--on' : '')} onClick={() => setFulfill('delivery')}>
                <span className="fulfill__ico" aria-hidden>🚚</span>
                <span className="fulfill__name">{t.delivery}</span>
                <span className="fulfill__sub">{t.deliverySub}</span>
              </button>
            </div>
            {fulfill === 'delivery' && (
              <>
                <label className="field" style={{ marginTop: 10 }}>
                  <span className="field__label">{t.address}</span>
                  <input className="input" placeholder={t.addressPh} value={addr} onChange={(e) => setAddr(e.target.value)} autoComplete="off" />
                </label>
                <div className="pos-two">
                  <label className="field">
                    <span className="field__label">{t.deliveryFee}</span>
                    <input className="input" type="number" inputMode="decimal" min={0} value={dfee || ''} onChange={(e) => setDfee(Math.max(0, Number(e.target.value) || 0))} />
                  </label>
                  <label className="field">
                    <span className="field__label">{t.courierCost}</span>
                    <input className="input" type="number" inputMode="decimal" min={0} value={courier || ''} onChange={(e) => setCourier(Math.max(0, Number(e.target.value) || 0))} />
                  </label>
                </div>
                <label className="field">
                  <span className="field__label">{t.deliveryNote}</span>
                  <input className="input" placeholder={t.deliveryNotePh} value={dnote} onChange={(e) => setDnote(e.target.value)} autoComplete="off" />
                </label>
              </>
            )}

            {overQuota && (
              <div className="card card--flat" style={{ marginTop: 12, background: '#fdeccc', color: 'var(--ink)', fontWeight: 800, padding: '12px 14px' }}>
                ⏳ {t.waitlistWarn}
              </div>
            )}

            <button type="button" className="btn btn--primary btn--lg pos-save" disabled={!canSave} onClick={save}>
              {t.save} · {formatMoney(grandTotal, cur)}
            </button>
          </aside>
        </div>
      </main>

      {keypad && (
        <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setKeypad(false) }}>
          <div className="sheet" role="dialog" aria-modal="true">
            <div className="sheet__handle" />
            <div className="sheet__title">{t.payLabel}</div>
            <MoneyKeypad value={paid} onChange={setPaid} currency={cur} />
            <button className="btn btn--primary" style={{ marginTop: 14 }} onClick={() => setKeypad(false)}>
              {t.done}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
