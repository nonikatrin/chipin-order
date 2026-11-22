import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import AppBar from '../../components/AppBar'
import { Ic } from '../../components/icons'
import MoneyKeypad from '../../components/MoneyKeypad'
import { usePOStore, usePOEvent, MENU_LIMITS } from '../../po/store'
import type { NewMenuInput } from '../../po/store'
import { useToast } from '../../components/Toast'
import { useLangStore } from '../../utils/langStore'
import { formatMoney, roundMoney } from '../../utils/format'
import { parseMoney } from '../../po/parse'
import { PO_EMOJIS } from '../../utils/categories'
import { fileToThumb } from '../../utils/image'
import { MenuThumb } from '../../components/MenuThumb'
import type { POMenu, Currency } from '../../po/types'

export const MENU_SETUP_STRINGS = {
  id: {
    title: 'Atur Menu & Harga',
    hint: 'Tentukan Harga Beli (modal ke supplier) & Harga Jual (ke warga). Untung dihitung otomatis.',
    bulk: 'Salin Daftar Menu sekaligus',
    listLabel: 'Daftar Menu',
    empty: 'Belum ada menu',
    emptySub: 'Tekan tombol hijau di bawah untuk menambah menu pertama.',
    add: 'Tambah Menu',
    done: '✓ Selesai',
    beli: 'Beli',
    jual: 'Jual',
    profitPer: 'Untung per porsi',
    quotaMax: 'Maks',
    porsi: 'porsi',
    editTitle: 'Ubah Menu',
    newTitle: 'Tambah Menu',
    nameLabel: 'Nama menu',
    namePh: 'Contoh: Nasi Kuning Komplit',
    vendorLabel: 'Supplier',
    vendorPh: 'Contoh: Bu Sri',
    vendorHint: 'Untuk setoran akhir hari per supplier.',
    image: 'Gambar',
    photoAdd: 'Unggah foto',
    photoChange: 'Ganti foto',
    photoRemove: 'Hapus foto',
    photoFail: 'Foto gagal dibaca — coba file lain',
    buyLabel: 'Harga Beli (modal ke supplier)',
    sellLabel: 'Harga Jual (ke warga)',
    marginLabel: 'Untung dari modal (%)',
    marginHint: 'Isi % → Harga Jual dihitung otomatis (modal + untung%). Tetap bisa diubah manual.',
    marginPh: 'mis. 30',
    quotaLabel: 'Batas porsi',
    quotaPh: 'kosongkan = tanpa batas',
    piecesLabel: 'Isi per unit (pcs)',
    piecesPh: 'mis. 1 unit = 3 pcs',
    piecesHint: 'Bila 1 paket berisi beberapa pcs. Membantu baca pesanan "3 x 10" sbg 3 unit (9 pcs).',
    basisLabel: 'Cara hitung modal supplier',
    basisPerUnit: 'Modal Tetap',
    basisPercent: 'Bagi hasil %',
    pctLabel: 'Bagian supplier (% dari harga jual)',
    pctPh: 'mis. 50 utk bagi hasil 50-50',
    pctHint: 'Modal supplier = persen ini × harga jual. Sisanya jadi untung untuk kas.',
    saveMenu: '✓ Simpan Menu',
    delMenu: 'Hapus Menu',
    confirmDel: 'Yakin hapus menu ini?',
    yes: 'Ya, Hapus',
    cancel: 'Batal',
    done2: '✓ Selesai',
    bulkTitle: 'Salin Daftar Menu',
    bulkHint: 'Satu menu per baris. Contoh: "Nasi Kuning - 5, 15, Bu Sri" (nama - beli, jual, supplier). Info yang kurang ditandai ⚠ dan bisa dilengkapi nanti.',
    bulkPh: 'Nasi Kuning - 5, 15, Bu Sri\nPepes Tahu - 8, 12 (maks 20)\nEs Cendol - jual 4 @Kedai Manis',
    bulkPreview: 'Akan ditambahkan',
    bulkAdd: '✓ Tambah Semua',
    bulkEmpty: 'Belum ada baris yang terbaca.',
    saved: '✓ Menu tersimpan',
    removed: 'Menu dihapus',
    addedN: (n: number) => `✓ ${n} menu ditambahkan`,
  },
  en: {
    title: 'Set Up Menu & Pricing',
    hint: 'Set the Buy Price (cost to supplier) & Sell Price. Profit is auto-calculated.',
    bulk: 'Paste a whole menu list',
    listLabel: 'Menu List',
    empty: 'No menus yet',
    emptySub: 'Tap the green button below to add your first menu.',
    add: 'Add Menu',
    done: '✓ Done',
    beli: 'Buy',
    jual: 'Sell',
    profitPer: 'Profit per portion',
    quotaMax: 'Max',
    porsi: 'portions',
    editTitle: 'Edit Menu',
    newTitle: 'Add Menu',
    nameLabel: 'Menu name',
    namePh: 'e.g. Complete Yellow Rice',
    vendorLabel: 'Supplier',
    vendorPh: 'e.g. Mrs. Sri',
    vendorHint: 'For end-of-day payout per supplier.',
    image: 'Photo',
    photoAdd: 'Upload photo',
    photoChange: 'Change photo',
    photoRemove: 'Remove photo',
    photoFail: 'Could not read the photo — try another file',
    buyLabel: 'Buy Price (cost to supplier)',
    sellLabel: 'Sell Price',
    marginLabel: 'Markup on cost (%)',
    marginHint: 'Enter % → Sell Price auto-fills (cost + markup%). You can still edit it manually.',
    marginPh: 'e.g. 30',
    quotaLabel: 'Portion limit',
    quotaPh: 'blank = no limit',
    piecesLabel: 'Pieces per unit',
    piecesPh: 'e.g. 1 unit = 3 pcs',
    piecesHint: 'If one bundle holds several pcs. Helps read "3 x 10" as 3 units (9 pcs).',
    basisLabel: 'Supplier cost basis',
    basisPerUnit: 'Fixed Cost',
    basisPercent: 'Revenue split %',
    pctLabel: "Supplier's share (% of sell price)",
    pctPh: 'e.g. 50 for a 50-50 split',
    pctHint: "Supplier cost = this percent × sell price. The rest is profit for the cause.",
    saveMenu: '✓ Save Menu',
    delMenu: 'Delete Menu',
    confirmDel: 'Delete this menu?',
    yes: 'Yes, Delete',
    cancel: 'Cancel',
    done2: '✓ Done',
    bulkTitle: 'Paste Menu List',
    bulkHint: 'One menu per line. e.g. "Yellow Rice - 5, 15, Bu Sri" (name - buy, sell, supplier). Missing info is flagged ⚠ and can be completed later.',
    bulkPh: 'Yellow Rice - 5, 15, Bu Sri\nTofu Pepes - 8, 12 (max 20)\nIced Cendol - sell 4 @Sweet Stall',
    bulkPreview: 'Will be added',
    bulkAdd: '✓ Add All',
    bulkEmpty: 'No lines detected yet.',
    saved: '✓ Menu saved',
    removed: 'Menu deleted',
    addedN: (n: number) => `✓ ${n} menus added`,
  },
}
const strings = MENU_SETUP_STRINGS

