import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { usePOStore, usePOEvent, MENU_LIMITS } from '../../po/store'
import { Ic } from '../../components/icons'
import { useToast } from '../../components/Toast'
import { useLangStore } from '../../utils/langStore'
import { formatMoney, roundMoney, currencySymbol } from '../../utils/format'
import { MenuCard } from '../../components/MenuCard'
import { MenuThumb } from '../../components/MenuThumb'
import { MENU_SETUP_STRINGS } from './POMenuSetupPage'
import { fileToThumb } from '../../utils/image'
import { ALLERGENS } from '../../utils/allergens'
import { parseMoney } from '../../po/parse'
import type { POMenu, Currency } from '../../po/types'

interface MenuStepProps {
  eventId: string
  onBack?: () => void
  onNext?: () => void
  nextLabel?: string
}

type BulkField = 'buy' | 'sell' | 'supplier'

interface BulkPreviewRow {
  raw: string
  /** valid = semua terdeteksi · partial = nama ada tapi info belum lengkap · invalid = nama tak terbaca */
  status: 'valid' | 'partial' | 'invalid'
  item?: {
    name: string
    buyPrice: number
    sellPrice: number
    maxQuota?: number
    vendor?: string
  }
  missing?: BulkField[]
  error?: string
}

function renderOptionalLabel(text: string): ReactNode {
  const suffixPattern = /\s\((optional|opsional)\)$/i
  const match = text.match(suffixPattern)
  if (!match || match.index == null) return text

  const label = text.slice(0, match.index).trimEnd()
  const suffix = text.slice(match.index).trimStart()
  return (
    <>
      {label}{' '}
      <span className="po-menu-optional-label">{suffix}</span>
    </>
  )
}

