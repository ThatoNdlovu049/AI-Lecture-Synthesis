import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Login() {
  const { role } = useParams()
  console.log('role:', role)
  const { login } = useAuth()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setUsername('')
    setPassword('')
    setError('')
  }, [role])

  async function handleSubmit(e) {
    e.preventDefault()
    const result = await login({ username, password })
    if (!result.ok) {
      setError(result.error)
      return
    }
    navigate(`/${role}`)
  }

  return (
    <div className="max-w-md mx-auto px-6 py-12">
      <p className="font-display italic text-teal-deep capitalize">
        {role} portal
      </p>
      <h1 className="font-display text-3xl text-navy mt-1 mb-8">Log in</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium">Email</label>
          <input
            type="email"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 w-full rounded-lg border border-navy/15 bg-paper px-4 py-2.5
              outline-none focus:border-teal transition-colors"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Password</label>
          <input
            type="password"
            required
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
          Log in
        </button>
      </form>

      <p className="text-sm text-ink/60 mt-6 text-center">
        Don't have an account?{' '}
        <Link
          to={`/register/${role}`}
          className="text-navy font-medium hover:text-teal-deep hover:underline"
        >
          Register
        </Link>
      </p>
    </div>
  )
}
