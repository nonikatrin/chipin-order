import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMonthGrid } from '../utils/calendar'
import { usePOStore } from '../po/store'
import { useLangStore } from '../utils/langStore'
import type { POEvent } from '../po/types'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function todayISO(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function Calendar({
  year,
  month,
  onNext,
  onPrev,
  onPickDate,
}: {
  year: number
  month: number
  onNext: () => void
  onPrev: () => void
  /** Ketuk tanggal → mulai buku pesanan dengan tanggal itu (opsional). */
  onPickDate?: (iso: string) => void
}) {
  const navigate = useNavigate()
  const events = usePOStore((s) => s.events)
  const { currentLang } = useLangStore()
  const days = getMonthGrid(year, month)
  const today = todayISO()
  const id = currentLang === 'id'
  const pickHint = id
    ? 'Ketuk tanggal: buka PO-nya, atau mulai PO baru'
    : 'Tap a date: open its PO, or start a new one'

  // Tanggal dengan >1 PO → panel pemilih di bawah grid.
  const [pickDate, setPickDate] = useState<string | null>(null)

  const monthName = new Date(year, month).toLocaleString(id ? 'id-ID' : 'en-US', {
    month: 'long',
  })

  // Tanggal kirim → daftar PO pada tanggal itu (penanda titik + tujuan klik).
  const poByDate = useMemo(() => {
    const map = new Map<string, POEvent[]>()
    for (const e of events) {
      if (!e.deliveryDate) continue
      const list = map.get(e.deliveryDate)
      if (list) list.push(e)
      else map.set(e.deliveryDate, [e])
    }
    return map
  }, [events])

  // Klik tanggal: ada 1 PO → langsung ke halaman PO-nya (ringkasan; user memutuskan
  // langkah berikutnya di sana); >1 PO → panel pemilih; kosong → mulai PO baru (onPickDate).
  function handleDay(iso: string) {
    const pos = poByDate.get(iso)
    if (!pos || pos.length === 0) {
      setPickDate(null)
      onPickDate?.(iso)
      return
    }
    if (pos.length === 1) {
      navigate(`/po/${pos[0].id}`)
      return
    }
    setPickDate((cur) => (cur === iso ? null : iso))
  }

  const pickList = pickDate ? poByDate.get(pickDate) ?? [] : []
  const pickDateLabel = pickDate
    ? new Date(pickDate + 'T00:00:00').toLocaleDateString(id ? 'id-ID' : 'en-US', {
        weekday: 'short', day: 'numeric', month: 'short',
      })
    : ''

  const hasRecurring = useMemo(() => events.some((e) => e.recurrence), [events])

  return (
    <div className="cal">
      <div className="cal__nav">
        <h3 className="cal__title">📅 {monthName} {year}</h3>
        <div className="cal__navbtns">
          <button type="button" onClick={onPrev} aria-label="Prev month">←</button>
          <button type="button" onClick={onNext} aria-label="Next month">→</button>
        </div>
      </div>

      <div className="cal__grid">
        {WEEKDAYS.map((d) => (
          <div key={d} className="cal__wd">{d}</div>
        ))}

        {days.map((cell, i) => {
          if (!cell.day || !cell.iso) return <div key={i} className="cal__cell cal__cell--empty" />
          const iso = cell.iso
          const isToday = iso === today
          const pos = poByDate.get(iso)
          const isPO = !!pos && pos.length > 0
          const label = isPO
            ? `${cell.day} — ${pos!.map((p) => p.name).join(', ')}`
            : id ? `${cell.day} — mulai PO baru` : `${cell.day} — start a new PO`
          return (
            <div
              key={i}
              role="button"
              tabIndex={0}
              title={label}
              aria-label={label}
              className={
                'cal__cell cal__cell--clickable' +
                (isToday ? ' is-today' : '') +
                (isPO && !isToday ? ' is-po' : '') +
                (pickDate === iso ? ' is-picking' : '')
              }
              onClick={() => handleDay(iso)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleDay(iso)
                }
              }}
            >
              <span className="cal__num">{cell.day}</span>
              {isPO && !isToday && <span className="cal__dot" aria-hidden />}
            </div>
          )
        })}
      </div>

      {/* Panel pemilih saat satu tanggal punya beberapa PO */}
      {pickDate && pickList.length > 1 && (
        <div className="cal__pick">
          <div className="cal__pick-title">{id ? 'PO pada' : 'POs on'} {pickDateLabel}</div>
          {pickList.map((e) => (
            <button key={e.id} type="button" className="cal__pick-row" onClick={() => navigate(`/po/${e.id}`)}>
              <span aria-hidden>{e.emoji}</span>
              <span className="cal__pick-name">{e.name}</span>
              {e.status === 'closed' && <span className="pill pill--neutral">{id ? 'ditutup' : 'closed'}</span>}
              <span className="cal__pick-go" aria-hidden>→</span>
            </button>
          ))}
          {onPickDate && (
            <button type="button" className="cal__pick-row cal__pick-row--new" onClick={() => onPickDate(pickDate)}>
              <span aria-hidden>＋</span>
              <span className="cal__pick-name">{id ? 'Buat PO baru tanggal ini' : 'New PO on this date'}</span>
            </button>
          )}
        </div>
      )}

      {onPickDate && <p className="cal__hint">＋ {pickHint}</p>}

      <div className="cal__legend">
        <span><span className="cal__lg cal__lg--today" /> {currentLang === 'id' ? 'Hari ini' : 'Current day'}</span>
        <span><span className="cal__lg cal__lg--po" /> Pre-Orders</span>
        {hasRecurring && <span>🔁 {currentLang === 'id' ? 'berulang' : 'recurring'}</span>}
      </div>
    </div>
  )
}
