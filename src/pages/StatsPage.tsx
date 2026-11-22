import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import AppBar from '../components/AppBar'
import { usePOStore } from '../po/store'
import { computePO } from '../po/calc'
import { formatMoney } from '../utils/format'
import { useLangStore } from '../utils/langStore'

const STR = {
  id: {
    title: 'Laporan',
    active: 'PO Aktif',
    closed: 'PO Lampau',
    revenue: 'Dana Masuk',
    profit: 'Untung Bersih',
    portions: 'Porsi',
    perPO: 'PER PRE-ORDER',
    buyers: 'pembeli',
    emptyTitle: 'Belum ada data laporan',
    emptyDesc: 'Laporan muncul otomatis setelah kamu membuat dan mengelola PO pertama.',
    emptyCta: 'Mulai dengan Buat PO',
    whatLabel: 'Yang akan muncul di sini:',
    whatItems: [
      { ico: '💰', label: 'Total pendapatan & keuntungan' },
      { ico: '📊', label: 'Grafik pembayaran pembeli' },
      { ico: '🍱', label: 'Rekap porsi per supplier' },
      { ico: '📅', label: 'Riwayat PO bulanan' },
    ],
    note: 'Semua angka dari data di perangkat ini (multi-mata-uang dijumlah per PO, bukan lintas PO).',
  },
  en: {
    title: 'Reports',
    active: 'Active POs',
    closed: 'Past POs',
    revenue: 'Money In',
    profit: 'Net Profit',
    portions: 'Portions',
    perPO: 'PER PRE-ORDER',
    buyers: 'buyers',
    emptyTitle: 'No report data yet',
    emptyDesc: 'Reports appear automatically once you create and run your first PO.',
    emptyCta: 'Start by Creating a PO',
    whatLabel: "What you'll see here:",
    whatItems: [
      { ico: '💰', label: 'Total revenue & profit' },
      { ico: '📊', label: 'Buyer payment overview' },
      { ico: '🍱', label: 'Portion recap per supplier' },
      { ico: '📅', label: 'Monthly PO history' },
    ],
    note: 'All numbers come from on-device data (multi-currency sums stay per PO, not across POs).',
  },
} as const

export default function StatsPage() {
  const navigate = useNavigate()
  const { currentLang } = useLangStore()
  const t = STR[currentLang]
  const events = usePOStore((s) => s.events)

  const rows = useMemo(
    () => events.map((e) => ({ e, totals: computePO(e) })),
    [events],
  )

  // Total lintas-PO hanya dijumlahkan bila SEMUA PO satu mata uang — jujur soal uang.
  const currencies = new Set(events.map((e) => e.currency))
  const singleCur = currencies.size === 1 ? events[0]?.currency : null
  const sum = (f: (r: (typeof rows)[number]) => number) =>
    rows.reduce((s, r) => s + f(r), 0)

  const activeCount = events.filter((e) => e.status !== 'closed').length

  return (
    <>
      <AppBar title={t.title} backTo="/" />
      <main className="page" style={{ paddingTop: 20 }}>
        {events.length === 0 ? (
          <div className="empty">
            <div className="empty__art" aria-hidden>📈</div>
            <h2 className="empty__title">{t.emptyTitle}</h2>
            <p className="empty__text">{t.emptyDesc}</p>
            <div className="empty__ctas">
              <button type="button" className="btn btn--primary" onClick={() => navigate('/po/buat')}>{t.emptyCta}</button>
            </div>
            <div className="empty-extra">
              <div className="what-card">
                <div className="section-label" style={{ color: 'var(--brand)' }}>{t.whatLabel}</div>
                <ul className="what-list">
                  {t.whatItems.map((w) => (
                    <li key={w.label}>
                      <span className="what-list__ico" aria-hidden>{w.ico}</span>
                      {w.label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <>
            <section className="statgrid" style={{ marginTop: 4 }}>
              <div className="stat stat--profit">
                <div className="stat__label">{t.profit}</div>
                <div className="stat__value">
                  {singleCur ? formatMoney(sum((r) => r.totals.untungBersih), singleCur) : '—'}
                </div>
              </div>
              <div className="stat">
                <div className="stat__label">{t.revenue}</div>
                <div className="stat__value">
                  {singleCur ? formatMoney(sum((r) => r.totals.danaMasuk), singleCur) : '—'}
                </div>
              </div>
              <div className="stat">
                <div className="stat__label">{t.portions}</div>
                <div className="stat__value">{sum((r) => r.totals.totalPorsi)}</div>
              </div>
            </section>

            <section className="statgrid">
              <div className="stat">
                <div className="stat__label">{t.active}</div>
                <div className="stat__value">{activeCount}</div>
              </div>
              <div className="stat">
                <div className="stat__label">{t.closed}</div>
                <div className="stat__value">{events.length - activeCount}</div>
              </div>
              <div className="stat">
                <div className="stat__label">PO</div>
                <div className="stat__value">{events.length}</div>
              </div>
            </section>

            {!singleCur && (
              <p className="field__hint" style={{ marginTop: 8 }}>
                {t.note}
              </p>
            )}

            <div className="section-label" style={{ marginTop: 18 }}>
              {t.perPO}
            </div>
            <div className="stack">
              {rows.map(({ e, totals }) => (
                <button
                  key={e.id}
                  type="button"
                  className="pocard__main card card--flat"
                  style={{ display: 'flex', gap: 12, alignItems: 'center' }}
                  onClick={() => navigate(`/po/${e.id}`)}
                >
                  <span className="pocard__art" aria-hidden>
                    {e.emoji}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 700 }}>{e.name}</span>
                    <span className="muted" style={{ fontSize: 'var(--fs-caption)' }}>
                      {e.buyers.length} {t.buyers} · {totals.totalPorsi} porsi
                      {e.status === 'closed' ? ' · 🔒' : ''}
                    </span>
                  </span>
                  <span style={{ textAlign: 'right' }}>
                    <span style={{ display: 'block', fontWeight: 800, color: 'var(--good)' }}>
                      {formatMoney(totals.untungBersih, e.currency)}
                    </span>
                    <span className="muted" style={{ fontSize: 'var(--fs-caption)' }}>
                      {formatMoney(totals.danaMasuk, e.currency)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  )
}
