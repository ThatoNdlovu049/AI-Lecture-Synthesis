import { useEffect, useState } from 'react'
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
      {/* Big slide preview */}
      <div className="aspect-[4/3] rounded-lg bg-navy/5 border-2 border-navy/15 overflow-hidden flex items-center justify-center">
        <img
          src={`${api_url}${activeSlide.url}`}
          alt={`Slide ${activeIndex + 1}`}
          className="w-full h-full object-contain"
        />
      </div>

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
