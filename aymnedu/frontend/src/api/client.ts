import axios from 'axios'

const env = (import.meta as unknown as { env?: Record<string, string> }).env
const rawApiUrl = env?.VITE_API_URL
const apiBase = rawApiUrl ? `${rawApiUrl.replace(/\/+$/, '')}/api/v1` : '/api/v1'

export const apiClient = axios.create({
  baseURL: apiBase,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ── Request Interceptor: attach JWT access token ──────────────────────────
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

// ── Response Interceptor: handle 401 → refresh token logic ────────────────
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      const refreshToken = localStorage.getItem('refresh_token')

      if (!refreshToken) {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/app/login'
        return Promise.reject(error)
      }

      try {
        const { data } = await axios.post(
          `${apiBase}/auth/refresh`,
          { refresh_token: refreshToken },
          { withCredentials: true }
        )
        // Refresh Token Rotation: update BOTH access and new rotated refresh token
        localStorage.setItem('access_token', data.access_token)
        if (data.refresh_token) {
          localStorage.setItem('refresh_token', data.refresh_token)
        }
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`
        return apiClient(originalRequest)
      } catch {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/app/login'
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  },
)

export default apiClient
