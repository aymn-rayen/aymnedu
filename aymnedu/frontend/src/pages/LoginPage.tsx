import { useState } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import {
  GraduationCap, Lock, Mail, AlertCircle, Loader2, Eye, EyeOff, ShieldCheck, UserCircle2, BookOpenCheck, Sparkles
} from 'lucide-react'

export default function LoginPage() {
  const { login, user } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  if (user) return <Navigate to={getDefaultRoute(user.role)} replace />

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Veuillez renseigner votre email et votre mot de passe.')
      return
    }

    setError('')
    setIsLoading(true)
    try {
      await login({ email: email.trim(), password })
      // useAuth sets user state; redirection will be handled or navigated
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
        'Identifiants incorrects. Veuillez vérifier votre adresse e-mail et votre mot de passe.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  // Raccourcis de test rapide (Démo & Évaluation)
  const setQuickAccount = (quickEmail: string, quickPass: string) => {
    setEmail(quickEmail)
    setPassword(quickPass)
    setError('')
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center p-6">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary-500/10 border border-primary-500/20">
              <GraduationCap className="w-6 h-6 text-primary-400" />
            </div>
            <span className="font-heading text-2xl font-bold text-white">
              Aymn<span className="text-primary-400">EDU</span>
            </span>
          </Link>
          <h1 className="text-2xl font-bold text-white">Connexion à votre espace</h1>
          <p className="text-slate-400 text-sm mt-1">Plateforme de gestion pour centres de soutien scolaire</p>
        </div>

        {/* Card */}
        <div className="card shadow-2xl border-white/10">
          {error && (
            <div className="mb-5 flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">Adresse e-mail</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="nom@ecole.dz"
                  className="input pl-10"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0" htmlFor="password">Mot de passe</label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  className="input pl-10 pr-10 font-mono"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !email || !password}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-6 py-2.5 text-base font-semibold disabled:opacity-60"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLoading ? 'Connexion en cours…' : 'Se connecter'}
            </button>
          </form>

          {/* Quick Demo Pre-fills */}
          <div className="mt-6 pt-5 border-t border-white/5">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-primary-400" />
              <span className="font-medium">Comptes de test (Centre El-Feth) :</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setQuickAccount('directeur@aymnedu.dz', 'admin1234')}
                className="px-2.5 py-1.5 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 border border-violet-500/20 text-left transition-colors flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">Directeur</span>
              </button>
              <button
                type="button"
                onClick={() => setQuickAccount('enseignant@aymnedu.dz', 'enseignant1234')}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 text-left transition-colors flex items-center gap-1.5"
              >
                <BookOpenCheck className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">Enseignant</span>
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-sm text-slate-400 mt-6">
          Vous êtes directeur d'un nouveau centre ?{' '}
          <Link to="/register" className="text-primary-400 hover:text-primary-300 font-semibold underline underline-offset-4">
            Créer un centre (14 jours gratuits)
          </Link>
        </p>
      </div>
    </div>
  )
}

function getDefaultRoute(role?: string): string {
  switch (role) {
    case 'directeur': return '/app/dashboard'
    case 'secretaire': return '/app/eleves'
    case 'enseignant': return '/app/presences'
    default: return '/app/dashboard'
  }
}
