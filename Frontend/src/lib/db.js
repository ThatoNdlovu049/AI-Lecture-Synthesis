/* @Thato this is a mock database that l created using localStorage to check that it actually works without having
a rel database or any backend work so bascially a demo. This is just plain text so you must make changes here
and create your API calls and backend work...*/
import axios from 'axios'

const USERS_KEY = 'pas_v1_users'
const COURSES_KEY = 'pas_v1_courses'
const PROGRESS_KEY = 'pas_v1_progress'
const STUDENT_COURSES_KEY = 'pas_v1_student_courses'

const api_url = 'http://localhost:8000'

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function getUsers() {
  return read(USERS_KEY, [])
}
const allUsers = async () => {
  try{
    axios.get(`{api_url}`)
  }catch(error){
    console.log('Could not load all users', error)
    throw error
  }
}

/*
export function createUser({ firstName, lastName,username, email, password, role }) {
  const users = getUsers()
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return { ok: false, error: 'An account with that email already exists.' }
  }
  const user = {
    firstName,
    lastName,
    username,
    email,
    password,
    role, 
  }
  write(USERS_KEY, [...users, user])
  return { ok: true, user }
}
  */

const registerUser = async (userData) => {
  try{
    
    await axios.post(`${api_url}/auth/register_user`, userData);
    return {ok: true, userData}

  }catch(error){

    console.log("Error registering user", error);
    return{ok: false, error: 'Error registering user'};

  }
}

const loginUser = async (credentials) => {
  
  try{

    const params = new URLSearchParams();
    for(const key in credentials){
      params.append(key, credentials[key]);
    }
    
    const response = await axios.post(`${api_url}/auth/login`, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
    });
    return response.data;

  }catch(error){
    
    console.log('error logging into account!', error);
    return {ok: false, error: 'error logging into account'};

  }
}

