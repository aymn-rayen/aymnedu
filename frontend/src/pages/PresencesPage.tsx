import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { groupesApi, presencesApi } from '@/api'
import { ClipboardCheck, Save } from 'lucide-react'
import type { Presence } from '@/types'

export default function PresencesPage() {
  const [selectedGroupe, setSelectedGroupe] = useState<number | null>(null)
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [statuts, setStatuts] = useState<Record<number, Presence['statut']>>({})

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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['presences'] }),
  })


  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-white">Gestion des Présences</h1>
        <p className="text-slate-400 text-sm mt-1">Appel numérique par groupe</p>
      </div>

      {/* Selectors */}
      <div className="flex gap-3 flex-wrap">
        <select
          className="input w-auto"
          value={selectedGroupe ?? ''}
          onChange={e => { setSelectedGroupe(Number(e.target.value)); setStatuts({}) }}
        >
          <option value="">Choisir un groupe...</option>
          {groupes?.map(g => <option key={g.id} value={g.id}>{g.nom} — {g.matiere}</option>)}
        </select>
        <input
          type="date"
          className="input w-auto"
          value={date}
          onChange={e => setDate(e.target.value)}
        />
      </div>

      {/* Attendance list */}
      {selectedGroupe && (
        <div className="card space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-heading font-semibold text-white flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-primary-400" />
              Feuille d'appel
            </h2>
            <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="btn-primary flex items-center gap-2 py-1.5 px-3 text-sm">
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>

          {isLoading ? (
            <div className="text-slate-500 text-sm text-center py-8">Chargement de la liste…</div>
          ) : presences?.length === 0 ? (
            <div className="text-slate-500 text-sm text-center py-8">Aucun élève dans ce groupe.</div>
          ) : (
            presences?.map(p => {
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
            })
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
