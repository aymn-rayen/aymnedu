import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { enseignantsApi } from '@/api'
import { GraduationCap, Mail, Lock, UserPlus, Trash2 } from 'lucide-react'

const schema = z.object({
  full_name: z.string().min(3, 'Requis (min 3 caractères)'),
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Minimum 6 caractères'),
})
type EnseignantForm = z.infer<typeof schema>

export default function EnseignantsPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')

  const { data: enseignants, isLoading } = useQuery({
    queryKey: ['enseignants'],
    queryFn: enseignantsApi.list,
  })

  const { register, handleSubmit, reset, formState: { errors } } =
    useForm<EnseignantForm>({ resolver: zodResolver(schema) })

  const createMutation = useMutation({
    mutationFn: enseignantsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enseignants'] })
      reset()
      setShowForm(false)
      setError('')
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || "Erreur lors de la création.")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: enseignantsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['enseignants'] }),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-white">Enseignants</h1>
          <p className="text-slate-400 text-sm mt-1">
            {enseignants?.length ?? 0} enseignant{(enseignants?.length ?? 0) > 1 ? 's' : ''} enregistré{(enseignants?.length ?? 0) > 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="btn-primary flex items-center gap-2">
          <UserPlus className="w-4 h-4" />
          Ajouter un enseignant
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="card border-primary-500/20 animate-fadeIn">
          <h2 className="font-heading font-semibold text-white mb-4">Créer un compte enseignant</h2>
          <p className="text-xs text-slate-400 mb-4">L'enseignant pourra se connecter avec son email et ce mot de passe provisoire.</p>

          {error && (
            <div className="mb-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Nom complet *</label>
              <div className="relative">
                <GraduationCap className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input className="input pl-10" placeholder="Ex: Karim Belhouchet" {...register('full_name')} />
              </div>
              {errors.full_name && <p className="text-xs text-red-400 mt-1">{errors.full_name.message}</p>}
            </div>

            <div>
              <label className="label">Email de connexion *</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input className="input pl-10" type="email" placeholder="enseignant@centre.dz" {...register('email')} />
              </div>
              {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label">Mot de passe provisoire *</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input className="input pl-10" type="password" placeholder="Min. 6 caractères" {...register('password')} />
              </div>
              {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password.message}</p>}
            </div>

            <div className="sm:col-span-2 flex gap-3 justify-end">
              <button type="button" onClick={() => { setShowForm(false); setError('') }} className="btn-secondary">Annuler</button>
              <button type="submit" disabled={createMutation.isPending} className="btn-primary">
                {createMutation.isPending ? 'Création...' : 'Créer le compte'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Teachers list */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead className="bg-white/2">
            <tr>
              <th className="table-header">Nom complet</th>
              <th className="table-header">Email</th>
              <th className="table-header">Statut</th>
              <th className="table-header">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className="table-cell text-center text-slate-500 py-12">Chargement…</td></tr>
            ) : enseignants && enseignants.length > 0 ? (
              enseignants.map(e => (
                <tr key={e.id} className="table-row">
                  <td className="table-cell font-medium text-white flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary-500/20 border border-primary-500/30 flex items-center justify-center text-primary-400 font-bold text-xs">
                      {e.full_name[0].toUpperCase()}
                    </div>
                    {e.full_name}
                  </td>
                  <td className="table-cell text-slate-400">{e.email}</td>
                  <td className="table-cell">
                    <span className={e.is_active ? 'badge-success' : 'badge-danger'}>
                      {e.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="table-cell">
                    <button
                      onClick={() => { if (confirm(`Supprimer ${e.full_name} ?`)) deleteMutation.mutate(e.id) }}
                      className="text-slate-600 hover:text-red-400 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="py-16 text-center">
                  <GraduationCap className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">Aucun enseignant enregistré. Cliquez sur <strong>"Ajouter un enseignant"</strong>.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
