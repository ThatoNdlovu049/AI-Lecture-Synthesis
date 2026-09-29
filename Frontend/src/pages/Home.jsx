import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <section className="relative overflow-hidden bg-cream">
      <div
        className="absolute top-0 right-0 w-[50%] h-full"
        style={{
          background: 'var(--color-yellow)',
          clipPath: 'polygon(35% 0, 100% 0, 100% 100%, 0 100%)',
        }}
      />

      <div className="relative max-w-5xl mx-auto px-6 pt-24 pb-28">
        <h1 className="font-display text-6xl text-navy mb-6 max-w-lg">
          Hello!
        </h1>
        <p className="font-display text-xl text-navy/80 mb-10 max-w-md leading-relaxed">
          Welcome to your lecture hall that never sleeps, teaching you
          anywhere, at any hour, in any language!
        </p>
        <div className="flex items-center gap-4">
          <Link
            to="/about"
            className="rounded-full bg-teal text-white font-medium px-7 py-3
              hover:bg-teal-deep transition-colors"
          >
            Learn more
          </Link>
          <Link
            to="/get-started"
            className="rounded-full bg-navy text-white font-medium px-7 py-3
              hover:bg-navy-deep transition-colors"
          >
            Get started
          </Link>
        </div>
      </div>
    </section>
  )
}
