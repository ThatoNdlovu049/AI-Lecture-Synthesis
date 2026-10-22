import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { api_url, recordCourseAccess } from '../lib/db.js'
import { fetchLecture, getLocalLecture, getPendingUpload } from '../lib/lectures.js'
import InteractiveSlideSystem from '../components/InteractiveSlideSystem.jsx'
import GenerationProgress from '../components/GenerationProgress.jsx'
import CourseChat from '../components/CourseChat.jsx'
import LectureNotes from '../components/LectureNotes.jsx'
import { fetchNotes } from '../lib/notes.js'

const POLL_MS = 3000

// One lecture: a progress guide while it's generating, then the video,
// slides and course chat. URL: /lectures/:key
export default function LecturePage() {
  const { key } = useParams()
  const { currentUser, token } = useAuth()

  const [lecture, setLecture] = useState(null)
  const [missing, setMissing] = useState(false)
  const [justFinished, setJustFinished] = useState(false)
  const wasGenerating = useRef(false)

  useEffect(() => {
    setLecture(null)
    setMissing(false)
    setJustFinished(false)
    wasGenerating.current = false

    if (key.startsWith('local:')) {
      const local = getLocalLecture(key, currentUser)
      if (local) setLecture(local)
      else setMissing(true)
      return
    }

    let stopped = false
    let timer

    async function poll() {
      const result = await fetchLecture(token, key)
      if (stopped) return

      if (result.ok) {
        const l = result.lecture
        setLecture(l)
        if (l.status === 'generating') {
          wasGenerating.current = true
          timer = setTimeout(poll, POLL_MS)
        } else if (l.status === 'ready' && wasGenerating.current) {
          setJustFinished(true)
        }
        return
      }

      // Not saved on the server yet: keep waiting while this browser is still uploading it
      const pending = getPendingUpload(key)
      if (result.status === 404 && pending && !pending.error) {
        wasGenerating.current = true
        setLecture({ course_name: pending.courseName, status: 'uploading', is_mine: true })
        timer = setTimeout(poll, POLL_MS)
      } else if (pending?.error) {
        setLecture({ course_name: pending.courseName, status: 'failed', error: pending.error, is_mine: true })
      } else {
        setMissing(true)
      }
    }

    poll()
    return () => {
      stopped = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only restart when the user changes, not on every profile refresh
  }, [key, token, currentUser?.id])

  // Students' "courses in progress" list on their dashboard
  useEffect(() => {
    if (lecture?.status === 'ready' && currentUser?.role === 'student') {
      recordCourseAccess(currentUser.id, lecture.course_name)
    }
  }, [lecture?.status, lecture?.course_name, currentUser])

  if (missing) {
    return (
      <Centered>
        <h1 className="font-display text-2xl text-navy mb-2">Lecture not found</h1>
        <p className="text-ink/60 mb-6">It may have been removed, or it isn't shared with you.</p>
        <BackLink />
      </Centered>
    )
  }

  if (!lecture) {
    return (
      <Centered>
        <p className="text-ink/50">Loading lecture…</p>
      </Centered>
    )
  }

  if (lecture.status === 'uploading' || lecture.status === 'generating') {
    return (
      <>
        <div className="max-w-2xl mx-auto px-6 pt-6">
          <BackLink />
        </div>
        <GenerationProgress
          courseName={lecture.course_name}
          progress={lecture.progress}
          uploading={lecture.status === 'uploading'}
        />
      </>
    )
  }

  if (lecture.status === 'failed' || lecture.status === 'interrupted') {
    return (
      <Centered>
        <p className="font-display italic text-teal-deep">{lecture.course_name}</p>
        <h1 className="font-display text-2xl text-navy mt-1 mb-3">
          {lecture.status === 'failed' ? 'This lecture could not be generated' : 'Generation was interrupted'}
        </h1>
        <p className="text-ink/70 mb-2">
          {lecture.status === 'failed'
            ? lecture.error || 'Something went wrong while generating.'
            : 'The backend server was restarted while this lecture was being made, so it stopped part-way.'}
        </p>
        <p className="text-ink/60 mb-6">
          {lecture.error?.includes('Face not detected')
            ? 'Use a lecturer video where the face is clearly visible in every frame, then try again.'
            : 'Please try generating it again from your dashboard.'}
        </p>
        <Link
          to={`/${currentUser.role}`}
          className="inline-block rounded-lg bg-navy text-white font-medium px-5 py-2.5 hover:bg-teal-deep transition-colors"
        >
          Back to dashboard
        </Link>
      </Centered>
    )
  }

  return <LecturePlayer lecture={lecture} justFinished={justFinished} />
}

// An open/closed panel that's remembered between lectures in this browser
function useRememberedToggle(storageKey, openByDefault) {
  const [open, setOpen] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      return saved === null ? openByDefault : saved === 'true'
    } catch {
      return openByDefault
    }
  })

  function toggle() {
    setOpen((was) => {
      try {
        localStorage.setItem(storageKey, String(!was))
      } catch {
        // only a convenience
      }
      return !was
    })
  }

  return [open, toggle]
}

