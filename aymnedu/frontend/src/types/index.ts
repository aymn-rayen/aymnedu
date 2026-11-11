// ===== Auth =====
export interface User {
  id: number
  email: string
  full_name: string
  role: 'directeur' | 'secretaire' | 'enseignant'
  centre_id: number
  is_active: boolean
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface LoginRequest {
  email: string
  password: string
}

// Role-based login
export interface LoginRoleRequest {
  centre_id: number
  role: string
  password: string
  user_id?: number
}

export interface CentreSearchResult {
  id: number
  nom: string
  wilaya?: string
}

export interface CentreRoleUser {
  id: number
  full_name: string
  role: string
}

export interface Utilisateur {
  id: number
  email: string
  full_name: string
  role: string
  is_active: boolean
}

export interface CreateUtilisateurRequest {
  full_name: string
  email: string
  password: string
  role: string
}

export interface RegisterRequest {
  nom_centre: string
  wilaya?: string
  telephone?: string
  full_name: string
  email: string
  password: string
}

// ===== Centre =====
export interface Centre {
  id: number
  nom: string
  adresse: string
  wilaya: string
  telephone: string
  subscription_plan: 'starter' | 'medium' | 'enterprise'
  is_active: boolean
  created_at: string
}

// ===== Elève =====
export interface Eleve {
  id: number
  centre_id: number
  prenom: string
  nom: string
  telephone_responsable: string
  niveau: string
  date_inscription: string
  statut: 'actif' | 'inactif'
}

export interface CreateEleveRequest {
  prenom: string
  nom: string
  telephone_responsable: string
  niveau: string
}

// ===== Groupe =====
export interface Groupe {
  id: number
  centre_id: number
  nom: string
  matiere: string
  niveau: string
  capacite_max: number
  nombre_eleves: number
  enseignant_id: number | null
  enseignant_nom?: string
}

// ===== Paiement =====
export interface Paiement {
  id: number
  centre_id: number
  eleve_id: number
  eleve_nom?: string
  groupe_id: number
  groupe_nom?: string
  montant: number
  montant_verse: number   // montant déjà encaissé
  mois: string
  statut: 'paye' | 'impaye' | 'partiel'
  date_paiement?: string
  recu_numero?: string
}

// ===== Présence =====
export interface Presence {
  id: number
  groupe_id: number
  eleve_id: number
  eleve_nom?: string
  date_seance: string
  statut: 'present' | 'absent' | 'retard'
  minutes_retard?: number
}

// ===== Emploi du Temps =====
export interface Seance {
  id: number
  centre_id: number
  groupe_id: number
  groupe_nom?: string
  salle: string
  enseignant_id: number
  enseignant_nom?: string
  jour_semaine: 'dimanche' | 'lundi' | 'mardi' | 'mercredi' | 'jeudi' | 'vendredi' | 'samedi'
  heure_debut: string
  heure_fin: string
}

// ===== Pagination =====
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
  pages: number
}

// ===== Dashboard Stats =====
export interface DashboardStats {
  total_eleves: number
  eleves_actifs: number
  total_groupes: number
  paiements_du_mois: number
  montant_encaisse: number
  impayes_du_mois: number
  taux_presence_hebdo: number
}

// ===== Subscription (Abonnement SaaS) =====
export interface SubscriptionInfo {
  centre_id: number
  nom_centre: string
  subscription_plan: 'starter' | 'pro'
  subscription_status: 'trial' | 'active' | 'expired' | 'suspended'
  trial_ends_at?: string
  subscription_expires_at?: string
  days_remaining: number
  is_expired: boolean
  can_write: boolean
  max_eleves: number
  current_eleves: number
  tarif_mensuel_dzd: number
}

export interface PaymentInstructions {
  montant_mensuel_dzd: number
  nom_beneficiaire: string
  ccp_compte: string
  baridimob_rip: string
  instructions: string
  contact_support: string
}
