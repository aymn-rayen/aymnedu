import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { User, LoginRequest, RegisterRequest } from '@/types'

// ── 🚧 DEV BYPASS – disabled, using live API ──────────────────────────
const DEV_BYPASS = false
const MOCK_USER: User = {
  id: 1,
  email: 'directeur@aymnedu.dz',
  full_name: 'Aymn Benali',
  role: 'directeur',
  centre_id: 1,
  is_active: true,
}
// ───────────────────────────────────────────────────────────────────────────

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (data: LoginRequest) => Promise<void>
  register: (data: RegisterRequest) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(DEV_BYPASS ? MOCK_USER : null)
  const [isLoading, setIsLoading] = useState(!DEV_BYPASS)

  useEffect(() => {
    if (DEV_BYPASS) return   // skip API call entirely
    const token = localStorage.getItem('access_token')
    if (token) {
      import('@/api').then(({ authApi }) =>
        authApi.me()
          .then(setUser)
          .catch(() => {
            localStorage.removeItem('access_token')
            localStorage.removeItem('refresh_token')
          })
          .finally(() => setIsLoading(false))
      )
    } else {
      setIsLoading(false)
    }
  }, [])

  const login = async (_data: LoginRequest) => {
    if (DEV_BYPASS) { setUser(MOCK_USER); return }
    const { authApi } = await import('@/api')
    const tokens = await authApi.login(_data)
    localStorage.setItem('access_token', tokens.access_token)
    localStorage.setItem('refresh_token', tokens.refresh_token)
    const me = await authApi.me()
    setUser(me)
  }

  const register = async (data: RegisterRequest) => {
    if (DEV_BYPASS) { setUser(MOCK_USER); return }
    const { authApi } = await import('@/api')
    const tokens = await authApi.register(data)
    localStorage.setItem('access_token', tokens.access_token)
    localStorage.setItem('refresh_token', tokens.refresh_token)
    const me = await authApi.me()
    setUser(me)
  }

  const logout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

