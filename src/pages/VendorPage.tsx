import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import AppBar from '../components/AppBar'
import { Ic } from '../components/icons'
import { usePOStore } from '../po/store'
import { computePO } from '../po/calc'
import { formatMoney } from '../utils/format'
import { useLangStore } from '../utils/langStore'
import { useToast } from '../components/Toast'

const STR = {
  id: {
    title: 'Portal Supplier',
    sub: 'Semua kewajiban ke supplier dari PO aktif — tandai lunas di sini atau di Rekap.',
    unpaidTotal: 'BELUM DIBAYAR',
    paid: 'Lunas',
    unpaid: 'Belum',
    by: 'oleh',
    noVendor: 'Tanpa nama supplier',
    empty: 'Tidak ada kewajiban supplier — semua PO aktif belum punya menu bersupplier.',
    openPO: 'Buka PO',
  },
  en: {
    title: 'Supplier Portal',
    sub: 'All supplier obligations from active POs — mark paid here or on the Recap page.',
    unpaidTotal: 'UNPAID',
    paid: 'Paid',
    unpaid: 'Unpaid',
    by: 'by',
    noVendor: 'No supplier name',
    empty: 'No supplier obligations — active POs have no supplier-assigned menus yet.',
    openPO: 'Open PO',
  },
} as const

export default function VendorPage() {
  const navigate = useNavigate()
  const { currentLang } = useLangStore()
  const t = STR[currentLang]
  const events = usePOStore((s) => s.events)
  const toggleVendorPaid = usePOStore((s) => s.toggleVendorPaid)
  const toast = useToast()

  // Per PO aktif → kelompokkan biaya per vendor (POTotals.menus + menu.vendor).
  const groups = useMemo(() => {
    return events
      .filter((e) => e.status !== 'closed')
      .map((e) => {
        const totals = computePO(e)
        const byVendor = new Map<string, number>()
        for (const mr of totals.menus) {
          const menu = e.menus.find((m) => m.id === mr.menuId)
          const vendor = menu?.vendor?.trim() ?? ''
          byVendor.set(vendor, (byVendor.get(vendor) ?? 0) + mr.cost)
        }
        const vendors = [...byVendor.entries()]
          .filter(([, owed]) => owed > 0)
          .map(([vendor, owed]) => ({
            vendor,
            owed,
            payout: vendor ? e.vendorPayouts?.[vendor] : undefined,
          }))
        return { e, vendors }
      })
      .filter((g) => g.vendors.length > 0)
  }, [events])

  // Total belum dibayar per mata uang (jangan campur mata uang).
  const unpaidByCur = new Map<string, number>()
  for (const g of groups)
    for (const v of g.vendors)
      if (!v.payout?.paid)
        unpaidByCur.set(g.e.currency, (unpaidByCur.get(g.e.currency) ?? 0) + v.owed)

  return (
    <>
      <AppBar title={t.title} backTo="/" />
      <main className="page" style={{ paddingTop: 20 }}>
        <p className="muted" style={{ marginTop: 0 }}>
          {t.sub}
        </p>

        {groups.length === 0 ? (
          <div className="empty">
            <div className="empty__emoji">🏦</div>
            <p>{t.empty}</p>
          </div>
        ) : (
          <>
            <section className="statgrid" style={{ gridTemplateColumns: '1fr' }}>
              <div className="stat stat--out">
                <div className="stat__label">{t.unpaidTotal}</div>
                <div className="stat__value">
                  {unpaidByCur.size === 0
                    ? '✓'
                    : [...unpaidByCur.entries()]
                        .map(([c, n]) => formatMoney(n, c))
                        .join(' + ')}
                </div>
              </div>
            </section>

            {groups.map(({ e, vendors }) => (
              <section key={e.id} style={{ marginTop: 18 }}>
                <div className="section-label" style={{ justifyContent: 'space-between' }}>
                  <span>
                    {e.emoji} {e.name}
                  </span>
                  <button
                    type="button"
                    className="btn btn--sm btn--ghost"
                    style={{ width: 'auto', minHeight: 36 }}
                    onClick={() => navigate(`/po/${e.id}/rekap`)}
                  >
                    {t.openPO} {Ic.arrowRight}
                  </button>
                </div>
                <div className="stack">
                  {vendors.map((v) => (
                    <div
                      key={v.vendor || '(none)'}
                      className="card card--flat"
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14 }}
                    >
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontWeight: 700 }}>
                          {v.vendor || <i className="muted">{t.noVendor}</i>}
                        </span>
                        {v.payout?.paid && (
                          <span className="muted" style={{ fontSize: 'var(--fs-caption)' }}>
                            {v.payout.paidDate}
                            {v.payout.paidBy ? ` · ${t.by} ${v.payout.paidBy}` : ''}
                          </span>
                        )}
                      </span>
                      <span style={{ fontWeight: 800 }}>{formatMoney(v.owed, e.currency)}</span>
                      {v.vendor ? (
                        <button
                          type="button"
                          className={'pill ' + (v.payout?.paid ? 'pill--good' : 'pill--bad')}
                          style={{ border: 'none', cursor: 'pointer', font: 'inherit', fontWeight: 700 }}
                          onClick={() => {
                            toggleVendorPaid(e.id, v.vendor)
                            toast.show('✓')
                          }}
                        >
                          {v.payout?.paid ? `✓ ${t.paid}` : t.unpaid}
                        </button>
                      ) : (
                        <span className="pill pill--neutral">—</span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </main>
    </>
  )
}
