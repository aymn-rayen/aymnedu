import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { groupesApi, presencesApi } from '@/api'
import { ClipboardCheck, Save, CheckCircle2, AlertTriangle, X, CheckCheck } from 'lucide-react'
import type { Presence } from '@/types'

export default function PresencesPage() {
  const [selectedGroupe, setSelectedGroupe] = useState<number | null>(null)
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [statuts, setStatuts] = useState<Record<number, Presence['statut']>>({})
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const { data: groupes } = useQuery({ queryKey: ['groupes'], queryFn: groupesApi.list })
  const { data: presences, isLoading } = useQuery({
    queryKey: ['presences', selectedGroupe, date],
    queryFn: () => presencesApi.listByGroupe(selectedGroupe!, date),
    enabled: !!selectedGroupe,
  })

  const qc = useQueryClient()
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

  // Quick batch actions
  const markAll = (statut: Presence['statut']) => {
    if (!presences) return
    const next: Record<number, Presence['statut']> = {}
    presences.forEach(p => { next[p.eleve_id] = statut })
    setStatuts(next)
  }

  // Summary counts
  const totalCount = presences?.length || 0
  const counts = (presences || []).reduce(
    (acc, p) => {
      const current = statuts[p.eleve_id] ?? p.statut
      acc[current] = (acc[current] || 0) + 1
      return acc
    },
    { present: 0, retard: 0, absent: 0 } as Record<Presence['statut'], number>
  )

  const hasModifications = Object.keys(statuts).length > 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-white">Gestion des Présences</h1>
        <p className="text-slate-400 text-sm mt-1">Appel numérique par groupe</p>
      </div>

      {/* Selectors */}
      <div className="flex gap-3 flex-wrap items-center">
        <select
          className="input w-auto min-w-[240px]"
          value={selectedGroupe ?? ''}
          onChange={e => { setSelectedGroupe(Number(e.target.value) || null); setStatuts({}); setFeedback(null) }}
        >
          <option value="">Choisir un groupe...</option>
          {groupes?.map(g => <option key={g.id} value={g.id}>{g.nom} — {g.matiere}</option>)}
        </select>
        <input
          type="date"
          className="input w-auto"
          value={date}
          onChange={e => { setDate(e.target.value); setStatuts({}); setFeedback(null) }}
        />
      </div>

      {/* Feedback Toast Banner */}
      {feedback && (
        <div
          className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm animate-fadeIn ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Attendance list */}
      {selectedGroupe && (
        <div className="card space-y-4 animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-4">
            <div className="space-y-1">
              <h2 className="font-heading font-semibold text-white flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-primary-400" />
                Feuille d'appel
                {hasModifications && (
                  <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Modifications non enregistrées
                  </span>
                )}
              </h2>

              {/* Counters */}
              {totalCount > 0 && !isLoading && (
                <div className="flex items-center gap-3 text-xs pt-1">
                  <span className="text-slate-400">Total : <strong className="text-white">{totalCount}</strong></span>
                  <span className="text-emerald-400">● {counts.present} Présents</span>
                  <span className="text-amber-400">● {counts.retard} Retards</span>
                  <span className="text-red-400">● {counts.absent} Absents</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {totalCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAll('present')}
                  className="btn-secondary flex items-center gap-1.5 py-1.5 px-3 text-xs text-slate-300 hover:text-white"
                  title="Marquer tous les élèves comme présents"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
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
            <div className="text-slate-500 text-sm text-center py-8">Aucun élève dans ce groupe.</div>
          ) : (
            <div className="space-y-2">
              {presences?.map(p => {
                const current = statuts[p.eleve_id] ?? p.statut
                return (
                  <div
                    key={p.eleve_id}
                    className="flex items-center justify-between px-4 py-3 rounded-xl border border-white/5 hover:border-white/10 transition-colors"
                  >
                    <span className="font-medium text-white text-sm">{p.eleve_nom}</span>
                    <div className="flex gap-2">
                      {(['present', 'retard', 'absent'] as Presence['statut'][]).map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setStatuts(prev => ({ ...prev, [p.eleve_id]: s }))}
                          className={`text-xs px-3 py-1.5 rounded-lg font-semibold border transition-all duration-150 ${
                            current === s
                              ? s === 'present'
                                ? 'bg-primary-500/20 border-primary-500/40 text-primary-400'
                                : s === 'retard'
                                ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                                : 'bg-red-500/20 border-red-500/40 text-red-400'
                              : 'bg-white/2 border-white/5 text-slate-500 hover:border-white/15'
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
          <ClipboardCheck className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Sélectionnez un groupe pour commencer l'appel.</p>
        </div>
      )}
    </div>
  )
}
