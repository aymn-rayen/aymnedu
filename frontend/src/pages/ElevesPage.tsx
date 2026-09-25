import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { elevesApi } from '@/api'
import type { Eleve, CreateEleveRequest } from '@/types'
import { UserPlus, Search, Users, Pencil, Trash2, X, ChevronLeft, ChevronRight } from 'lucide-react'

const schema = z.object({
  prenom: z.string().min(2, 'Requis'),
  nom: z.string().min(2, 'Requis'),
  telephone_responsable: z.string().min(9, 'Numéro invalide'),
  niveau: z.string().min(2, 'Requis'),
  statut: z.enum(['actif', 'inactif']).optional(),
})
type EleveFormData = z.infer<typeof schema>

export default function ElevesPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [editingEleve, setEditingEleve] = useState<Eleve | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['eleves', search, page],
    queryFn: () => elevesApi.list({ q: search, page }),
  })

  // Create Form
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EleveFormData>({ resolver: zodResolver(schema) })

  // Edit Form
  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
    formState: { errors: editErrors, isSubmitting: isSubmittingEdit },
  } = useForm<EleveFormData>({ resolver: zodResolver(schema) })

  const createMutation = useMutation({
    mutationFn: elevesApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eleves'] })
      reset()
      setShowForm(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateEleveRequest> }) =>
      elevesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eleves'] })
      setEditingEleve(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: elevesApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eleves'] })
    },
  })

  const handleOpenEdit = (eleve: Eleve) => {
    setEditingEleve(eleve)
    resetEdit({
      prenom: eleve.prenom,
      nom: eleve.nom,
      telephone_responsable: eleve.telephone_responsable || '',
      niveau: eleve.niveau,
      statut: eleve.statut as any,
    })
  }

  const handleDelete = (eleve: Eleve) => {
    if (confirm(`Êtes-vous sûr de vouloir archiver l'élève "${eleve.prenom} ${eleve.nom}" ?`)) {
      deleteMutation.mutate(eleve.id)
    }
  }

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

      {/* Inline Form (Ajout) */}
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

      {/* Modal Edition */}
      {editingEleve && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="card w-full max-w-lg bg-[#0f172a] border border-primary-500/30 p-6 relative">
            <button
              onClick={() => setEditingEleve(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="font-heading text-lg font-bold text-white mb-4">Modifier l'élève</h2>
            <form
              onSubmit={handleSubmitEdit(d => updateMutation.mutate({ id: editingEleve.id, data: d }))}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              <div>
                <label className="label">Prénom</label>
                <input className="input" {...registerEdit('prenom')} />
                {editErrors.prenom && <p className="text-xs text-red-400 mt-1">{editErrors.prenom.message}</p>}
              </div>
              <div>
                <label className="label">Nom</label>
                <input className="input" {...registerEdit('nom')} />
                {editErrors.nom && <p className="text-xs text-red-400 mt-1">{editErrors.nom.message}</p>}
              </div>
              <div>
                <label className="label">Téléphone responsable</label>
                <input className="input" {...registerEdit('telephone_responsable')} />
                {editErrors.telephone_responsable && <p className="text-xs text-red-400 mt-1">{editErrors.telephone_responsable.message}</p>}
              </div>
              <div>
                <label className="label">Niveau</label>
                <select className="input" {...registerEdit('niveau')}>
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
              </div>
              <div className="sm:col-span-2">
                <label className="label">Statut</label>
                <select className="input" {...registerEdit('statut')}>
                  <option value="actif">Actif</option>
                  <option value="inactif">Inactif</option>
                </select>
              </div>
              <div className="sm:col-span-2 flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setEditingEleve(null)} className="btn-secondary">
                  Annuler
                </button>
                <button type="submit" disabled={isSubmittingEdit} className="btn-primary">
                  {isSubmittingEdit ? 'Enregistrement…' : 'Mettre à jour'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        <input
          className="input pl-10"
          placeholder="Rechercher un élève..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
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
              <th className="table-header text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="table-cell text-center text-slate-500 py-12">Chargement…</td></tr>
            ) : data?.items?.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center">
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
                <td className="table-cell text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleOpenEdit(eleve)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-primary-400 hover:bg-primary-500/10 transition-colors"
                      title="Modifier"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(eleve)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Archiver"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination bar */}
        {data && data.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5 bg-white/2">
            <span className="text-xs text-slate-400">
              Page {data.page} sur {data.pages} ({data.total} élève{data.total > 1 ? 's' : ''})
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1 disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Précédent
              </button>
              <button
                onClick={() => setPage(p => Math.min(data.pages, p + 1))}
                disabled={page >= data.pages}
                className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1 disabled:opacity-40"
              >
                Suivant <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
