import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { getCoursesByLecturer, saveCourse } from '../lib/db.js'
import UploadField from '../components/UploadField.jsx'

export default function LecturerDashboard() {
  const { currentUser } = useAuth()
  const [courses, setCourses] = useState(() =>
    getCoursesByLecturer(currentUser.id)
  )

  const [courseName, setCourseName] = useState('')
  const [materials, setMaterials] = useState([])
  const [video, setVideo] = useState (null)
  const [images, setImages] = useState([])
  const [generating, setGenerating] = useState(false)

  const canGenerate = courseName.trim() && materials.length && video > 0 && !generating

  function handleGenerate(e) {
    e.preventDefault()
    const trimmedName = courseName.trim()
    if (!trimmedName) return

    setGenerating(true)

    /* For Thato!!NB, this was bascially like a temp stand in to check if it works
    so you'll have to replace with a real call which will be your API... get me? (e.g. POST
    generate-video with the uploaded materials/images).*/
    setTimeout(() => {
      const course = saveCourse({
        name: trimmedName,
        lecturerId: currentUser.id,
        lectureFileName: `${trimmedName} Lecture`,
        slidesFileName: `${trimmedName} Slides`,
        materialCount: materials.length,
        videoFileName: video.name,
        imageCount: images.length,
        createdAt: new Date().toISOString(),
      })

      setCourses((prev) => [
        ...prev.filter((c) => c.name !== course.name),
        course,
      ])

      setCourseName('')
      setMaterials([])
      setVideo(null)
      setImages([])
      setGenerating(false)
    }, 1200)
  }

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
          label="Images"
          hint="OPTIONAL"
          accept="image/*"
          multiple
          onFilesSelect={setImages}
        />

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
