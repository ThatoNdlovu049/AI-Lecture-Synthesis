import axios from 'axios'
import { api_url } from './db.js'

// Private lecture notes: any number per user per lecture (backend/routes/lectures.py).
// fetch is used for writes so they can pass keepalive, which lets a save
// finish even while the page is closing.

function authHeaders(token) {
  return { headers: { Authorization: `Bearer ${token}` } }
}

async function send(method, path, token, body, keepalive = false) {
  const response = await fetch(`${api_url}${path}`, {
    method,
    keepalive,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) throw new Error('Could not save the note')
  return response.status === 204 ? null : response.json()
}

// [{ id, content, video_time, created_at, updated_at }]
export async function fetchNotes(token, lectureKey) {
  const response = await axios.get(`${api_url}/ai/notes/lecture`, {
    ...authHeaders(token),
    params: { key: lectureKey },
  })
  return response.data.notes
}

export function createNote(token, lectureKey, content, videoTime, { keepalive } = {}) {
  return send('POST', '/ai/notes/lecture', token, {
    lecture_key: lectureKey,
    content,
    video_time: videoTime,
  }, keepalive)
}

export function updateNote(token, id, content, { keepalive } = {}) {
  return send('PUT', `/ai/notes/${id}`, token, { content }, keepalive)
}

export function deleteNote(token, id) {
  return send('DELETE', `/ai/notes/${id}`, token)
}

// Map of lecture key -> number of notes this user has on it
export async function fetchNoteCounts(token) {
  try {
    const response = await axios.get(`${api_url}/ai/notes`, authHeaders(token))
    return new Map(response.data.notes.map((n) => [n.lecture_key, n.count]))
  } catch {
    return new Map()
  }
}
