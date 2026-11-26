import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { elevesApi, groupesApi } from '@/api'
import type { Eleve, InscriptionCompleteResponse } from '@/types'
import {
  UserPlus, Search, Users, Pencil, Trash2, X, ChevronLeft, ChevronRight,
  CheckCircle2, CreditCard, BookOpen, Receipt, Banknote, ShieldCheck
} from 'lucide-react'

const schema = z.object({
  prenom: z.string().min(2, 'Le prénom est requis (min 2 caractères)'),
  nom: z.string().min(2, 'Le nom est requis (min 2 caractères)'),
  telephone_responsable: z.string().min(9, 'Numéro de téléphone requis (ex: 0550 12 34 56)'),
  niveau: z.string().min(2, 'Veuillez sélectionner un niveau scolaire'),
})
type EleveFormData = z.infer<typeof schema>

const schemaEdit = schema.extend({
  statut: z.enum(['actif', 'inactif']).optional(),
})
type EleveEditFormData = z.infer<typeof schemaEdit>

export default function ElevesPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [editingEleve, setEditingEleve] = useState<Eleve | null>(null)

  // ── Tout-en-Un : État des groupes & Encaissement ────────────────────────────
  const [selectedGroupeIds, setSelectedGroupeIds] = useState<number[]>([])
  const [encaisserMaintenant, setEncaisserMaintenant] = useState(false)
  const [modeReglement, setModeReglement] = useState<'especes' | 'baridimob'>('especes')
  const [montantVerseCustom, setMontantVerseCustom] = useState<string>('')
  const [successInfo, setSuccessInfo] = useState<InscriptionCompleteResponse | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  // Récupération des élèves paginés
  const { data, isLoading } = useQuery({
    queryKey: ['eleves', search, page],
    queryFn: () => elevesApi.list({ q: search, page }),
  })

  // Récupération des groupes pour l'inscription Tout-en-un
  const { data: groupes } = useQuery({
    queryKey: ['groupes'],
    queryFn: groupesApi.list,
  })

  // Formulaire d'inscription
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EleveFormData>({ resolver: zodResolver(schema) })

  const currentNiveau = watch('niveau')

  // Groupes filtrés par pertinence de niveau
  const availableGroupes = (groupes || []).filter(g => !currentNiveau || g.niveau === currentNiveau || g.niveau === 'Langues')
  const otherGroupes = (groupes || []).filter(g => currentNiveau && g.niveau !== currentNiveau && g.niveau !== 'Langues')

  // Calcul dynamique du total des tarifs
  const totalTarif = selectedGroupeIds.reduce((sum, gid) => {
    const grp = (groupes || []).find(g => g.id === gid)
    return sum + (grp?.tarif ?? 2500)
  }, 0)

  // Formulaire d'édition
  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
    formState: { errors: editErrors, isSubmitting: isSubmittingEdit },
  } = useForm<EleveEditFormData>({ resolver: zodResolver(schemaEdit) })

  // Mutation Inscription Tout-en-Un
  const inscriptionMutation = useMutation({
    mutationFn: (formData: EleveFormData) => {
      setFormError(null)
      const verse = encaisserMaintenant
        ? (montantVerseCustom ? parseFloat(montantVerseCustom) : totalTarif)
        : 0

      return elevesApi.inscriptionComplete({
        prenom: formData.prenom,
        nom: formData.nom,
        telephone_responsable: formData.telephone_responsable,
        niveau: formData.niveau,
        groupe_ids: selectedGroupeIds,
        encaisser_maintenant: encaisserMaintenant,
        montant_verse: verse,
        mode_reglement: modeReglement,
      })
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['eleves'] })
      qc.invalidateQueries({ queryKey: ['groupes'] })
      qc.invalidateQueries({ queryKey: ['paiements'] })
      setSuccessInfo(res)
      reset()
      setSelectedGroupeIds([])
      setEncaisserMaintenant(false)
      setMontantVerseCustom('')
      setShowForm(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.detail ?? "Erreur lors de l'inscription.")
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<EleveEditFormData> }) =>
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

  const toggleGroupe = (id: number) => {
    setSelectedGroupeIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  return (
    <div className="space-y-6 text-[#1E293B]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#1E293B]">Gestion des Élèves</h1>
          <p className="text-[#64748B] text-sm mt-1">
            {data?.total ?? 0} élève{(data?.total ?? 0) > 1 ? 's' : ''} inscrits dans l'établissement
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(v => !v)
            setSuccessInfo(null)
            setFormError(null)
          }}
          className="btn-primary flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          {showForm ? 'Fermer le formulaire' : 'Inscrire un élève (Tout-en-un)'}
        </button>
      </div>

      {/* Bannière de confirmation de l'inscription précédente */}
      {successInfo && (
        <div className="card bg-emerald-50 border-emerald-200 border p-5 animate-fadeIn">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-bold text-emerald-900 text-base">
                  Inscription réussie : {successInfo.eleve.prenom} {successInfo.eleve.nom} ({successInfo.eleve.niveau})
                </h3>
                <button onClick={() => setSuccessInfo(null)} className="text-emerald-700 hover:text-emerald-900">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-emerald-800 text-xs mt-1">
                L'élève a été inscrit avec succès dans{' '}
                <strong>{successInfo.groupes_inscrits.length} groupe{successInfo.groupes_inscrits.length > 1 ? 's' : ''}</strong>.
              </p>

              {/* Détails financiers */}
              <div className="mt-3 flex flex-wrap gap-3 items-center text-xs">
                <span className="bg-white/80 border border-emerald-200 px-2.5 py-1 rounded-lg font-medium text-emerald-950">
                  Tarif total : {successInfo.total_tarif.toLocaleString('fr-DZ')} DA
                </span>
                <span className="bg-emerald-600 text-white px-2.5 py-1 rounded-lg font-semibold">
                  Encaissé : {successInfo.total_verse.toLocaleString('fr-DZ')} DA
                </span>
                {successInfo.reste_a_payer > 0 ? (
                  <span className="bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-1 rounded-lg font-semibold">
                    Reste dû : {successInfo.reste_a_payer.toLocaleString('fr-DZ')} DA
                  </span>
                ) : (
                  <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Mois soldé
                  </span>
                )}
                {successInfo.recu_numero && (
                  <span className="bg-blue-50 text-[#2563EB] border border-blue-200 px-2.5 py-1 rounded-lg font-mono font-bold flex items-center gap-1">
                    <Receipt className="w-3.5 h-3.5" /> Reçu : {successInfo.recu_numero}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Formulaire Inscription Tout-en-Un */}
      {showForm && (
        <div className="card border-blue-200 bg-white shadow-lg animate-fadeIn p-6">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3 mb-5">
            <div>
              <h2 className="font-heading font-bold text-lg text-[#1E293B]">
                Inscription Complète d'un Élève (Tout-en-Un)
              </h2>
              <p className="text-xs text-[#64748B]">
                Crée la fiche élève, affecte les groupes avec leurs tarifs officiels et enregistre le règlement en 1 seul clic.
              </p>
            </div>
            <button onClick={() => setShowForm(false)} className="text-[#64748B] hover:text-[#1E293B]">
              <X className="w-5 h-5" />
            </button>
          </div>

          {formError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center justify-between">
              <span>{formError}</span>
              <button onClick={() => setFormError(null)}><X className="w-3.5 h-3.5" /></button>
            </div>
          )}

          <form onSubmit={handleSubmit(d => inscriptionMutation.mutate(d))} className="space-y-6">
            {/* Section 1 : Identité de l'élève */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#2563EB] mb-3 flex items-center gap-1.5">
                <Users className="w-4 h-4" /> 1. Informations de l'Élève
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="label">Prénom *</label>
                  <input className="input" placeholder="ex: Amine" {...register('prenom')} />
                  {errors.prenom && <p className="text-xs text-red-500 mt-1">{errors.prenom.message}</p>}
                </div>
                <div>
                  <label className="label">Nom *</label>
                  <input className="input" placeholder="ex: Haddad" {...register('nom')} />
                  {errors.nom && <p className="text-xs text-red-500 mt-1">{errors.nom.message}</p>}
                </div>
                <div>
                  <label className="label">Téléphone du responsable *</label>
                  <input className="input" placeholder="0550 12 34 56" {...register('telephone_responsable')} />
                  {errors.telephone_responsable && <p className="text-xs text-red-500 mt-1">{errors.telephone_responsable.message}</p>}
                </div>
                <div>
                  <label className="label">Niveau scolaire *</label>
                  <select className="input font-medium" {...register('niveau')}>
                    <option value="">Sélectionner le niveau...</option>
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
                  {errors.niveau && <p className="text-xs text-red-500 mt-1">{errors.niveau.message}</p>}
                </div>
              </div>
            </div>

            {/* Section 2 : Affectation aux Groupes */}
            <div className="border-t border-[#E2E8F0] pt-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#2563EB] flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" /> 2. Inscription aux Groupes de Soutien
                </h3>
                <span className="text-xs text-[#64748B]">
                  {selectedGroupeIds.length} groupe{selectedGroupeIds.length > 1 ? 's' : ''} sélectionné{selectedGroupeIds.length > 1 ? 's' : ''}
                </span>
              </div>

              {!groupes || groupes.length === 0 ? (
                <div className="p-4 bg-slate-50 border border-[#E2E8F0] rounded-xl text-center text-xs text-[#64748B]">
                  Aucun groupe n'est encore configuré dans l'école. Rendez-vous dans l'onglet "Groupes" pour créer vos premiers cours avec leurs tarifs.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {availableGroupes.map(g => {
                      const isSelected = selectedGroupeIds.includes(g.id)
                      return (
                        <div
                          key={g.id}
                          onClick={() => toggleGroupe(g.id)}
                          className={`cursor-pointer border rounded-xl p-3 transition-all select-none ${
                            isSelected
                              ? 'border-[#2563EB] bg-blue-50/70 ring-1 ring-[#2563EB]'
                              : 'border-[#E2E8F0] bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-semibold text-sm text-[#1E293B]">{g.nom}</p>
                              <p className="text-xs text-[#64748B] mt-0.5">{g.matiere} · {g.niveau}</p>
                            </div>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}} // géré par le parent div
                              className="rounded text-[#2563EB] focus:ring-blue-400 mt-1"
                            />
                          </div>
                          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                            <span className="text-[#64748B]">{g.nombre_eleves}/{g.capacite_max} places</span>
                            <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              {(g.tarif ?? 2500).toLocaleString('fr-DZ')} DA/m
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Autres groupes si niveau différent */}
                  {otherGroupes.length > 0 && currentNiveau && (
                    <details className="mt-2">
                      <summary className="text-xs text-[#64748B] cursor-pointer hover:text-[#1E293B] font-medium">
                        Voir les groupes des autres niveaux ({otherGroupes.length})
                      </summary>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                        {otherGroupes.map(g => {
                          const isSelected = selectedGroupeIds.includes(g.id)
                          return (
                            <div
                              key={g.id}
                              onClick={() => toggleGroupe(g.id)}
                              className={`cursor-pointer border rounded-xl p-3 transition-all select-none opacity-80 hover:opacity-100 ${
                                isSelected
                                  ? 'border-[#2563EB] bg-blue-50/70 ring-1 ring-[#2563EB]'
                                  : 'border-[#E2E8F0] bg-slate-50'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="font-semibold text-xs text-[#1E293B]">{g.nom}</p>
                                  <p className="text-[11px] text-[#64748B]">{g.matiere} · {g.niveau}</p>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {}}
                                  className="rounded text-[#2563EB] mt-1"
                                />
                              </div>
                              <div className="mt-2 flex justify-between text-[11px]">
                                <span>{g.nombre_eleves}/{g.capacite_max}</span>
                                <span className="font-bold text-emerald-600">{(g.tarif ?? 2500).toLocaleString('fr-DZ')} DA</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>

            {/* Section 3 : Encaissement au Guichet (Optionnel mais recommandé) */}
            <div className="border-t border-[#E2E8F0] pt-5">
              <div className="bg-slate-50 border border-[#E2E8F0] rounded-2xl p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E293B] flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-emerald-600" /> 3. Règlement Financier
                    </h3>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      Total mensuel calculé pour les cours choisis :{' '}
                      <span className="font-bold text-sm text-[#1E293B] ml-1">
                        {totalTarif.toLocaleString('fr-DZ')} DA
                      </span>
                    </p>
                  </div>

                  <label className="flex items-center gap-2.5 cursor-pointer select-none bg-white px-3.5 py-2 rounded-xl border border-[#E2E8F0] hover:border-emerald-400 transition-colors shadow-2xs">
                    <input
                      type="checkbox"
                      checked={encaisserMaintenant}
                      onChange={e => setEncaisserMaintenant(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-400 w-4 h-4"
                    />
                    <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                      <Banknote className="w-3.5 h-3.5" /> Encaisser le 1er mois maintenant
                    </span>
                  </label>
                </div>

                {encaisserMaintenant && (
                  <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fadeIn">
                    <div>
                      <label className="label">Montant perçu (DA)</label>
                      <input
                        type="number"
                        step="100"
                        className="input font-bold text-emerald-700 text-base"
                        placeholder={totalTarif.toString()}
                        value={montantVerseCustom}
                        onChange={e => setMontantVerseCustom(e.target.value)}
                      />
                      <p className="text-[11px] text-[#64748B] mt-1">
                        Laissez vide pour encaisser la totalité ({totalTarif.toLocaleString('fr-DZ')} DA) ou saisissez un acompte partiel.
                      </p>
                    </div>

                    <div>
                      <label className="label">Mode de règlement</label>
                      <select
                        className="input"
                        value={modeReglement}
                        onChange={e => setModeReglement(e.target.value as any)}
                      >
                        <option value="especes">💵 Espèces (Comptoir)</option>
                        <option value="baridimob">📱 BaridiMob / Virement</option>
                      </select>
                      <p className="text-[11px] text-[#64748B] mt-1">
                        Un numéro de reçu unique sera émis pour la caisse de la journée.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Boutons d'action */}
            <div className="flex gap-3 justify-end items-center pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn-secondary"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSubmitting || inscriptionMutation.isPending}
                className="btn-primary py-2.5 px-6 flex items-center gap-2"
              >
                {inscriptionMutation.isPending ? (
                  'Enregistrement en cours…'
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Valider l'inscription {encaisserMaintenant && `& Encaisser`}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Edition d'un élève */}
      {editingEleve && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="card w-full max-w-lg bg-white border border-[#E2E8F0] shadow-xl p-6 relative">
            <button
              onClick={() => setEditingEleve(null)}
              className="absolute top-4 right-4 text-[#64748B] hover:text-[#1E293B]"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="font-heading text-lg font-bold text-[#1E293B] mb-4">Modifier l'élève</h2>
            <form
              onSubmit={handleSubmitEdit(d => updateMutation.mutate({ id: editingEleve.id, data: d }))}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              <div>
                <label className="label">Prénom</label>
                <input className="input" {...registerEdit('prenom')} />
                {editErrors.prenom && <p className="text-xs text-red-500 mt-1">{editErrors.prenom.message}</p>}
              </div>
              <div>
                <label className="label">Nom</label>
                <input className="input" {...registerEdit('nom')} />
                {editErrors.nom && <p className="text-xs text-red-500 mt-1">{editErrors.nom.message}</p>}
              </div>
              <div>
                <label className="label">Téléphone responsable</label>
                <input className="input" {...registerEdit('telephone_responsable')} />
                {editErrors.telephone_responsable && <p className="text-xs text-red-500 mt-1">{editErrors.telephone_responsable.message}</p>}
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

      {/* Barre de Recherche rapide */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B] pointer-events-none" />
        <input
          className="input pl-10"
          placeholder="Rechercher un élève (nom, prénom)..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {/* Table des élèves */}
      <div className="card p-0 overflow-hidden bg-white shadow-xs border border-[#E2E8F0]">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header">Nom complet</th>
              <th className="table-header">Niveau</th>
              <th className="table-header">Téléphone Responsable</th>
              <th className="table-header">Statut</th>
              <th className="table-header">Date d'inscription</th>
              <th className="table-header text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="table-cell text-center text-[#64748B] py-12">Chargement…</td></tr>
            ) : data?.items?.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-[#64748B] text-sm">Aucun élève trouvé.</p>
                </td>
              </tr>
            ) : data?.items?.map(eleve => (
              <tr key={eleve.id} className="table-row">
                <td className="table-cell font-semibold text-[#1E293B]">{eleve.prenom} {eleve.nom}</td>
                <td className="table-cell">{eleve.niveau}</td>
                <td className="table-cell text-[#64748B]">{eleve.telephone_responsable}</td>
                <td className="table-cell">
                  <span className={eleve.statut === 'actif' ? 'badge-success' : 'badge-danger'}>
                    {eleve.statut === 'actif' ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td className="table-cell text-[#64748B]">{new Date(eleve.date_inscription).toLocaleDateString('fr-DZ')}</td>
                <td className="table-cell text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => handleOpenEdit(eleve)}
                      className="p-1.5 rounded-lg text-[#64748B] hover:text-[#2563EB] hover:bg-blue-50 transition-colors"
                      title="Modifier"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(eleve)}
                      className="p-1.5 rounded-lg text-[#64748B] hover:text-red-600 hover:bg-red-50 transition-colors"
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
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#E2E8F0] bg-slate-50">
            <span className="text-xs text-[#64748B]">
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