function LecturePlayer({ lecture, justFinished }) {
  const { currentUser, token } = useAuth()
  const videoRef = useRef(null)

  const [chatOpen, toggleChat] = useRememberedToggle('pas_v1_lecture_chat_open', true)
  const [notesOpen, toggleNotes] = useRememberedToggle('pas_v1_lecture_notes_open', false)

  // Shown on the "My notes" button while the notes are closed
  const [noteCount, setNoteCount] = useState(0)
  useEffect(() => {
    fetchNotes(token, lecture.key)
      .then((notes) => setNoteCount(notes.filter((n) => n.content.trim()).length))
      .catch(() => {})
  }, [token, lecture.key])

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <BackLink />

      {justFinished && (
        <div className="mt-4 rounded-xl bg-teal text-white px-5 py-3 text-sm font-medium">
          Your lecture is ready. Press play to watch it.
        </div>
      )}

      <div className={`mt-4 grid gap-6 ${chatOpen ? 'lg:grid-cols-[1fr_340px]' : ''}`}>
        <div className="space-y-6 min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-display italic text-teal-deep">
                {lecture.is_mine ? 'Your lecture' : lecture.owner_name}
              </p>
              <h1 className="font-display text-2xl text-navy">{lecture.course_name}</h1>
            </div>
            <button
              onClick={toggleChat}
              aria-expanded={chatOpen}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                chatOpen
                  ? 'border-2 border-navy/15 text-navy hover:border-teal'
                  : 'bg-navy text-white hover:bg-teal-deep'
              }`}
            >
              {chatOpen ? 'Hide chat ✕' : '💬 Ask about this lecture'}
            </button>
          </div>

          <div className="aspect-video rounded-xl bg-navy border-2 border-navy/15 overflow-hidden">
            <video
              ref={videoRef}
              src={`${api_url}${lecture.video_url}`}
              controls
              autoPlay={justFinished}
              className="w-full h-full"
            />
          </div>

          <div className={`grid gap-6 ${notesOpen ? 'md:grid-cols-2' : ''}`}>
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h2 className="font-display text-sm">Slides</h2>
                {!notesOpen && (
                  <button
                    onClick={toggleNotes}
                    aria-expanded={false}
                    className="rounded-lg border-2 border-navy/15 px-3 py-1.5 text-sm font-medium text-navy
                      hover:border-teal transition-colors"
                  >
                    📝 My notes{noteCount > 0 ? ` (${noteCount})` : ''}
                  </button>
                )}
              </div>
              <InteractiveSlideSystem
                videoRef={videoRef}
                slides={lecture.slides}
                subtitles={lecture.subtitles}
              />
            </div>
            {notesOpen && (
              <LectureNotes
                token={token}
                lectureKey={lecture.key}
                videoRef={videoRef}
                onClose={toggleNotes}
                onCountChange={setNoteCount}
              />
            )}
          </div>
        </div>

        {chatOpen && (
          <CourseChat
            token={token}
            userId={currentUser.id}
            ownerId={lecture.owner_id}
            courseName={lecture.course_name}
            onClose={toggleChat}
          />
        )}
      </div>
    </div>
  )
}

function Centered({ children }) {
  return <div className="max-w-xl mx-auto px-6 py-16 text-center">{children}</div>
}

function BackLink() {
  return (
    <Link to="/lectures" className="text-sm text-ink/50 hover:text-teal-deep transition-colors">
      ← My lectures
    </Link>
  )
}
