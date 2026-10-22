import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { listLectures } from '../lib/lectures.js'
import LectureCard from '../components/LectureCard.jsx'

// Every lecture the user can watch: their own, then lecturers' lectures.
export default function MyLectures() {
  const { currentUser, token } = useAuth()
  const [lectures, setLectures] = useState(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    listLectures(token, currentUser).then(setLectures)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, currentUser?.id])

  if (!lectures) {
    return <p className="max-w-3xl mx-auto px-6 py-10 text-ink/50">Loading lectures…</p>
  }

  const matches = (l) => l.course_name.toLowerCase().includes(query.trim().toLowerCase())
  const mine = lectures.filter((l) => l.is_mine && matches(l))
  const others = lectures.filter((l) => !l.is_mine && matches(l))

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl text-navy">My lectures</h1>
          <p className="text-ink/60 mt-1">Click a lecture to watch it, with slides and the AI tutor.</p>
        </div>
        <Link
          to={`/${currentUser.role}`}
          className="rounded-lg bg-navy text-white text-sm font-medium px-4 py-2.5 hover:bg-teal-deep transition-colors"
        >
          + Create a lecture
        </Link>
      </div>

      {lectures.length > 3 && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search lectures..."
          className="w-full mb-8 rounded-lg border-2 border-navy/15 bg-paper px-4 py-2.5
            outline-none focus:border-teal transition-colors"
        />
      )}

      <section className="mb-12">
        <h2 className="font-display text-lg text-navy mb-4">Your lectures</h2>
        {mine.length > 0 ? (
          <div className="space-y-3">
            {mine.map((l) => <LectureCard key={l.key} lecture={l} />)}
          </div>
        ) : (
          <p className="text-sm text-ink/50">
            {query ? 'No matches.' : "You haven't created any lectures yet."}
          </p>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg text-navy mb-4">From lecturers</h2>
        {others.length > 0 ? (
          <div className="space-y-3">
            {others.map((l) => <LectureCard key={l.key} lecture={l} />)}
          </div>
        ) : (
          <p className="text-sm text-ink/50">
            {query ? 'No matches.' : 'No lecturer has published a lecture yet.'}
          </p>
        )}
      </section>
    </div>
  )
}
