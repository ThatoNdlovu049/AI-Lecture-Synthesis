import { createContext, useContext, useEffect, useState } from 'react'
import { registerUser, findUser, fetchUser, loginUser } from '../lib/db.js'
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext(null)
const SESSION_KEY = 'pas_v1_session'

export function AuthProvider({ children }) {
  
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [currentUser, setCurrentUser] = useState('');
  // true while a saved token is being checked, so protected pages wait instead of redirecting
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('token')));
  const navigate = useNavigate();

  useEffect(() => {

    if(token){
      const getUser = async () => {

        const user = await fetchUser(token);
        if (user.ok) {
          setCurrentUser(user.user);
        } else {
          // saved token expired or invalid
          setToken(null);
          localStorage.removeItem('token');
        }
        setLoading(false);
      };
      getUser();
    }

  }, [token]);

  async function register({ first_name, last_name, username, email, password, role }) {
    const result = await registerUser({ first_name, last_name, username, email, password, role });
    return result;
  }

  async function login( {username, password} ){

    const response = await loginUser({ username, password });
    if(response?.access_token){
      setToken(response.access_token);
      localStorage.setItem('token', response.access_token);
      const userProfile = await fetchUser(response.access_token);
      setCurrentUser(userProfile.user);
      return {ok: true}
    }
    return{ok: false, error: 'error logging in user'}
  }

  function logout() {
    setToken(null);
    setCurrentUser(null);
    localStorage.removeItem('token');
  }

  return (
    <AuthContext.Provider value={{ currentUser, register, login, logout, token, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
