import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { paiementsApi } from '@/api'
import { CheckCircle, AlertTriangle, Receipt, Printer, X } from 'lucide-react'

const MOIS = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
]

export default function PaiementsPage() {
  const qc = useQueryClient()
  const [statut, setStatut] = useState<string>('')
  const [mois, setMois] = useState<number>(0) // 0 = Tous les mois
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['paiements', statut, mois],
    queryFn: () => paiementsApi.list({ statut: statut || undefined, mois: mois > 0 ? `${mois}` : undefined }),
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
        <p className="text-slate-400 text-sm mt-1">
          Suivi des mensualités — {mois > 0 ? MOIS[mois - 1] : 'Tous les mois'}
        </p>
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
          <option value={0}>Tous les mois</option>
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
                  {p.statut !== 'paye' ? (
                    <button
                      onClick={() => payMutation.mutate(p.id)}
                      className="text-xs btn-primary py-1.5 px-3"
                      disabled={payMutation.isPending}
                    >
                      Encaisser
                    </button>
                  ) : (
                    <button
                      onClick={() => setSelectedReceipt(p)}
                      className="text-xs btn-secondary py-1.5 px-2.5 flex items-center gap-1.5 text-slate-300 hover:text-white"
                    >
                      <Receipt className="w-3.5 h-3.5 text-primary-400" />
                      Reçu
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Reçu de Paiement */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="card w-full max-w-md bg-[#0f172a] border border-primary-500/30 shadow-2xl p-6 relative">
            <button
              onClick={() => setSelectedReceipt(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center pb-4 border-b border-white/10">
              <span className="badge badge-success mb-2">Paiement Validé</span>
              <h2 className="font-heading text-xl font-bold text-white">Reçu d'encaissement</h2>
              <p className="text-xs text-primary-400 font-mono mt-1">{selectedReceipt.recu_numero || `REC-${selectedReceipt.id}`}</p>
            </div>

            <div className="py-4 space-y-3 text-sm">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Élève :</span>
                <span className="font-medium text-white">{selectedReceipt.eleve_nom}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Groupe :</span>
                <span className="font-medium text-white">{selectedReceipt.groupe_nom}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Mois concerné :</span>
                <span className="font-medium text-white">{selectedReceipt.mois}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Date d'encaissement :</span>
                <span className="font-medium text-white">
                  {selectedReceipt.date_paiement
                    ? new Date(selectedReceipt.date_paiement).toLocaleDateString('fr-DZ')
                    : 'Aujourd\'hui'}
                </span>
              </div>
              <div className="flex justify-between py-2 bg-primary-500/10 px-3 rounded-lg border border-primary-500/20">
                <span className="font-semibold text-primary-300">Montant total réglé :</span>
                <span className="font-heading font-bold text-lg text-primary-400">
                  {selectedReceipt.montant.toLocaleString('fr-DZ')} DA
                </span>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="btn-secondary text-sm"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-primary text-sm flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Imprimer le reçu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