/** Parser daftar menu: "Nama - beli, jual (maks N)" → NewMenuInput. */
function parseMenuLines(text: string, currency: Currency): NewMenuInput[] {
  const res: NewMenuInput[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const firstNum = line.search(/\d/)
    if (firstNum <= 0) continue
    let name = line
      .slice(0, firstNum)
      .replace(/\b(modal|beli|jual|harga|buy|sell|cost|maks|max)\b/gi, '')
      .replace(/[\s\-–:,|]+$/, '') // buang pemisah + spasi di ujung
      .trim()
    const rest = line.slice(firstNum)
    const tokens = rest
      .split(/[,;|]| {2,}|\b(?:jual|sell|modal|beli|buy|cost|maks|max)\b/i)
      .map((s) => (s ? s.trim() : ''))
      .filter(Boolean)
    const nums = tokens
      .map((t) => parseMoney(t, currency))
      .filter((n): n is number => n != null && n > 0)
    if (!name || nums.length < 2) continue
    res.push({
      name,
      buyPrice: nums[0],
      sellPrice: nums[1],
      maxQuota: nums[2],
    })
  }
  return res
}

/** Harga jual dari markup atas modal, dibulatkan ke satuan mata uang (IDR bulat / USD sen). */
function sellFromMarkup(buy: number, pct: number, currency: Currency): number {
  return roundMoney(buy * (1 + pct / 100), currency)
}

