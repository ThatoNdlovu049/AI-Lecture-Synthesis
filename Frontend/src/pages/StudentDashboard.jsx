import { useEffect, useState } from 'react'
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
  waitForJob,
  askChatbot,
  api_url,
} from '../lib/db.js'
import UploadField from '../components/UploadField.jsx'

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
  const [thinking, setThinking] = useState(false)

  // Runs when a different lecture is opened (not when the same lecture's
  // video finishes generating), so the chat is not reset mid-conversation.
  const activeCourseName = activeCourse?.name
  useEffect(() => {
    if (!activeCourseName) return
    recordCourseAccess(currentUser.id, activeCourseName)
    setProgressList(getStudentProgress(currentUser.id))

    const saved = getChatHistory(currentUser.id, activeCourseName)
    setMessages(
      saved.length > 0
        ? saved
        : [{ role: 'bot', text: 'Ask me anything about this lecture.' }]
    )
  }, [activeCourseName, currentUser.id])

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

  // Open the lecture screen straight away with a loading state, so the
  // chatbot can be used while the backend builds the video.
  const pending = saveStudentCourse({
    name: trimmedName,
    studentId: currentUser.id,
    videoFileName: video.name,
    materialCount: materials.length,
    audio_name: audio.name,
    lectureFileName: trimmedName,
    slidesFileName: '',
    status: 'generating',
    createdAt: new Date().toISOString(),
  })

  setNewName('')
  setVideo(null)
  setMaterials([])
  setAudio(null)

  setCourseSource('own')
  setActiveCourse(pending)
  setScreen('course')

  try{
    // Uploads the files; the backend queues the lecture and answers straight away
    const response = await sendData(formData, token)

    if (!response.ok) {
      showIfOpen(saveStudentCourse({ ...pending, status: 'failed', error: response.error }))
      return
    }

    if (response.data.videoUrl) {
      showIfOpen(finishCourse(pending, response.data))
      return
    }

    const queued = saveStudentCourse({ ...pending, jobId: response.data.jobId, step: response.data.step })
    showIfOpen(queued)
    trackJob(queued)

  }catch(err){
    showIfOpen(saveStudentCourse({ ...pending, status: 'failed', error: 'Something went wrong. Please try again....' }))
  }finally{
    setGenerating(false)
  }


}

  // Swap in the updated course if the student is still viewing it
  function showIfOpen(course) {
    setActiveCourse((current) =>
      current && current.name === course.name ? course : current
    )
  }

  function finishCourse(course, job) {
    return saveStudentCourse({
      ...course,
      lectureFileName: job.lectureFileName,
      slidesFileName: job.slidesFileName,
      videoUrl: job.videoUrl,
      status: 'ready',
      step: undefined,
    })
  }

  // Follows a queued lecture until the backend worker has finished it
  function trackJob(course) {
    waitForJob(course.jobId, token, (job) => {
      if (job.status === 'queued' || job.status === 'running') {
        showIfOpen(saveStudentCourse({ ...course, step: job.step }))
      }
    }).then((job) => {
      if (job.status === 'done') {
        showIfOpen(finishCourse(course, job))
      } else {
        showIfOpen(saveStudentCourse({ ...course, status: 'failed', error: job.error }))
      }
    })
  }

  // Opening a lecture that is still being generated (for example after a page
  // reload) picks up its progress again
  const activeCourseStatus = activeCourse?.status
  useEffect(() => {
    if (courseSource === 'own' && activeCourseStatus === 'generating' && activeCourse?.jobId) {
      trackJob(activeCourse)
    }
  }, [activeCourseName, activeCourseStatus, courseSource])

  async function sendMessage() {
    if (!chatInput.trim() || !activeCourse || thinking) return

    const question = chatInput
    const next = [...messages, { role: 'user', text: question }]
    setChatInput('')
    setMessages([...next, { role: 'bot', text: 'Thinking…' }])
    saveChatHistory(currentUser.id, activeCourse.name, next)

    // Ask the backend chatbot (POST /ai/ask), which answers with the local Llama model
    setThinking(true)
    const result = await askChatbot(question, activeCourse.name, token)
    setThinking(false)

    const withReply = [
      ...next,
      { role: 'bot', text: result.ok ? result.answer : result.error },
    ]
    setMessages(withReply)
    saveChatHistory(currentUser.id, activeCourse.name, withReply)
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
            <video src={`${api_url}${activeCourse.videoUrl}`} controls className='w-full h-full' />
          ) : activeCourse.status === 'generating' && (activeCourse.jobId || generating) ? (
            <div className="flex flex-col items-center gap-4 text-center px-6">
              <div className="h-10 w-10 rounded-full border-4 border-white/20 border-t-white animate-spin" />
              <span className="text-white text-sm">Generating your lecture…</span>
              <span className="text-white/70 text-xs">
                {activeCourse.step || 'Uploading your files'}
              </span>
              <span className="text-white/50 text-xs max-w-sm">
                This can take several minutes. You can ask the chatbot questions while you wait.
              </span>
            </div>
          ) : activeCourse.status === 'generating' ? (
            <span className="text-white/50 text-sm text-center px-6">
              The upload was interrupted (the page was reloaded). Please generate this lecture again from the dashboard.
            </span>
          ) : activeCourse.status === 'failed' ? (
            <span className="text-white/70 text-sm text-center px-6">
              Could not generate the lecture: {activeCourse.error}. Please try again from the dashboard.
            </span>
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
          <div className="aspect-[4/3] max-w-md rounded-lg bg-paper border-2 border-navy/15 flex items-center justify-center">
            <span className="text-ink/30 text-sm">Slide view</span>
          </div>
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