const fetchUser = async (token) => {
  try{

    const response = await axios.get(`${api_url}/user/logged-in`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    // The backend sends first_name / last_name; the pages read firstName / surname.
    // The password hash is left out so it is never kept in the browser.
    const { password, ...data } = response.data;
    const user = { ...data, firstName: data.first_name, surname: data.last_name };
    return {ok: true, "user": user};

  }catch(error){

    console.log('Error fetching current user', error);
    return{ok: false, error: 'Error fetching current user'};

  }
}
const sendData = async ( data, token ) => {
  try{
    const response = await axios.post(`${api_url}/ai/upload`, data, {
      headers:{
        'Content-Type': 'multipart/form-data',
        Authorization: `Bearer ${token}`
      }
    });
    return {ok: true, data: response.data}
  }catch (error){
    console.log('Error sending video and materials to fastapi', error)
    const detail = error.response?.data?.detail
    return {ok: false, error: typeof detail === 'string' ? detail : 'Error sending video and materials'}
  }
}

// ---------- Lecture generation jobs ----------
// POST /ai/upload only queues the lecture; a separate backend worker builds it.
// These check on the job until it is done or has failed.

const getJob = async ( jobId, token ) => {
  try{
    const response = await axios.get(`${api_url}/ai/jobs/${jobId}`, {
      headers:{
        Authorization: `Bearer ${token}`
      }
    });
    return {ok: true, data: response.data}
  }catch (error){
    const code = error.response?.status
    return {
      ok: false,
      // no reply or a server error: the backend may be restarting, so try again
      retry: !code || code >= 500,
      error: code === 404 ? 'This lecture job was not found.' : 'Could not check the lecture status.',
    }
  }
}

const jobWatchers = new Map() // jobId -> { listeners, promise }

const waitForJob = ( jobId, token, onUpdate ) => {
  let watcher = jobWatchers.get(jobId)
  if (!watcher) {
    watcher = { listeners: new Set() }
    watcher.promise = (async () => {
      while (true) {
        const result = await getJob(jobId, token)
        if (result.ok) {
          watcher.listeners.forEach((listener) => listener(result.data))
          if (result.data.status === 'done' || result.data.status === 'failed') {
            return result.data
          }
        } else if (!result.retry) {
          return { status: 'failed', error: result.error }
        }
        await new Promise((resolve) => setTimeout(resolve, 5000))
      }
    })().finally(() => jobWatchers.delete(jobId))
    jobWatchers.set(jobId, watcher)
  }
  if (onUpdate) watcher.listeners.add(onUpdate)
  return watcher.promise
}

const askChatbot = async ( question, course, token ) => {
  try{
    const response = await axios.post(`${api_url}/ai/ask`, { question, course }, {
      headers:{
        Authorization: `Bearer ${token}`
      }
    });
    return {ok: true, answer: response.data.answer}
  }catch (error){
    console.log('Error asking the chatbot', error)
    return {ok: false, error: 'Sorry, I could not reach the AI Lecturer. Please try again.'}
  }
}

export function findUser({ email, password, role }) {
  const users = getUsers()
  const user = users.find(
    (u) =>
      u.email.toLowerCase() === email.toLowerCase() &&
      u.password === password &&
      u.role === role
  )
  if (!user) {
    return { ok: false, error: 'Incorrect email, password, or wrong portal.' }
  }
  return { ok: true, user }
}

export function getCourses() {
  return read(COURSES_KEY, [])
}

export function getCourseByName(name) {
  return getCourses().find((c) => c.name.toLowerCase() === name.toLowerCase())
}

export function getCoursesByLecturer(lecturerId) {
  return getCourses().filter((c) => c.lecturerId === lecturerId)
}

export function saveCourse(course) {
  const courses = getCourses()
  const idx = courses.findIndex(
    (c) => c.name.toLowerCase() === course.name.toLowerCase()
  )
  if (idx >= 0) {
    courses[idx] = course
  } else {
    courses.push(course)
  }
  write(COURSES_KEY, courses)
  return course
}

function chatKey(studentId, courseName) {
  return `pas_v1_chat_${studentId}_${courseName.toLowerCase()}`
}

export function getChatHistory(studentId, courseName) {
  return read(chatKey(studentId, courseName), [])
}

export function saveChatHistory(studentId, courseName, messages) {
  write(chatKey(studentId, courseName), messages)
}

export function getStudentProgress(studentId) {
  return read(PROGRESS_KEY, []).filter((p) => p.studentId === studentId)
}

export function recordCourseAccess(studentId, courseName) {
  const all = read(PROGRESS_KEY, [])
  const idx = all.findIndex(
    (p) =>
      p.studentId === studentId &&
      p.courseName.toLowerCase() === courseName.toLowerCase()
  )
  const now = new Date().toISOString()
  if (idx >= 0) {
    all[idx] = {
      ...all[idx],
      progress: Math.min(100, all[idx].progress + 10),
      lastAccessedAt: now,
    }
  } else {
    all.push({ studentId, courseName, progress: 10, lastAccessedAt: now })
  }
  write(PROGRESS_KEY, all)
}

// ---------- Student's own generated lectures ----------
// Separate from the lecturer-published `courses` list above, so a
// student's own upload never shows up in "access existing lectures"
// search results for everyone else - it's personal to that student.

export function getStudentCourses(studentId) {
  return read(STUDENT_COURSES_KEY, []).filter(
    (c) => c.studentId === studentId
  )
}

export function getStudentCourseByName(studentId, name) {
  return getStudentCourses(studentId).find(
    (c) => c.name.toLowerCase() === name.toLowerCase()
  )
}

export function saveStudentCourse(course) {
  const all = read(STUDENT_COURSES_KEY, [])
  const idx = all.findIndex(
    (c) =>
      c.studentId === course.studentId &&
      c.name.toLowerCase() === course.name.toLowerCase()
  )
  if (idx >= 0) {
    all[idx] = course
  } else {
    all.push(course)
  }
  write(STUDENT_COURSES_KEY, all)
  return course
}

export{ registerUser, fetchUser, loginUser, sendData, getJob, waitForJob, askChatbot, api_url }