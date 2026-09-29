import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import BrandStrip from './components/BrandStrip.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Home from './pages/Home.jsx'
import About from './pages/About.jsx'
import GetStarted from './pages/GetStarted.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Profile from './pages/Profile.jsx'
import LecturerDashboard from './pages/LecturerDashboard.jsx'
import StudentDashboard from './pages/StudentDashboard.jsx'

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/get-started" element={<GetStarted />} />
          <Route path="/login/:role" element={<Login />} />
          <Route path="/register/:role" element={<Register />} />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lecturer"
            element={
              <ProtectedRoute role="lecturer">
                <LecturerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student"
            element={
              <ProtectedRoute role="student">
                <StudentDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
      <BrandStrip />
    </div>
  )
}
