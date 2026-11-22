import { useEffect } from 'react'
import { formatNumber, currencyDecimals, currencySymbol } from '../utils/format'

interface Props {
  value: number
  onChange: (next: number) => void
  /** Kode mata uang ISO. Desimal mengikuti standar mata uang (IDR=0, USD=2, KWD=3). */
  currency?: string
  /** Enter (keyboard fisik) — biasanya = tombol simpan sheet. */
  onEnter?: () => void
  /** Escape (keyboard fisik) — biasanya = tutup sheet. */
  onEscape?: () => void
}

const MAX_VALUE = 1_000_000_000_000 // batas atas nilai utuh (1 triliun)

export default function MoneyKeypad({ value, onChange, currency = 'IDR', onEnter, onEscape }: Props) {
  const decimals = currencyDecimals(currency)
  const factor = Math.pow(10, decimals)
  const symbol = currencySymbol(currency)

  // Semua operasi dilakukan pada "satuan terkecil" (minor units) agar bebas galat desimal.
  function press(digit: string) {
    const minor = Math.round(value * factor)
    const nextMinor =
      digit === '000' ? minor * 1000 : digit === '00' ? minor * 100 : minor * 10 + Number(digit)
    const next = nextMinor / factor
    onChange(next > MAX_VALUE ? value : next)
  }

  function backspace() {
    const minor = Math.floor(Math.round(value * factor) / 10)
    onChange(minor / factor)
  }

  function addQuick(q: number) {
    onChange(Math.min(value + q, MAX_VALUE))
  }

  const quicks = decimals === 0 ? [20000, 50000, 100000] : [1, 5, 10]
  const display = decimals === 0 ? formatNumber(value) : value.toFixed(decimals)
  const zeroKey = decimals === 0 ? '000' : '00'

  // Keyboard fisik: angka mengetik seperti tombol keypad, Backspace menghapus,
  // Delete/C mengosongkan, Enter/Escape diteruskan ke sheet pemanggil.
  // Tidak menyabot pengetikan di input/textarea/select lain di halaman yang sama.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tgt = e.target as HTMLElement | null
      if (
        tgt &&
        (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.tagName === 'SELECT' || tgt.isContentEditable)
      )
        return
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault()
        press(e.key)
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        backspace()
      } else if (e.key === 'Delete' || e.key.toLowerCase() === 'c') {
        e.preventDefault()
        onChange(0)
      } else if (e.key === 'Enter' && onEnter) {
        e.preventDefault()
        onEnter()
      } else if (e.key === 'Escape' && onEscape) {
        e.preventDefault()
        onEscape()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div>
      <div className="amount-display">
        <div className="amount-display__rp">{symbol}</div>
        <div
          className={'amount-display__value' + (value === 0 ? ' is-empty' : '')}
        >
          {display}
        </div>
      </div>

      <div className="quick-amounts">
        {quicks.map((q) => (
          <button key={q} onClick={() => addQuick(q)}>
            +{decimals === 0 ? formatNumber(q) : symbol + q}
          </button>
        ))}
      </div>

      <div className="keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} onClick={() => press(d)}>
            {d}
          </button>
        ))}
        <button className="key--action" onClick={() => press(zeroKey)}>
          {zeroKey}
        </button>
        <button onClick={() => press('0')}>0</button>
        <button
          className="key--action"
          onClick={backspace}
          aria-label="Hapus satu angka"
        >
          ⌫
        </button>
      </div>
    </div>
  )
}
