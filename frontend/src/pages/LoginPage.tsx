import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { authApi } from '@/api'
import type { CentreSearchResult, CentreRoleUser } from '@/types'
import {
  GraduationCap, Lock, Search, AlertCircle, School,
  Loader2, UserCircle2, ShieldCheck, BookOpenCheck
} from 'lucide-react'

const ROLE_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  directeur: { label: 'Directeur / Admin', icon: ShieldCheck, color: 'text-violet-400' },
  secretaire: { label: 'Secrétaire', icon: UserCircle2, color: 'text-sky-400' },
  enseignant: { label: 'Enseignant', icon: BookOpenCheck, color: 'text-emerald-400' },
}

export default function LoginPage() {
  const { loginByRole, user } = useAuth()
  const navigate = useNavigate()

  // Step state: 1 = choose school, 2 = choose role + password
  const [step, setStep] = useState<1 | 2>(1)

  // Step 1: school search
  const [schoolQuery, setSchoolQuery] = useState('')
  const [schools, setSchools] = useState<CentreSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedSchool, setSelectedSchool] = useState<CentreSearchResult | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)

  // Step 2: role + password
  const [roles, setRoles] = useState<CentreRoleUser[]>([])
  const [selectedRole, setSelectedRole] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  if (user) return <Navigate to={getDefaultRoute(user.role)} replace />

  // Debounced school search
  useEffect(() => {
    if (schoolQuery.trim().length < 2) { setSchools([]); return }
    const t = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await authApi.searchCentres(schoolQuery)
        setSchools(res)
        setShowDropdown(true)
      } finally {
        setIsSearching(false)
      }
    }, 350)
    return () => clearTimeout(t)
  }, [schoolQuery])

  // Load roles when school selected
  const handleSelectSchool = useCallback(async (school: CentreSearchResult) => {
    setSelectedSchool(school)
    setSchoolQuery(school.nom)
    setShowDropdown(false)
    setIsLoading(true)
    try {
      const res = await authApi.getCentreRoles(school.id)
      setRoles(res)
      // Auto-select first role
      if (res.length > 0) setSelectedRole(res[0].role)
    } finally {
      setIsLoading(false)
    }
    setStep(2)
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSchool || !selectedRole || !password) return
    setError('')
    setIsLoading(true)
    try {
      await loginByRole({ centre_id: selectedSchool.id, role: selectedRole, password })
      const me = await authApi.me()
      navigate(getDefaultRoute(me.role), { replace: true })
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Mot de passe incorrect.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleBack = () => {
    setStep(1)
    setSelectedSchool(null)
    setRoles([])
    setSelectedRole('')
    setPassword('')
    setError('')
    setSchoolQuery('')
  }

  // Unique roles across all users (in case multiple directeurs etc.)
  const uniqueRoles = Array.from(new Set(roles.map(u => u.role)))

  return (
    <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary-500/6 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-500/4 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-500/10 border border-primary-500/20 mb-4 hover:opacity-85 transition-opacity">
            <GraduationCap className="w-7 h-7 text-primary-400" />
          </Link>
          <h1 className="font-heading text-2xl font-bold text-white">
            Aymn<span className="text-primary-400">EDU</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">Accès à votre espace</p>
        </div>

        <div className="card">
          {/* Progress indicators */}
          <div className="flex items-center gap-2 mb-6 px-1">
            <div className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${step === 1 ? 'text-primary-400' : 'text-slate-500'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step === 1 ? 'bg-primary-500 text-white' : step === 2 ? 'bg-emerald-500 text-white' : 'bg-white/10 text-slate-500'}`}>
                {step > 1 ? '✓' : '1'}
              </span>
              Votre école
            </div>
            <div className="flex-1 h-px bg-white/5" />
            <div className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${step === 2 ? 'text-primary-400' : 'text-slate-500'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step === 2 ? 'bg-primary-500 text-white' : 'bg-white/10 text-slate-500'}`}>
                2
              </span>
              Profil & mot de passe
            </div>
          </div>

          {/* ── STEP 1: School Search ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="label">Chercher votre école / centre</label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  {isSearching && <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 animate-spin pointer-events-none" />}
                  <input
                    id="school-search"
                    type="text"
                    autoFocus
                    placeholder="Ex: Centre El-Nadjah, Soutien Scolaire..."
                    className="input pl-10"
                    value={schoolQuery}
                    onChange={e => { setSchoolQuery(e.target.value); setShowDropdown(true) }}
                    onFocus={() => schoolQuery.length >= 2 && setShowDropdown(true)}
                  />

                  {/* Dropdown */}
                  {showDropdown && schools.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#141827] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50">
                      {schools.map(school => (
                        <button
                          key={school.id}
                          type="button"
                          onClick={() => handleSelectSchool(school)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                        >
                          <School className="w-4 h-4 text-primary-400 shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-white">{school.nom}</p>
                            {school.wilaya && <p className="text-xs text-slate-500">{school.wilaya}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {showDropdown && schoolQuery.trim().length >= 2 && !isSearching && schools.length === 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#141827] border border-white/10 rounded-xl px-4 py-3 text-slate-500 text-sm z-50">
                      Aucun centre trouvé pour « {schoolQuery} »
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-2">Tapez au moins 2 caractères pour lancer la recherche</p>
              </div>
            </div>
          )}

          {/* ── STEP 2: Role + Password ── */}
          {step === 2 && selectedSchool && (
            <form onSubmit={handleLogin} className="space-y-5">
              {/* Selected school */}
              <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-primary-500/8 border border-primary-500/20">
                <div className="flex items-center gap-2">
                  <School className="w-4 h-4 text-primary-400" />
                  <div>
                    <p className="text-sm font-semibold text-white">{selectedSchool.nom}</p>
                    {selectedSchool.wilaya && <p className="text-[11px] text-slate-500">{selectedSchool.wilaya}</p>}
                  </div>
                </div>
                <button type="button" onClick={handleBack} className="text-xs text-primary-400 hover:text-primary-300 underline underline-offset-2">
                  Changer
                </button>
              </div>

              {/* Error banner */}
              {error && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Role selector */}
              <div>
                <label className="label">Votre profil</label>
                {isLoading ? (
                  <div className="flex items-center gap-2 text-slate-500 text-sm py-3">
                    <Loader2 className="w-4 h-4 animate-spin" /> Chargement des profils…
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {uniqueRoles.map(role => {
                      const meta = ROLE_LABELS[role] ?? { label: role, icon: UserCircle2, color: 'text-slate-400' }
                      const Icon = meta.icon
                      return (
                        <button
                          key={role}
                          type="button"
                          onClick={() => { setSelectedRole(role); setError('') }}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                            selectedRole === role
                              ? 'bg-primary-500/15 border-primary-500/50 ring-1 ring-primary-500/40'
                              : 'bg-white/3 border-white/8 hover:border-white/20'
                          }`}
                        >
                          <Icon className={`w-5 h-5 shrink-0 ${selectedRole === role ? meta.color : 'text-slate-500'}`} />
                          <span className={`text-sm font-medium ${selectedRole === role ? 'text-white' : 'text-slate-400'}`}>
                            {meta.label}
                          </span>
                          {selectedRole === role && (
                            <div className="ml-auto w-4 h-4 rounded-full bg-primary-500 flex items-center justify-center">
                              <div className="w-2 h-2 rounded-full bg-white" />
                            </div>
                          )}
                        </button>
                      )
                    })}
                    {uniqueRoles.length === 0 && !isLoading && (
                      <p className="text-slate-500 text-sm">Aucun profil configuré pour cette école.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="label" htmlFor="password">Mot de passe</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  <input
                    id="password"
                    type="password"
                    autoFocus
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="input pl-10"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError('') }}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !selectedRole || !password}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {isLoading ? 'Connexion…' : 'Se connecter'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-slate-400 mt-6">
          Nouveau sur AymnEDU ?{' '}
          <Link to="/register" className="text-primary-400 hover:text-primary-300 font-semibold underline underline-offset-4">
            Créer un compte centre
          </Link>
        </p>
      </div>
    </div>
  )
}

function getDefaultRoute(role: string): string {
  switch (role) {
    case 'directeur': return '/app/dashboard'
    case 'secretaire': return '/app/eleves'
    case 'enseignant': return '/app/presences'
    default: return '/app/dashboard'
  }
}
