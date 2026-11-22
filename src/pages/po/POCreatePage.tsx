import { useNavigate, useSearchParams } from 'react-router-dom'
import { POWizard } from './POWizard'

/** Halaman buat-PO (rute /po/buat). Wizard-nya sendiri ada di POWizard,
 *  supaya bisa juga ditanam inline di halaman Pesanan.
 *  `?date=YYYY-MM-DD` (mis. dari kalender) → tanggal kirim ter-prefill. */
export default function POCreatePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const initialDate = params.get('date') ?? undefined
  return <POWizard onExit={() => navigate('/')} initialDate={initialDate} />
}
