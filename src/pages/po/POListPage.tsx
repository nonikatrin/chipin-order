import PageLayout from '../../components/PageLayout'
import { useNavigate } from 'react-router-dom'
import { usePOStore } from '../../po/store'
import { useLangStore } from '../../utils/langStore'

const strings = {
  id: {
    title: 'PO Bersama',
    add: '+ PO Baru',
    emptyTitle: 'Belum ada PO',
    emptyText: 'Buka pre-order pertama untuk mulai mengumpulkan pesanan.',
    sub: (buyers: number, menus: number) => `🛒 ${buyers} pemesan · ${menus} menu`,
  },
  en: {
    title: 'Group PO',
    add: '+ New PO',
    emptyTitle: 'No POs yet',
    emptyText: 'Open your first pre-order to start collecting orders.',
    sub: (buyers: number, menus: number) => `🛒 ${buyers} buyers · ${menus} items`,
  },
}

export default function POListPage() {
  const navigate = useNavigate()
  const events = usePOStore((s) => s.events)
  const { currentLang } = useLangStore()
  const t = strings[currentLang] ?? strings.id

  return (
    <PageLayout title={t.title} addLabel={t.add} onAdd={() => navigate('/po/buat')}>
      {events.length === 0 ? (
        <div className="empty">
          <div className="empty__emoji">🛒</div>
          <h2 className="empty__title">{t.emptyTitle}</h2>
          <p className="empty__text">{t.emptyText}</p>
        </div>
      ) : (
        <div className="list">
          {events.map((event) => (
            <button
              key={event.id}
              type="button"
              className="row"
              onClick={() => navigate(`/po/${event.id}`)}
            >
              <div className="cat-badge">{event.emoji || '🍲'}</div>
              <div className="row__main">
                <div className="row__title">{event.name}</div>
                <div className="row__sub">{t.sub(event.buyers.length, event.menus.length)}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </PageLayout>
  )
}
