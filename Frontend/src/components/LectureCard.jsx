import { Link } from 'react-router-dom'

const STATUS = {
  ready: { label: 'Ready', action: 'Watch ▸', badge: 'bg-teal text-white' },
  generating: { label: 'Generating…', action: 'View progress', badge: 'bg-amber text-navy' },
  failed: { label: 'Failed', action: 'See what went wrong', badge: 'bg-red-600 text-white' },
  interrupted: { label: 'Interrupted', action: 'See what happened', badge: 'bg-red-600 text-white' },
}

// One lecture in a list; the whole card opens the lecture page.
export default function LectureCard({ lecture }) {
  const status = STATUS[lecture.status] || STATUS.ready

  return (
    <Link
      to={`/lectures/${lecture.key}`}
      className="flex items-center gap-4 rounded-xl border-2 border-navy/15 bg-paper p-4
        hover:border-teal hover:shadow-md transition-all"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-display text-lg truncate">{lecture.course_name}</span>
          <span className={`shrink-0 text-[11px] rounded-full px-2 py-0.5 ${status.badge}`}>
            {status.label}
          </span>
          {lecture.note_count > 0 && (
            <span className="shrink-0 text-[11px] rounded-full px-2 py-0.5 bg-cream text-navy">
              📝 {lecture.note_count} note{lecture.note_count === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <p className="text-xs text-ink/50 mt-1">
          {lecture.is_mine ? 'Your lecture' : lecture.owner_name}
          {lecture.created_at && ` · ${new Date(lecture.created_at).toLocaleDateString()}`}
        </p>
      </div>
      <span
        className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
          lecture.status === 'ready' ? 'bg-navy text-white' : 'border-2 border-navy/15 text-navy'
        }`}
      >
        {status.action}
      </span>
    </Link>
  )
}
