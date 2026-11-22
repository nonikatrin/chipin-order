import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import AppBar from '../components/AppBar'
import { usePOStore } from '../po/store'
import type { POEvent } from '../po/types'
import { computePO } from '../po/calc'
import { formatMoney } from '../utils/format'
import { useLangStore } from '../utils/langStore'
import { useToast } from '../components/Toast'
import { Ic } from '../components/icons'
import { MenuThumb } from '../components/MenuThumb'
import { buildRecapReport, sharePO } from '../po/whatsapp'
import { POWizard } from './po/POWizard'

const STR = {
  id: {
    title: 'Pesanan',
    newPO: '+ Buku Pesanan Baru',
    newOrder: '+ Pesanan Baru',
    active: 'Aktif',
    past: 'Lampau',
    search: 'Cari PO…',
    buyers: 'pembeli',
    items: 'menu',
    noActive: 'Belum ada PO aktif.',
    noPast: 'Belum ada PO lampau.',
    noMatch: 'Tidak ada PO yang cocok.',
    emptyTitle: 'Belum ada PO',
    emptyDesc: 'Buat buku pesanan pertama untuk mulai menerima order dari pembeli.',
    emptyCta: 'Buat Buku Pesanan Baru',
    emptyImport: 'Impor dari Chip!n',
    featLabel: 'Cuplikan Fitur',
    feats: [
      { ico: '💳', name: 'Kelola Pembayaran', desc: 'Parsial & lunas' },
      { ico: '🚚', name: 'Pickup & Delivery', desc: 'Lacak pemenuhan' },
      { ico: '📊', name: 'Rekap Otomatis', desc: 'Laporan supplier' },
    ],
    open: 'Buka',
    sheetEdit: 'Edit detail PO', sheetDup: 'Duplikat PO', sheetShare: 'Bagikan rekap',
    sheetClose: 'Tutup PO (jadi riwayat)', sheetReopen: 'Buka lagi PO ini', sheetDelete: 'Hapus PO',
    dupDone: 'PO diduplikasi', closed: 'PO ditutup — pindah ke tab Lampau', reopened: 'PO dibuka kembali', deleted: 'PO dihapus',
    delTitle: 'Hapus PO ini?',
    delBody: (n: number) => n > 0 ? `Ini menghapus permanen ${n} pesanan pembeli dan tidak bisa dibatalkan.` : 'PO ini akan dihapus permanen.',
    delNudge: 'Pertimbangkan menutup PO alih-alih menghapus — riwayatnya tetap tersimpan.',
    keep: 'Simpan PO', yesDelete: 'Ya, Hapus',
    activeBadge: 'AKTIF', closedBadge: 'DITUTUP', emptyBadge: 'KOSONG',
  },
  en: {
    title: 'Orders',
    newPO: '+ New Order Book',
    newOrder: '+ New Order',
    active: 'Active',
    past: 'Past',
    search: 'Search Orders…',
    buyers: 'buyers',
    items: 'items',
    noActive: 'No active orders yet.',
    noPast: 'No past orders yet.',
    noMatch: 'No orders match.',
    emptyTitle: 'No orders yet',
    emptyDesc: 'Create your first order book to start taking orders from buyers.',
    emptyCta: 'Create New Order Book',
    emptyImport: 'Import from Chip!n',
    featLabel: 'Feature Preview',
    feats: [
      { ico: '💳', name: 'Manage Payments', desc: 'Partial & settled' },
      { ico: '🚚', name: 'Pickup & Delivery', desc: 'Track fulfillment' },
      { ico: '📊', name: 'Auto Recap', desc: 'Supplier reports' },
    ],
    open: 'Open',
    sheetEdit: 'Edit Order details', sheetDup: 'Duplicate Order', sheetShare: 'Share recap',
    sheetClose: 'Close Order (marks as past)', sheetReopen: 'Reopen this Order', sheetDelete: 'Delete Order',
    dupDone: 'Order duplicated', closed: 'Order closed — moved to the Past tab', reopened: 'Order reopened', deleted: 'Order deleted',
    delTitle: 'Delete this Order?',
    delBody: (n: number) => n > 0 ? `This permanently deletes ${n} buyer orders and cannot be undone.` : 'This Order will be permanently deleted.',
    delNudge: "Consider closing instead of deleting — you'll keep the history.",
    keep: 'Keep Order', yesDelete: 'Yes, Delete',
    activeBadge: 'ACTIVE', closedBadge: 'CLOSED', emptyBadge: 'EMPTY',
  },
} as const

