import { useEffect, useRef, useState } from 'react'
import { api_url } from '../lib/db.js'

/*
Brief rundown of what InteractiveSlideSystem.jsx does:
- slide matches whatever subtitle line is being spoken and also
  matching current moment in the lecturer video
- Doesn't render it's own video. Given a reference to the <video>
  element that's already on the StudentDashboard.jsx page. Listens
  to the video's "timeupdate" event as well
- `slides[i].time` and `subtitles[i].start` are both real timestamps
  (in seconds) produced on the backend from the SAME subtitle file
  AssemblyAI generated - that's what "links" the slides to the
  subtitles/script timing, rather than the two working independently.
 */
export default function InteractiveSlideSystem({ videoRef, slides = [], subtitles = [] }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [caption, setCaption] = useState('')
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    const video = videoRef?.current
    if (!video || slides.length === 0) return

    function onTimeUpdate() {
      const t = video.currentTime

      // Slide rule: show the LAST slide whose timestamp has already
      // passed - so a slide stays up until the next one's time arrives.
      let slideTarget = 0
      for (let i = 0; i < slides.length; i++) {
        if (slides[i].time <= t) slideTarget = i
        else break
      }
      setActiveIndex((current) => (current !== slideTarget ? slideTarget : current))

      // Caption rule: find the one subtitle cue whose start/end
      // window actually contains the current playback time.
      const cue = subtitles.find((c) => t >= c.start && t <= c.end)
      setCaption(cue ? cue.text : '')
    }

    video.addEventListener('timeupdate', onTimeUpdate)
    return () => video.removeEventListener('timeupdate', onTimeUpdate)
  }, [videoRef, slides, subtitles])

  // Clicking a thumbnail jumps the actual video to that slide's
  // moment, instead of just changing what's displayed here.
  function jumpToSlide(index) {
    const video = videoRef?.current
    if (video) video.currentTime = slides[index].time
  }

  if (slides.length === 0) {
    return (
      <div className="aspect-[4/3] max-w-md rounded-lg bg-paper border-2 border-navy/15 flex items-center justify-center">
        <span className="text-ink/30 text-sm">No slides available for this lecture yet</span>
      </div>
    )
  }

  const activeSlide = slides[activeIndex]

  return (
    <div className="max-w-md">
      {/* Big slide preview - double-click or the button opens it full screen */}
      <div className="relative aspect-[4/3] rounded-lg bg-navy/5 border-2 border-navy/15 overflow-hidden flex items-center justify-center">
        <img
          src={`${api_url}${activeSlide.url}`}
          alt={`Slide ${activeIndex + 1}`}
          onDoubleClick={() => setFullscreen(true)}
          className="w-full h-full object-contain cursor-zoom-in"
        />
        <button
          onClick={() => setFullscreen(true)}
          className="absolute top-2 right-2 rounded-md bg-navy/80 text-white text-xs font-medium px-2.5 py-1.5
            hover:bg-teal-deep transition-colors"
        >
          ⛶ Full screen
        </button>
      </div>

      {fullscreen && (
        <FullscreenSlides
          slides={slides}
          activeIndex={activeIndex}
          caption={caption}
          videoRef={videoRef}
          onJump={jumpToSlide}
          onClose={() => setFullscreen(false)}
        />
      )}

      {/* The subtitle line currently being spoken, if any */}
      {caption && (
        <p className="text-xs text-ink/60 italic mt-2 px-1">{caption}</p>
      )}

      {/* Thumbnail strip - click to jump the video to that slide */}
      <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
        {slides.map((s, i) => (
          <button
            key={i}
            onClick={() => jumpToSlide(i)}
            className={`flex-none w-14 h-10 rounded border-2 overflow-hidden transition-colors ${
              i === activeIndex ? 'border-teal' : 'border-navy/15 hover:border-teal/50'
            }`}
          >
            <img
              src={`${api_url}${s.url}`}
              alt={`Slide ${i + 1} thumbnail`}
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  )
}

/*
Slides filling the whole screen. Uses the browser's real full-screen mode
where it can; otherwise it still covers the page. The slide keeps following
the video, so the narration carries on while it's open. Esc closes it,
the arrow keys change slide and Space plays/pauses.
 */
function FullscreenSlides({ slides, activeIndex, caption, videoRef, onJump, onClose }) {
  const overlayRef = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const [playing, setPlaying] = useState(() => videoRef?.current ? !videoRef.current.paused : false)

  // Enter real full screen once; leaving it (Esc, or the browser's own exit) closes the view
  useEffect(() => {
    overlayRef.current?.requestFullscreen?.().catch(() => {})
    function onFullscreenChange() {
      if (!document.fullscreenElement) closeRef.current()
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [])

  useEffect(() => {
    const video = videoRef?.current
    if (!video) return
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    return () => {
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
    }
  }, [videoRef])

  function jump(index) {
    if (index >= 0 && index < slides.length) onJump(index)
  }

  function togglePlay() {
    const video = videoRef?.current
    if (!video) return
    if (video.paused) video.play()
    else video.pause()
  }

  function close() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => closeRef.current())
    else closeRef.current()
  }

  useEffect(() => {
    function onKey(e) {
      // In real full screen the browser handles Esc itself (see fullscreenchange above)
      if (e.key === 'Escape') closeRef.current()
      else if (e.key === 'ArrowRight') jump(activeIndex + 1)
      else if (e.key === 'ArrowLeft') jump(activeIndex - 1)
      else if (e.key === ' ') {
        e.preventDefault()
        togglePlay()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const buttonClass = 'rounded-md px-3 py-2 hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-transparent transition-colors'

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div className="flex-1 min-h-0 flex items-center justify-center p-4">
        <img
          src={`${api_url}${slides[activeIndex].url}`}
          alt={`Slide ${activeIndex + 1}`}
          className="max-w-full max-h-full object-contain"
        />
      </div>

      {caption && (
        <p className="text-white/90 text-center text-lg px-6 pb-3">{caption}</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-white/5 text-white text-sm">
        <div className="flex items-center gap-1">
          <button onClick={() => jump(activeIndex - 1)} disabled={activeIndex === 0} className={buttonClass}>
            ◀ Previous
          </button>
          {videoRef?.current && (
            <button onClick={togglePlay} className={buttonClass}>
              {playing ? '❚❚ Pause' : '▶ Play'}
            </button>
          )}
          <button
            onClick={() => jump(activeIndex + 1)}
            disabled={activeIndex === slides.length - 1}
            className={buttonClass}
          >
            Next ▶
          </button>
        </div>
        <span className="text-white/60">
          Slide {activeIndex + 1} of {slides.length}
        </span>
        <button onClick={close} className={buttonClass}>
          ✕ Exit full screen <span className="text-white/50">(Esc)</span>
        </button>
      </div>
    </div>
  )
}
