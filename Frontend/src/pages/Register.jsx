import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Register() {
  const { role } = useParams()
  const { register } = useAuth()
  const navigate = useNavigate()

  const [first_name, setFirstName] = useState('')
  const [last_name, setLastName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setFirstName('')
    setLastName('')
    setUsername('')
    setEmail('')
    setPassword('')
    setError('')
  }, [role])

  async function handleSubmit(e) {
    e.preventDefault()
    const result = await register({ first_name, last_name, username, email, password, role })
    if (!result.ok) {
      setError(result.error)
      return
    }
    navigate(`/login/${role}`)
  }

  return (
    <div className="max-w-md mx-auto px-6 py-12">
      <p className="font-display italic text-teal-deep capitalize">
        {role} portal
      </p>
      <h1 className="font-display text-3xl text-navy mt-1 mb-8">
        Create your account
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">First name</label>
            <input
              required
              value={first_name}
              onChange={(e) => setFirstName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-navy/15 bg-paper px-4 py-2.5
                outline-none focus:border-teal transition-colors"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Surname</label>
            <input
              required
              value={last_name}
              onChange={(e) => setLastName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-navy/15 bg-paper px-4 py-2.5
                outline-none focus:border-teal transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Username</label>
          <input
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 w-full rounded-lg border border-navy/15 bg-paper px-4 py-2.5
              outline-none focus:border-teal transition-colors"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-navy/15 bg-paper px-4 py-2.5
              outline-none focus:border-teal transition-colors"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Password</label>
          <input
            type="password"
            required
            minLength={4}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-navy/15 bg-paper px-4 py-2.5
              outline-none focus:border-teal transition-colors"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          className="w-full rounded-lg bg-navy text-white font-medium py-3
            hover:bg-teal-deep transition-colors"
        >
          Register
        </button>
      </form>

      <p className="text-sm text-ink/60 mt-6 text-center">
        Already have an account?{' '}
        <Link
          to={`/login/${role}`}
          className="text-navy font-medium hover:text-teal-deep hover:underline"
        >
          Log in
        </Link>
      </p>
    </div>
  )
}
