import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

const linkClass = 'text-navy/70 hover:text-navy font-medium transition-colors'

export default function Navbar() {
  const { currentUser, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <header className="bg-paper">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-5">
        <Link
          to="/"
          className="font-display text-lg tracking-tight border-2 border-navy px-4 py-1.5 rounded-md"
        >
          Avatar
        </Link>

        {currentUser ? (
          <nav className="flex items-center gap-8 text-sm">
            <Link to={`/${currentUser.role}`} className={linkClass}>
              Dashboard
            </Link>
            <Link to="/profile" className={linkClass}>
              Profile
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-full bg-navy text-white font-medium px-6 py-2.5
                hover:bg-teal-deep transition-colors"
            >
              Log out
            </button>
          </nav>
        ) : (
          <nav className="flex items-center gap-8 text-sm">
            <Link to="/" className={linkClass}>
              Home
            </Link>
            <Link
              to="/about"
              className="rounded-full bg-teal text-white font-medium px-6 py-2.5
                hover:bg-teal-deep transition-colors"
            >
              About
            </Link>
          </nav>
        )}
      </div>
    </header>
  )
}
