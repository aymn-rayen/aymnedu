import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { utilisateursApi } from '@/api'
import type { Utilisateur } from '@/types'
import {
  ShieldCheck, UserCircle2, BookOpenCheck, PlusCircle, Trash2,
  KeyRound, Eye, EyeOff, X, CheckCircle2, AlertTriangle, Users2
} from 'lucide-react'

const ROLES = [
  { value: 'directeur', label: 'Directeur / Admin', icon: ShieldCheck, color: 'text-violet-400 bg-violet-500/15 border-violet-500/30' },
  { value: 'secretaire', label: 'Secrétaire', icon: UserCircle2, color: 'text-sky-400 bg-sky-500/15 border-sky-500/30' },
  { value: 'enseignant', label: 'Enseignant', icon: BookOpenCheck, color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30' },
]

const createSchema = z.object({
  full_name: z.string().min(2, 'Nom requis (min 2 caractères)'),
  email: z.string().email('Email invalide'),
  password: z.string().min(4, 'Mot de passe trop court (min 4 caractères)'),
  role: z.enum(['directeur', 'secretaire', 'enseignant']),
})

const passwordSchema = z.object({
  password: z.string().min(4, 'Min 4 caractères'),
})

type CreateForm = z.infer<typeof createSchema>
type PasswordForm = z.infer<typeof passwordSchema>

export default function RolesPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [resetTarget, setResetTarget] = useState<Utilisateur | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showResetPwd, setShowResetPwd] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const notify = (type: 'success' | 'error', msg: string) => {
    setFeedback({ type, msg })
    setTimeout(() => setFeedback(null), 5000)
  }

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['utilisateurs'],
    queryFn: utilisateursApi.list,
  })

  const createForm = useForm<CreateForm>({ resolver: zodResolver(createSchema), defaultValues: { role: 'secretaire' } })
  const pwdForm = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) })

  const createMutation = useMutation({
    mutationFn: utilisateursApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['utilisateurs'] })
      createForm.reset()
      setShowForm(false)
      notify('success', 'Accès créé avec succès !')
    },
    onError: (err: any) => notify('error', err?.response?.data?.detail || 'Erreur lors de la création'),
  })

  const resetMutation = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      utilisateursApi.resetPassword(id, password),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['utilisateurs'] })
      setResetTarget(null)
      pwdForm.reset()
      notify('success', 'Mot de passe réinitialisé !')
    },
    onError: (err: any) => notify('error', err?.response?.data?.detail || 'Erreur'),
  })

  const deleteMutation = useMutation({
    mutationFn: utilisateursApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['utilisateurs'] })
      notify('success', 'Accès supprimé.')
    },
    onError: (err: any) => notify('error', err?.response?.data?.detail || 'Erreur lors de la suppression'),
  })

  const handleDelete = (u: Utilisateur) => {
    if (confirm(`Supprimer l'accès de ${u.full_name} (${u.role}) ?`)) {
      deleteMutation.mutate(u.id)
    }
  }

  // Group users by role
  const grouped = ROLES.map(r => ({
    ...r,
    users: users.filter(u => u.role === r.value),
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-white flex items-center gap-2">
            <Users2 className="w-6 h-6 text-primary-400" />
            Gestion des Accès
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Créez et gérez les profils de connexion de votre équipe
          </p>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); createForm.reset() }}
          className="btn-primary flex items-center gap-2"
        >
          <PlusCircle className="w-4 h-4" />
          Ajouter un accès
        </button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm animate-fadeIn ${
          feedback.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border-red-500/30 text-red-300'
        }`}>
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-red-400" />}
            <span className="font-medium">{feedback.msg}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <div className="card border-primary-500/20 animate-fadeIn">
          <h2 className="font-heading font-semibold text-white mb-5 flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-primary-400" />
            Nouvel accès
          </h2>

          <form onSubmit={createForm.handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
            {/* Role selector */}
            <div>
              <label className="label">Rôle / Profil *</label>
              <div className="grid grid-cols-3 gap-2">
                {ROLES.map(r => {
                  const Icon = r.icon
                  const selected = createForm.watch('role') === r.value
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => createForm.setValue('role', r.value as any)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all ${
                        selected ? `${r.color} ring-1 ring-offset-0` : 'bg-white/3 border-white/8 text-slate-500 hover:border-white/20'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {r.label}
                    </button>
                  )
                })}
              </div>
              {createForm.formState.errors.role && (
                <p className="text-xs text-red-400 mt-1">{createForm.formState.errors.role.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Nom complet *</label>
                <input
                  className="input"
                  placeholder="Ex: Amina Boudiaf"
                  {...createForm.register('full_name')}
                />
                {createForm.formState.errors.full_name && (
                  <p className="text-xs text-red-400 mt-1">{createForm.formState.errors.full_name.message}</p>
                )}
              </div>

              <div>
                <label className="label">Email *</label>
                <input
                  className="input"
                  type="email"
                  placeholder="amina@moncentre.dz"
                  {...createForm.register('email')}
                />
                {createForm.formState.errors.email && (
                  <p className="text-xs text-red-400 mt-1">{createForm.formState.errors.email.message}</p>
                )}
              </div>
            </div>

            <div>
              <label className="label">Mot de passe *</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Minimum 4 caractères"
                  {...createForm.register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {createForm.formState.errors.password && (
                <p className="text-xs text-red-400 mt-1">{createForm.formState.errors.password.message}</p>
              )}
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Annuler</button>
              <button type="submit" disabled={createMutation.isPending} className="btn-primary">
                {createMutation.isPending ? 'Création…' : 'Créer l\'accès'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users grouped by role */}
      {isLoading ? (
        <div className="card py-12 text-center text-slate-500 text-sm">Chargement…</div>
      ) : (
        <div className="space-y-4">
          {grouped.map(group => {
            const Icon = group.icon
            return (
              <div key={group.value} className="card">
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/5">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-semibold ${group.color}`}>
                    <Icon className="w-4 h-4" />
                    {group.label}
                  </div>
                  <span className="text-xs text-slate-600">{group.users.length} compte{group.users.length > 1 ? 's' : ''}</span>
                </div>

                {group.users.length === 0 ? (
                  <p className="text-slate-600 text-sm py-2">
                    Aucun compte « {group.label} » — cliquez sur <strong className="text-slate-500">Ajouter un accès</strong> pour en créer un.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {group.users.map(u => (
                      <div
                        key={u.id}
                        className="flex items-center justify-between px-4 py-3 rounded-xl border border-white/5 hover:border-white/10 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center text-sm font-bold text-slate-300">
                            {u.full_name[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">{u.full_name}</p>
                            <p className="text-xs text-slate-500">{u.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { setResetTarget(u); pwdForm.reset() }}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:border-white/25 transition-all"
                            title="Réinitialiser le mot de passe"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            Mot de passe
                          </button>
                          <button
                            onClick={() => handleDelete(u)}
                            disabled={deleteMutation.isPending}
                            className="p-2 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                            title="Supprimer l'accès"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Reset Password Modal */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d1220] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-heading font-semibold text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400" />
                Réinitialiser le mot de passe
              </h3>
              <button onClick={() => setResetTarget(null)} className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-slate-400 mb-4">
              Nouveau mot de passe pour <strong className="text-white">{resetTarget.full_name}</strong>
            </p>

            <form onSubmit={pwdForm.handleSubmit(d => resetMutation.mutate({ id: resetTarget.id, password: d.password }))} className="space-y-4">
              <div>
                <div className="relative">
                  <input
                    className="input pr-10"
                    type={showResetPwd ? 'text' : 'password'}
                    placeholder="Nouveau mot de passe…"
                    autoFocus
                    {...pwdForm.register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showResetPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {pwdForm.formState.errors.password && (
                  <p className="text-xs text-red-400 mt-1">{pwdForm.formState.errors.password.message}</p>
                )}
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setResetTarget(null)} className="btn-secondary flex-1">Annuler</button>
                <button type="submit" disabled={resetMutation.isPending} className="btn-primary flex-1">
                  {resetMutation.isPending ? 'Enregistrement…' : 'Confirmer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
