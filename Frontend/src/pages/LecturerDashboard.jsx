import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { getCoursesByLecturer, saveCourse, sendData, waitForJob } from '../lib/db.js'
import UploadField from '../components/UploadField.jsx'

export default function LecturerDashboard() {
  const { currentUser, token } = useAuth()
  const [courses, setCourses] = useState(() =>
    getCoursesByLecturer(currentUser.id)
  )

  const [courseName, setCourseName] = useState('')
  const [materials, setMaterials] = useState([])
  const [video, setVideo] = useState (null)
  const [images, setImages] = useState([])
  const [audio, setAudio] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const canGenerate = Boolean(courseName.trim() && materials.length > 0 && video && audio && !generating)

  async function handleGenerate(e) {
    e.preventDefault()
    const trimmedName = courseName.trim()
    if (!trimmedName || !video || !audio || !materials.length) return

    setGenerating(true)
    setError('')

    // Same backend call as the student page: POST /ai/upload builds the lecture video.
    // Images are not used by the backend yet, so they are not sent.
    const formData = new FormData()
    formData.append('video', video)
    materials.forEach((file) => formData.append('materials', file))
    formData.append('audio_sample', audio)

    try {
      // Uploads the files; the backend queues the lecture and answers straight away
      const response = await sendData(formData, token)

      if (!response.ok) {
        setError(response.error)
        return
      }

      const course = saveCourse({
        name: trimmedName,
        lecturerId: currentUser.id,
        lectureFileName: `${trimmedName} Lecture`,
        slidesFileName: `${trimmedName} Slides`,
        materialCount: materials.length,
        videoFileName: video.name,
        imageCount: images.length,
        videoUrl: response.data.videoUrl || undefined,
        status: response.data.videoUrl ? 'ready' : 'generating',
        jobId: response.data.jobId,
        step: response.data.step,
        createdAt: new Date().toISOString(),
      })

      showCourse(course)
      if (course.status === 'generating') trackJob(course)

      setCourseName('')
      setMaterials([])
      setVideo(null)
      setImages([])
      setAudio(null)
    } catch {
      setError('Something went wrong. Please try again....')
    } finally {
      setGenerating(false)
    }
  }

  function showCourse(course) {
    setCourses((prev) => [
      ...prev.filter((c) => c.name !== course.name),
      course,
    ])
  }

  // Follows a queued lecture until the backend worker has finished it
  function trackJob(course) {
    waitForJob(course.jobId, token, (job) => {
      if (job.status === 'queued' || job.status === 'running') {
        showCourse(saveCourse({ ...course, step: job.step }))
      }
    }).then((job) => {
      if (job.status === 'done') {
        showCourse(saveCourse({ ...course, videoUrl: job.videoUrl, status: 'ready', step: undefined }))
      } else {
        showCourse(saveCourse({ ...course, status: 'failed', error: job.error }))
      }
    })
  }

  // Picks up lectures that were still generating when the page was last open
  useEffect(() => {
    courses
      .filter((c) => c.status === 'generating' && c.jobId)
      .forEach(trackJob)
  }, [])

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <p className="font-display italic text-teal-deep">
        Welcome back, {currentUser.firstName}
      </p>
      <h1 className="font-display text-3xl text-navy mt-1 mb-2">
        Lecturer dashboard
      </h1>
      <p className="text-ink/60 mb-10">
        {courses.length} course{courses.length === 1 ? '' : 's'} uploaded
      </p>

      {courses.length > 0 && (
        <div className="mb-14">
          <h2 className="font-display text-lg text-navy mb-4">
            Your courses
          </h2>
          <div className="space-y-3">
            {courses.map((course) => (
              <div
                key={course.name}
                className="rounded-xl border-2 border-navy/15 bg-paper p-4
                  hover:border-teal transition-colors"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-lg">{course.name}</span>
                  <span className="text-xs text-ink/40">
                    {new Date(course.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-ink/60 mt-1">
                  {course.lectureFileName} · {course.slidesFileName}
                </p>
                {course.videoFileName && (
                  <p className="text-xs text-ink/40 mt-0.5">
                    Source video: {course.videoFileName}
                  </p>
                )}
                {course.status === 'generating' && (
                  <p className="text-xs text-teal-deep mt-1">
                    Generating… {course.step}
                  </p>
                )}
                {course.status === 'failed' && (
                  <p className="text-xs text-red-600 mt-1">
                    Failed: {course.error}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="font-display text-lg text-navy mb-4">
        Create a new lecture
      </h2>
      <form onSubmit={handleGenerate} className="space-y-6">
        <div>
          <label className="text-sm font-medium">Course name</label>
          <input
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
            placeholder="e.g. Database"
            className="mt-1 w-full sm:w-64 rounded-lg border-2 border-navy/15 bg-paper px-4 py-2.5
              outline-none focus:border-teal transition-colors"
          />
        </div>

        <UploadField
          label="Course materials / notes"
          hint="MULTIPLE FILES"
          accept=".pdf,.doc,.docx,.txt"
          multiple
          onFilesSelect={setMaterials}
        />

        <UploadField
          label="Lecturer video"
          hint="30 SECOND CLIP"
          accept="video/*"
          onFileSelect={setVideo}
        />

        <UploadField
          label="Audio sample"
          hint="~5 seconds audio sample"
          accept="audio/*, .mp4, .m4a"
          onFileSelect={setAudio}
        />

        <UploadField
          label="Images"
          hint="OPTIONAL"
          accept="image/*"
          multiple
          onFilesSelect={setImages}
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
