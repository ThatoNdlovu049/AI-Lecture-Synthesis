import { useEffect, useRef, useState } from 'react'
import { createNote, deleteNote, fetchNotes, updateNote } from '../lib/notes.js'

const SAVE_DELAY_MS = 1000

function formatTime(seconds) {
  const s = Math.floor(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// Notes in video order; ones without a time go last
function byVideoTime(a, b) {
  return (a.video_time ?? Infinity) - (b.video_time ?? Infinity) || a.id - b.id
}

/*
A lecture's notes as separate cards. Click a card to open and edit it, "Done"
closes it again. "+ Add note" starts a new one stamped with the current video
time. The open note saves itself a second after typing stops, when it's
closed, and when leaving the page. Notes are private to the logged-in user.
 */
export default function LectureNotes({ token, lectureKey, videoRef, onClose, onCountChange }) {
  const [notes, setNotes] = useState(null) // null while loading
  const [loadError, setLoadError] = useState(false)
  const [openKey, setOpenKey] = useState(null) // id of the open note, 'new', or null
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState('saved') // saved | unsaved | saving | error

  // The open note: { id (null until created), videoTime, text, dirty }
  const current = useRef(null)
  const timer = useRef(null)
  // Saves run one after another, so a new note is only ever created once
  const pending = useRef(Promise.resolve())

  useEffect(() => {
    let cancelled = false
    setNotes(null)
    setLoadError(false)
    fetchNotes(token, lectureKey)
      .then((list) => !cancelled && setNotes(list))
      .catch(() => !cancelled && setLoadError(true))

    function onUnload() {
      saveNow({ keepalive: true })
    }
    window.addEventListener('beforeunload', onUnload)
    return () => {
      cancelled = true
      window.removeEventListener('beforeunload', onUnload)
      saveNow({ keepalive: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, lectureKey])

  useEffect(() => {
    if (notes) onCountChange?.(notes.filter((n) => n.content.trim()).length)
  }, [notes, onCountChange])

  function saveNow({ keepalive = false } = {}) {
    clearTimeout(timer.current)
    const note = current.current
    if (!note || !note.dirty) return pending.current
    note.dirty = false
    const text = note.text
    setStatus('saving')

    pending.current = pending.current.then(async () => {
      try {
        if (note.id == null) {
          if (!text.trim()) return setStatus('saved')
          const created = await createNote(token, lectureKey, text, note.videoTime, { keepalive })
          note.id = created.id
          // Stays in the "new note" slot until closed, so the textbox and cursor don't jump
          setNotes((list) => [...(list || []), created])
        } else {
          const updated = await updateNote(token, note.id, text, { keepalive })
          setNotes((list) => list.map((n) => (n.id === updated.id ? updated : n)))
        }
        if (!note.dirty) setStatus('saved')
      } catch {
        note.dirty = true
        setStatus('error')
      }
    })
    return pending.current
  }

  function edit(text) {
    setDraft(text)
    current.current.text = text
    current.current.dirty = true
    setStatus('unsaved')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => saveNow(), SAVE_DELAY_MS)
  }

  async function closeNote() {
    const note = current.current
    if (!note) return
    await saveNow()
    current.current = null
    setOpenKey(null)
    // A note that was emptied isn't worth keeping
    if (note.id != null && !note.text.trim()) await removeFromServer(note.id)
  }

  async function openNote(note) {
    await closeNote()
    current.current = { id: note.id, videoTime: note.video_time, text: note.content, dirty: false }
    setDraft(note.content)
    setStatus('saved')
    setOpenKey(note.id)
  }

  async function addNote() {
    await closeNote()
    const time = videoRef?.current?.currentTime
    current.current = { id: null, videoTime: time ?? null, text: '', dirty: false }
    setDraft('')
    setStatus('saved')
    setOpenKey('new')
  }

  async function removeFromServer(id) {
    try {
      await deleteNote(token, id)
      setNotes((list) => list.filter((n) => n.id !== id))
    } catch {
      setStatus('error')
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this note?')) return
    const note = current.current
    clearTimeout(timer.current)
    current.current = null
    setOpenKey(null)
    await pending.current // a note still being created gets its id here
    if (note?.id != null) await removeFromServer(note.id)
  }

  function seek(seconds) {
    if (videoRef?.current && seconds != null) videoRef.current.currentTime = seconds
  }

  const statusText = {
    unsaved: 'Typing…',
    saving: 'Saving…',
    saved: 'Saved',
    error: "Couldn't save",
  }[status]

  const editor = (
    <div className="rounded-lg border-2 border-teal bg-paper">
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => edit(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && closeNote()}
        rows={5}
        placeholder="Write your note..."
        className="w-full resize-y rounded-t-lg bg-transparent px-3 py-2.5 text-sm leading-relaxed outline-none"
      />
      <div className="flex items-center justify-between gap-2 border-t border-navy/10 px-3 py-2">
        <span className={`text-xs ${status === 'error' ? 'text-red-600' : 'text-ink/40'}`}>
          {statusText}
          {status === 'error' && (
            <button
              onClick={() => {
                current.current.dirty = true
                saveNow()
              }}
              className="ml-2 underline hover:text-teal-deep"
            >
              Retry
            </button>
          )}
        </span>
        <div className="flex items-center gap-3">
          <button onClick={handleDelete} className="text-xs text-red-600/80 hover:text-red-600">
            Delete
          </button>
          <button
            onClick={closeNote}
            className="rounded-md bg-navy text-white text-xs font-medium px-3 py-1.5 hover:bg-teal-deep transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )

  const newNoteId = openKey === 'new' ? current.current?.id : undefined
  const sorted = notes ? notes.filter((n) => n.id !== newNoteId).sort(byVideoTime) : []
  const newNoteTime = current.current?.videoTime

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="font-display text-sm">
          My notes{notes && notes.length > 0 ? ` (${notes.length})` : ''}
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={addNote}
            disabled={!notes}
            className="rounded-md bg-navy text-white text-xs font-medium px-3 py-1.5 hover:bg-teal-deep
              disabled:opacity-30 transition-colors"
          >
            + Add note
          </button>
          {onClose && (
            <button onClick={onClose} aria-label="Close notes" className="text-ink/50 hover:text-teal-deep text-sm">
              ✕
            </button>
          )}
        </div>
      </div>

      {loadError && <p className="text-sm text-red-600">Couldn't load your notes. Is the backend running?</p>}
      {!notes && !loadError && <p className="text-sm text-ink/40">Loading notes…</p>}

      <div className="space-y-2">
        {openKey === 'new' && (
          <div>
            {newNoteTime != null && (
              <p className="text-xs text-teal-deep mb-1">New note at {formatTime(newNoteTime)}</p>
            )}
            {editor}
          </div>
        )}

        {sorted.map((note) =>
          note.id === openKey ? (
            <div key={note.id}>{editor}</div>
          ) : (
            <div
              key={note.id}
              role="button"
              tabIndex={0}
              onClick={() => openNote(note)}
              onKeyDown={(e) => e.key === 'Enter' && openNote(note)}
              className="cursor-pointer rounded-lg border-2 border-navy/15 bg-paper px-3 py-2.5
                hover:border-teal transition-colors"
            >
              <div className="flex items-baseline justify-between gap-2">
                {note.video_time != null ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      seek(note.video_time)
                    }}
                    title="Jump the video to this point"
                    className="text-xs font-medium text-teal-deep hover:underline"
                  >
                    ▶ {formatTime(note.video_time)}
                  </button>
                ) : (
                  <span />
                )}
                {note.updated_at && (
                  <span className="text-[11px] text-ink/40">
                    {new Date(note.updated_at).toLocaleDateString()}
                  </span>
                )}
              </div>
              <p className="text-sm text-ink mt-1 line-clamp-2 whitespace-pre-wrap">
                {note.content.trim() || <span className="text-ink/40">Empty note</span>}
              </p>
            </div>
          )
        )}

        {sorted.length === 0 && notes && openKey !== 'new' && (
          <p className="text-sm text-ink/50 rounded-lg border-2 border-dashed border-navy/15 px-3 py-4 text-center">
            No notes yet. Click <strong>+ Add note</strong> to write one. It's stamped with the
            current video time.
          </p>
        )}
      </div>
    </div>
  )
}
