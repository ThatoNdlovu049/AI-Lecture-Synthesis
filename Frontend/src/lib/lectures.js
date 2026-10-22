import axios from 'axios'
import {
  api_url,
  getCourses,
  getStudentCourses,
  saveCourse,
  saveStudentCourse,
} from './db.js'
import { fetchNoteCounts } from './notes.js'

// Lectures are saved on the server (backend/routes/lectures.py) and found by
// a key: the job id the frontend picks when it starts generating. Lectures
// made before that existed only live in this browser's localStorage, so they
// get a "local:" key and are merged into the same list.

function authHeaders(token) {
  return { headers: { Authorization: `Bearer ${token}` } }
}

// Uploads that are still being sent or are waiting on the server's reply,
// so the lecture page can tell "still uploading" apart from "doesn't exist".
const pendingUploads = {}

export function getPendingUpload(key) {
  return pendingUploads[key]
}

// Starts generating a lecture and returns its key straight away. The
// request keeps running in the background while the user watches progress.
export function startLectureGeneration({ token, user, courseName, video, materials, audio }) {
  const key = crypto.randomUUID()

  const formData = new FormData()
  formData.append('video', video)
  materials.forEach((file) => formData.append('materials', file))
  formData.append('audio_sample', audio)
  formData.append('course_name', courseName)
  formData.append('job_id', key)

  pendingUploads[key] = { courseName }

  axios
    .post(`${api_url}/ai/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` },
    })
    .then(({ data }) => {
      pendingUploads[key].done = true
      // Also keep the browser copy the rest of the original code reads
      const course = {
        name: courseName,
        videoFileName: video.name,
        materialCount: materials.length,
        audio_name: audio.name,
        lectureFileName: data.lectureFileName,
        slidesFileName: data.slidesFileName,
        videoUrl: data.videoUrl,
        slides: data.slides,
        subtitles: data.subtitles,
        createdAt: new Date().toISOString(),
      }
      if (user.role === 'lecturer') saveCourse({ ...course, lecturerId: user.id })
      else saveStudentCourse({ ...course, studentId: user.id })
    })
    .catch((error) => {
      const detail = error.response?.data?.detail
      pendingUploads[key].error =
        typeof detail === 'string' ? detail : 'The upload failed. Is the backend running?'
    })

  return key
}

export async function fetchLecture(token, key) {
  try {
    const response = await axios.get(`${api_url}/ai/lectures/${key}`, authHeaders(token))
    return { ok: true, lecture: response.data }
  } catch (error) {
    return { ok: false, status: error.response?.status }
  }
}

function localLecture(course, ownerId, ownerRole, isMine) {
  return {
    key: `local:${ownerRole}:${ownerId}:${encodeURIComponent(course.name)}`,
    course_name: course.name,
    status: 'ready',
    video_url: course.videoUrl,
    slides: course.slides || [],
    subtitles: course.subtitles || [],
    owner_id: ownerId,
    owner_name: isMine ? 'You' : 'A lecturer',
    owner_role: ownerRole,
    is_mine: isMine,
    created_at: course.createdAt,
    local: true,
  }
}

// Finds a localStorage lecture from its "local:" key
export function getLocalLecture(key, user) {
  const [, ownerRole, ownerId, name] = key.split(':')
  const courseName = decodeURIComponent(name)
  const course =
    ownerRole === 'lecturer'
      ? getCourses().find((c) => String(c.lecturerId) === ownerId && c.name === courseName)
      : getStudentCourses(Number(ownerId)).find((c) => c.name === courseName)
  if (!course) return null
  return localLecture(course, Number(ownerId), ownerRole, String(user.id) === ownerId)
}

// Every lecture this user can watch: their own (in any state) and finished
// lectures from lecturers. Newest first; note_count is this user's notes on it.
export async function listLectures(token, user) {
  let server = []
  const noteCounts = fetchNoteCounts(token)
  try {
    const response = await axios.get(`${api_url}/ai/lectures`, authHeaders(token))
    server = response.data.lectures
  } catch {
    // fall back to whatever this browser has
  }

  const onServer = (l) =>
    server.some((s) => s.course_name === l.course_name && s.owner_id === l.owner_id)

  const local = [
    ...getCourses().map((c) => localLecture(c, c.lecturerId, 'lecturer', c.lecturerId === user.id)),
    ...getStudentCourses(user.id).map((c) => localLecture(c, user.id, 'student', true)),
  ].filter((l) => l.video_url && !onServer(l))

  const counts = await noteCounts
  return [...server, ...local]
    .map((l) => ({ ...l, note_count: counts.get(l.key) || 0 }))
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
}
