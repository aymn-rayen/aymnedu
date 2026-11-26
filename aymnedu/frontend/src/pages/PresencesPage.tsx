import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { groupesApi, presencesApi } from '@/api'
import {
  ClipboardCheck,
  Save,
  CheckCircle2,
  AlertTriangle,
  X,
  CheckCheck,
  Users,
  UserPlus,
  CalendarDays,
  Table2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Printer,
  Calendar,
} from 'lucide-react'
import type { Presence } from '@/types'

type ViewMode = 'jour' | 'mensuel'
type StatutPresence = Presence['statut']

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const label = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(
    new Date(y, m - 1, 1)
  )
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function formatDateHeader(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const weekday = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' })
    .format(dt)
    .replace('.', '')
  return {
    weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1),
    day: String(d).padStart(2, '0'),
    month: String(m).padStart(2, '0'),
  }
}

function nextStatut(current: StatutPresence | null | undefined): StatutPresence {
  if (!current) return 'present'
  if (current === 'present') return 'absent'
  if (current === 'absent') return 'retard'
  return 'present'
}

export default function PresencesPage() {
  const [mode, setMode] = useState<ViewMode>('mensuel')
  const [selectedGroupe, setSelectedGroupe] = useState<number | null>(null)
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [mois, setMois] = useState(() => new Date().toISOString().slice(0, 7))

  // Edits pour l'appel du jour
  const [statuts, setStatuts] = useState<Record<number, StatutPresence>>({})
  // Edits pour la grille mensuelle : clé `${eleve_id}_${dateStr}`
  const [gridEdits, setGridEdits] = useState<Record<string, StatutPresence>>({})
  // Séances ajoutées manuellement dans la grille : clé `${groupeId}_${mois}`
  const [extraDatesMap, setExtraDatesMap] = useState<Record<string, string[]>>({})
  const [newSeanceDate, setNewSeanceDate] = useState(() => new Date().toISOString().split('T')[0])
  const [showAddSeance, setShowAddSeance] = useState(false)

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const { data: groupes } = useQuery({ queryKey: ['groupes'], queryFn: groupesApi.list })

  const { data: presences, isLoading } = useQuery({
    queryKey: ['presences', selectedGroupe, date],
    queryFn: () => presencesApi.listByGroupe(selectedGroupe!, date),
    enabled: !!selectedGroupe && mode === 'jour',
  })

  const { data: grille, isLoading: isLoadingGrille } = useQuery({
    queryKey: ['presences-grille', selectedGroupe, mois],
    queryFn: () => presencesApi.getGrilleMensuelle(selectedGroupe!, mois),
    enabled: !!selectedGroupe && mode === 'mensuel',
  })

  const qc = useQueryClient()

  // Sauvegarde Appel du Jour
  const saveMutation = useMutation({
    mutationFn: () => {
      const records: Presence[] = presences!.map(p => ({
        ...p,
        statut: statuts[p.eleve_id] ?? p.statut,
      }))
      return presencesApi.save(records)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['presences'] })
      qc.invalidateQueries({ queryKey: ['presences-grille'] })
      setStatuts({})
      setFeedback({
        type: 'success',
        message: `Feuille d'appel enregistrée avec succès (${presences?.length || 0} élève${(presences?.length || 0) > 1 ? 's' : ''}) !`,
      })
      setTimeout(() => setFeedback(null), 4000)
    },
    onError: (err: any) => {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.detail || "Erreur lors de l'enregistrement des présences.",
      })
    },
  })

  // Sauvegarde Grille Mensuelle
  const saveGridMutation = useMutation({
    mutationFn: () => {
      const records: Presence[] = Object.entries(gridEdits).map(([key, statut]) => {
        const [eleveIdStr, dateSeance] = key.split('_')
        return {
          groupe_id: selectedGroupe!,
          eleve_id: Number(eleveIdStr),
          date_seance: dateSeance,
          statut,
          minutes_retard: statut === 'retard' ? 10 : 0,
        }
      })
      return presencesApi.save(records)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['presences-grille'] })
      qc.invalidateQueries({ queryKey: ['presences'] })
      const count = Object.keys(gridEdits).length
      setGridEdits({})
      setFeedback({
        type: 'success',
        message: `Grille mensuelle enregistrée (${count} pointage${count > 1 ? 's' : ''} mis à jour) !`,
      })
      setTimeout(() => setFeedback(null), 4000)
    },
    onError: (err: any) => {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.detail || "Erreur lors de l'enregistrement de la grille.",
      })
    },
  })

  // Quick batch actions (Appel du jour)
  const markAll = (statut: StatutPresence) => {
    if (!presences) return
    const next: Record<number, StatutPresence> = {}
    presences.forEach(p => { next[p.eleve_id] = statut })
    setStatuts(next)
  }

  // Summary counts (Appel du jour)
  const totalCount = presences?.length || 0
  const counts = (presences || []).reduce(
    (acc, p) => {
      const current = statuts[p.eleve_id] ?? p.statut
      acc[current] = (acc[current] || 0) + 1
      return acc
    },
    { present: 0, retard: 0, absent: 0 } as Record<StatutPresence, number>
  )
  const hasModifications = Object.keys(statuts).length > 0

  // Grille mensuelle : fusion des dates serveur + dates ajoutées manuellement
  const extraKey = `${selectedGroupe ?? 'none'}_${mois}`
  const allDates = useMemo(() => {
    const serverDates = grille?.dates ?? []
    const localDates = extraDatesMap[extraKey] ?? []
    return Array.from(new Set([...serverDates, ...localDates])).sort()
  }, [grille?.dates, extraDatesMap, extraKey])

  const hasGridModifications = Object.keys(gridEdits).length > 0

  const handleAddSeanceDate = () => {
    if (!newSeanceDate || !selectedGroupe) return
    if (!newSeanceDate.startsWith(mois)) {
      setFeedback({
        type: 'error',
        message: `La date choisie doit appartenir au mois sélectionné (${formatMonthLabel(mois)}).`,
      })
      return
    }
    setExtraDatesMap(prev => {
      const current = prev[extraKey] ?? []
      if (current.includes(newSeanceDate) || grille?.dates.includes(newSeanceDate)) return prev
      return { ...prev, [extraKey]: [...current, newSeanceDate] }
    })
    setShowAddSeance(false)
    setFeedback(null)
  }

  const handleMarkColumnPresent = (dateStr: string) => {
    if (!grille?.eleves.length) return
    setGridEdits(prev => {
      const next = { ...prev }
      grille.eleves.forEach(elv => {
        next[`${elv.eleve_id}_${dateStr}`] = 'present'
      })
      return next
    })
  }

  const selectedGroupeObj = groupes?.find(g => g.id === selectedGroupe)

  const renderEmptyGroupState = () => (
    <div className="text-center py-10 px-4 space-y-4 rounded-xl border border-dashed border-[#CBD5E1] dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
      <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
        <Users className="w-6 h-6" />
      </div>
      <div className="max-w-md mx-auto space-y-1.5">
        <h3 className="font-semibold text-[#1E293B] text-base">
          Aucun élève inscrit dans ce groupe
        </h3>
        <p className="text-sm text-slate-500 leading-relaxed">
          Votre établissement compte des élèves, mais aucun n'a encore été affecté au groupe{' '}
          <strong className="text-[#1E293B]">{selectedGroupeObj?.nom}</strong>.
          La feuille d'appel affiche uniquement les élèves inscrits à ce cours spécifique.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <Link to="/app/groupes" className="btn-primary flex items-center gap-2 py-2 px-4 text-xs font-medium">
          <Users className="w-4 h-4" />
          Affecter des élèves au groupe
        </Link>
        <Link to="/app/eleves" className="btn-secondary flex items-center gap-2 py-2 px-4 text-xs font-medium">
          <UserPlus className="w-4 h-4" />
          Inscrire un élève (Tout-en-un)
        </Link>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header + Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#1E293B]">Gestion des Présences</h1>
          <p className="text-slate-400 text-sm mt-1">
            {mode === 'mensuel'
              ? 'Tableau récapitulatif mensuel par groupe'
              : 'Appel numérique rapide pour une séance'}
          </p>
        </div>

        {/* Onglets */}
        <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-[#E2E8F0]">
          <button
            type="button"
            onClick={() => { setMode('mensuel'); setFeedback(null) }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              mode === 'mensuel'
                ? 'bg-white text-[#1E293B] shadow-sm border border-[#E2E8F0]'
                : 'text-slate-500 hover:text-[#1E293B]'
            }`}
          >
            <Table2 className="w-4 h-4 text-primary-500" />
            Tableau Mensuel
          </button>
          <button
            type="button"
            onClick={() => { setMode('jour'); setFeedback(null) }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              mode === 'jour'
                ? 'bg-white text-[#1E293B] shadow-sm border border-[#E2E8F0]'
                : 'text-slate-500 hover:text-[#1E293B]'
            }`}
          >
            <CalendarDays className="w-4 h-4 text-primary-500" />
            Appel du Jour
          </button>
        </div>
      </div>

      {/* Selectors */}
      <div className="flex gap-3 flex-wrap items-center print:hidden">
        <select
          className="input w-auto min-w-[260px]"
          value={selectedGroupe ?? ''}
          onChange={e => {
            setSelectedGroupe(Number(e.target.value) || null)
            setStatuts({})
            setGridEdits({})
            setFeedback(null)
          }}
        >
          <option value="">Choisir un groupe...</option>
          {groupes?.map(g => (
            <option key={g.id} value={g.id}>
              {g.nom} — {g.matiere} ({g.nombre_eleves ?? 0} élève{(g.nombre_eleves ?? 0) > 1 ? 's' : ''})
            </option>
          ))}
        </select>

        {mode === 'jour' ? (
          <input
            type="date"
            className="input w-auto"
            value={date}
            onChange={e => { setDate(e.target.value); setStatuts({}); setFeedback(null) }}
          />
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => { setMois(m => shiftMonth(m, -1)); setGridEdits({}); setFeedback(null) }}
              className="btn-secondary p-2"
              title="Mois précédent"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="month"
              className="input w-auto font-medium"
              value={mois}
              onChange={e => {
                if (e.target.value) {
                  setMois(e.target.value)
                  setGridEdits({})
                  setFeedback(null)
                }
              }}
            />
            <button
              type="button"
              onClick={() => { setMois(m => shiftMonth(m, 1)); setGridEdits({}); setFeedback(null) }}
              className="btn-secondary p-2"
              title="Mois suivant"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Feedback Toast Banner */}
      {feedback && (
        <div
          className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm animate-fadeIn print:hidden ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700'
              : 'bg-red-500/10 border-red-500/30 text-red-700'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-[#1E293B] p-1 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ══════════════ MODE 1 : TABLEAU MENSUEL ══════════════ */}
      {selectedGroupe && mode === 'mensuel' && (
        <div className="card space-y-4 animate-fadeIn print:border-0 print:shadow-none print:p-0">
          {/* Print-only Header */}
          <div className="hidden print:block border-b pb-3 mb-4">
            <h2 className="text-lg font-bold">Feuille de Présence Mensuelle — {formatMonthLabel(mois)}</h2>
            <p className="text-sm text-slate-600">
              Groupe : {grille?.groupe_nom || selectedGroupeObj?.nom} • Matière : {grille?.matiere || selectedGroupeObj?.matiere}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] pb-4 print:hidden">
            <div className="space-y-1">
              <h2 className="font-heading font-semibold text-[#1E293B] flex items-center gap-2">
                <Table2 className="w-5 h-5 text-primary-500" />
                Registre : {formatMonthLabel(mois)}
                {hasGridModifications && (
                  <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 border border-amber-500/30">
                    Modifications non enregistrées
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500">
                Cliquez sur une case pour basculer : <strong className="text-emerald-600">P</strong> (Présent) →{' '}
                <strong className="text-red-600">A</strong> (Absent) →{' '}
                <strong className="text-amber-600">R</strong> (Retard)
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {grille && grille.total_eleves > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const today = new Date().toISOString().split('T')[0]
                      setNewSeanceDate(today.startsWith(mois) ? today : `${mois}-01`)
                      setShowAddSeance(v => !v)
                    }}
                    className="btn-secondary flex items-center gap-1.5 py-1.5 px-3 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5 text-primary-500" />
                    Ajouter une séance
                  </button>

                  {allDates.length > 0 && (
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="btn-secondary flex items-center gap-1.5 py-1.5 px-3 text-xs"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Imprimer
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => saveGridMutation.mutate()}
                    disabled={saveGridMutation.isPending || !hasGridModifications}
                    className="btn-primary flex items-center gap-2 py-1.5 px-4 text-sm font-medium disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {saveGridMutation.isPending ? 'Enregistrement…' : 'Enregistrer la grille'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Mini-barre d'ajout de date */}
          {showAddSeance && (
            <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-slate-50 border border-[#E2E8F0] print:hidden">
              <Calendar className="w-4 h-4 text-primary-500" />
              <span className="text-xs font-medium text-slate-700">Date de la séance à ajouter :</span>
              <input
                type="date"
                className="input w-auto py-1 text-xs"
                value={newSeanceDate}
                onChange={e => setNewSeanceDate(e.target.value)}
              />
              <button
                type="button"
                onClick={handleAddSeanceDate}
                className="btn-primary py-1.5 px-3 text-xs"
              >
                Ajouter la colonne
              </button>
              <button
                type="button"
                onClick={() => setShowAddSeance(false)}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Annuler
              </button>
            </div>
          )}

          {isLoadingGrille ? (
            <div className="text-slate-500 text-sm text-center py-10">Chargement de la grille mensuelle…</div>
          ) : !grille || grille.total_eleves === 0 ? (
            renderEmptyGroupState()
          ) : allDates.length === 0 ? (
            <div className="text-center py-10 px-4 space-y-4 rounded-xl border border-dashed border-[#CBD5E1] bg-slate-50/50">
              <div className="w-12 h-12 rounded-full bg-primary-500/10 text-primary-500 flex items-center justify-center mx-auto">
                <CalendarDays className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto space-y-1.5">
                <h3 className="font-semibold text-[#1E293B] text-base">
                  Aucune séance ce mois-ci ({formatMonthLabel(mois)})
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Ce groupe compte <strong>{grille.total_eleves} élève(s)</strong>, mais aucune séance n'a encore été
                  pointée ni planifiée dans le <strong>Planning</strong> pour {formatMonthLabel(mois)}.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0]
                    setNewSeanceDate(today.startsWith(mois) ? today : `${mois}-01`)
                    setShowAddSeance(true)
                  }}
                  className="btn-primary flex items-center gap-2 py-2 px-4 text-xs font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter une séance manuellement
                </button>
                <Link to="/app/planning" className="btn-secondary flex items-center gap-2 py-2 px-4 text-xs font-medium">
                  <Calendar className="w-4 h-4" />
                  Configurer l'emploi du temps
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#E2E8F0]">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-[#E2E8F0]">
                    <th className="py-3 px-4 font-semibold text-[#1E293B] sticky left-0 bg-slate-50 z-10 min-w-[200px] border-r border-[#E2E8F0]">
                      Élève ({grille.total_eleves})
                    </th>
                    {allDates.map(dStr => {
                      const h = formatDateHeader(dStr)
                      return (
                        <th key={dStr} className="py-2 px-2 text-center min-w-[68px] border-r border-[#E2E8F0]">
                          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">
                            {h.weekday}
                          </div>
                          <div className="text-xs font-bold text-[#1E293B]">
                            {h.day}/{h.month}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleMarkColumnPresent(dStr)}
                            className="mt-1 text-[10px] text-emerald-600 hover:text-emerald-700 hover:underline print:hidden"
                            title="Marquer tout le groupe présent pour cette séance"
                          >
                            Tout P
                          </button>
                        </th>
                      )
                    })}
                    <th className="py-3 px-3 text-center font-semibold text-emerald-600 min-w-[44px] bg-emerald-50/40">P</th>
                    <th className="py-3 px-3 text-center font-semibold text-red-600 min-w-[44px] bg-red-50/40">A</th>
                    <th className="py-3 px-3 text-center font-semibold text-amber-600 min-w-[44px] bg-amber-50/40">R</th>
                    <th className="py-3 px-3 text-center font-semibold text-[#1E293B] min-w-[70px]">Assiduité</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {grille.eleves.map(elv => {
                    // Recalcul dynamique des totaux avec les modifications locales
                    let pCount = 0
                    let aCount = 0
                    let rCount = 0
                    allDates.forEach(dStr => {
                      const editKey = `${elv.eleve_id}_${dStr}`
                      const st = gridEdits[editKey] !== undefined ? gridEdits[editKey] : elv.seances[dStr]
                      if (st === 'present') pCount++
                      else if (st === 'absent') aCount++
                      else if (st === 'retard') rCount++
                    })
                    const totalPointes = pCount + aCount + rCount
                    const taux = totalPointes > 0 ? Math.round((pCount / totalPointes) * 100) : 100

                    return (
                      <tr key={elv.eleve_id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-4 sticky left-0 bg-white z-10 border-r border-[#E2E8F0]">
                          <div className="font-medium text-[#1E293B]">{elv.eleve_nom}</div>
                          <div className="text-[11px] text-slate-400">{elv.matricule}</div>
                        </td>
                        {allDates.map(dStr => {
                          const editKey = `${elv.eleve_id}_${dStr}`
                          const statut = gridEdits[editKey] !== undefined ? gridEdits[editKey] : elv.seances[dStr]
                          const isEdited = gridEdits[editKey] !== undefined

                          return (
                            <td key={dStr} className="py-2 px-2 text-center border-r border-[#E2E8F0]">
                              <button
                                type="button"
                                onClick={() => {
                                  const next = nextStatut(statut)
                                  setGridEdits(prev => ({ ...prev, [editKey]: next }))
                                }}
                                title="Cliquer pour changer le statut"
                                className={`w-9 h-8 rounded-lg font-bold text-xs border transition-all inline-flex items-center justify-center ${
                                  statut === 'present'
                                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700'
                                    : statut === 'absent'
                                    ? 'bg-red-500/15 border-red-500/40 text-red-700'
                                    : statut === 'retard'
                                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-700'
                                    : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300'
                                } ${isEdited ? 'ring-2 ring-primary-400 ring-offset-1' : ''}`}
                              >
                                {statut === 'present' ? 'P' : statut === 'absent' ? 'A' : statut === 'retard' ? 'R' : '·'}
                              </button>
                            </td>
                          )
                        })}
                        <td className="py-2.5 px-3 text-center font-semibold text-emerald-600 bg-emerald-50/20">
                          {pCount}
                        </td>
                        <td className="py-2.5 px-3 text-center font-semibold text-red-600 bg-red-50/20">
                          {aCount}
                        </td>
                        <td className="py-2.5 px-3 text-center font-semibold text-amber-600 bg-amber-50/20">
                          {rCount}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              taux >= 80
                                ? 'bg-emerald-500/15 text-emerald-700'
                                : taux >= 50
                                ? 'bg-amber-500/15 text-amber-700'
                                : 'bg-red-500/15 text-red-700'
                            }`}
                          >
                            {taux}%
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ MODE 2 : APPEL DU JOUR ══════════════ */}
      {selectedGroupe && mode === 'jour' && (
        <div className="card space-y-4 animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] pb-4">
            <div className="space-y-1">
              <h2 className="font-heading font-semibold text-[#1E293B] flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-primary-400" />
                Feuille d'appel du {date}
                {hasModifications && (
                  <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 border border-amber-500/30">
                    Modifications non enregistrées
                  </span>
                )}
              </h2>

              {totalCount > 0 && !isLoading && (
                <div className="flex items-center gap-3 text-xs pt-1">
                  <span className="text-slate-400">Total : <strong className="text-[#1E293B]">{totalCount}</strong></span>
                  <span className="text-emerald-600">● {counts.present} Présents</span>
                  <span className="text-amber-600">● {counts.retard} Retards</span>
                  <span className="text-red-600">● {counts.absent} Absents</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {totalCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAll('present')}
                  className="btn-secondary flex items-center gap-1.5 py-1.5 px-3 text-xs"
                  title="Marquer tous les élèves comme présents"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
                  Tout marquer présent
                </button>
              )}

              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || isLoading || totalCount === 0}
                className="btn-primary flex items-center gap-2 py-1.5 px-4 text-sm font-medium"
              >
                <Save className="w-4 h-4" />
                {saveMutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="text-slate-500 text-sm text-center py-8">Chargement de la liste…</div>
          ) : presences?.length === 0 ? (
            renderEmptyGroupState()
          ) : (
            <div className="space-y-2">
              {presences?.map(p => {
                const current = statuts[p.eleve_id] ?? p.statut
                return (
                  <div
                    key={p.eleve_id}
                    className="flex items-center justify-between px-4 py-3 rounded-xl border border-[#E2E8F0] transition-colors"
                  >
                    <span className="font-medium text-[#1E293B] text-sm">{p.eleve_nom}</span>
                    <div className="flex gap-2">
                      {(['present', 'retard', 'absent'] as StatutPresence[]).map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setStatuts(prev => ({ ...prev, [p.eleve_id]: s }))}
                          className={`text-xs px-3 py-1.5 rounded-lg font-semibold border transition-all duration-150 ${
                            current === s
                              ? s === 'present'
                                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700'
                                : s === 'retard'
                                ? 'bg-amber-500/15 border-amber-500/40 text-amber-700'
                                : 'bg-red-500/15 border-red-500/40 text-red-700'
                              : 'bg-slate-50 border-[#E2E8F0] text-slate-500 hover:border-slate-300'
                          }`}
                        >
                          {s === 'present' ? 'Présent' : s === 'retard' ? 'Retard' : 'Absent'}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {!selectedGroupe && (
        <div className="card text-center py-16">
          <ClipboardCheck className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">
            Sélectionnez un groupe pour afficher {mode === 'mensuel' ? 'le tableau mensuel' : "la feuille d'appel"}.
          </p>
        </div>
      )}
    </div>
  )
}
