// Step-by-step guide shown while a lecture is being generated. The steps
// match backend/routes/ai.py; `progress` comes from GET /ai/lectures/{key}.
// Typical times were measured on a CPU-only PC - a GPU is much faster.

const STEPS = [
  {
    key: 'upload',
    title: 'Uploading your files',
    why: 'Your video, voice sample and course materials are being sent to the server.',
    typical: 'Under a minute',
    weight: 1,
  },
  {
    key: 'script',
    title: 'Writing the lecture script',
    why: 'The AI reads your course materials and writes a spoken lecture from them.',
    typical: 'About 3–10 minutes',
    weight: 6,
  },
  {
    key: 'voice',
    title: 'Recording the narration',
    why: 'Your voice sample is cloned to read the script aloud, one paragraph at a time. This is one of the two slowest steps.',
    typical: 'About 3 minutes per paragraph',
    weight: 38,
  },
  {
    key: 'lipsync',
    title: 'Lip-syncing the video',
    why: 'Your video is matched to the new narration frame by frame: first the face is found in every frame, then the mouth is animated to match the words. This is usually the longest step.',
    typical: '30–60 minutes',
    weight: 52,
  },
  {
    key: 'subtitles',
    title: 'Adding subtitles',
    why: 'The finished video is transcribed and the subtitles are burned into it.',
    typical: '1–3 minutes',
    weight: 2,
  },
  {
    key: 'slides',
    title: 'Creating slides',
    why: 'Your PDF pages become slides that change in time with the narration.',
    typical: 'A few seconds',
    weight: 1,
  },
]

const EXPECTED_SCRIPT_WORDS = 1700

function formatDuration(seconds) {
  if (seconds == null) return ''
  const s = Math.max(0, Math.round(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h} h ${m} min`
  if (m > 0) return `${m} min`
  return `${s} s`
}

// How far through the current step we are, from 0 to 1 (null if unknown)
function stepFraction(progress) {
  const { stage, current, total, detail } = progress
  if (stage === 'script' && current) return Math.min(current / EXPECTED_SCRIPT_WORDS, 0.95)
  if (!total) return null
  const fraction = current / total
  // Lip-sync has two phases; finding the face takes most of the time
  if (stage === 'lipsync') {
    if (detail === 'Finding the face') return fraction * 0.85
    if (detail === 'Animating the mouth' || detail === 'Saving the video') return 0.85 + fraction * 0.15
  }
  return fraction
}

function stepDetail(progress) {
  const { stage, current, total, detail } = progress
  if (stage === 'script') return current ? `${current} words written so far` : 'Starting the AI…'
  if (stage === 'voice' && total) return `Paragraph ${Math.min(current + 1, total)} of ${total}`
  if (stage === 'lipsync') {
    if (detail && total) return `${detail}: batch ${current} of ${total}`
    return detail || 'Preparing video'
  }
  return null
}

// Remaining time in the current step, from the pace so far
function stepTimeLeft(progress) {
  const { stage, current, total, stage_elapsed } = progress
  if (stage === 'script' || !total || !current || current >= total) return null
  return (stage_elapsed / current) * (total - current)
}

function StepIcon({ state }) {
  if (state === 'done') {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal text-white text-sm">
        ✓
      </span>
    )
  }
  if (state === 'current') {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center">
        <span className="h-6 w-6 rounded-full border-[3px] border-teal/25 border-t-teal animate-spin" />
      </span>
    )
  }
  return <span className="h-7 w-7 shrink-0 rounded-full border-2 border-navy/15" />
}

export default function GenerationProgress({ courseName, progress, uploading }) {
  // Before the server has the files there is no progress yet - that's the upload step
  const current = progress || { stage: 'upload', current: null, total: null, elapsed: null }
  const currentIndex = Math.max(0, STEPS.findIndex((s) => s.key === current.stage))

  const fraction = stepFraction(current)
  const before = STEPS.slice(0, currentIndex).reduce((sum, s) => sum + s.weight, 0)
  const overall = Math.min(99, Math.round(before + STEPS[currentIndex].weight * (fraction ?? 0)))
  const detail = stepDetail(current)
  const timeLeft = stepTimeLeft(current)

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <p className="font-display italic text-teal-deep">{courseName}</p>
      <h1 className="font-display text-3xl text-navy mt-1 mb-2">Generating your lecture</h1>
      <p className="text-ink/70 mb-6">
        This page turns into the video player as soon as the lecture is ready. On this
        computer that usually takes <strong>45–90 minutes</strong>.
      </p>

      <div className="mb-8">
        <div className="flex justify-between text-sm mb-1.5">
          <span className="font-medium">{overall}% done</span>
          {current.elapsed != null && (
            <span className="text-ink/50">Running for {formatDuration(current.elapsed)}</span>
          )}
        </div>
        <div className="h-2.5 rounded-full bg-navy/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-teal transition-all duration-700"
            style={{ width: `${Math.max(overall, 2)}%` }}
          />
        </div>
        <p className="text-xs text-ink/40 mt-1.5">
          The percentage is an estimate based on how long each step usually takes.
        </p>
      </div>

      <ol className="space-y-1">
        {STEPS.map((step, i) => {
          const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'waiting'
          return (
            <li
              key={step.key}
              className={`flex gap-4 rounded-xl p-4 ${
                state === 'current' ? 'bg-cream/60 border-2 border-teal/40' : 'border-2 border-transparent'
              }`}
            >
              <StepIcon state={state} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className={`font-medium ${state === 'waiting' ? 'text-ink/40' : 'text-navy'}`}>
                    {step.title}
                  </h2>
                  {state !== 'done' && (
                    <span className="text-xs text-ink/40 shrink-0">{step.typical}</span>
                  )}
                </div>

                {state === 'current' && (
                  <div className="mt-1.5 space-y-2">
                    <p className="text-sm text-ink/70">{step.why}</p>
                    {(detail || (state === 'current' && uploading)) && (
                      <p className="text-sm font-medium text-teal-deep">
                        {detail || 'Sending files…'}
                        {timeLeft != null && (
                          <span className="font-normal text-ink/50">
                            {' '}· about {formatDuration(timeLeft)} left in this step
                          </span>
                        )}
                      </p>
                    )}
                    {fraction != null && (
                      <div className="h-1.5 rounded-full bg-navy/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-teal-deep transition-all duration-700"
                          style={{ width: `${Math.round(fraction * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      <div className="mt-8 rounded-xl bg-navy text-white p-5 space-y-2 text-sm">
        <p className="font-display text-base">While you wait</p>
        <p className="text-white/80">
          <strong className="text-white">Ask the AI tutor</strong> (bottom-right) about this
          course: your materials are already loaded, and the script is added as soon as it's
          written.
        </p>
        <p className="text-white/80">
          <strong className="text-white">You can leave this page.</strong> The lecture keeps
          generating and will appear under <em>My lectures</em> when it's ready. Just don't stop
          the backend server until it's done.
        </p>
      </div>
    </div>
  )
}
