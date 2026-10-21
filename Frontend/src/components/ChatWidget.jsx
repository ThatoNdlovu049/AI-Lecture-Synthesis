import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { askChatbot, fetchChatSources } from '../lib/chat.js'

const GENERAL = 'general'

function historyKey(userId, source) {
  return `pas_v1_chatbot_${userId}_${source}`
}

function loadHistory(userId, source) {
  try {
    return JSON.parse(localStorage.getItem(historyKey(userId, source))) || []
  } catch {
    return []
  }
}

function saveHistory(userId, source, messages) {
  try {
    localStorage.setItem(historyKey(userId, source), JSON.stringify(messages.slice(-40)))
  } catch {
    // history is a convenience - chat still works without it
  }
}

// Floating AI study assistant, available on every page once logged in.
// The user picks a lecturer and it answers from that lecturer's uploaded
// materials and generated lecture scripts (see backend/routes/chat.py).
export default function ChatWidget() {
  const { currentUser, token } = useAuth()
  const userId = currentUser?.id

  const [open, setOpen] = useState(false)
  const [sources, setSources] = useState([])
  const [source, setSource] = useState(GENERAL)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const listRef = useRef(null)

  // Refresh the lecturer list each time the panel opens, so a lecture
  // uploaded a moment ago shows up without reloading the page.
  useEffect(() => {
    if (!open || !token) return
    fetchChatSources(token)
      .then((list) => {
        setSources(list)
        setSource((current) => {
          if (current !== GENERAL && list.some((s) => String(s.owner_id) === current)) {
            return current
          }
          const preferred = list.find((s) => s.is_you) || list[0]
          return preferred ? String(preferred.owner_id) : GENERAL
        })
      })
      .catch(() => setError('Could not load lecturers. Is the backend running?'))
  }, [open, token])

  useEffect(() => {
    if (userId) setMessages(loadHistory(userId, source))
  }, [userId, source])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages, open])

  if (!userId || !token) return null

  const selected = sources.find((s) => String(s.owner_id) === source)

  async function send(e) {
    e.preventDefault()
    const question = input.trim()
    if (!question || busy) return

    const history = messages.map(({ role, content }) => ({ role, content }))
    const withQuestion = [...messages, { role: 'user', content: question }]
    setMessages([...withQuestion, { role: 'assistant', content: '' }])
    setInput('')
    setError('')
    setBusy(true)

    const askedSource = source
    try {
      const answer = await askChatbot({
        token,
        ownerId: askedSource === GENERAL ? null : Number(askedSource),
        question,
        history,
        onText: (text) =>
          setMessages([...withQuestion, { role: 'assistant', content: text }]),
      })
      const finished = [...withQuestion, { role: 'assistant', content: answer }]
      setMessages(finished)
      saveHistory(userId, askedSource, finished)
    } catch (err) {
      setMessages(withQuestion)
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function clearChat() {
    setMessages([])
    saveHistory(userId, source, [])
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 rounded-full bg-navy text-white font-medium
          px-5 py-3 shadow-lg hover:bg-teal-deep transition-colors"
      >
        Ask the AI tutor
      </button>
    )
  }

  return (
    <div
      className="fixed bottom-5 right-5 z-50 flex flex-col rounded-xl border-2 border-navy/15
        bg-paper shadow-2xl w-[min(380px,calc(100vw-2.5rem))] h-[min(560px,calc(100vh-2.5rem))]"
    >
      <div className="px-4 py-3 border-b border-navy/15 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm">AI tutor</h2>
          <div className="flex items-center gap-3 text-xs">
            {messages.length > 0 && (
              <button onClick={clearChat} className="text-ink/50 hover:text-teal-deep">
                Clear
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="text-ink/50 hover:text-teal-deep"
              aria-label="Close chat"
            >
              Close
            </button>
          </div>
        </div>

        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          disabled={busy}
          className="w-full rounded-md border-2 border-navy/15 bg-paper px-2 py-1.5 text-sm
            outline-none focus:border-teal"
        >
          {sources.map((s) => (
            <option key={s.owner_id} value={String(s.owner_id)}>
              {s.is_you ? 'My uploaded lectures' : s.name}
            </option>
          ))}
          <option value={GENERAL}>General study help</option>
        </select>

        <p className="text-xs text-ink/50">
          {selected
            ? `Answers from: ${selected.courses.join(', ')}`
            : sources.length === 0
              ? 'No lecture content uploaded yet - general answers only.'
              : 'General answers, not tied to a lecture.'}
        </p>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-ink/50">
            {selected
              ? `Ask anything about ${selected.is_you ? 'your' : `${selected.name}'s`} lectures.`
              : 'Ask any study question.'}
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`text-sm max-w-[85%] rounded-lg px-3 py-2 whitespace-pre-wrap ${
              m.role === 'assistant' ? 'bg-cream text-ink' : 'bg-navy text-white ml-auto'
            }`}
          >
            {m.content || (busy && i === messages.length - 1 ? 'Thinking…' : '')}
          </div>
        ))}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <form onSubmit={send} className="p-3 border-t border-navy/15 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
          className="flex-1 min-w-0 rounded-md border-2 border-navy/15 px-3 py-2 text-sm outline-none
            focus:border-teal transition-colors"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-md bg-navy text-white text-sm px-3 disabled:opacity-30
            hover:bg-teal-deep transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  )
}
