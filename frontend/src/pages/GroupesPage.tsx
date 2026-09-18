import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { groupesApi, enseignantsApi, elevesApi } from '@/api'
import type { Groupe, Eleve } from '@/types'
import { BookOpen, Users, PlusCircle, Pencil, UserPlus, X, Trash2, Search } from 'lucide-react'

const NIVEAUX = ['1AP','2AP','3AP','4AP','5AP','1AM','2AM','3AM','4AM','1AS','2AS','3AS','Langues']
const MATIERES = ['Mathématiques','Physique','Arabe','Français','Anglais','Science','Histoire/Géo','Informatique','Autre']

const schema = z.object({
  nom: z.string().min(2, 'Requis'),
  matiere: z.string().min(1, 'Requis'),
  niveau: z.string().min(1, 'Requis'),
  capacite_max: z.coerce.number().min(1, 'Min 1').max(60, 'Max 60'),
  enseignant_id: z.coerce.number().optional().nullable(),
})
type GroupeForm = z.infer<typeof schema>

export default function GroupesPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingGroupe, setEditingGroupe] = useState<Groupe | null>(null)
  const [managingElevesGroupe, setManagingElevesGroupe] = useState<Groupe | null>(null)
  const [eleveSearch, setEleveSearch] = useState('')

  const { data: groupes, isLoading } = useQuery({
    queryKey: ['groupes'],
    queryFn: groupesApi.list,
  })

  const { data: enseignants } = useQuery({
    queryKey: ['enseignants'],
    queryFn: enseignantsApi.list,
  })

  const { data: allElevesData } = useQuery({
    queryKey: ['eleves', 'all'],
    queryFn: () => elevesApi.list({ page: 1 }),
    enabled: !!managingElevesGroupe,
  })

  const { data: groupeEleves, isLoading: isLoadingGroupeEleves } = useQuery({
    queryKey: ['groupe-eleves', managingElevesGroupe?.id],
    queryFn: () => (managingElevesGroupe ? groupesApi.getEleves(managingElevesGroupe.id) : Promise.resolve([])),
    enabled: !!managingElevesGroupe,
  })

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } =
    useForm<GroupeForm>({ resolver: zodResolver(schema) })

  const createMutation = useMutation({
    mutationFn: (data: GroupeForm) =>
      groupesApi.create({ ...data, enseignant_id: data.enseignant_id || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groupes'] })
      reset()
      setShowForm(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: GroupeForm }) =>
      groupesApi.update(id, { ...data, enseignant_id: data.enseignant_id || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groupes'] })
      reset()
      setEditingGroupe(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: groupesApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groupes'] }),
  })

  const addEleveMutation = useMutation({
    mutationFn: ({ groupeId, eleveId }: { groupeId: number; eleveId: number }) =>
      groupesApi.addEleve(groupeId, eleveId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groupe-eleves', managingElevesGroupe?.id] })
      qc.invalidateQueries({ queryKey: ['groupes'] })
    },
  })

  const removeEleveMutation = useMutation({
    mutationFn: ({ groupeId, eleveId }: { groupeId: number; eleveId: number }) =>
      groupesApi.removeEleve(groupeId, eleveId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groupe-eleves', managingElevesGroupe?.id] })
      qc.invalidateQueries({ queryKey: ['groupes'] })
    },
  })

  const handleOpenEdit = (groupe: Groupe) => {
    setEditingGroupe(groupe)
    setShowForm(false)
    setValue('nom', groupe.nom)
    setValue('matiere', groupe.matiere)
    setValue('niveau', groupe.niveau)
    setValue('capacite_max', groupe.capacite_max)
    setValue('enseignant_id', groupe.enseignant_id ?? null)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingGroupe(null)
    reset()
  }

  const onSubmitForm = (data: GroupeForm) => {
    if (editingGroupe) {
      updateMutation.mutate({ id: editingGroupe.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  // Filter available students to add to group
  const enrolledIds = new Set(groupeEleves?.map(e => e.id) ?? [])
  const availableEleves = allElevesData?.items?.filter(e =>
    !enrolledIds.has(e.id) &&
    (`${e.prenom} ${e.nom}`.toLowerCase().includes(eleveSearch.toLowerCase()) ||
     e.niveau.toLowerCase().includes(eleveSearch.toLowerCase()))
  ) ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-white">Gestion des Groupes</h1>
          <p className="text-slate-400 text-sm mt-1">
            {groupes?.length ?? 0} groupe{(groupes?.length ?? 0) > 1 ? 's' : ''} configurés
          </p>
        </div>
        <button
          onClick={() => {
            if (showForm || editingGroupe) {
              handleCloseForm()
            } else {
              reset()
              setEditingGroupe(null)
              setShowForm(true)
            }
          }}
          className="btn-primary flex items-center gap-2"
        >
          <PlusCircle className="w-4 h-4" />
          Nouveau groupe
        </button>
      </div>

      {/* Create / Edit Form */}
      {(showForm || editingGroupe) && (
        <div className="card border-primary-500/20 animate-fadeIn">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-heading font-semibold text-white">
              {editingGroupe ? `Modifier le groupe : ${editingGroupe.nom}` : 'Créer un nouveau groupe'}
            </h2>
            <button onClick={handleCloseForm} className="text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit(onSubmitForm)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Nom du groupe *</label>
              <input className="input" placeholder="Ex: Math 3AS Groupe A" {...register('nom')} />
              {errors.nom && <p className="text-xs text-red-400 mt-1">{errors.nom.message}</p>}
            </div>

            <div>
              <label className="label">Matière *</label>
              <select className="input" {...register('matiere')}>
                <option value="">Choisir...</option>
                {MATIERES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              {errors.matiere && <p className="text-xs text-red-400 mt-1">{errors.matiere.message}</p>}
            </div>

            <div>
              <label className="label">Niveau *</label>
              <select className="input" {...register('niveau')}>
                <option value="">Choisir...</option>
                {NIVEAUX.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              {errors.niveau && <p className="text-xs text-red-400 mt-1">{errors.niveau.message}</p>}
            </div>

            <div>
              <label className="label">Capacité max *</label>
              <input className="input" type="number" defaultValue={20} {...register('capacite_max')} />
              {errors.capacite_max && <p className="text-xs text-red-400 mt-1">{errors.capacite_max.message}</p>}
            </div>

            <div className="sm:col-span-2">
              <label className="label">Enseignant assigné (Changer d'enseignant)</label>
              <select className="input" {...register('enseignant_id')}>
                <option value="">— Sans enseignant —</option>
                {enseignants?.map(e => (
                  <option key={e.id} value={e.id}>{e.full_name}</option>
                ))}
              </select>
              {(!enseignants || enseignants.length === 0) && (
                <p className="text-xs text-slate-500 mt-1">Aucun enseignant disponible — ajoutez-en d'abord dans la page Enseignants.</p>
              )}
            </div>

            <div className="sm:col-span-2 flex gap-3 justify-end">
              <button type="button" onClick={handleCloseForm} className="btn-secondary">Annuler</button>
              <button type="submit" disabled={isSubmitting || createMutation.isPending || updateMutation.isPending} className="btn-primary">
                {editingGroupe
                  ? (updateMutation.isPending ? 'Modification...' : 'Enregistrer les modifications')
                  : (createMutation.isPending ? 'Création...' : 'Créer le groupe')}
              </button>
            </div>
          </form>
          {(createMutation.isError || updateMutation.isError) && (
            <p className="text-xs text-red-400 mt-2">Erreur lors de l'enregistrement. Vérifiez les champs.</p>
          )}
        </div>
      )}

      {/* Group cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card animate-pulse space-y-3">
                <div className="h-4 bg-white/5 rounded w-3/4" />
                <div className="h-3 bg-white/5 rounded w-1/2" />
                <div className="h-2 bg-white/5 rounded-full" />
              </div>
            ))
          : groupes?.map(g => {
              const pct = Math.round(((g.nombre_eleves ?? 0) / (g.capacite_max || 1)) * 100)
              const colorBar = pct >= 90 ? 'bg-amber-500' : 'bg-primary-500'
              return (
                <div key={g.id} className="card hover:border-primary-500/20 transition-colors group relative flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-white text-sm">{g.nom}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">{g.matiere} · {g.niveau}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(g)}
                          className="p-1 text-slate-400 hover:text-primary-400 transition-colors"
                          title="Modifier le groupe"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { if (confirm(`Supprimer le groupe "${g.nom}" ?`)) deleteMutation.mutate(g.id) }}
                          className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 mb-3">
                      Professeur : <span className="text-white font-medium">{g.enseignant_nom ?? 'Non assigné'}</span>
                    </p>

                    <div className="mb-4">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Users className="w-3 h-3" /> {g.nombre_eleves}/{g.capacite_max} places
                        </span>
                        <span className={pct >= 90 ? 'text-amber-400' : 'text-primary-400'}>{pct}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#1b2542] rounded-full overflow-hidden">
                        <div className={`h-full ${colorBar} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setManagingElevesGroupe(g)}
                    className="btn-secondary text-xs w-full flex items-center justify-center gap-1.5 py-2 mt-2"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Gérer les élèves ({g.nombre_eleves ?? 0})
                  </button>
                </div>
              )
            })
        }

        {!isLoading && (!groupes || groupes.length === 0) && (
          <div className="col-span-3 py-16 text-center">
            <BookOpen className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Aucun groupe créé. Cliquez sur <strong>"Nouveau groupe"</strong> pour commencer.</p>
          </div>
        )}
      </div>

      {/* Modal: Managing Students in Group */}
      {managingElevesGroupe && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-fadeIn">
            {/* Modal Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary-400" />
                  Gestion des Élèves — {managingElevesGroupe.nom}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {managingElevesGroupe.matiere} · {managingElevesGroupe.niveau} | {groupeEleves?.length ?? 0}/{managingElevesGroupe.capacite_max} élèves inscrits
                </p>
              </div>
              <button
                onClick={() => setManagingElevesGroupe(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Enrolled Students List */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Élèves actuellement dans ce groupe :</h3>
                {isLoadingGroupeEleves ? (
                  <p className="text-xs text-slate-400">Chargement des élèves...</p>
                ) : !groupeEleves || groupeEleves.length === 0 ? (
                  <div className="p-4 bg-white/5 rounded-xl text-center text-xs text-slate-400">
                    Aucun élève inscrit dans ce groupe pour le moment.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {groupeEleves.map(e => (
                      <div key={e.id} className="flex items-center justify-between bg-white/5 hover:bg-white/10 p-3 rounded-xl transition-colors">
                        <div>
                          <p className="text-sm font-medium text-white">{e.prenom} {e.nom}</p>
                          <p className="text-xs text-slate-400">{e.niveau} · {e.telephone_responsable}</p>
                        </div>
                        <button
                          onClick={() => removeEleveMutation.mutate({ groupeId: managingElevesGroupe.id, eleveId: e.id })}
                          disabled={removeEleveMutation.isPending}
                          className="text-slate-400 hover:text-red-400 text-xs px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                          title="Retirer du groupe"
                        >
                          Retirer
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add New Students Section */}
              <div className="border-t border-white/10 pt-4">
                <h3 className="text-sm font-semibold text-white mb-3">Ajouter un élève au groupe :</h3>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                  <input
                    className="input pl-10 text-xs py-2"
                    placeholder="Rechercher un élève du centre par nom ou niveau..."
                    value={eleveSearch}
                    onChange={e => setEleveSearch(e.target.value)}
                  />
                </div>

                {availableEleves.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">Aucun nouvel élève disponible à ajouter.</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                    {availableEleves.map(e => (
                      <div key={e.id} className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg text-xs">
                        <span className="text-slate-200">{e.prenom} {e.nom} <span className="text-slate-500">({e.niveau})</span></span>
                        <button
                          onClick={() => addEleveMutation.mutate({ groupeId: managingElevesGroupe.id, eleveId: e.id })}
                          disabled={addEleveMutation.isPending || (groupeEleves?.length ?? 0) >= managingElevesGroupe.capacite_max}
                          className="btn-primary py-1 px-3 text-xs"
                        >
                          + Ajouter
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-white/10 flex justify-end bg-white/2">
              <button
                onClick={() => setManagingElevesGroupe(null)}
                className="btn-secondary text-xs px-5"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
