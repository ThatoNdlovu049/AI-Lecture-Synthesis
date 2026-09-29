import { useAuth } from '../context/AuthContext.jsx'

function Field({ label, value }) {
  return (
    <div className="border-b border-navy/15 pb-3">
      <p className="text-xs uppercase tracking-wide text-ink/50">{label}</p>
      <p className="text-lg">{value}</p>
    </div>
  )
}

export default function Profile() {
  const { currentUser } = useAuth()

  return (
    <div className="max-w-md mx-auto px-6 py-12">
      <h1 className="font-display text-3xl text-navy mb-8">Profile</h1>
      <div className="space-y-5">
        <Field label="First name" value={currentUser.firstName} />
        <Field label="Surname" value={currentUser.surname} />
        <Field label="Email" value={currentUser.email} />
        <Field
          label="Account type"
          value={currentUser.role === 'lecturer' ? 'Lecturer' : 'Student'}
        />
      </div>
    </div>
  )
}
