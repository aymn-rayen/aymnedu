import { useState } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { GraduationCap, Lock, Mail, AlertCircle, Building2, User, Phone, MapPin } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const registerSchema = z.object({
  nom_centre: z.string().min(3, 'Le nom du centre doit faire au moins 3 caractères'),
  wilaya: z.string().min(2, 'Veuillez renseigner la wilaya'),
  telephone: z.string().optional(),
  full_name: z.string().min(3, 'Le nom complet doit faire au moins 3 caractères'),
  email: z.string().email('Email de connexion invalide'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
})

type RegisterForm = z.infer<typeof registerSchema>

export default function RegisterCenterPage() {
  const { register: submitRegister, user } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  // If already logged in, redirect to dashboard
  if (user) return <Navigate to="/app/dashboard" replace />

  const {
    register: formRegister,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) })

  const onSubmit = async (data: RegisterForm) => {
    setError('')
    try {
      await submitRegister(data)
      navigate('/app/dashboard')
    } catch (err: any) {
      setError(
        err.response?.data?.detail || "Une erreur est survenue lors de l'enregistrement de votre centre."
      )
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center p-6">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-6">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary-500/10 border border-primary-500/20">
              <GraduationCap className="w-6 h-6 text-primary-400" />
            </div>
            <span className="font-heading text-2xl font-bold text-white">
              Aymn<span className="text-primary-400">EDU</span>
            </span>
          </Link>
          <h1 className="text-2xl font-bold text-white">Créer mon centre d'étude</h1>
          <p className="text-slate-400 text-sm mt-1">Numérisez la gestion de vos cours de soutien en quelques minutes</p>
        </div>

        {/* Card */}
        <div className="card">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="border-b border-white/5 pb-4 mb-4">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Informations du Centre</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label" htmlFor="nom_centre">Nom du centre *</label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    <input
                      id="nom_centre"
                      type="text"
                      placeholder="Ex: Centre El Hikma"
                      className="input pl-10"
                      {...formRegister('nom_centre')}
                    />
                  </div>
                  {errors.nom_centre && (
                    <p className="text-xs text-red-400 mt-1">{errors.nom_centre.message}</p>
                  )}
                </div>

                <div>
                  <label className="label" htmlFor="wilaya">Wilaya *</label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    <input
                      id="wilaya"
                      type="text"
                      placeholder="Ex: Alger / Oran / Setif"
                      className="input pl-10"
                      {...formRegister('wilaya')}
                    />
                  </div>
                  {errors.wilaya && (
                    <p className="text-xs text-red-400 mt-1">{errors.wilaya.message}</p>
                  )}
                </div>
              </div>

              <div className="mt-3">
                <label className="label" htmlFor="telephone">Téléphone du Centre (Optionnel)</label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  <input
                    id="telephone"
                    type="tel"
                    placeholder="Ex: 0550123456"
                    className="input pl-10"
                    {...formRegister('telephone')}
                  />
                </div>
                {errors.telephone && (
                  <p className="text-xs text-red-400 mt-1">{errors.telephone.message}</p>
                )}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Compte Directeur (Administrateur)</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="label" htmlFor="full_name">Nom et Prénom *</label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    <input
                      id="full_name"
                      type="text"
                      placeholder="Ex: Salim Larbi"
                      className="input pl-10"
                      {...formRegister('full_name')}
                    />
                  </div>
                  {errors.full_name && (
                    <p className="text-xs text-red-400 mt-1">{errors.full_name.message}</p>
                  )}
                </div>

                <div>
                  <label className="label" htmlFor="email">Email professionnel *</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    <input
                      id="email"
                      type="email"
                      placeholder="directeur@centre.dz"
                      className="input pl-10"
                      {...formRegister('email')}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label className="label" htmlFor="password">Mot de passe de connexion *</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    <input
                      id="password"
                      type="password"
                      placeholder="Minimum 8 caractères"
                      className="input pl-10"
                      {...formRegister('password')}
                    />
                  </div>
                  {errors.password && (
                    <p className="text-xs text-red-400 mt-1">{errors.password.message}</p>
                  )}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-4"
            >
              {isSubmitting ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : null}
              {isSubmitting ? 'Création du centre...' : 'Créer mon centre et m\'abonner'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-400 mt-6">
          Déjà inscrit ?{' '}
          <Link to="/app/login" className="text-primary-400 hover:text-primary-300 font-semibold underline underline-offset-4">
            Connectez-vous à votre espace centré
          </Link>
        </p>
      </div>
    </div>
  )
}
