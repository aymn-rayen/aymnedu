import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { elevesApi } from '@/api'
import type { CreateEleveRequest } from '@/types'
import { UserPlus, Search, Users } from 'lucide-react'

const schema = z.object({
  prenom: z.string().min(2, 'Requis'),
  nom: z.string().min(2, 'Requis'),
  telephone_responsable: z.string().min(9, 'Numéro invalide'),
  niveau: z.string().min(2, 'Requis'),
})

export default function ElevesPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['eleves', search],
    queryFn: () => elevesApi.list({ q: search }),
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateEleveRequest>({ resolver: zodResolver(schema) })

  const createMutation = useMutation({
    mutationFn: elevesApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eleves'] })
      reset()
      setShowForm(false)
    },
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-white">Gestion des Élèves</h1>
          <p className="text-slate-400 text-sm mt-1">
            {data?.total ?? 0} élève{(data?.total ?? 0) > 1 ? 's' : ''} inscrits
          </p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="btn-primary flex items-center gap-2">
          <UserPlus className="w-4 h-4" />
          Nouvel élève
        </button>
      </div>

      {/* Inline Form */}
      {showForm && (
        <div className="card border-primary-500/20 animate-fadeIn">
          <h2 className="font-heading font-semibold text-white mb-4">Inscrire un élève</h2>
          <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Prénom</label>
              <input className="input" placeholder="Amina" {...register('prenom')} />
              {errors.prenom && <p className="text-xs text-red-400 mt-1">{errors.prenom.message}</p>}
            </div>
            <div>
              <label className="label">Nom</label>
              <input className="input" placeholder="Benali" {...register('nom')} />
              {errors.nom && <p className="text-xs text-red-400 mt-1">{errors.nom.message}</p>}
            </div>
            <div>
              <label className="label">Téléphone responsable</label>
              <input className="input" placeholder="0550 12 34 56" {...register('telephone_responsable')} />
              {errors.telephone_responsable && <p className="text-xs text-red-400 mt-1">{errors.telephone_responsable.message}</p>}
            </div>
            <div>
              <label className="label">Niveau scolaire</label>
              <select className="input" {...register('niveau')}>
                <option value="">Choisir...</option>
                <optgroup label="Primaire">
                  {['1AP','2AP','3AP','4AP','5AP'].map(n => <option key={n} value={n}>{n}</option>)}
                </optgroup>
                <optgroup label="Moyen (BEM)">
                  {['1AM','2AM','3AM','4AM'].map(n => <option key={n} value={n}>{n}</option>)}
                </optgroup>
                <optgroup label="Lycée (BAC)">
                  {['1AS','2AS','3AS'].map(n => <option key={n} value={n}>{n}</option>)}
                </optgroup>
                <optgroup label="Langues">
                  <option value="Arabe">Arabe</option>
                  <option value="Anglais">Anglais</option>
                  <option value="Français">Français</option>
                </optgroup>
              </select>
              {errors.niveau && <p className="text-xs text-red-400 mt-1">{errors.niveau.message}</p>}
            </div>
            <div className="sm:col-span-2 flex gap-3 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Annuler</button>
              <button type="submit" disabled={isSubmitting} className="btn-primary">
                {isSubmitting ? 'Enregistrement…' : 'Inscrire l\'élève'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        <input
          className="input pl-10"
          placeholder="Rechercher un élève..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead className="bg-white/2">
            <tr>
              <th className="table-header">Nom complet</th>
              <th className="table-header">Niveau</th>
              <th className="table-header">Téléphone</th>
              <th className="table-header">Statut</th>
              <th className="table-header">Inscription</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="table-cell text-center text-slate-500 py-12">Chargement…</td></tr>
            ) : data?.items?.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-16 text-center">
                  <Users className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">Aucun élève trouvé.</p>
                </td>
              </tr>
            ) : data?.items?.map(eleve => (
              <tr key={eleve.id} className="table-row">
                <td className="table-cell font-medium text-white">{eleve.prenom} {eleve.nom}</td>
                <td className="table-cell">{eleve.niveau}</td>
                <td className="table-cell">{eleve.telephone_responsable}</td>
                <td className="table-cell">
                  <span className={eleve.statut === 'actif' ? 'badge-success' : 'badge-danger'}>
                    {eleve.statut === 'actif' ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td className="table-cell">{new Date(eleve.date_inscription).toLocaleDateString('fr-DZ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
