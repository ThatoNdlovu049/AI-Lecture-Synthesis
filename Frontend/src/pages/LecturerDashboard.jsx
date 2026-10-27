import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { listLectures, startLectureGeneration } from '../lib/lectures.js'
import UploadField from '../components/UploadField.jsx'
import LectureCard from '../components/LectureCard.jsx'

export default function LecturerDashboard() {
  const { currentUser, token } = useAuth()
  const navigate = useNavigate()
  const [courses, setCourses] = useState([])

  useEffect(() => {
    listLectures(token, currentUser).then((all) => setCourses(all.filter((l) => l.is_mine)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, currentUser?.id])

  const [courseName, setCourseName] = useState('')
  const [materials, setMaterials] = useState([])
  const [video, setVideo] = useState (null)
  const [audio, setAudio] = useState(null)
  const [language, setLanguage] = useState("english")

  const canGenerate = Boolean( courseName.trim() && materials.length > 0 && video && audio )

  // Goes straight to the lecture's page, which shows progress while it
  // generates and becomes the video player when it's done.
  function handleGenerate(e) {
    e.preventDefault()
    if (!canGenerate) return
    const key = startLectureGeneration({
      token,
      user: currentUser,
      courseName: courseName.trim(),
      video,
      materials,
      audio,
      language
    })
    navigate(`/lectures/${key}`)
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <p className="font-display italic text-teal-deep">
        Welcome back, {currentUser.first_name ?? currentUser.firstName}
      </p>
      <h1 className="font-display text-3xl text-navy mt-1 mb-2">
        Lecturer dashboard
      </h1>
      <p className="text-ink/60 mb-10">
        {courses.length} lecture{courses.length === 1 ? '' : 's'} created
      </p>

      {courses.length > 0 && (
        <div className="mb-14">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-display text-lg text-navy">Your lectures</h2>
            <Link to="/lectures" className="text-sm text-ink/50 hover:text-teal-deep transition-colors">
              See all lectures →
            </Link>
          </div>
          <div className="space-y-3">
            {courses.slice(0, 5).map((course) => (
              <LectureCard key={course.key} lecture={course} />
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
          label="Course materials / notes"
          hint="MULTIPLE FILES"
          accept=".pdf,.docx"
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
          accept="audio/*,.mp4,.m4a"
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