/** Markup atas modal sebagai persen bulat untuk ditampilkan; '' bila modal ≤ 0. */
function markupText(buy: number, sell: number): string {
  if (buy <= 0) return ''
  return String(Math.round((sell / buy - 1) * 100))
}

export default function POMenuSetupPage() {
  const { poId } = useParams()
  const navigate = useNavigate()
  const event = usePOEvent(poId)
  const { addMenu, updateMenu, removeMenu } = usePOStore()
  const showToast = useToast((s) => s.show)
  const { currentLang } = useLangStore()
  const t = strings[currentLang] ?? strings.id

  const [editing, setEditing] = useState<POMenu | 'new' | null>(null)
  const [bulk, setBulk] = useState(false)

  if (!event) return <Navigate to="/" replace />
  const cur = event.currency

  return (
    <>
      <AppBar title={t.title} subtitle={`${event.emoji} ${event.name}`} backTo={`/po/${event.id}`} />

      <main className="page">
        <p className="field__hint" style={{ marginTop: 16 }}>
          {t.hint}
        </p>

        <button
          type="button"
          className="btn btn--ghost"
          style={{ marginBottom: 8 }}
          onClick={() => setBulk(true)}
        >
          {Ic.sparkles} {t.bulk}
        </button>

        {event.menus.length === 0 ? (
          <div className="empty">
            <div className="empty__emoji">🍱</div>
            <h2 className="empty__title">{t.empty}</h2>
            <p className="empty__text">{t.emptySub}</p>
          </div>
        ) : (
          <>
            <div className="section-label">
              {Ic.clipboard} {t.listLabel} ({event.menus.length})
            </div>
            <div>
              {event.menus.map((m) => {
                const margin = m.sellPrice - m.buyPrice
                return (
                  <button className="row" key={m.id} onClick={() => setEditing(m)}>
                    <MenuThumb menu={m} />
                    <div className="row__main">
                      <div className="row__title row__title--wrap">{m.name}</div>
                      <div className="row__sub">
                        {t.beli} {formatMoney(m.buyPrice, cur)} · {t.jual}{' '}
                        {formatMoney(m.sellPrice, cur)}
                        {m.maxQuota ? ` · ${t.quotaMax} ${m.maxQuota}` : ''}
                        {m.vendor ? ` · 👩‍🍳 ${m.vendor}` : ''}
                      </div>
                    </div>
                    <span className={'pill ' + (margin >= 0 ? 'pill--good' : 'pill--bad')}>
                      {margin >= 0 ? '＋' : '－'}
                      {formatMoney(Math.abs(margin), cur)}
                    </span>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </main>

      <div className="dock">
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="button"
            className="btn btn--ghost"
            style={{ flex: 1 }}
            onClick={() => setEditing('new')}
          >
            {Ic.plus} {t.add}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            style={{ flex: 1 }}
            disabled={event.menus.length === 0}
            onClick={() => navigate(`/po/${event.id}`)}
          >
            {t.done}
          </button>
        </div>
      </div>

      {editing && (
        <MenuEditorSheet
          t={t}
          currency={cur}
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(data) => {
            if (editing === 'new') addMenu(event.id, data)
            else updateMenu(event.id, editing.id, data)
            showToast(t.saved)
            setEditing(null)
          }}
          onDelete={
            editing === 'new'
              ? undefined
              : () => {
                  removeMenu(event.id, editing.id)
                  showToast(t.removed)
                  setEditing(null)
                }
          }
        />
      )}

      {bulk && (
        <BulkMenuSheet
          t={t}
          currency={cur}
          onClose={() => setBulk(false)}
          onAdd={(items) => {
            items.forEach((it) => addMenu(event.id, it))
            showToast(t.addedN(items.length))
            setBulk(false)
          }}
        />
      )}
    </>
  )
}

type Strings = (typeof strings)['id']

export interface MenuData {
  name: string
  emoji: string
  buyPrice: number
  sellPrice: number
  maxQuota?: number
  vendor?: string
  piecesPerUnit?: number
  costBasis?: 'perUnit' | 'percent'
  costValue?: number
  photo?: string
}

export function MenuEditorSheet({
  t,
  currency,
  initial,
  onSave,
  onClose,
  onDelete,
}: {
  t: Strings
  currency: Currency
  initial: POMenu | null
  onSave: (data: MenuData) => void
  onClose: () => void
  onDelete?: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [vendor, setVendor] = useState(initial?.vendor ?? '')
  const [emoji, setEmoji] = useState(initial?.emoji ?? '🍱')
  const [buyPrice, setBuyPrice] = useState(initial?.buyPrice ?? 0)
  const [sellPrice, setSellPrice] = useState(initial?.sellPrice ?? 0)
  const [marginText, setMarginText] = useState(() =>
    markupText(initial?.buyPrice ?? 0, initial?.sellPrice ?? 0),
  )
  const [quota, setQuota] = useState(initial?.maxQuota ? String(initial.maxQuota) : '')
  const [pieces, setPieces] = useState(
    initial?.piecesPerUnit && initial.piecesPerUnit > 1 ? String(initial.piecesPerUnit) : '',
  )
  const [basis, setBasis] = useState<'perUnit' | 'percent'>(initial?.costBasis ?? 'perUnit')
  const [pct, setPct] = useState(
    initial?.costBasis === 'percent' && initial.costValue != null
      ? String(Math.round(initial.costValue * 100))
      : '',
  )
  const [photo, setPhoto] = useState<string | undefined>(initial?.photo)
  const [photoError, setPhotoError] = useState(false)
  const [keypadFor, setKeypadFor] = useState<'buy' | 'sell' | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)

  async function handlePhotoFile(file: File | undefined) {
    if (!file) return
    setPhotoError(false)
    try {
      setPhoto(await fileToThumb(file))
    } catch {
      setPhotoError(true)
    }
  }

  const effectiveCost = basis === 'percent' ? sellPrice * (Number(pct) / 100) : buyPrice
  const margin = sellPrice - effectiveCost
  const canSave =
    name.trim().length > 0 &&
    sellPrice > 0 &&
    (basis === 'perUnit' || (Number(pct) > 0 && Number(pct) < 100))

  // Modal berubah → harga jual ikut, mempertahankan markup% yang sedang dipakai.
  function handleBuyChange(next: number) {
    setBuyPrice(next)
    const pct = parseFloat(marginText)
    if (marginText.trim() !== '' && Number.isFinite(pct)) {
      setSellPrice(sellFromMarkup(next, pct, currency))
    }
  }

  // Harga jual diubah manual → markup% mengikuti rasio baru (tetap jujur).
  function handleSellChange(next: number) {
    setSellPrice(next)
    setMarginText(markupText(buyPrice, next))
  }

  // % diisi → harga jual dihitung dari modal.
  function handleMarginChange(raw: string) {
    setMarginText(raw)
    const pct = parseFloat(raw)
    if (raw.trim() !== '' && Number.isFinite(pct)) {
      setSellPrice(sellFromMarkup(buyPrice, pct, currency))
    }
  }

  return (
    <div
      className="sheet-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="sheet__handle" />

        {keypadFor ? (
          <>
            <div className="sheet__title">
              {keypadFor === 'buy' ? t.buyLabel : t.sellLabel}
            </div>
            <MoneyKeypad
              value={keypadFor === 'buy' ? buyPrice : sellPrice}
              onChange={keypadFor === 'buy' ? handleBuyChange : handleSellChange}
              currency={currency}
            />
            <button
              className="btn btn--primary"
              style={{ marginTop: 14 }}
              onClick={() => setKeypadFor(null)}
            >
              {t.done2}
            </button>
          </>
        ) : (
          <>
            <div className="sheet__title">{initial ? t.editTitle : t.newTitle}</div>

            <div className="field" style={{ marginTop: 14 }}>
              <label className="field__label" htmlFor="menu-name">
                {t.nameLabel}
              </label>
              <input
                id="menu-name"
                className="input"
                placeholder={t.namePh}
                maxLength={MENU_LIMITS.name}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="field">
              <label className="field__label" htmlFor="menu-vendor">
                {t.vendorLabel}
              </label>
              <input
                id="menu-vendor"
                className="input"
                placeholder={t.vendorPh}
                maxLength={MENU_LIMITS.vendor}
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                autoComplete="off"
              />
              <p className="field__hint" style={{ marginTop: 6 }}>
                {t.vendorHint}
              </p>
            </div>

            <div className="field">
              <label className="field__label">{t.image}</label>
              <div className="photo-row">
                {photo && <img src={photo} alt="" className="photo-row__thumb" />}
                <label className="btn btn--ghost btn--sm photo-row__pick">
                  {photo ? t.photoChange : t.photoAdd}
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      void handlePhotoFile(e.target.files?.[0])
                      e.target.value = ''
                    }}
                  />
                </label>
                {photo && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm photo-row__pick"
                    onClick={() => setPhoto(undefined)}
                  >
                    {Ic.trash} {t.photoRemove}
                  </button>
                )}
              </div>
              {photoError && (
                <p className="field__hint" style={{ color: 'var(--bad)' }}>
                  {t.photoFail}
                </p>
              )}
              <div className="pick-grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginTop: 10 }}>
                {PO_EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEmoji(e)}
                    className={'pick' + (emoji === e ? ' is-selected' : '')}
                    style={{ minHeight: 52, padding: 4 }}
                    aria-label={`Pilih ${e}`}
                  >
                    <span style={{ fontSize: '1.5rem' }}>{e}</span>
                  </button>
                ))}
              </div>
            </div>

            <PriceButton label={t.sellLabel} value={sellPrice} currency={currency} onClick={() => setKeypadFor('sell')} />

            <div className="field">
              <label className="field__label">{t.basisLabel}</label>
              <div className="kind-toggle" role="group" aria-label={t.basisLabel}>
                <button
                  type="button"
                  className={'kind-toggle__btn' + (basis === 'perUnit' ? ' is-on income' : '')}
                  onClick={() => setBasis('perUnit')}
                  aria-pressed={basis === 'perUnit'}
                >
                  {t.basisPerUnit}
                </button>
                <button
                  type="button"
                  className={'kind-toggle__btn' + (basis === 'percent' ? ' is-on income' : '')}
                  onClick={() => setBasis('percent')}
                  aria-pressed={basis === 'percent'}
                >
                  {t.basisPercent}
                </button>
              </div>
            </div>

            {basis === 'percent' ? (
              <div className="field">
                <label className="field__label" htmlFor="menu-pct">
                  {t.pctLabel}
                </label>
                <input
                  id="menu-pct"
                  className="input"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  placeholder={t.pctPh}
                  value={pct}
                  onChange={(e) => setPct(e.target.value)}
                />
                <p className="field__hint" style={{ marginTop: 6 }}>
                  {t.pctHint}
                </p>
              </div>
            ) : (
              <PriceButton label={t.buyLabel} value={buyPrice} currency={currency} onClick={() => setKeypadFor('buy')} />
            )}

            {basis === 'perUnit' && (
            <div className="field">
              <label className="field__label" htmlFor="menu-margin">
                {t.marginLabel}
              </label>
              <input
                id="menu-margin"
                className="input"
                type="number"
                inputMode="decimal"
                min={0}
                placeholder={t.marginPh}
                value={marginText}
                onChange={(e) => handleMarginChange(e.target.value)}
              />
              <p className="field__hint" style={{ marginTop: 6 }}>
                {t.marginHint}
              </p>
            </div>
            )}

            <div className="field">
              <label className="field__label" htmlFor="menu-quota">
                {t.quotaLabel}
              </label>
              <input
                id="menu-quota"
                className="input"
                type="number"
                inputMode="numeric"
                min={1}
                max={MENU_LIMITS.quota}
                placeholder={t.quotaPh}
                value={quota}
                onChange={(e) => setQuota(e.target.value)}
              />
            </div>

            <div className="field">
              <label className="field__label" htmlFor="menu-pieces">
                {t.piecesLabel}
              </label>
              <input
                id="menu-pieces"
                className="input"
                type="number"
                inputMode="numeric"
                min={1}
                max={MENU_LIMITS.pieces}
                placeholder={t.piecesPh}
                value={pieces}
                onChange={(e) => setPieces(e.target.value)}
              />
              <p className="field__hint" style={{ marginTop: 6 }}>
                {t.piecesHint}
              </p>
            </div>

            <div className="card card--flat center" style={{ padding: 14 }}>
              <span className="muted">{t.profitPer}</span>
              <div
                className={'money money--lg ' + (margin >= 0 ? 'money--pos' : 'money--neg')}
                style={{ marginTop: 2 }}
              >
                {margin >= 0 ? '＋' : '－'}
                {formatMoney(Math.abs(margin), currency)}
              </div>
            </div>

            <div className="stack" style={{ marginTop: 18 }}>
              <button
                className="btn btn--primary"
                disabled={!canSave}
                onClick={() =>
                  onSave({
                    name,
                    emoji,
                    // percent: turunkan modal per unit dari % agar daftar tetap tampil benar
                    buyPrice:
                      basis === 'percent'
                        ? Math.round(sellPrice * (Number(pct) / 100) * 100) / 100
                        : buyPrice,
                    sellPrice,
                    maxQuota: quota ? Number(quota) : undefined,
                    vendor,
                    piecesPerUnit: pieces ? Number(pieces) : undefined,
                    costBasis: basis,
                    costValue: basis === 'percent' ? Number(pct) / 100 : buyPrice,
                    photo,
                  })
                }
              >
                {t.saveMenu}
              </button>
              {onDelete &&
                (confirmDel ? (
                  <>
                    <p className="center" style={{ fontWeight: 800 }}>
                      {t.confirmDel}
                    </p>
                    <button
                      className="btn"
                      style={{ background: 'var(--bad)', color: '#fff' }}
                      onClick={onDelete}
                    >
                      {t.yes}
                    </button>
                    <button className="btn btn--ghost" onClick={() => setConfirmDel(false)}>
                      {t.cancel}
                    </button>
                  </>
                ) : (
                  <button
                    className="btn btn--ghost"
                    style={{ color: 'var(--bad)' }}
                    onClick={() => setConfirmDel(true)}
                  >
                    {Ic.trash} {t.delMenu}
                  </button>
                ))}
              {!onDelete && (
                <button className="btn btn--ghost" onClick={onClose}>
                  {t.cancel}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function PriceButton({
  label,
  value,
  currency,
  onClick,
}: {
  label: string
  value: number
  currency: Currency
  onClick: () => void
}) {
  return (
    <button
      className="input"
      onClick={onClick}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        textAlign: 'left',
        gap: 12,
        marginBottom: 12,
        cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: '1rem', fontWeight: 700 }}>{label}</span>
      <span className="money" style={{ whiteSpace: 'nowrap' }}>
        {formatMoney(value, currency)}
      </span>
    </button>
  )
}

function BulkMenuSheet({
  t,
  currency,
  onClose,
  onAdd,
}: {
  t: Strings
  currency: Currency
  onClose: () => void
  onAdd: (items: NewMenuInput[]) => void
}) {
  const [text, setText] = useState('')
  const items = parseMenuLines(text, currency)

  return (
    <div
      className="sheet-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="sheet__handle" />
        <div className="sheet__title">{t.bulkTitle}</div>
        <p className="field__hint" style={{ margin: '6px 0 10px' }}>
          {t.bulkHint}
        </p>
        <textarea
          className="textarea"
          placeholder={t.bulkPh}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        {text.trim() && (
          <div style={{ marginTop: 12 }}>
            <div className="section-label" style={{ marginTop: 6 }}>
              {t.bulkPreview} ({items.length})
            </div>
            {items.length === 0 ? (
              <p className="muted">{t.bulkEmpty}</p>
            ) : (
              items.map((it, i) => (
                <div key={i} className="parsed-card">
                  <b>{it.name}</b>
                  <div className="row__sub" style={{ marginTop: 4 }}>
                    {t.beli} {formatMoney(it.buyPrice, currency)} · {t.jual}{' '}
                    {formatMoney(it.sellPrice, currency)}
                    {it.maxQuota ? ` · ${t.quotaMax} ${it.maxQuota}` : ''}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <div className="stack" style={{ marginTop: 18 }}>
          <button
            className="btn btn--primary"
            disabled={items.length === 0}
            onClick={() => onAdd(items)}
          >
            {t.bulkAdd}
          </button>
          <button className="btn btn--ghost" onClick={onClose}>
            {t.cancel}
          </button>
        </div>
      </div>
    </div>
  )
}
