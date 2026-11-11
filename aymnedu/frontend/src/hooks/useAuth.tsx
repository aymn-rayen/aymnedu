import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { User, LoginRequest, LoginRoleRequest, RegisterRequest } from '@/types'

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

  const login = async (data: LoginRequest) => {
    const { authApi } = await import('@/api')
    const tokens = await authApi.login(data)
    localStorage.setItem('access_token', tokens.access_token)
    localStorage.setItem('refresh_token', tokens.refresh_token)
    const me = await authApi.me()
    setUser(me)
  }

  const loginByRole = async (data: LoginRoleRequest) => {
    const { authApi } = await import('@/api')
    const tokens = await authApi.loginByRole(data)
    localStorage.setItem('access_token', tokens.access_token)
    localStorage.setItem('refresh_token', tokens.refresh_token)
    const me = await authApi.me()
    setUser(me)
  }

  const register = async (data: RegisterRequest) => {
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
