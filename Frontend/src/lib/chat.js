import axios from 'axios'
import { api_url } from './db.js'

// Lecturers who have uploaded content, plus the logged-in user's own uploads.
// [{ owner_id, name, is_you, courses: ['Databases', ...] }]
export async function fetchChatSources(token) {
  const response = await axios.get(`${api_url}/chat/sources`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data.sources
}

// Asks the chatbot a question. The answer streams in as Ollama generates it:
// onText is called with the answer so far, and the full answer is returned.
// ownerId = whose lectures to answer from (null for general study help),
// history = earlier [{ role: 'user' | 'assistant', content }] messages.
// fetch is used instead of axios because axios can't stream in the browser.
export async function askChatbot({ token, ownerId, courseName, question, history, onText }) {
  const response = await fetch(`${api_url}/chat/ask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      owner_id: ownerId ?? null,
      course_name: courseName ?? null,
      question,
      history,
    }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(
      typeof body.detail === 'string' ? body.detail : 'The chatbot could not answer right now.'
    )
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let answer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    answer += decoder.decode(value, { stream: true })
    onText?.(answer)
  }
  return answer
}