export function MenuStep({ eventId, onBack, onNext, nextLabel }: MenuStepProps) {
  const event = usePOEvent(eventId)
  const { addMenu, updateMenu, removeMenu } = usePOStore()
  const showToast = useToast((s) => s.show)
  const { currentLang } = useLangStore()

  const strings = {
    id: {
      eyebrow: 'LANGKAH 2',
      title: 'Item Menu',
      subtitle: 'Tambahkan item yang bisa dipesan pembeli',
      tip: 'Tambah dulu beberapa item favorit supaya pembeli cepat memilih.',
      empty: 'Belum ada menu',
      emptySub: 'Tambah menu pertama supaya warga bisa pesan.',
      listLabel: 'Menu',
      beli: 'Beli',
      jual: 'Jual',
      add: 'Tambah Item',
      edit: 'Edit',
      duplicate: 'Duplikat',
      duplicated: 'Salinan siap, cek lalu simpan',
      copySuffix: 'salinan',
      filterAllVendors: 'Semua vendor',
      filterLabel: 'Filter vendor',
      noVendor: 'Tanpa vendor',
      filterEmptyTitle: 'Tidak ada menu untuk vendor ini',
      filterEmptySub: 'Pilih vendor lain atau kembali ke semua vendor.',
      addAnother: 'Tambah Item Lagi',
      pasteMenu: 'Paste Menu',
      back: 'Kembali',
      next: 'Lanjut: Ringkasan',
      basicInfo: 'Info Dasar',
      supplierCost: 'Harga & Modal',
      photo: 'Porsi & Foto',
      willAdd: 'Akan ditambahkan',
      missingLabel: 'Belum terdeteksi',
      incompleteLabel: 'Belum lengkap',
      donatedLabel: 'Disumbang supplier',
      donatedHint: 'Tanpa modal — tidak ada setoran untuk item ini',
      donatedTag: 'Disumbang',
      fieldBuy: 'Harga Beli',
      fieldSell: 'Harga Jual',
      fieldSupplier: 'Supplier',
      supplierWord: 'Supplier',
      descLabel: 'Deskripsi (opsional)',
      descPh: 'mis. isi 10 pcs',
      allergenLabel: 'Alergen (opsional)',
      recipeToggle: 'Hitung HPP dari resep',
      recipeCostLabel: 'Total biaya bahan',
      recipeYieldLabel: 'Jumlah porsi jadi',
      recipeApply: 'Pakai jadi HPP',
      recipeResult: 'HPP per porsi',
      supplierSelfHint: 'Kosongkan jika buatan sendiri',
      hppLabel: 'HPP (modal per porsi)',
    },
    en: {
      eyebrow: 'STEP 2',
      title: 'Menu Items',
      subtitle: 'Add items buyers can order',
      tip: 'Add a couple of popular items first so buyers can choose quickly.',
      empty: 'No menus yet',
      emptySub: 'Add your first menu to let people order.',
      listLabel: 'Menus',
      beli: 'Buy',
      jual: 'Sell',
      add: 'Add Item',
      edit: 'Edit',
      duplicate: 'Duplicate',
      duplicated: 'Copy is ready, review and save',
      copySuffix: 'copy',
      filterAllVendors: 'All vendors',
      filterLabel: 'Vendor filter',
      noVendor: 'No vendor',
      filterEmptyTitle: 'No menus for this vendor',
      filterEmptySub: 'Pick another vendor or switch back to all vendors.',
      addAnother: 'Add Another Item',
      pasteMenu: 'Paste Menu',
      back: 'Back',
      next: 'Next: Summary',
      basicInfo: 'Basic Info',
      supplierCost: 'Pricing & Cost',
      photo: 'Portions & Photo',
      willAdd: 'Will be added',
      missingLabel: 'Not detected',
      incompleteLabel: 'Incomplete',
      donatedLabel: 'Donated by supplier',
      donatedHint: 'No cost — nothing to pay out for this item',
      donatedTag: 'Donated',
      fieldBuy: 'Buy Price',
      fieldSell: 'Sell Price',
      fieldSupplier: 'Supplier',
      supplierWord: 'Supplier',
      descLabel: 'Description (optional)',
      descPh: 'e.g. pack of 10 pcs',
      allergenLabel: 'Allergens (optional)',
      recipeToggle: 'Calculate COGS from recipe',
      recipeCostLabel: 'Total ingredient cost',
      recipeYieldLabel: 'Servings made',
      recipeApply: 'Use as COGS',
      recipeResult: 'COGS per serving',
      supplierSelfHint: 'Leave empty if self-made',
      hppLabel: 'COGS (cost per serving)',
    },
  }

  const t = strings[currentLang] ?? strings.id
  const mt = MENU_SETUP_STRINGS[currentLang] ?? MENU_SETUP_STRINGS.id

  const [editingId, setEditingId] = useState<string | 'new'>('new')
  const editingMenu = useMemo(
    () => (editingId === 'new' ? null : event?.menus.find((m) => m.id === editingId) ?? null),
    [editingId, event?.menus],
  )

  const [name, setName] = useState('')
  const [vendor, setVendor] = useState('')
  const [description, setDescription] = useState('')
  const [allergens, setAllergens] = useState<string[]>([])
  const toggleAllergen = (key: string) =>
    setAllergens((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]))
  const [buyPrice, setBuyPrice] = useState(0)
  const [sellPrice, setSellPrice] = useState(0)
  const [marginText, setMarginText] = useState('')
  const [quota, setQuota] = useState('')
  const [pieces, setPieces] = useState('')
  const [basis, setBasis] = useState<'perUnit' | 'percent'>('perUnit')
  const [pct, setPct] = useState('')
  const [donated, setDonated] = useState(false)
  const [photo, setPhoto] = useState<string | undefined>()
  const [photoError, setPhotoError] = useState(false)
  // Batch-cost helper (produksi sendiri): total biaya bahan ÷ jumlah porsi jadi → modal per porsi.
  const [showRecipe, setShowRecipe] = useState(false)
  const [recipeCost, setRecipeCost] = useState('')
  const [recipeYield, setRecipeYield] = useState('')
  const [vendorFilter, setVendorFilter] = useState('__all__')
  const [openActionsId, setOpenActionsId] = useState<string | null>(null)
  const skipResetRef = useRef(false)
  const [prefill, setPrefill] = useState<POMenu | null>(null)
  const [editorMode, setEditorMode] = useState<'form' | 'paste'>('form')
  const [bulkText, setBulkText] = useState('')
  const nameInputRef = useRef<HTMLInputElement | null>(null)

  const focusNameInput = () => {
    requestAnimationFrame(() => {
      nameInputRef.current?.focus()
    })
  }

  // Tutup menu aksi ⋮ saat klik di luar (pola yang sama dengan kartu PO di Dashboard/Orders).
  useEffect(() => {
    if (!openActionsId) return
    const onDown = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement | null
      if (target?.closest('.pocard__menu-wrap')) return
      setOpenActionsId(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [openActionsId])

  useEffect(() => {
    if (editingMenu) {
      setName(editingMenu.name)
      setVendor(editingMenu.vendor ?? '')
      setDescription(editingMenu.description ?? '')
      setAllergens(editingMenu.allergens ?? [])
      setBuyPrice(editingMenu.buyPrice)
      setSellPrice(editingMenu.sellPrice)
      setMarginText(markupText(editingMenu.buyPrice, editingMenu.sellPrice))
      setQuota(editingMenu.maxQuota ? String(editingMenu.maxQuota) : '')
      setPieces(editingMenu.piecesPerUnit && editingMenu.piecesPerUnit > 1 ? String(editingMenu.piecesPerUnit) : '')
      setBasis(editingMenu.costBasis ?? 'perUnit')
      setPct(
        editingMenu.costBasis === 'percent' && editingMenu.costValue != null
          ? String(Math.round(editingMenu.costValue * 100))
          : '',
      )
      setDonated(Boolean(editingMenu.donated))
      setPhoto(editingMenu.photo)
      setPhotoError(false)
      focusNameInput()
      return
    }

    if (prefill) {
      setName(prefill.name)
      setVendor(prefill.vendor ?? '')
      setDescription(prefill.description ?? '')
      setAllergens(prefill.allergens ?? [])
      setBuyPrice(prefill.buyPrice)
      setSellPrice(prefill.sellPrice)
      setMarginText(markupText(prefill.buyPrice, prefill.sellPrice))
      setQuota(prefill.maxQuota ? String(prefill.maxQuota) : '')
      setPieces(prefill.piecesPerUnit && prefill.piecesPerUnit > 1 ? String(prefill.piecesPerUnit) : '')
      setBasis(prefill.costBasis ?? 'perUnit')
      setPct(
        prefill.costBasis === 'percent' && prefill.costValue != null
          ? String(Math.round(prefill.costValue * 100))
          : '',
      )
      setDonated(Boolean(prefill.donated))
      setPhoto(prefill.photo)
      setPhotoError(false)
      // Konsumsi sekali: setPrefill(null) memicu effect ini lagi — jangan sampai
      // cabang reset di bawah menghapus nilai salinan yang baru saja diisi.
      skipResetRef.current = true
      setPrefill(null)
      focusNameInput()
      return
    }

    if (skipResetRef.current) {
      skipResetRef.current = false
      return
    }

    setName('')
    setVendor('')
    setDescription('')
    setAllergens([])
    setBuyPrice(0)
    setSellPrice(0)
    setMarginText('')
    setQuota('')
    setPieces('')
    setBasis('perUnit')
    setPct('')
    setDonated(false)
    setPhoto(undefined)
    setPhotoError(false)
    focusNameInput()
  }, [editingMenu, prefill])

  useEffect(() => {
    if (!event) return
    if (editingId !== 'new' && !event.menus.some((m) => m.id === editingId)) {
      setEditingId('new')
    }
  }, [editingId, event])

  // Gerbang lapis supplier: "Bagi hasil %" hanya masuk akal bila ada supplier luar.
  // Menghapus supplier saat basis 'percent' → jatuh kembali ke modal tetap (edge case terkunci).
  const hasSupplier = vendor.trim().length > 0
  useEffect(() => {
    if (!hasSupplier && basis === 'percent') setBasis('perUnit')
  }, [hasSupplier, basis])

  if (!event) return null

  const cur = event.currency
  const vendorOptions = Array.from(
    new Set(event.menus.map((m) => (m.vendor?.trim() ? m.vendor.trim() : t.noVendor))),
  ).sort((a, b) => a.localeCompare(b))

  const visibleMenus = event.menus.filter((m) => {
    if (vendorFilter === '__all__') return true
    const normalizedVendor = m.vendor?.trim() ? m.vendor.trim() : t.noVendor
    return normalizedVendor === vendorFilter
  })

  const bulkPreview = useMemo(() => parseMenuLinesDetailed(bulkText, cur), [bulkText, cur])
  // Baris valid DAN partial ikut ditambahkan (harga hilang = 0, dilengkapi via editor).
  const bulkItems = useMemo(
    () =>
      bulkPreview
        .filter((row) => row.status !== 'invalid' && row.item)
        .map((row) => row.item as NonNullable<BulkPreviewRow['item']>),
    [bulkPreview],
  )
  const bulkOpen = editorMode === 'paste'

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

  // Batch-cost: modal per porsi = total biaya bahan ÷ jumlah porsi jadi (dibulatkan ke mata uang acara,
  // dijepit ke batas harga agar konsisten dengan input harga lain).
  const recipePerUnit = (() => {
    const c = Number(recipeCost)
    const y = Number(recipeYield)
    if (!(c > 0 && y > 0)) return null
    return Math.min(MENU_LIMITS.price, roundMoney(c / y, cur))
  })()
  function applyRecipe() {
    if (recipePerUnit == null) return
    setBuyPrice(recipePerUnit)
    setMarginText(markupText(recipePerUnit, sellPrice))
  }
  const canSave =
    name.trim().length > 0 &&
    sellPrice > 0 &&
    (basis === 'perUnit' || (Number(pct) > 0 && Number(pct) < 100))

  // Harga Jual & Beli = sumber kebenaran; % diturunkan dari keduanya.
  // Mengetik % adalah satu-satunya arah yang MENDORONG Harga Jual (handleMarginChange).
  function handleBuyChange(raw: string) {
    const next = Math.min(MENU_LIMITS.price, Number(raw) || 0)
    setBuyPrice(next)
    setMarginText(markupText(next, sellPrice))
  }

  function handleSellChange(raw: string) {
    const next = Math.min(MENU_LIMITS.price, Number(raw) || 0)
    setSellPrice(next)
    setMarginText(markupText(buyPrice, next))
  }

  function handleMarginChange(raw: string) {
    setMarginText(raw)
    const parsedPct = parseFloat(raw)
    if (raw.trim() !== '' && Number.isFinite(parsedPct)) {
      setSellPrice(sellFromMarkup(buyPrice, parsedPct, cur))
    }
  }

  function handleSave() {
    if (!canSave) return
    const payload = {
      name,
      buyPrice: donated
        ? 0
        : basis === 'percent'
          ? Math.round(sellPrice * (Number(pct) / 100) * 100) / 100
          : buyPrice,
      sellPrice,
      maxQuota: quota ? Number(quota) : undefined,
      vendor,
      description,
      allergens: allergens.length ? allergens : undefined,
      piecesPerUnit: pieces ? Number(pieces) : undefined,
      costBasis: donated ? 'perUnit' : basis,
      costValue: donated ? 0 : basis === 'percent' ? Number(pct) / 100 : buyPrice,
      donated,
      photo,
    }

    if (editingMenu) {
      updateMenu(eventId, editingMenu.id, payload)
    } else {
      addMenu(eventId, payload)
    }
    showToast(mt.saved)
  }

  function handleDelete(menu: POMenu) {
    removeMenu(eventId, menu.id)
    showToast(mt.removed)
    if (editingId === menu.id) {
      setEditingId('new')
    }
  }

  function handleStartAdd() {
    setPrefill(null)
    setEditingId('new')
    setEditorMode('form')
    focusNameInput()
  }

  function handleEdit(menu: POMenu) {
    setPrefill(null)
    setEditingId(menu.id)
    setEditorMode('form')
  }

  function handleDuplicate(menu: POMenu) {
    const baseName = menu.name.trim() || 'Menu'
    const suffix = t.copySuffix
    const existingMenus = event?.menus ?? []
    const escapedSuffix = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const copyPattern = new RegExp(`^${escapeRegex(baseName)} \\(${escapedSuffix}(?: (\\d+))?\\)$`)
    let maxCopyIndex = 0

    for (const existing of existingMenus) {
      const existingName = existing.name.trim()
      if (existingName === `${baseName} (${suffix})`) {
        maxCopyIndex = Math.max(maxCopyIndex, 1)
        continue
      }
      const match = existingName.match(copyPattern)
      if (match?.[1]) {
        maxCopyIndex = Math.max(maxCopyIndex, Number(match[1]))
      }
    }

    const nextName = maxCopyIndex <= 0 ? `${baseName} (${suffix})` : `${baseName} (${suffix} ${maxCopyIndex + 1})`

    setPrefill({
      ...menu,
      id: 'draft-copy',
      name: nextName,
    })
    setEditingId('new')
    showToast(t.duplicated)
    focusNameInput()
  }

  function handleBulkAdd() {
    if (bulkItems.length === 0) return
    bulkItems.forEach((it) => addMenu(eventId, it))
    showToast(mt.addedN(bulkItems.length))
    setEditorMode('form')
    setBulkText('')
  }

  return (
    <MenuCard
      className="po-menu-card"
      eyebrow={t.eyebrow}
      title={t.title}
      subtitle={t.subtitle}
      tip={
        <>
          <span className="menu-step-card__tip-icon">{Ic.alert}</span>
          <span>
            <strong>Tip:</strong> {t.tip}
          </span>
        </>
      }
      bodyClassName="po-menu-body"
    >
      <div className="po-menu-layout">
        <section className="po-menu-list">
          <div className="menu-step-card__list-header">
            <span className="menu-step-card__list-label">
              {Ic.clipboard} {t.listLabel} ({visibleMenus.length}/{event.menus.length})
            </span>
            <div className="po-menu-list__header-actions">
              <button
                type="button"
                className="btn btn--ghost btn--sm po-menu-list__header-btn"
                onClick={() => setEditorMode('paste')}
              >
                {Ic.clipboard} {t.pasteMenu}
              </button>
              <button
                type="button"
                className="btn btn--primary btn--sm po-menu-list__header-btn"
                onClick={handleStartAdd}
              >
                {Ic.plus} {t.add}
              </button>
            </div>
          </div>

          {event.menus.length > 0 ? (
            <label className="po-menu-list__filter" aria-label={t.filterLabel}>
              <span>{t.filterLabel}</span>
              <select
                className="input input--compact input--select"
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
              >
                <option value="__all__">{t.filterAllVendors}</option>
                {vendorOptions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {event.menus.length === 0 ? (
            <div className="menu-step-card__empty">
              <div className="menu-step-card__empty-emoji">🍱</div>
              <h3 className="empty__title">{t.empty}</h3>
              <p className="empty__text">{t.emptySub}</p>
              <button type="button" className="btn btn--primary btn--sm menu-step-card__empty-cta" onClick={() => setEditorMode('paste')}>
                {Ic.clipboard} {t.pasteMenu}
              </button>
            </div>
          ) : visibleMenus.length === 0 ? (
            <div className="menu-step-card__empty">
              <div className="menu-step-card__empty-emoji">🔎</div>
              <h3 className="empty__title">{t.filterEmptyTitle}</h3>
              <p className="empty__text">{t.filterEmptySub}</p>
            </div>
          ) : (
            <div className="menu-step-card__list">
              {visibleMenus.map((m) => {
                const listMargin = m.sellPrice - (m.costBasis === 'percent' ? m.sellPrice * (m.costValue ?? 0) : m.buyPrice)
                const incomplete: string[] = []
                // Menu sumbangan memang bermodal 0 — jangan diperlakukan sebagai data yang belum diisi.
                if (!m.donated && (m.costBasis === 'percent' ? (m.costValue ?? 0) <= 0 : m.buyPrice <= 0))
                  incomplete.push(t.fieldBuy)
                if (m.sellPrice <= 0) incomplete.push(t.fieldSell)
                if (!m.vendor) incomplete.push(t.fieldSupplier)
                const incompleteHint = incomplete.length > 0 ? `${t.incompleteLabel}: ${incomplete.join(', ')}` : ''
                return (
                  <div
                    className={'menu-step-card__item' + (editingId === m.id ? ' menu-step-card__item--active' : '')}
                    key={m.id}
                  >
                    <button
                      type="button"
                      className="menu-step-card__item-main"
                      onClick={() => handleEdit(m)}
                    >
                      <MenuThumb menu={m} />
                      <div className="row__main">
                        <div className="row__title row__title--wrap">
                          {m.name}
                          {incomplete.length > 0 && (
                            <span className="menu-step-card__item-warn" title={incompleteHint} aria-label={incompleteHint}>
                              {Ic.alert}
                            </span>
                          )}
                        </div>
                        <div className="row__sub">
                          {m.donated
                            ? t.donatedTag
                            : m.costBasis === 'percent'
                              ? `${mt.basisPercent} ${Math.round((m.costValue ?? 0) * 100)}%`
                              : `${t.beli} ${formatMoney(m.buyPrice, cur)}`}
                          {' · '}
                          {t.jual} {formatMoney(m.sellPrice, cur)}
                          {m.maxQuota ? ` · ${mt.quotaMax} ${m.maxQuota}` : ''}
                          {m.vendor ? ` · ${m.vendor}` : ''}
                        </div>
                      </div>
                      <span className={'pill ' + (listMargin >= 0 ? 'pill--good' : 'pill--bad')}>
                        {listMargin >= 0 ? '＋' : '－'}
                        {formatMoney(Math.abs(listMargin), cur)}
                      </span>
                    </button>
                    <div className="pocard__menu-wrap">
                      <button
                        type="button"
                        className="pocard__more"
                        aria-label={`Aksi ${m.name}`}
                        onClick={(ev) => {
                          ev.stopPropagation()
                          setOpenActionsId((cur) => (cur === m.id ? null : m.id))
                        }}
                      >
                        {Ic.more}
                      </button>
                      {openActionsId === m.id && (
                        <div className="pocard__menu" role="menu">
                          <button type="button" className="pocard__menu-row" onClick={() => { setOpenActionsId(null); handleEdit(m) }}>
                            {Ic.edit} {t.edit}
                          </button>
                          <button type="button" className="pocard__menu-row" onClick={() => { setOpenActionsId(null); handleDuplicate(m) }}>
                            {Ic.copy} {t.duplicate}
                          </button>
                          <button type="button" className="pocard__menu-row pocard__menu-row--danger" onClick={() => { setOpenActionsId(null); handleDelete(m) }}>
                            {Ic.trash} {mt.delMenu}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {event.menus.length > 0 && (
            <>
              <button type="button" className="btn btn--outline btn--sm po-menu-list__add-another" onClick={handleStartAdd}>
                {Ic.plus} {t.addAnother}
              </button>
              <button type="button" className="btn btn--outline btn--sm po-menu-list__add-another" onClick={() => setEditorMode('paste')}>
                {Ic.clipboard} {t.pasteMenu}
              </button>
            </>
          )}
          {event.menus.length < 3 && <p className="menu-tip">{t.tip}</p>}
        </section>

        <section className="po-menu-editor">
          <h3 className="po-menu-editor__title">{editingMenu ? mt.editTitle : mt.newTitle}</h3>

          {event.menus.length === 0 && editingId === 'new' && !name.trim() ? (
            <div className="po-menu-editor__empty-prompt">
              <strong>{t.empty}</strong>
              <p>{t.emptySub}</p>
            </div>
          ) : null}

          <section className="po-editor-section">
            <div className="po-editor-section__eyebrow">01 · {t.basicInfo}</div>
            <label className="po-form-row">
              <span className="po-form-row__label">{mt.nameLabel}</span>
              <input
                ref={nameInputRef}
                className="input"
                placeholder={mt.namePh}
                maxLength={MENU_LIMITS.name}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="po-form-row">
              <span className="po-form-row__label">{renderOptionalLabel(t.descLabel)}</span>
              <input
                className="input"
                placeholder={t.descPh}
                maxLength={MENU_LIMITS.description}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <label className="po-form-row">
              <span className="po-form-row__label">{renderOptionalLabel(mt.vendorLabel)}</span>
              <input
                className="input"
                placeholder={t.supplierSelfHint}
                maxLength={MENU_LIMITS.vendor}
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
              />
            </label>
            <div className="po-allergens">
              <span className="po-allergens__label">{renderOptionalLabel(t.allergenLabel)}</span>
              <div className="po-allergens__chips" role="group" aria-label={t.allergenLabel}>
                {ALLERGENS.map((a) => {
                  const on = allergens.includes(a.key)
                  return (
                    <button
                      key={a.key}
                      type="button"
                      className={'allergen-chip' + (on ? ' is-on' : '')}
                      aria-pressed={on}
                      onClick={() => toggleAllergen(a.key)}
                    >
                      <span aria-hidden>{a.emoji}</span> {currentLang === 'en' ? a.en : a.id}
                    </button>
                  )
                })}
              </div>
            </div>
          </section>

          <section className="po-editor-section">
            <div className="po-editor-section__eyebrow">02 · {t.supplierCost}</div>

            {/* Menu sumbangan: modal 0 yang DISENGAJA. Tanpa ini, item donasi selamanya
                ditandai "belum lengkap" dan penyumbang muncul di daftar bayar sebagai $0. */}
            {hasSupplier && (
              <label className="po-form-row po-form-row--check">
                <span className="po-form-row__label">
                  {t.donatedLabel}
                  <span className="po-form-row__hint">{t.donatedHint}</span>
                </span>
                <span className="po-form-row__value">
                  <input
                    type="checkbox"
                    className="po-check"
                    checked={donated}
                    onChange={(e) => setDonated(e.target.checked)}
                  />
                </span>
              </label>
            )}

            {/* "Bagi hasil %" hanya tampil bila ada supplier luar — produksi sendiri = opsi absen, bukan terkubur. */}
            {hasSupplier && !donated && (
              <div className="field">
                <label className="field__label">{mt.basisLabel}</label>
                <div className="kind-toggle" role="group" aria-label={mt.basisLabel}>
                  <button
                    type="button"
                    className={'kind-toggle__btn' + (basis === 'perUnit' ? ' is-on income' : '')}
                    onClick={() => setBasis('perUnit')}
                    aria-pressed={basis === 'perUnit'}
                  >
                    {mt.basisPerUnit}
                  </button>
                  <button
                    type="button"
                    className={'kind-toggle__btn' + (basis === 'percent' ? ' is-on income' : '')}
                    onClick={() => setBasis('percent')}
                    aria-pressed={basis === 'percent'}
                  >
                    {mt.basisPercent}
                  </button>
                </div>
              </div>
            )}

            <label className="po-form-row">
              <span className="po-form-row__label">{mt.sellLabel}</span>
              <span className="po-form-row__value">
                <span className="po-form-row__unit">{currencySymbol(cur)}</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={MENU_LIMITS.price}
                  step="any"
                  placeholder="0"
                  value={sellPrice || ''}
                  onChange={(e) => handleSellChange(e.target.value)}
                />
              </span>
            </label>

            {basis === 'percent' ? (
              <>
                <label className="po-form-row">
                  <span className="po-form-row__label">{mt.pctLabel}</span>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={100}
                    placeholder={mt.pctPh}
                    value={pct}
                    onChange={(e) => setPct(e.target.value)}
                  />
                </label>
                <p className="field__hint">{mt.pctHint}</p>
              </>
            ) : (
              <>
                <label className="po-form-row">
                  {/* Ada supplier = "Harga Beli" (bayar ke supplier); buatan sendiri = "HPP" (modal produksi). */}
                  <span className="po-form-row__label">{hasSupplier ? mt.buyLabel : t.hppLabel}</span>
                  <span className="po-form-row__value">
                    <span className="po-form-row__unit">{currencySymbol(cur)}</span>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      max={MENU_LIMITS.price}
                      step="any"
                      placeholder="0"
                      value={buyPrice || ''}
                      onChange={(e) => handleBuyChange(e.target.value)}
                    />
                  </span>
                </label>
                <label className="po-form-row">
                  <span className="po-form-row__label">{mt.marginLabel}</span>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    placeholder={mt.marginPh}
                    value={marginText}
                    onChange={(e) => handleMarginChange(e.target.value)}
                  />
                </label>
                <p className="field__hint">{mt.marginHint}</p>

                {/* Hitung HPP dari resep = alat produksi sendiri; tak relevan bila ada supplier. */}
                {!hasSupplier && (
                <button
                  type="button"
                  className="recipe-helper__toggle"
                  aria-expanded={showRecipe}
                  onClick={() => setShowRecipe((v) => !v)}
                >
                  🧮 {t.recipeToggle} {showRecipe ? '▾' : '▸'}
                </button>
                )}
                {!hasSupplier && showRecipe && (
                  <div className="recipe-helper">
                    <label className="po-form-row">
                      <span className="po-form-row__label">{t.recipeCostLabel}</span>
                      <span className="po-form-row__value">
                        <span className="po-form-row__unit">{currencySymbol(cur)}</span>
                        <input
                          className="input"
                          type="number"
                          min={0}
                          step="any"
                          placeholder="0"
                          value={recipeCost}
                          onChange={(e) => setRecipeCost(e.target.value)}
                        />
                      </span>
                    </label>
                    <label className="po-form-row">
                      <span className="po-form-row__label">{t.recipeYieldLabel}</span>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        placeholder="0"
                        value={recipeYield}
                        onChange={(e) => setRecipeYield(e.target.value)}
                      />
                    </label>
                    <div className="recipe-helper__foot">
                      <span className="recipe-helper__result">
                        {t.recipeResult}:{' '}
                        <strong>{recipePerUnit != null ? formatMoney(recipePerUnit, cur) : '—'}</strong>
                      </span>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        disabled={recipePerUnit == null}
                        onClick={applyRecipe}
                      >
                        {t.recipeApply}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          <section className="po-editor-section">
            <div className="po-editor-section__eyebrow">03 · {t.photo}</div>
            <label className="po-form-row">
              <span className="po-form-row__label">{renderOptionalLabel(mt.quotaLabel)}</span>
              <input
                className="input"
                type="number"
                min={1}
                max={MENU_LIMITS.quota}
                placeholder={mt.quotaPh}
                value={quota}
                onChange={(e) => setQuota(e.target.value)}
              />
            </label>
            <label className="po-form-row">
              <span className="po-form-row__label">{renderOptionalLabel(mt.piecesLabel)}</span>
              <input
                className="input"
                type="number"
                min={1}
                max={MENU_LIMITS.pieces}
                placeholder={mt.piecesPh}
                value={pieces}
                onChange={(e) => setPieces(e.target.value)}
              />
            </label>
            <div className="field">
              <label className="field__label">{mt.image}</label>
              <div className="photo-row">
                {photo && <img src={photo} alt="" className="photo-row__thumb" />}
                <label className="btn btn--ghost btn--sm photo-row__pick">
                  {photo ? mt.photoChange : renderOptionalLabel(mt.photoAdd)}
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
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPhoto(undefined)}>
                    {Ic.trash} {mt.photoRemove}
                  </button>
                )}
              </div>
              {photoError && (
                <p className="field__hint" style={{ color: 'var(--bad)' }}>
                  {mt.photoFail}
                </p>
              )}
            </div>
          </section>

          <div className="po-profit-row">
            <span>{mt.profitPer}</span>
            <strong className={'money ' + (margin >= 0 ? 'money--pos' : 'money--neg')}>
              {margin >= 0 ? '＋' : '－'}
              {formatMoney(Math.abs(margin), cur)}
            </strong>
          </div>

          <div className="po-menu-editor__actions">
            <button
              type="button"
              className="btn btn--primary btn--sm po-menu-editor__save-btn"
              disabled={!canSave}
              onClick={handleSave}
            >
              {mt.saveMenu}
            </button>
            {editingMenu && (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                style={{ color: 'var(--bad)' }}
                onClick={() => handleDelete(editingMenu)}
              >
                {Ic.trash} {mt.delMenu}
              </button>
            )}
          </div>
        </section>
      </div>

      {bulkOpen && (
        <div
          className="sheet-backdrop sheet-backdrop--center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditorMode('form')
          }}
        >
          <div className="sheet sheet--center" role="dialog" aria-modal="true">
            <div className="sheet__handle" />
            <div className="sheet__title">{mt.bulkTitle}</div>
            <p className="field__hint" style={{ margin: '6px 0 10px' }}>
              {mt.bulkHint}
            </p>
            <textarea
              className="textarea"
              placeholder={mt.bulkPh}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
            />

            <div className="section-label" style={{ marginTop: 10 }}>
              {t.willAdd} ({bulkItems.length})
            </div>
            {bulkPreview.length === 0 ? (
              <p className="muted" style={{ margin: '6px 0 0' }}>
                {mt.bulkEmpty}
              </p>
            ) : (
              <div className="po-bulk-preview">
                {bulkPreview.map((row, i) => {
                  const fieldLabel: Record<BulkField, string> = { buy: t.fieldBuy, sell: t.fieldSell, supplier: t.fieldSupplier }
                  const detected: string[] = []
                  if (row.item) {
                    if (row.item.buyPrice > 0) detected.push(`${t.beli} ${formatMoney(row.item.buyPrice, cur)}`)
                    if (row.item.sellPrice > 0) detected.push(`${t.jual} ${formatMoney(row.item.sellPrice, cur)}`)
                    if (row.item.maxQuota) detected.push(`${mt.quotaMax} ${row.item.maxQuota}`)
                    if (row.item.vendor) detected.push(`${t.supplierWord} ${row.item.vendor}`)
                  }
                  return (
                    <div key={`${row.raw}-${i}`} className={`po-bulk-preview__row is-${row.status}`}>
                      <span className="po-bulk-preview__status" aria-hidden>
                        {row.status === 'partial' && Ic.alert}
                      </span>
                      <div className="po-bulk-preview__body">
                        {row.item ? (
                          <>
                            <div className="row__title">{row.item.name}</div>
                            {detected.length > 0 && <div className="row__sub">{detected.join(' · ')}</div>}
                            {row.missing && (
                              <div className="po-bulk-preview__missing">
                                {t.missingLabel}: {row.missing.map((f) => fieldLabel[f]).join(', ')}
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="row__title">{row.raw}</div>
                            <div className="po-bulk-preview__error">Fix: {row.error}</div>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                style={{ flex: 1 }}
                disabled={bulkItems.length === 0}
                onClick={handleBulkAdd}
              >
                {mt.bulkAdd} ({bulkItems.length})
              </button>
              <button type="button" className="btn btn--ghost btn--sm" style={{ flex: 1 }} onClick={() => setEditorMode('form')}>
                {mt.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Navigasi di BAWAH, sama seperti langkah 1 & 3 (dulu ikon panah kecil di kepala kartu). */}
      <div className="wz-actions">
        <button type="button" className="btn btn--ghost btn--sm" onClick={onBack}>
          {Ic.arrowLeft} {t.back}
        </button>
        <button type="button" className="btn btn--primary btn--sm" disabled={event.menus.length === 0} onClick={onNext}>
          {nextLabel ?? t.next} {Ic.arrowRight}
        </button>
      </div>
    </MenuCard>
  )
}

function sellFromMarkup(buy: number, pct: number, currency: string): number {
  return roundMoney(buy * (1 + pct / 100), currency as never)
}

function markupText(buy: number, sell: number): string {
  if (buy <= 0) return ''
  return String(Math.round((sell / buy - 1) * 100))
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Parser "pintar" untuk Salin Daftar Menu: per baris mendeteksi nama menu, supplier,
 * harga beli, harga jual, dan kuota — dari label eksplisit (jual/beli/maks/supplier/@)
 * ATAU posisi ("nama - beli, jual, supplier"). Baris yang nama-nya terbaca tapi ada
 * info kurang tetap masuk sebagai `partial` (harga hilang = 0, dilengkapi via editor)
 * dengan daftar `missing` untuk ikon notifikasi di preview & daftar menu.
 */
function parseMenuLinesDetailed(text: string, currency: Currency): BulkPreviewRow[] {
  const rows: BulkPreviewRow[] = []

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue

    let work = line
    let vendor: string | undefined
    let buy: number | undefined
    let sell: number | undefined
    let quota: number | undefined

    // 1) Supplier eksplisit: "@Bu Sri" / "supplier: Bu Sri" / "vendor Bu Sri" / "dari Bu Sri" di ujung baris
    const vendorMarked = work.match(/(?:@|\b(?:supplier|vendor|dari)\b)\s*[:=]?\s*([^,;|@]+?)\s*$/i)
    if (vendorMarked && /[a-z]/i.test(vendorMarked[1]) && !/\d/.test(vendorMarked[1])) {
      vendor = vendorMarked[1].trim()
      work = work.slice(0, vendorMarked.index).replace(/[\s\-–:,;|]+$/, '')
    }

    // 2) Harga/kuota berlabel: "jual 15" / "beli 8rb" / "maks 20" (label sebelum ATAU sesudah angka)
    const grab = (re: RegExp): number | undefined => {
      const m = work.match(re)
      if (!m) return undefined
      const v = parseMoney(m[1], currency)
      if (v == null || v <= 0) return undefined
      work = (work.slice(0, m.index) + ' ' + work.slice((m.index ?? 0) + m[0].length)).trim()
      return v
    }
    quota = grab(/\(?\b(?:maks|max|kuota|quota|limit)\b\.?\s*:?\s*([\d.,]+(?:\s*(?:rb|ribu|k|jt|juta))?)\)?/i)
    sell = grab(/\b(?:jual|sell)\b\.?\s*:?\s*(?:rp\.?\s*)?([\d.,]+(?:\s*(?:rb|ribu|k|jt|juta))?)/i)
    buy = grab(/\b(?:beli|buy|modal|cost)\b\.?\s*:?\s*(?:rp\.?\s*)?([\d.,]+(?:\s*(?:rb|ribu|k|jt|juta))?)/i)

    // 3) Nama = teks sebelum angka pertama (atau seluruh baris tanpa angka)
    const firstNum = work.search(/\d/)
    let name = (firstNum >= 0 ? work.slice(0, firstNum) : work)
      .replace(/\b(modal|beli|jual|harga|buy|sell|cost|maks|max|kuota|quota|rp)\b\.?/gi, '')
      .replace(/[\s\-–:,;|@(]+$/, '')
      .trim()

    if (!name) {
      rows.push({ raw: line, status: 'invalid', error: 'missing menu name' })
      continue
    }

    // 4) Sisa angka posisional + supplier posisional ("nama - 5, 15, Bu Sri")
    if (firstNum >= 0) {
      const tokens = work
        .slice(firstNum)
        .split(/[,;|·]| {2,}|\s[-–]\s/)
        .map((s) => s.replace(/[()]/g, '').trim())
        .filter(Boolean)
      const nums: number[] = []
      const words: string[] = []
      for (const token of tokens) {
        const v = /\d/.test(token) ? parseMoney(token, currency) : null
        if (v != null && v > 0) nums.push(v)
        else if (/[a-z]/i.test(token) && !/\d/.test(token)) words.push(token)
      }
      if (buy == null && sell == null) {
        if (nums.length >= 2) [buy, sell] = nums
        else if (nums.length === 1) sell = nums[0] // satu harga = anggap harga jual
        if (quota == null && nums.length >= 3) quota = nums[2]
      } else {
        // salah satu sudah berlabel → angka polos mengisi slot yang kosong
        if (buy == null && nums.length > 0) buy = nums.shift()
        if (sell == null && nums.length > 0) sell = nums.shift()
        if (quota == null && nums.length > 0) quota = nums.shift()
      }
      if (!vendor && words.length > 0) vendor = words[words.length - 1]
    }

    const missing: BulkField[] = []
    if (buy == null) missing.push('buy')
    if (sell == null) missing.push('sell')
    if (!vendor) missing.push('supplier')

    rows.push({
      raw: line,
      status: missing.length === 0 ? 'valid' : 'partial',
      item: {
        name: name.slice(0, MENU_LIMITS.name),
        buyPrice: Math.min(MENU_LIMITS.price, buy ?? 0),
        sellPrice: Math.min(MENU_LIMITS.price, sell ?? 0),
        maxQuota: quota != null ? Math.min(MENU_LIMITS.quota, quota) : undefined,
        vendor: vendor?.slice(0, MENU_LIMITS.vendor),
      },
      missing: missing.length > 0 ? missing : undefined,
    })
  }

  return rows
}
