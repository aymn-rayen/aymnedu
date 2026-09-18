import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { paiementsApi } from '@/api'
import { CheckCircle, AlertTriangle } from 'lucide-react'

const MOIS = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
]

export default function PaiementsPage() {
  const qc = useQueryClient()
  const [statut, setStatut] = useState<string>('')
  const [mois, setMois] = useState(new Date().getMonth() + 1)

  const { data, isLoading } = useQuery({
    queryKey: ['paiements', statut, mois],
    queryFn: () => paiementsApi.list({ statut: statut || undefined, mois: `${mois}` }),
  })

  const payMutation = useMutation({
    mutationFn: paiementsApi.markPaid,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['paiements'] }),
  })

  const totalEncaisse = data?.items?.filter(p => p.statut === 'paye').reduce((s, p) => s + p.montant, 0) ?? 0
  const totalImpaye = data?.items?.filter(p => p.statut === 'impaye').reduce((s, p) => s + p.montant, 0) ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-white">Gestion des Paiements</h1>
        <p className="text-slate-400 text-sm mt-1">Suivi des mensualités — {MOIS[mois - 1]}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card border-primary-500/20">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-primary-400" />
            <span className="text-sm text-slate-400">Encaissé</span>
          </div>
          <p className="font-heading text-2xl font-bold text-primary-400">{totalEncaisse.toLocaleString('fr-DZ')} DA</p>
        </div>
        <div className="card border-amber-500/20">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-slate-400">Impayé</span>
          </div>
          <p className="font-heading text-2xl font-bold text-amber-400">{totalImpaye.toLocaleString('fr-DZ')} DA</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select className="input w-auto" value={mois} onChange={e => setMois(Number(e.target.value))}>
          {MOIS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select className="input w-auto" value={statut} onChange={e => setStatut(e.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="paye">Payé</option>
          <option value="impaye">Impayé</option>
          <option value="partiel">Partiel</option>
        </select>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead className="bg-white/2">
            <tr>
              <th className="table-header">Élève</th>
              <th className="table-header">Groupe</th>
              <th className="table-header">Montant</th>
              <th className="table-header">Statut</th>
              <th className="table-header">Reçu</th>
              <th className="table-header">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="table-cell text-center text-slate-500 py-12">Chargement…</td></tr>
            ) : data?.items?.map(p => (
              <tr key={p.id} className="table-row">
                <td className="table-cell font-medium text-white">{p.eleve_nom}</td>
                <td className="table-cell">{p.groupe_nom}</td>
                <td className="table-cell font-mono">{p.montant.toLocaleString('fr-DZ')} DA</td>
                <td className="table-cell">
                  {p.statut === 'paye' && <span className="badge-success">Payé</span>}
                  {p.statut === 'impaye' && <span className="badge-danger">Impayé</span>}
                  {p.statut === 'partiel' && <span className="badge-warning">Partiel</span>}
                </td>
                <td className="table-cell text-slate-500">{p.recu_numero ?? '—'}</td>
                <td className="table-cell">
                  {p.statut !== 'paye' && (
                    <button
                      onClick={() => payMutation.mutate(p.id)}
                      className="text-xs btn-primary py-1.5 px-3"
                      disabled={payMutation.isPending}
                    >
                      Encaisser
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
