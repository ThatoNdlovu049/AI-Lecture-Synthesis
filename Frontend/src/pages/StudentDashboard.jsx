import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { getStudentProgress } from '../lib/db.js'
import { listLectures, startLectureGeneration } from '../lib/lectures.js'
import UploadField from '../components/UploadField.jsx'
import LectureCard from '../components/LectureCard.jsx'

export default function StudentDashboard() {
  const { currentUser, token } = useAuth()
  const navigate = useNavigate()

  // 'home' | 'find' | 'create' - a lecture itself opens on its own page (/lectures/:key)
  const [screen, setScreen] = useState('home')

  const [progressList] = useState(() =>
    getStudentProgress(currentUser.id)
  )

  // Every lecture this student can watch: lecturers' and their own
  const [lectures, setLectures] = useState([])
  useEffect(() => {
    listLectures(token, currentUser).then(setLectures)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, currentUser?.id])

  const ownLectures = lectures.filter((l) => l.is_mine)

  // ---- Find an existing (lecturer-published) lecture ----
  const [query, setQuery] = useState('')
  const [findError, setFindError] = useState('')

  const suggestions =
    query.trim().length > 0
      ? lectures.filter((l) =>
          !l.is_mine && l.course_name.toLowerCase().includes(query.trim().toLowerCase())
        )
      : []

  // ---- Generate your own lecture ----
  const [newName, setNewName] = useState('')
  const [video, setVideo] = useState(null)
  const [materials, setMaterials] = useState([])
  const [audio, setAudio] = useState(null)
  const [language, setLanguage] = useState("english")
  const canGenerate = Boolean( newName.trim() && video && materials.length > 0 && audio )

  // Checks lecturers' lectures first, then this student's own - so
  // clicking a "courses in progress" entry works whichever kind it was.
  function openCourseByName(name) {
    const sameName = (l) => l.course_name.toLowerCase() === name.toLowerCase()
    const lecture = lectures.find((l) => !l.is_mine && sameName(l)) || lectures.find(sameName)
    if (lecture) {
      navigate(`/lectures/${lecture.key}`)
      return
    }
    setFindError(`No lecture found for "${name}".`)
  }

  function handleFindSubmit(e) {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    openCourseByName(trimmed)
  }

  // Goes straight to the lecture's page, which shows progress while it
  // generates and becomes the video player when it's done.
  function handleGenerateOwn(e) {
    e.preventDefault()
    if (!canGenerate) return
    const key = startLectureGeneration({
      token,
      user: currentUser,
      courseName: newName.trim(),
      video,
      materials,
      audio,
      language
    })
    navigate(`/lectures/${key}`)
  }

  function goHome() {
    setScreen('home')
    setQuery('')
    setFindError('')
  }

  // ---------------- Screen: home ----------------
  if (screen === 'home') {
    return (
      <div className="max-w-xl mx-auto px-6 py-10">
        <p className="font-display italic text-teal-deep">
          Welcome, {currentUser.first_name ?? currentUser.firstName}
        </p>
        <h1 className="font-display text-3xl text-navy mt-1 mb-10">
          Your dashboard
        </h1>

        {progressList.length > 0 && (
          <div className="mb-14">
            <h2 className="font-display text-lg text-navy mb-4">
              Courses in progress
            </h2>
            <div className="space-y-3">
              {progressList.map((p) => (
                <button
                  key={p.courseName}
                  onClick={() => openCourseByName(p.courseName)}
                  className="w-full text-left rounded-xl border-2 border-navy/15 bg-paper p-4
                    hover:border-teal transition-colors"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-display text-lg">
                      {p.courseName}
                    </span>
                    <span className="text-xs text-ink/50">
                      {p.progress}% complete
                    </span>
                  </div>
                  <p className="text-xs text-ink/40 mt-1">
                    Last accessed{' '}
                    {new Date(p.lastAccessedAt).toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>
            {findError && <p className="text-sm text-red-600 mt-3">{findError}</p>}
          </div>
        )}

        {ownLectures.length > 0 && (
          <div className="mb-14">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="font-display text-lg text-navy">Lectures you generated</h2>
              <Link to="/lectures" className="text-sm text-ink/50 hover:text-teal-deep transition-colors">
                See all lectures →
              </Link>
            </div>
            <div className="space-y-3">
              {ownLectures.slice(0, 3).map((l) => (
                <LectureCard key={l.key} lecture={l} />
              ))}
            </div>
          </div>
        )}

        <h2 className="font-display text-lg text-navy mb-4">
          What would you like to do?
        </h2>
        <div className="grid sm:grid-cols-2 gap-6">
          <button
            onClick={() => setScreen('find')}
            className="rounded-2xl border-2 border-navy/15 bg-paper p-8 text-center
              hover:border-teal hover:shadow-lg transition-all"
          >
            <span className="font-display text-xl text-navy block mb-2">
              Access existing lectures
            </span>
            <p className="text-sm text-ink/70">
              Find a lecture a lecturer has already created.
            </p>
          </button>

          <button
            onClick={() => setScreen('create')}
            className="rounded-2xl border-2 border-navy/15 bg-paper p-8 text-center
              hover:border-teal hover:shadow-lg transition-all"
          >
            <span className="font-display text-xl text-navy block mb-2">
              Generate your own lecture
            </span>
            <p className="text-sm text-ink/70">
              Upload your own material and let Avatar build it for you.
            </p>
          </button>
        </div>
      </div>
    )
  }

  // ---------------- Screen: find an existing lecture ----------------
  if (screen === 'find') {
    return (
      <div className="max-w-xl mx-auto px-6 py-10">
        <button
          onClick={goHome}
          className="text-sm text-ink/50 hover:text-teal-deep transition-colors mb-6"
        >
          ← Back to dashboard
        </button>

        <h1 className="font-display text-3xl text-navy mb-8">
          Find a lecture
        </h1>

        <form onSubmit={handleFindSubmit} className="space-y-3">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setFindError('')
            }}
            placeholder="Start typing a course name..."
            autoFocus
            className="w-full rounded-lg border-2 border-navy/15 bg-paper px-4 py-2.5
              outline-none focus:border-teal transition-colors"
          />

          {suggestions.length > 0 && (
            <div className="space-y-2">
              {suggestions.map((l) => (
                <button
                  key={l.key}
                  type="button"
                  onClick={() => navigate(`/lectures/${l.key}`)}
                  className="w-full flex items-baseline justify-between gap-3 text-left rounded-lg border-2 border-navy/15 bg-paper px-4 py-2.5
                    hover:border-teal transition-colors"
                >
                  <span>{l.course_name}</span>
                  <span className="text-xs text-ink/50">{l.owner_name}</span>
                </button>
              ))}
            </div>
          )}

          {query.trim() && suggestions.length === 0 && (
            <p className="text-sm text-red-600">No matching courses found.</p>
          )}
          {findError && <p className="text-sm text-red-600">{findError}</p>}

          <button
            type="submit"
            className="w-full rounded-lg bg-navy text-white font-medium py-3
              hover:bg-teal-deep transition-colors"
          >
            Find lecture
          </button>
        </form>
      </div>
    )
  }

  // ---------------- Screen: generate your own lecture ----------------
  return (
    <div className="max-w-xl mx-auto px-6 py-10">
      <button
        onClick={goHome}
        className="text-sm text-ink/50 hover:text-teal-deep transition-colors mb-6"
      >
        ← Back to dashboard
      </button>

      <h1 className="font-display text-3xl text-navy mb-8">
        Generate your own lecture
      </h1>

      <form onSubmit={handleGenerateOwn} className="space-y-6">
        <div>
          <label className="text-sm font-medium">Lecture name</label>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. My Database Notes"
            className="mt-1 w-full rounded-lg border-2 border-navy/15 bg-paper px-4 py-2.5
              outline-none focus:border-teal transition-colors"
          />
        </div>

        <div>
          <label htmlFor="language">Language: </label>
          <select
            id="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="english">English</option>
            <option value="chinese">Chinese</option>
            <option value="dutch">Dutch</option>
          </select>
          <p>Selected: {language}</p>
        </div>

        <UploadField
          label="Your video"
          hint="~30 SEC CLIP"
          accept="video/*"
          onFileSelect={setVideo}
        />

        <UploadField
          label="Your materials / notes"
          hint="MULTIPLE FILES"
          accept=".pdf,.docx"
          multiple
          onFilesSelect={setMaterials}
        />

        <UploadField
          label="Audio sample"
          hint="~5 seconds audio sample"
          accept="audio/*, .mp4, .m4a"
          onFileSelect={setAudio}
        />

        <button
          type="submit"
          disabled={!canGenerate}
          className="w-full rounded-lg bg-navy text-white font-medium py-3
            disabled:opacity-30 disabled:cursor-not-allowed hover:bg-teal-deep transition-colors"
        >
          Generate lecture & slides
        </button>
        <p className="text-xs text-ink/50 text-center">
          You'll be taken to the lecture's page, where you can follow each step. It usually
          takes 45–90 minutes on this computer.
        </p>
      </form>
    </div>
  )
}
