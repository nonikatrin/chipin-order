import { Navigate, useNavigate, useParams } from 'react-router-dom'
import AppBar from '../../components/AppBar'
import { usePOEvent } from '../../po/store'
import { useLangStore } from '../../utils/langStore'
import { MenuStep } from './MenuStep'

const STR = {
  id: {
    done: 'Selesai',
  },
  en: {
    done: 'Done',
  },
} as const

export default function POEventMenuPage() {
  const { poId } = useParams()
  const navigate = useNavigate()
  const { currentLang } = useLangStore()
  const t = STR[currentLang] ?? STR.id
  const event = usePOEvent(poId)

  if (!event) return <Navigate to="/" replace />

  return (
    <>
      <AppBar title={`${event.emoji} ${event.name}`} backTo={`/po/${event.id}`} />
      <main className="page page--wizard">
        <MenuStep
          eventId={event.id}
          onBack={() => navigate(`/po/${event.id}`)}
          onNext={() => navigate(`/po/${event.id}`)}
          nextLabel={t.done}
        />
      </main>
    </>
  )
}
