/**
 * Modal sukses pembayaran — adaptasi comp POS user (2026-07-04) ke Chip!n Order:
 * token oranye/krem + bilingual via props; TANPA fitur POS (member points, kartu,
 * print bill) yang butuh backend/perangkat. Kembalian dihitung oleh pemanggil.
 */
interface Row {
  label: string
  value: string
}

interface Props {
  title: string
  subtitle?: string
  detailsLabel: string
  rows: Row[]
  changeLabel: string
  changeValue: string
  doneLabel: string
  onDone: () => void
}

export default function PaymentSuccessModal({
  title,
  subtitle,
  detailsLabel,
  rows,
  changeLabel,
  changeValue,
  doneLabel,
  onDone,
}: Props) {
  return (
    <div className="confirm-backdrop" onClick={onDone}>
      <div className="confirm" role="alertdialog" onClick={(e) => e.stopPropagation()}>
        <div className="paydone__circle" aria-hidden>
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="confirm__title" style={{ marginTop: 12 }}>
          {title}
        </div>
        {subtitle && <p className="confirm__text">{subtitle}</p>}

        <div className="paydone__box">
          <div className="paydone__caption">{detailsLabel}</div>
          {rows.map((r, i) => (
            <div className="paydone__row" key={i}>
              <span>{r.label}</span>
              <b>{r.value}</b>
            </div>
          ))}
          <div className="paydone__row paydone__row--change">
            <span>{changeLabel}</span>
            <b>{changeValue}</b>
          </div>
        </div>

        <div className="confirm__actions">
          <button type="button" className="btn btn--primary" onClick={onDone}>
            {doneLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
