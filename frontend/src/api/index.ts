import apiClient from './client'
import type { AuthTokens, LoginRequest, LoginRoleRequest, RegisterRequest, User, DashboardStats, CentreSearchResult, CentreRoleUser, Utilisateur, CreateUtilisateurRequest } from '@/types'
import type { PaginatedResponse, Eleve, CreateEleveRequest, Groupe, Paiement, Presence, Seance } from '@/types'

// ── Auth ───────────────────────────────────────────────────────────────────
export const authApi = {
  login: (data: LoginRequest) =>
    apiClient.post<AuthTokens>('/auth/login', data).then(r => r.data),
  loginByRole: (data: LoginRoleRequest) =>
    apiClient.post<AuthTokens>('/auth/login-role', data).then(r => r.data),
  searchCentres: (q: string) =>
    apiClient.get<CentreSearchResult[]>('/auth/centres/search', { params: { q } }).then(r => r.data),
  getCentreRoles: (centreId: number) =>
    apiClient.get<CentreRoleUser[]>(`/auth/centres/${centreId}/roles`).then(r => r.data),
  register: (data: RegisterRequest) =>
    apiClient.post<AuthTokens>('/auth/register', data).then(r => r.data),
  me: () =>
    apiClient.get<User>('/auth/me').then(r => r.data),
  refresh: (refresh_token: string) =>
    apiClient.post<AuthTokens>('/auth/refresh', { refresh_token }).then(r => r.data),
}

// ── Utilisateurs (gestion des rôles par l'admin) ─────────────────────────
export const utilisateursApi = {
  list: () =>
    apiClient.get<Utilisateur[]>('/utilisateurs').then(r => r.data),
  create: (data: CreateUtilisateurRequest) =>
    apiClient.post<Utilisateur>('/utilisateurs', data).then(r => r.data),
  resetPassword: (id: number, password: string) =>
    apiClient.patch<Utilisateur>(`/utilisateurs/${id}/password`, { password }).then(r => r.data),
  delete: (id: number) =>
    apiClient.delete(`/utilisateurs/${id}`),
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
  search: (q: string) =>
    apiClient.get<Eleve[]>('/eleves/search', { params: { q } }).then(r => r.data),
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

