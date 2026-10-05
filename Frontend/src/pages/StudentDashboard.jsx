import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import {
  getChatHistory,
  getCourseByName,
  getCourses,
  getStudentCourseByName,
  getStudentProgress,
  recordCourseAccess,
  saveChatHistory,
  saveStudentCourse,
  sendData,
  api_url,
} from '../lib/db.js'
import UploadField from '../components/UploadField.jsx'
import InteractiveSlideSystem from '../components/InteractiveSlideSystem.jsx'

export default function StudentDashboard() {
  const { currentUser } = useAuth()
  const { token } = useAuth()

  // 'home' | 'find' | 'create' | 'course'
  const [screen, setScreen] = useState('home')

  const [progressList, setProgressList] = useState(() =>
    getStudentProgress(currentUser.id)
  )

  // ---- Find an existing (lecturer-published) lecture ----
  const [query, setQuery] = useState('')
  const [findError, setFindError] = useState('')

  const suggestions =
    query.trim().length > 0
      ? getCourses().filter((c) =>
          c.name.toLowerCase().includes(query.trim().toLowerCase())
        )
      : []

  // ---- Generate your own lecture ----
  const [newName, setNewName] = useState('')
  const [video, setVideo] = useState(null)
  const [materials, setMaterials] = useState([])
  const [audio, setAudio] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const canGenerate = Boolean( newName.trim() && video && materials.length > 0 && audio && !generating )

  // ---- Whichever course is currently being viewed ----
  const [activeCourse, setActiveCourse] = useState(null)
  const [courseSource, setCourseSource] = useState('lecturer') // 'lecturer' | 'own'
  const [messages, setMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const videoRef = useRef(null) // shared with InteractiveSlideSystem below

  useEffect(() => {
    if (!activeCourse) return
    recordCourseAccess(currentUser.id, activeCourse.name)
    setProgressList(getStudentProgress(currentUser.id))

    const saved = getChatHistory(currentUser.id, activeCourse.name)
    setMessages(
      saved.length > 0
        ? saved
        : [{ role: 'bot', text: 'Ask me anything about this lecture.' }]
    )
  }, [activeCourse, currentUser.id])

  // Checks lecturer-published courses first, then this student's own
  // generated ones - so clicking a "courses in progress" entry works
  // no matter which kind it originally was.
  function openCourseByName(name) {
    const lecturerCourse = getCourseByName(name)
    if (lecturerCourse) {
      setFindError('')
      setCourseSource('lecturer')
      setActiveCourse(lecturerCourse)
      setScreen('course')
      return
    }
    const ownCourse = getStudentCourseByName(currentUser.id, name)
    if (ownCourse) {
      setFindError('')
      setCourseSource('own')
      setActiveCourse(ownCourse)
      setScreen('course')
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

  async function handleGenerateOwn(e) {
  e.preventDefault()
  const trimmedName = newName.trim()
  if (!trimmedName) return
  if (!video) return
  if (!materials.length) return
  if (!audio) return

  setGenerating(true)
  setError('')

  const formData = new FormData()
  formData.append('video', video)
  materials.forEach((file) => formData.append('materials', file))
  formData.append('audio_sample', audio)
  
  try{
    const response = await sendData(formData, token)

    if (!response.ok) {
      setError(response.error)
      return
      
    }
    const course = saveStudentCourse({
    name: trimmedName,
    studentId: currentUser.id,
    videoFileName: video.name,
    materialCount: materials.length,
    audio_name: audio.name,
    lectureFileName: response.data.lectureFileName,
    slidesFileName: response.data.slidesFileName,
    videoUrl: response.data.videoUrl,
    slides: response.data.slides,
    subtitles: response.data.subtitles,
    createdAt: new Date().toISOString(),
  })

    setNewName('')
    setVideo(null)
    setMaterials([])
    setAudio(null)

    setCourseSource('own')
    setActiveCourse(course)
    setScreen('course')

  }catch(err){
    setError('Something went wrong. Please try again....')
  }finally{
    setGenerating(false)
  }
    

}

  function sendMessage() {
    if (!chatInput.trim() || !activeCourse) return

    const next = [...messages, { role: 'user', text: chatInput }]
    setChatInput('')
    setMessages(next)
    saveChatHistory(currentUser.id, activeCourse.name, next)

    // thato API work here too - can make changes to this section
    setTimeout(() => {
      const withReply = [
        ...next,
        {
          role: 'bot',
          text: `(Once the chatbot backend is connected, this is where the answer about ${activeCourse.name} will appear.)`,
        },
      ]
      setMessages(withReply)
      saveChatHistory(currentUser.id, activeCourse.name, withReply)
    }, 500)
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
          Welcome, {currentUser.firstName}
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
              {suggestions.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => openCourseByName(c.name)}
                  className="w-full text-left rounded-lg border-2 border-navy/15 bg-paper px-4 py-2.5
                    hover:border-teal transition-colors"
                >
                  {c.name}
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
  if (screen === 'create') {
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

          <UploadField
            label="Your video"
            hint="~30 SEC CLIP"
            accept="video/*"
            onFileSelect={setVideo}
          />

          <UploadField
            label="Your materials / notes"
            hint="MULTIPLE FILES"
            accept=".pdf,.docx,.txt"
            multiple
            onFilesSelect={setMaterials}
          />

          <UploadField
            label="Audio sample"
            hint="~5 seconds audio sample"
            accept="audio/*, .mp4, .m4a"
            onFileSelect={setAudio}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={!canGenerate}
            className="w-full rounded-lg bg-navy text-white font-medium py-3
              disabled:opacity-30 disabled:cursor-not-allowed hover:bg-teal-deep transition-colors"
          >
            {generating ? 'Generating lecture…' : 'Generate lecture & slides'}
          </button>
        </form>
      </div>
    )
  }

  // ---------------- Screen: course view (lecture stays left, chatbot stays right) ----------------
  return (
    <div className="max-w-6xl mx-auto px-6 py-10 grid lg:grid-cols-[1fr_340px] gap-6">
      <div className="space-y-6">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="font-display italic text-teal-deep">
              {activeCourse.name}
              {courseSource === 'own' && (
                <span className="ml-2 text-xs rounded-full bg-teal text-white px-2.5 py-0.5 align-middle not-italic">
                  Your lecture
                </span>
              )}
            </p>
            <h1 className="font-display text-2xl text-navy">
              {activeCourse.lectureFileName}
            </h1>
          </div>
          <button
            onClick={goHome}
            className="text-sm text-ink/50 hover:text-teal-deep transition-colors"
          >
            ← Back to dashboard
          </button>
        </div>

        <div className="aspect-video rounded-xl bg-navy flex items-center justify-center border-2 border-navy/15 overflow-hidden">
          {activeCourse.videoUrl ? (
            <video ref={videoRef} src={`${api_url}${activeCourse.videoUrl}`} controls className='w-full h-full' />
          ) : (
            <span className="text-white/50 text-sm">
              {activeCourse.lectureFileName} — video player
            </span>
          )} 
        </div>

        <div>
          <h2 className="font-display text-sm mb-2">
            {activeCourse.slidesFileName}
          </h2>
          <InteractiveSlideSystem
            videoRef={videoRef}
            slides={activeCourse.slides}
            subtitles={activeCourse.subtitles}
          />
        </div>
      </div>

      <aside className="rounded-xl border-2 border-navy/15 bg-paper flex flex-col h-[600px]">
        <div className="px-4 py-3 border-b border-navy/15">
          <h2 className="font-display text-sm">
            Ask me anything about this lecture
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`text-sm max-w-[85%] rounded-lg px-3 py-2 ${
                m.role === 'bot'
                  ? 'bg-cream text-ink'
                  : 'bg-navy text-white ml-auto'
              }`}
            >
              {m.text}
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-navy/15 flex gap-2">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Ask a question..."
            className="flex-1 rounded-md border-2 border-navy/15 px-3 py-2 text-sm outline-none
              focus:border-teal transition-colors"
          />
          <button
            onClick={sendMessage}
            className="rounded-md bg-navy text-white text-sm px-3
              hover:bg-teal-deep transition-colors"
          >
            Send
          </button>
        </div>
      </aside>
    </div>
  )
}
