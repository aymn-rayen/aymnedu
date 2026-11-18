import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { User, LoginRequest, LoginRoleRequest, RegisterRequest } from '@/types'
import { setAccessToken } from '@/api/client'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (data: LoginRequest) => Promise<void>
  loginByRole: (data: LoginRoleRequest) => Promise<void>
  register: (data: RegisterRequest) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Purge any lingering legacy tokens in localStorage from older versions
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')

    // Initial check: exchange HttpOnly cookie for a fresh in-memory access token
    import('@/api').then(({ authApi }) => {
      authApi.refresh()
        .then((tokens) => {
          setAccessToken(tokens.access_token)
          return authApi.me()
        })
        .then((me) => {
          setUser(me)
        })
        .catch(() => {
          setAccessToken(null)
          setUser(null)
        })
        .finally(() => {
          setIsLoading(false)
        })
    })
  }, [])

  const login = async (data: LoginRequest) => {
    const { authApi } = await import('@/api')
    const tokens = await authApi.login(data)
    setAccessToken(tokens.access_token)
    const me = await authApi.me()
    setUser(me)
  }

  const loginByRole = async (data: LoginRoleRequest) => {
    const { authApi } = await import('@/api')
    const tokens = await authApi.loginByRole(data)
    setAccessToken(tokens.access_token)
    const me = await authApi.me()
    setUser(me)
  }

  const register = async (data: RegisterRequest) => {
    const { authApi } = await import('@/api')
    const tokens = await authApi.register(data)
    setAccessToken(tokens.access_token)
    const me = await authApi.me()
    setUser(me)
  }

  const logout = () => {
    import('@/api').then(({ authApi }) => {
      authApi.logout()
    })
    setAccessToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, loginByRole, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
