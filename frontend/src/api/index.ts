import apiClient from './client'
import type { AuthTokens, LoginRequest, RegisterRequest, User, DashboardStats } from '@/types'
import type { PaginatedResponse, Eleve, CreateEleveRequest, Groupe, Paiement, Presence, Seance } from '@/types'

// ── Auth ───────────────────────────────────────────────────────────────────
export const authApi = {
  login: (data: LoginRequest) =>
    apiClient.post<AuthTokens>('/auth/login', data).then(r => r.data),
  register: (data: RegisterRequest) =>
    apiClient.post<AuthTokens>('/auth/register', data).then(r => r.data),
  me: () =>
    apiClient.get<User>('/auth/me').then(r => r.data),
  refresh: (refresh_token: string) =>
    apiClient.post<AuthTokens>('/auth/refresh', { refresh_token }).then(r => r.data),
}

// ── Dashboard ──────────────────────────────────────────────────────────────
export const dashboardApi = {
  stats: () =>
    apiClient.get<DashboardStats>('/dashboard/stats').then(r => r.data),
}

// ── Élèves ─────────────────────────────────────────────────────────────────
export const elevesApi = {
  list: (params?: { page?: number; q?: string; statut?: string }) =>
    apiClient.get<PaginatedResponse<Eleve>>('/eleves', { params }).then(r => r.data),
  get: (id: number) =>
    apiClient.get<Eleve>(`/eleves/${id}`).then(r => r.data),
  create: (data: CreateEleveRequest) =>
    apiClient.post<Eleve>('/eleves', data).then(r => r.data),
  update: (id: number, data: Partial<CreateEleveRequest>) =>
    apiClient.put<Eleve>(`/eleves/${id}`, data).then(r => r.data),
  delete: (id: number) =>
    apiClient.delete(`/eleves/${id}`),
}

// ── Groupes ────────────────────────────────────────────────────────────────
export const groupesApi = {
  list: () =>
    apiClient.get<Groupe[]>('/groupes').then(r => r.data),
  get: (id: number) =>
    apiClient.get<Groupe>(`/groupes/${id}`).then(r => r.data),
  create: (data: Partial<Groupe>) =>
    apiClient.post<Groupe>('/groupes', data).then(r => r.data),
  update: (id: number, data: Partial<Groupe>) =>
    apiClient.put<Groupe>(`/groupes/${id}`, data).then(r => r.data),
  delete: (id: number) =>
    apiClient.delete(`/groupes/${id}`),
  getEleves: (id: number) =>
    apiClient.get<Eleve[]>(`/groupes/${id}/eleves`).then(r => r.data),
  addEleve: (id: number, eleveId: number) =>
    apiClient.post(`/groupes/${id}/eleves/${eleveId}`).then(r => r.data),
  removeEleve: (id: number, eleveId: number) =>
    apiClient.delete(`/groupes/${id}/eleves/${eleveId}`).then(r => r.data),
}

// ── Paiements ──────────────────────────────────────────────────────────────
export const paiementsApi = {
  list: (params?: { page?: number; statut?: string; mois?: string }) =>
    apiClient.get<PaginatedResponse<Paiement>>('/paiements', { params }).then(r => r.data),
  create: (data: Partial<Paiement>) =>
    apiClient.post<Paiement>('/paiements', data).then(r => r.data),
  markPaid: (id: number) =>
    apiClient.patch<Paiement>(`/paiements/${id}/payer`).then(r => r.data),
}

// ── Présences ──────────────────────────────────────────────────────────────
export const presencesApi = {
  listByGroupe: (groupeId: number, date: string) =>
    apiClient.get<Presence[]>(`/presences`, { params: { groupe_id: groupeId, date } }).then(r => r.data),
  save: (data: Presence[]) =>
    apiClient.post<void>('/presences/batch', data),
}

// ── Emplois du Temps ───────────────────────────────────────────────────────
export const emploisApi = {
  list: () =>
    apiClient.get<Seance[]>('/emplois-du-temps').then(r => r.data),
  create: (data: Partial<Seance>) =>
    apiClient.post<Seance>('/emplois-du-temps', data).then(r => r.data),
  update: (id: number, data: Partial<Seance>) =>
    apiClient.put<Seance>(`/emplois-du-temps/${id}`, data).then(r => r.data),
  delete: (id: number) =>
    apiClient.delete(`/emplois-du-temps/${id}`),
}

// ── Enseignants ────────────────────────────────────────────────────────────
export const enseignantsApi = {
  list: () =>
    apiClient.get<{ id: number; full_name: string; email: string; is_active: boolean }[]>('/enseignants').then(r => r.data),
  create: (data: { full_name: string; email: string; password: string }) =>
    apiClient.post<{ id: number; full_name: string; email: string; is_active: boolean }>('/enseignants', data).then(r => r.data),
  delete: (id: number) =>
    apiClient.delete(`/enseignants/${id}`),
}

