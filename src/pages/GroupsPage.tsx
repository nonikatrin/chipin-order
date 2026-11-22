import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppBar from '../components/AppBar'
import { usePOStore } from '../po/store'
import { computePO } from '../po/calc'
import { formatMoney } from '../utils/format'
import { useLangStore } from '../utils/langStore'

const STR = {
  id: {
    title: 'Grup & Peserta',
    sub: 'Semua pembeli lintas PO — dari data di perangkat ini.',
    search: 'Cari nama…',
    poCount: 'PO',
    portions: 'porsi',
    outstanding: 'Belum dibayar',
    settled: '✓ Lunas',
    emptyTitle: 'Belum ada peserta',
    emptyDesc: 'Peserta muncul otomatis saat kamu menambahkan pembeli ke PO.',
    emptyCta: 'Buat PO Sekarang',
    howTitle: '💡 Cara kerjanya:',
    howSteps: ['Buat buku pesanan', 'Tambahkan pembeli ke PO', 'Peserta tampil di sini otomatis'],
    noMatch: 'Tidak ada nama yang cocok.',
    inPO: 'Ikut di PO ini:',
    open: 'Buka',
  },
  en: {
    title: 'Groups & Participants',
    sub: 'All buyers across your POs — from on-device data.',
    search: 'Search names…',
    poCount: 'POs',
    portions: 'portions',
    outstanding: 'Outstanding',
    settled: '✓ Settled',
    emptyTitle: 'No participants yet',
    emptyDesc: 'Participants appear automatically when you add buyers to a PO.',
    emptyCta: 'Create a PO Now',
    howTitle: '💡 How it works:',
    howSteps: ['Create an order book', 'Add buyers to the PO', 'They show up here automatically'],
    noMatch: 'No names match.',
    inPO: 'In these POs:',
    open: 'Open',
  },
} as const

interface Participant {
  key: string
  name: string
  phone?: string
  portions: number
  outstandingByCur: Map<string, number>
  pos: { id: string; name: string; emoji: string }[]
}

export default function GroupsPage() {
  const navigate = useNavigate()
  const { currentLang } = useLangStore()
  const t = STR[currentLang] ?? STR.id
  const events = usePOStore((s) => s.events)

  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const participants = useMemo(() => {
    const byKey = new Map<string, Participant>()
    for (const e of events) {
      const totals = computePO(e)
      const calcById = new Map(totals.buyers.map((b) => [b.buyerId, b]))
      for (const b of e.buyers) {
        const key = (b.name.trim().toLowerCase() || 'tanpa-nama') + '|' + (b.phone ?? '')
        let p = byKey.get(key)
        if (!p) {
          p = { key, name: b.name.trim() || 'Tanpa Nama', phone: b.phone, portions: 0, outstandingByCur: new Map(), pos: [] }
          byKey.set(key, p)
        }
        if (!p.phone && b.phone) p.phone = b.phone
        const calc = calcById.get(b.id)
        if (calc) {
          p.portions += calc.qtyTotal
          if (calc.kurangBayar > 0) p.outstandingByCur.set(e.currency, (p.outstandingByCur.get(e.currency) ?? 0) + calc.kurangBayar)
        }
        if (!p.pos.some((x) => x.id === e.id)) p.pos.push({ id: e.id, name: e.name, emoji: e.emoji })
      }
    }
    return [...byKey.values()].sort((a, b) => b.pos.length - a.pos.length || a.name.localeCompare(b.name))
  }, [events])

  const q = query.trim().toLowerCase()
  const shown = q ? participants.filter((p) => p.name.toLowerCase().includes(q) || (p.phone ?? '').includes(q)) : participants

  return (
    <>
      <AppBar title={t.title} backTo="/" />
      <main className="page" style={{ paddingTop: 16 }}>
        <p className="muted" style={{ marginTop: 0 }}>{t.sub}</p>

        {participants.length === 0 ? (
          <div className="empty">
            <div className="empty__art" aria-hidden>🧑‍🤝‍🧑</div>
            <h2 className="empty__title">{t.emptyTitle}</h2>
            <p className="empty__text">{t.emptyDesc}</p>
            <div className="empty__ctas">
              <button type="button" className="btn btn--primary" onClick={() => navigate('/po/buat')}>{t.emptyCta}</button>
            </div>
            <div className="empty-extra">
              <div className="howto-card">
                <p className="howto-card__title">{t.howTitle}</p>
                <ol>
                  {t.howSteps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        ) : (
          <>
            <input className="input" type="search" placeholder={t.search} value={query} onChange={(e) => setQuery(e.target.value)} style={{ marginBottom: 12 }} />
            {shown.length === 0 ? (
              <p className="muted" style={{ padding: '8px 4px' }}>{t.noMatch}</p>
            ) : (
              <div className="stack">
                {shown.map((p) => {
                  const outStr = [...p.outstandingByCur.entries()].map(([c, n]) => formatMoney(n, c)).join(' + ')
                  const isOpen = expanded === p.key
                  return (
                    <div key={p.key} className="card card--flat" style={{ padding: 0 }}>
                      <button
                        type="button"
                        className="person-row"
                        onClick={() => setExpanded((cur) => (cur === p.key ? null : p.key))}
                      >
                        <span className="person-row__avatar" aria-hidden>{p.name.charAt(0).toUpperCase()}</span>
                        <span className="person-row__body">
                          <span className="person-row__name">{p.name}</span>
                          <span className="person-row__meta">
                            {p.pos.length} {t.poCount} · {p.portions} {t.portions}
                            {p.phone ? ` · ${p.phone}` : ''}
                          </span>
                        </span>
                        <span className={'pill ' + (p.outstandingByCur.size > 0 ? 'pill--bad' : 'pill--good')}>
                          {p.outstandingByCur.size > 0 ? outStr : t.settled}
                        </span>
                      </button>
                      {isOpen && (
                        <div className="person-pos">
                          <div className="section-label">{t.inPO}</div>
                          {p.pos.map((po) => (
                            <button key={po.id} type="button" className="person-pos__item" onClick={() => navigate(`/po/${po.id}`)}>
                              <span>{po.emoji} {po.name}</span>
                              <span className="person-pos__go">{t.open} →</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </main>
    </>
  )
}
