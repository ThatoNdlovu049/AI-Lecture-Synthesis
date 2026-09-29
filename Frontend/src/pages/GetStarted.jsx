import { Link } from 'react-router-dom'

export default function GetStarted() {
  return (
    <section className="max-w-3xl mx-auto px-6 py-16 min-h-[60vh] flex flex-col justify-center">
      <div className="grid sm:grid-cols-2 gap-6">
        <Link
          to="/login/lecturer"
          className="rounded-2xl border-2 border-navy/15 bg-paper p-8 text-center
            hover:border-teal hover:shadow-lg transition-all"
        >
          <span className="font-display text-2xl text-navy">
            Lecturer Portal
          </span>
          <p className="text-sm text-ink/70 mt-2">
            Upload your course materials and let Avatar build your lecture
            for you.
          </p>
        </Link>

        <Link
          to="/login/student"
          className="rounded-2xl border-2 border-navy/15 bg-paper p-8 text-center
            hover:border-teal hover:shadow-lg transition-all"
        >
          <span className="font-display text-2xl text-navy">
            Student Portal
          </span>
          <p className="text-sm text-ink/70 mt-2">
            Find your course and start learning with Avatar's chatbot on
            hand.
          </p>
        </Link>
      </div>
    </section>
  )
}
