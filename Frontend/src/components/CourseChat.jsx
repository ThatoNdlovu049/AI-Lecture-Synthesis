import { useEffect, useRef, useState } from 'react'
import { getChatHistory, saveChatHistory } from '../lib/db.js'
import { askChatbot } from '../lib/chat.js'

const GREETING = { role: 'bot', text: 'Ask me anything about this lecture.' }

// Chat panel beside a lecture: answers only from that one course.
export default function CourseChat({ token, userId, ownerId, courseName, onClose }) {
  const [messages, setMessages] = useState([GREETING])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const listRef = useRef(null)

  useEffect(() => {
    const saved = getChatHistory(userId, courseName)
    setMessages(saved.length > 0 ? saved : [GREETING])
  }, [userId, courseName])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages])

  async function sendMessage() {
    const question = input.trim()
    if (!question || busy) return

    // Earlier turns, minus the greeting, in the shape the backend expects
    const history = messages
      .slice(1)
      .map((m) => ({ role: m.role === 'bot' ? 'assistant' : 'user', content: m.text }))

    const next = [...messages, { role: 'user', text: question }]
    setInput('')
    setMessages([...next, { role: 'bot', text: 'Thinking…' }])
    setBusy(true)

    let reply
    try {
      reply = await askChatbot({
        token,
        ownerId,
        courseName,
        question,
        history,
        onText: (text) => setMessages([...next, { role: 'bot', text }]),
      })
    } catch (err) {
      reply = err.message === 'No lecture content uploaded yet'
        ? 'This lecture was created before the chatbot was added, so there is no content to answer from. Regenerate it to enable questions.'
        : err.message
    } finally {
      setBusy(false)
    }

    const withReply = [...next, { role: 'bot', text: reply }]
    setMessages(withReply)
    saveChatHistory(userId, courseName, withReply)
  }

  return (
    <aside className="rounded-xl border-2 border-navy/15 bg-paper flex flex-col h-[600px]">
      <div className="px-4 py-3 border-b border-navy/15 flex items-center justify-between gap-2">
        <h2 className="font-display text-sm">Ask me anything about this lecture</h2>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close chat"
            className="text-ink/50 hover:text-teal-deep text-sm px-1"
          >
            ✕
          </button>
        )}
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`text-sm max-w-[85%] rounded-lg px-3 py-2 whitespace-pre-wrap ${
              m.role === 'bot' ? 'bg-cream text-ink' : 'bg-navy text-white ml-auto'
            }`}
          >
            {m.text}
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-navy/15 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Ask a question..."
          className="flex-1 min-w-0 rounded-md border-2 border-navy/15 px-3 py-2 text-sm outline-none
            focus:border-teal transition-colors"
        />
        <button
          onClick={sendMessage}
          disabled={busy}
          className="rounded-md bg-navy text-white text-sm px-3 disabled:opacity-30
            hover:bg-teal-deep transition-colors"
        >
          Send
        </button>
      </div>
    </aside>
  )
}
