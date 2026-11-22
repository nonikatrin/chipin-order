import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { usePOEvent } from '../../po/store'
import { POWizard } from './POWizard'

export default function POEditPage() {
  const { poId } = useParams()
  const navigate = useNavigate()
  const event = usePOEvent(poId)

  if (!poId || !event) return <Navigate to="/" replace />

  return <POWizard eventId={poId} onExit={() => navigate(`/po/${poId}`)} />
}