function isClosed(e: POEvent): boolean {
  return e.status === 'closed'
}

export default function OrdersPage() {
  const navigate = useNavigate()
  const { currentLang } = useLangStore()
  const t = STR[currentLang] ?? STR.id
  const toast = useToast()

  const events = usePOStore((s) => s.events)
  const { deleteEvent, closeEvent, reopenEvent, duplicateEvent } = usePOStore()

  const [tab, setTab] = useState<'active' | 'past'>('active')
  const [query, setQuery] = useState('')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [confirmFor, setConfirmFor] = useState<POEvent | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!openMenuId) return
    const onDown = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement | null
      if (target?.closest('.pocard__menu-wrap')) return
      setOpenMenuId(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [openMenuId])

  const q = query.trim().toLowerCase()
  const active = useMemo(
    () => events.filter((e) => !isClosed(e) && (!q || e.name.toLowerCase().includes(q))),
    [events, q],
  )
  const past = useMemo(
    () => events.filter((e) => isClosed(e) && (!q || e.name.toLowerCase().includes(q))),
    [events, q],
  )
  const activeCount = events.filter((e) => !isClosed(e)).length
  const pastCount = events.filter(isClosed).length
  const firstActiveEvent = events.find((e) => !isClosed(e))

  const locale = currentLang === 'id' ? 'id-ID' : 'en-US'
  function whenLabel(e: POEvent): string {
    const d = e.deliveryDate ? new Date(e.deliveryDate + 'T00:00:00') : new Date(e.createdAt)
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function badge(e: POEvent) {
    if (e.buyers.length === 0 && e.menus.length === 0)
      return <span className="badge badge--empty">{t.emptyBadge}</span>
    if (isClosed(e)) return <span className="badge badge--closed">{t.closedBadge}</span>
    return <span className="badge badge--active">{t.activeBadge}</span>
  }

  async function shareRecap(e: POEvent) {
    await sharePO(buildRecapReport(e))
  }

  function openPOActions(ev: ReactMouseEvent<HTMLButtonElement>, e: POEvent) {
    ev.preventDefault()
    ev.stopPropagation()
    setOpenMenuId((cur) => (cur === e.id ? null : e.id))
  }

  function card(e: POEvent) {
    const isMenuOpen = openMenuId === e.id
    const totals = computePO(e)
    return (
      <div key={e.id} className={'pocard' + (isClosed(e) ? ' pocard--past' : '')}>
        <button type="button" className="pocard__main" onClick={() => navigate(`/po/${e.id}`)}>
          <MenuThumb menu={e.menus[0] ?? { emoji: e.emoji, name: e.name }} />
          <span className="pocard__body">
            <span className="pocard__top">
              <span className="pocard__name">{e.name}</span>
              {badge(e)}
            </span>
            <span className="pocard__meta">
              {e.buyers.length} {t.buyers} · {e.menus.length} {t.items} · {whenLabel(e)}
            </span>
            <span className="pocard__meta pocard__meta--soft">
              {formatMoney(totals.revenue, e.currency)}
            </span>
          </span>
        </button>
        <div className="pocard__menu-wrap">
          <button type="button" className="pocard__more" aria-label="Menu PO" onClick={(ev) => openPOActions(ev, e)}>{Ic.more}</button>
          {isMenuOpen && (
            <div className="pocard__menu" role="menu">
              <button type="button" className="pocard__menu-row" onClick={() => { setOpenMenuId(null); navigate(`/po/${e.id}`) }}>{Ic.edit} {t.sheetEdit}</button>
              <button type="button" className="pocard__menu-row" onClick={() => { const id = duplicateEvent(e.id); setOpenMenuId(null); toast.show(t.dupDone); if (id) navigate(`/po/${id}`) }}>{Ic.copy} {t.sheetDup}</button>
              <button type="button" className="pocard__menu-row" onClick={() => { setOpenMenuId(null); void shareRecap(e) }}>{Ic.share} {t.sheetShare}</button>
              {isClosed(e) ? (
                <button type="button" className="pocard__menu-row" onClick={() => { reopenEvent(e.id); setOpenMenuId(null); toast.show(t.reopened) }}>{Ic.refresh} {t.sheetReopen}</button>
              ) : (
                <button type="button" className="pocard__menu-row" onClick={() => { closeEvent(e.id); setOpenMenuId(null); toast.show(t.closed) }}>{Ic.lock} {t.sheetClose}</button>
              )}
              <button type="button" className="pocard__menu-row pocard__menu-row--danger" onClick={() => { setOpenMenuId(null); setConfirmFor(e) }}>{Ic.trash} {t.sheetDelete}</button>
            </div>
          )}
        </div>
      </div>
    )
  }

  const list = tab === 'active' ? active : past
  const emptyMsg = q ? t.noMatch : tab === 'active' ? t.noActive : t.noPast

  // "+ PO Baru" menampilkan wizard inline (menggantikan daftar), bukan pindah halaman.
  if (creating) return <POWizard onExit={() => setCreating(false)} />

  return (
    <>
      <AppBar title={t.title} backTo="/" />
      <main className="page" style={{ paddingTop: 16 }}>
        {events.length === 0 ? (
          <div className="empty">
            <div className="empty__art" aria-hidden>🍜</div>
            <h2 className="empty__title">{t.emptyTitle}</h2>
            <p className="empty__text">{t.emptyDesc}</p>
            <div className="empty__ctas">
              <button type="button" className="btn btn--primary" onClick={() => setCreating(true)}>{t.emptyCta}</button>
              <button type="button" className="btn btn--ghost" onClick={() => navigate('/import')}>{t.emptyImport}</button>
            </div>
            <div className="empty-extra">
              <div className="section-label">{t.featLabel}</div>
              <div className="feat-grid">
                {t.feats.map((f) => (
                  <div key={f.name} className="feat-card">
                    <span className="feat-card__ico" aria-hidden>{f.ico}</span>
                    <span className="feat-card__name">{f.name}</span>
                    <span className="feat-card__desc">{f.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="orders-toolbar">
              <div className="tabs" role="tablist">
                <button type="button" role="tab" aria-selected={tab === 'active'} className={'tab' + (tab === 'active' ? ' tab--on' : '')} onClick={() => setTab('active')}>
                  <span className="tab__dot tab__dot--live" aria-hidden /> {t.active} ({activeCount})
                </button>
                <button type="button" role="tab" aria-selected={tab === 'past'} className={'tab' + (tab === 'past' ? ' tab--on' : '')} onClick={() => setTab('past')}>
                  <span className="tab__dot" aria-hidden /> {t.past} ({pastCount})
                </button>
              </div>
              <input
                className="input orders-search"
                type="search"
                placeholder={t.search}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button
                type="button"
                className="btn btn--ghost btn--sm orders-new"
                disabled={!firstActiveEvent}
                onClick={() => firstActiveEvent && navigate(`/po/${firstActiveEvent.id}/pesanan/baru`)}
              >
                {t.newOrder}
              </button>
              <button type="button" className="btn btn--primary btn--sm orders-new" onClick={() => setCreating(true)}>{t.newPO}</button>
            </div>

            {list.length === 0 ? (
              <p className="muted" style={{ padding: '16px 4px' }}>{emptyMsg}</p>
            ) : (
              <div className="stack">{list.map((e) => card(e))}</div>
            )}
          </>
        )}
      </main>

      <button type="button" className="fab m-only" onClick={() => setCreating(true)}>{t.newPO}</button>

      {confirmFor && (
        <div className="confirm-backdrop" onClick={() => setConfirmFor(null)}>
          <div className="confirm" role="alertdialog" onClick={(ev) => ev.stopPropagation()}>
            <div className="confirm__title"><span className="confirm__ico" aria-hidden>{Ic.trash}</span>{t.delTitle}</div>
            <div className="confirm__name">{confirmFor.name}</div>
            <p className="confirm__text">{t.delBody(confirmFor.buyers.length)}</p>
            {!isClosed(confirmFor) && <div className="nudge">{Ic.alert}<span>{t.delNudge}</span></div>}
            <div className="confirm__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setConfirmFor(null)}>{t.keep}</button>
              <button type="button" className="btn btn--danger" onClick={() => { deleteEvent(confirmFor.id); setConfirmFor(null); toast.show(t.deleted) }}>{t.yesDelete}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
