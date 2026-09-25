import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { emploisApi, groupesApi, enseignantsApi } from '@/api'
import { PlusCircle } from 'lucide-react'

const JOURS: Record<string, number> = {
  dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6,
}

const schema = z.object({
  groupe_id: z.coerce.number().min(1, 'Requis'),
  enseignant_id: z.coerce.number().optional().nullable(),
  salle: z.string().optional(),
  jour_semaine: z.enum(['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'], { required_error: 'Requis' }),
  heure_debut: z.string().min(1, 'Requis'),
  heure_fin: z.string().min(1, 'Requis'),
})
type SeanceForm = z.infer<typeof schema>

export default function PlanningPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)

  const { data: seances, isLoading } = useQuery({
    queryKey: ['emplois-du-temps'],
    queryFn: emploisApi.list,
  })

  const { data: groupes } = useQuery({ queryKey: ['groupes'], queryFn: groupesApi.list })
  const { data: enseignants } = useQuery({ queryKey: ['enseignants'], queryFn: enseignantsApi.list })

  const { register, handleSubmit, reset, formState: { errors } } =
    useForm<SeanceForm>({ resolver: zodResolver(schema) })

  const createMutation = useMutation({
    mutationFn: (data: SeanceForm) =>
      emploisApi.create({ ...data, enseignant_id: data.enseignant_id || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['emplois-du-temps'] }); reset(); setShowForm(false) },
  })

  const deleteMutation = useMutation({
    mutationFn: emploisApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['emplois-du-temps'] }),
  })

  // Map seances → FullCalendar events (recurring by day of week)
  const events = seances?.map(s => ({
    id: String(s.id),
    title: `${s.groupe_nom ?? 'Groupe'}${s.salle ? ` — ${s.salle}` : ''}`,
    startTime: s.heure_debut,
    endTime: s.heure_fin,
    daysOfWeek: [JOURS[s.jour_semaine]],
    backgroundColor: '#10b981',
    borderColor: '#10b981',
    extendedProps: { enseignant: s.enseignant_nom, salle: s.salle, id: s.id },
  })) ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-white">Emplois du Temps</h1>
          <p className="text-slate-400 text-sm mt-1">Planning hebdomadaire de toutes les salles</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="btn-primary flex items-center gap-2">
          <PlusCircle className="w-4 h-4" />
          Nouvelle séance
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="card border-primary-500/20 animate-fadeIn">
          <h2 className="font-heading font-semibold text-white mb-4">Ajouter une séance au planning</h2>
          {(!groupes || groupes.length === 0) && (
            <div className="mb-4 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-sm">
              ⚠️ Vous devez d'abord créer des groupes dans la page "Groupes" avant d'ajouter des séances.
            </div>
          )}
          <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="label">Groupe *</label>
              <select className="input" {...register('groupe_id')}>
                <option value="">Choisir un groupe...</option>
                {groupes?.map(g => <option key={g.id} value={g.id}>{g.nom}</option>)}
              </select>
              {errors.groupe_id && <p className="text-xs text-red-400 mt-1">{errors.groupe_id.message}</p>}
            </div>

            <div>
              <label className="label">Jour *</label>
              <select className="input" {...register('jour_semaine')}>
                <option value="">Choisir...</option>
                {Object.keys(JOURS).map(j => (
                  <option key={j} value={j}>{j.charAt(0).toUpperCase() + j.slice(1)}</option>
                ))}
              </select>
              {errors.jour_semaine && <p className="text-xs text-red-400 mt-1">{errors.jour_semaine.message}</p>}
            </div>

            <div>
              <label className="label">Salle</label>
              <input className="input" placeholder="Ex: Salle 1 / Labo" {...register('salle')} />
            </div>

            <div>
              <label className="label">Heure début *</label>
              <input className="input" type="time" {...register('heure_debut')} />
              {errors.heure_debut && <p className="text-xs text-red-400 mt-1">{errors.heure_debut.message}</p>}
            </div>

            <div>
              <label className="label">Heure fin *</label>
              <input className="input" type="time" {...register('heure_fin')} />
              {errors.heure_fin && <p className="text-xs text-red-400 mt-1">{errors.heure_fin.message}</p>}
            </div>

            <div>
              <label className="label">Enseignant (optionnel)</label>
              <select className="input" {...register('enseignant_id')}>
                <option value="">— Aucun —</option>
                {enseignants?.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
              </select>
            </div>

            <div className="sm:col-span-2 lg:col-span-3 flex gap-3 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Annuler</button>
              <button type="submit" disabled={createMutation.isPending} className="btn-primary">
                {createMutation.isPending ? 'Ajout...' : 'Ajouter au planning'}
              </button>
            </div>
          </form>
          {createMutation.isError && (
            <p className="text-xs text-red-400 mt-2 font-medium">
              {(createMutation.error as any)?.response?.data?.detail || "Erreur lors de la création de la séance."}
            </p>
          )}
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <style>{`
          .fc { --fc-border-color: rgba(255,255,255,0.06); --fc-neutral-bg-color: transparent; --fc-page-bg-color: transparent; color: #cbd5e1; }
          .fc-toolbar-title { font-family: 'Outfit', sans-serif; font-size: 1.1rem !important; }
          .fc-button { background: rgba(255,255,255,0.06) !important; border-color: rgba(255,255,255,0.1) !important; color: #f8fafc !important; }
          .fc-button:hover { background: rgba(255,255,255,0.12) !important; }
          .fc-button-active { background: #10b981 !important; border-color: #10b981 !important; }
          .fc-timegrid-slot-label, .fc-col-header-cell-cushion { color: #64748b; font-size: 0.8rem; }
          .fc-timegrid-now-indicator-line { border-color: #10b981; }
          .fc-event { border-radius: 6px; padding: 2px 6px; font-size: 0.8rem; cursor: pointer; }
        `}</style>
        <div className="p-4">
          {isLoading ? (
            <div className="h-64 flex items-center justify-center text-slate-500">Chargement du planning…</div>
          ) : (
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              locale="fr"
              firstDay={0}
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'timeGridWeek,timeGridDay',
              }}
              slotMinTime="07:00:00"
              slotMaxTime="22:00:00"
              allDaySlot={false}
              events={events}
              height="auto"
              eventClick={({ event }) => {
                if (confirm(`Supprimer la séance "${event.title}" du planning ?`)) {
                  deleteMutation.mutate(Number(event.extendedProps.id))
                }
              }}
              eventContent={({ event }) => (
                <div className="p-1">
                  <div className="font-semibold text-xs leading-tight">{event.title}</div>
                  {event.extendedProps.enseignant && (
                    <div className="text-[10px] opacity-75 mt-0.5">Prof. {event.extendedProps.enseignant}</div>
                  )}
                </div>
              )}
            />
          )}
        </div>
      </div>
    </div>
  )
}
