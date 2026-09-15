import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '../api'

export type AuthUser = {
  id: string
  username: string
  email: string
  role: string
}

type AuthContextType = {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_STORAGE_KEY = 'tri_ltd_auth_token'
const USER_STORAGE_KEY = 'tri_ltd_auth_user'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY))
  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem(USER_STORAGE_KEY)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return null
      }
    }
    return null
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function verifyAuth() {
      const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY)
      if (!storedToken) {
        setLoading(false)
        return
      }

      try {
        const verifiedUser = await api.me(storedToken)
        setUser(verifiedUser)
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(verifiedUser))
      } catch {
        // Token expired or server unreachable, clear session if invalid
        localStorage.removeItem(TOKEN_STORAGE_KEY)
        localStorage.removeItem(USER_STORAGE_KEY)
        setToken(null)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    verifyAuth()
  }, [])

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password)
    setToken(res.token)
    setUser(res.user)
    localStorage.setItem(TOKEN_STORAGE_KEY, res.token)
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(res.user))
  }

  const register = async (username: string, email: string, password: string) => {
    const res = await api.register(username, email, password)
    setToken(res.token)
    setUser(res.user)
    localStorage.setItem(TOKEN_STORAGE_KEY, res.token)
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(res.user))
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    localStorage.removeItem(USER_STORAGE_KEY)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        loading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
