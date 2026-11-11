import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { paiementsApi, groupesApi, elevesApi } from '@/api'
import {
  CheckCircle, AlertTriangle, Receipt, Printer, Download,
  X, ChevronLeft, ChevronRight, Plus, Banknote, Coins
} from 'lucide-react'
import { generateReceiptPdf } from '@/utils/generateReceiptPdf'
import type { Paiement } from '@/types'

const MOIS_LABELS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

const NOW = new Date()
const CURRENT_YEAR = NOW.getFullYear()
const CURRENT_MONTH = NOW.getMonth() + 1
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]

export default function PaiementsPage() {
  const qc = useQueryClient()

  // ── Filtres liste ─────────────────────────────────────────────────────────
  const [statut, setStatut] = useState<string>('')
  const [filterMois, setFilterMois] = useState<number>(0)
  const [page, setPage] = useState<number>(1)

  // ── Modal reçu ────────────────────────────────────────────────────────────
  const [selectedReceipt, setSelectedReceipt] = useState<Paiement | null>(null)

  // ── Modal Versement (partiel ou total) ─────────────────────────────────────
  const [versementTarget, setVersementTarget] = useState<Paiement | null>(null)
  const [versementMontant, setVersementMontant] = useState('')
  const [versementError, setVersementError] = useState('')

  // ── Formulaire Nouveau Paiement ───────────────────────────────────────────
  const [showNewForm, setShowNewForm] = useState(false)
  const [newEleve, setNewEleve] = useState<number | ''>('')
  const [newGroupe, setNewGroupe] = useState<number | ''>('')
  const [newMontant, setNewMontant] = useState('')
  const [newMoisNum, setNewMoisNum] = useState<number>(CURRENT_MONTH)
  const [newAnnee, setNewAnnee] = useState<number>(CURRENT_YEAR)
  const [newError, setNewError] = useState('')

  // Données pour le formulaire de création
  const { data: groupesList } = useQuery({
    queryKey: ['groupes'],
    queryFn: groupesApi.list,
    enabled: showNewForm,
  })
  const { data: elevesData } = useQuery({
    queryKey: ['eleves', 'all'],
    queryFn: () => elevesApi.list({ page: 1 }),
    enabled: showNewForm,
  })
  const elevesList = elevesData?.items ?? []

  // ── Queries & Mutations ───────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['paiements', statut, filterMois, page],
    queryFn: () => paiementsApi.list({
      statut: statut || undefined,
      mois: filterMois > 0 ? `${filterMois}` : undefined,
      page,
    }),
  })

  // Versement partiel ou total
  const verserMutation = useMutation({
    mutationFn: ({ id, montant }: { id: number; montant: number }) =>
      paiementsApi.verser(id, montant),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['paiements'] })
      setVersementTarget(null)
      setVersementMontant('')
      setVersementError('')
    },
    onError: (err: any) => {
      setVersementError(err?.response?.data?.detail ?? 'Erreur lors de l\'enregistrement du versement.')
    },
  })

  // Création d'un paiement
  const createMutation = useMutation({
    mutationFn: paiementsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['paiements'] })
      setShowNewForm(false)
      setNewEleve('')
      setNewGroupe('')
      setNewMontant('')
      setNewMoisNum(CURRENT_MONTH)
      setNewAnnee(CURRENT_YEAR)
      setNewError('')
    },
    onError: (err: any) => {
      setNewError(err?.response?.data?.detail ?? 'Erreur lors de la création du paiement.')
    },
  })

  const handleCreatePaiement = () => {
    setNewError('')
    if (!newEleve || !newGroupe || !newMontant) {
      setNewError('Veuillez remplir tous les champs obligatoires.')
      return
    }
    const montant = parseFloat(newMontant)
    if (isNaN(montant) || montant <= 0) {
      setNewError('Montant invalide — entrez un nombre positif en DA.')
      return
    }
    const moisStr = `${newAnnee}-${String(newMoisNum).padStart(2, '0')}`
    createMutation.mutate({
      eleve_id: Number(newEleve),
      groupe_id: Number(newGroupe),
      montant,
      mois: moisStr,
    } as any)
  }

  // Ouvrir le modal d'encaissement / versement
  const openVersementModal = (p: Paiement) => {
    const total = Number(p.montant || 0)
    const verse = Number(p.montant_verse || 0)
    const reste = Math.max(0, total - verse)
    setVersementTarget(p)
    setVersementMontant(reste > 0 ? String(reste) : String(total))
    setVersementError('')
  }

  const handleValiderVersement = () => {
    if (!versementTarget) return
    setVersementError('')
    const montantAdd = parseFloat(versementMontant)
    if (isNaN(montantAdd) || montantAdd <= 0) {
      setVersementError('Entrez un montant valide supérieur à 0 DA.')
      return
    }
    const total = Number(versementTarget.montant || 0)
    const dejaVerse = Number(versementTarget.montant_verse || 0)
    const reste = total - dejaVerse

    if (montantAdd > reste + 0.01) {
      setVersementError(`Le montant saisi (${montantAdd.toLocaleString('fr-DZ')} DA) dépasse le solde restant (${reste.toLocaleString('fr-DZ')} DA).`)
      return
    }

    verserMutation.mutate({ id: versementTarget.id, montant: montantAdd })
  }

  // ── Totaux précis (Encaissé vs Reste à recouvrer) ──────────────────────────
  const totalEncaisse = data?.items?.reduce((s, p) => s + Number(p.montant_verse || 0), 0) ?? 0
  const totalReste = data?.items?.reduce((s, p) => {
    const total = Number(p.montant || 0)
    const verse = Number(p.montant_verse || 0)
    return s + Math.max(0, total - verse)
  }, 0) ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-white">Gestion des Paiements</h1>
          <p className="text-slate-400 text-sm mt-1">
            Suivi des mensualités et encaissements —{' '}
            {filterMois > 0 ? MOIS_LABELS[filterMois - 1] : 'Tous les mois'}
          </p>
        </div>
        <button
          onClick={() => { setShowNewForm(true); setNewError('') }}
          className="btn-primary flex items-center gap-2 text-sm flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nouveau paiement
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card border-primary-500/20">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-primary-400" />
            <span className="text-sm text-slate-400">Total Encaissé (page)</span>
          </div>
          <p className="font-heading text-2xl font-bold text-primary-400">
            {totalEncaisse.toLocaleString('fr-DZ')} DA
          </p>
        </div>
        <div className="card border-amber-500/20">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-slate-400">Reste à Recouvrer (page)</span>
          </div>
          <p className="font-heading text-2xl font-bold text-amber-400">
            {totalReste.toLocaleString('fr-DZ')} DA
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          className="input w-auto"
          value={filterMois}
          onChange={e => { setFilterMois(Number(e.target.value)); setPage(1) }}
        >
          <option value={0}>Tous les mois</option>
          {MOIS_LABELS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select
          className="input w-auto"
          value={statut}
          onChange={e => { setStatut(e.target.value); setPage(1) }}
        >
          <option value="">Tous les statuts</option>
          <option value="paye">Payé (Soldé)</option>
          <option value="partiel">Partiel (Acompte versé)</option>
          <option value="impaye">Impayé (0 DA)</option>
        </select>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/2">
              <tr>
                <th className="table-header">Élève</th>
                <th className="table-header">Groupe</th>
                <th className="table-header">Mois</th>
                <th className="table-header text-right">Total Dû</th>
                <th className="table-header text-right">Versé</th>
                <th className="table-header text-right">Reste</th>
                <th className="table-header text-center">Statut</th>
                <th className="table-header">Reçu N°</th>
                <th className="table-header text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="table-cell text-center text-slate-500 py-12">Chargement…</td></tr>
              ) : !data?.items?.length ? (
                <tr><td colSpan={9} className="table-cell text-center text-slate-500 py-12">Aucun paiement trouvé.</td></tr>
              ) : data.items.map(p => {
                const total = Number(p.montant || 0)
                const verse = Number(p.montant_verse || 0)
                const reste = Math.max(0, total - verse)

                return (
                  <tr key={p.id} className="table-row">
                    <td className="table-cell font-medium text-white">{p.eleve_nom}</td>
                    <td className="table-cell text-slate-400 text-xs max-w-[170px] truncate">{p.groupe_nom}</td>
                    <td className="table-cell font-mono text-xs text-slate-400">{p.mois}</td>
                    <td className="table-cell font-mono text-xs font-semibold text-white text-right">
                      {total.toLocaleString('fr-DZ')} DA
                    </td>
                    <td className="table-cell font-mono text-xs text-emerald-400 text-right font-medium">
                      {verse > 0 ? `${verse.toLocaleString('fr-DZ')} DA` : '0 DA'}
                    </td>
                    <td className="table-cell font-mono text-xs text-right font-medium">
                      {reste > 0 ? (
                        <span className="text-amber-400 font-semibold">{reste.toLocaleString('fr-DZ')} DA</span>
                      ) : (
                        <span className="text-slate-500">0 DA</span>
                      )}
                    </td>
                    <td className="table-cell text-center">
                      {p.statut === 'paye' && <span className="badge-success">Payé</span>}
                      {p.statut === 'impaye' && <span className="badge-danger">Impayé</span>}
                      {p.statut === 'partiel' && <span className="badge-warning">Partiel</span>}
                    </td>
                    <td className="table-cell text-slate-500 text-xs font-mono">{p.recu_numero ?? '—'}</td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {p.statut !== 'paye' ? (
                          <button
                            onClick={() => openVersementModal(p)}
                            className="text-xs btn-primary py-1.5 px-3 flex items-center gap-1"
                            title={p.statut === 'partiel' ? 'Verser le solde restant' : 'Encaisser tout ou partie'}
                          >
                            <Banknote className="w-3.5 h-3.5" />
                            {p.statut === 'partiel' ? 'Verser solde' : 'Encaisser'}
                          </button>
                        ) : null}

                        {/* Bouton Reçu : visible dès qu'un versement a eu lieu (Payé ou Partiel avec montant versé) */}
                        {(p.statut === 'paye' || (p.statut === 'partiel' && verse > 0)) && (
                          <button
                            onClick={() => setSelectedReceipt(p)}
                            className="text-xs btn-secondary py-1.5 px-2.5 flex items-center gap-1.5 text-slate-300 hover:text-white"
                            title="Voir et imprimer le reçu"
                          >
                            <Receipt className="w-3.5 h-3.5 text-primary-400" />
                            Reçu
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5 bg-white/2">
            <span className="text-xs text-slate-400">
              Page {data.page} sur {data.pages} ({data.total} paiement{data.total > 1 ? 's' : ''})
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

      {/* ── Modal Versement Partiel / Total ────────────────────────────────── */}
      {versementTarget && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={() => setVersementTarget(null)}
        >
          <div
            className="card w-full max-w-md bg-[#0f172a] border border-primary-500/40 shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setVersementTarget(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 rounded-xl bg-primary-500/10 border border-primary-500/20 text-primary-400">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-heading text-lg font-bold text-white">
                  {versementTarget.statut === 'partiel' ? 'Compléter le versement' : 'Encaisser le paiement'}
                </h2>
                <p className="text-xs text-slate-400">Mois : {versementTarget.mois}</p>
              </div>
            </div>

            {/* Infos élève / groupe */}
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-2 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-slate-400">Élève :</span>
                <span className="font-semibold text-white">{versementTarget.eleve_nom}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Groupe :</span>
                <span className="text-slate-300">{versementTarget.groupe_nom}</span>
              </div>
              <div className="border-t border-white/10 pt-2 flex justify-between">
                <span className="text-slate-400">Total dû :</span>
                <span className="font-mono font-semibold text-white">
                  {Number(versementTarget.montant).toLocaleString('fr-DZ')} DA
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Déjà versé :</span>
                <span className="font-mono text-emerald-400 font-medium">
                  {Number(versementTarget.montant_verse || 0).toLocaleString('fr-DZ')} DA
                </span>
              </div>
              <div className="flex justify-between text-base pt-1 font-bold">
                <span className="text-amber-400">Reste à payer :</span>
                <span className="font-mono text-amber-400">
                  {Math.max(0, Number(versementTarget.montant) - Number(versementTarget.montant_verse || 0)).toLocaleString('fr-DZ')} DA
                </span>
              </div>
            </div>

            {/* Champ montant */}
            <div className="space-y-3">
              <label className="label">Montant apporté par le parent (DA) *</label>
              <input
                type="number"
                min="1"
                step="50"
                className="input text-lg font-mono font-bold"
                placeholder="Montant à encaisser"
                value={versementMontant}
                onChange={e => setVersementMontant(e.target.value)}
              />

              {/* Raccourcis rapides */}
              {(() => {
                const total = Number(versementTarget.montant || 0)
                const dejaVerse = Number(versementTarget.montant_verse || 0)
                const reste = Math.max(0, total - dejaVerse)

                return (
                  <div className="flex gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setVersementMontant(String(reste))}
                      className="text-xs px-2.5 py-1 rounded-md bg-primary-500/10 hover:bg-primary-500/20 text-primary-300 border border-primary-500/30 transition-colors"
                    >
                      Régler la totalité ({reste.toLocaleString('fr-DZ')} DA)
                    </button>
                    {reste > 1000 && (
                      <button
                        type="button"
                        onClick={() => setVersementMontant(String(Math.floor(reste / 2)))}
                        className="text-xs px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors"
                      >
                        Acompte 50% ({Math.floor(reste / 2).toLocaleString('fr-DZ')} DA)
                      </button>
                    )}
                  </div>
                )
              })()}

              <p className="text-[11px] text-slate-400 leading-relaxed">
                • Si le montant versé couvre tout le reste → le paiement passe en <span className="text-emerald-400 font-semibold">Payé (Soldé)</span> et un reçu officiel est émis.<br />
                • Si le montant versé est inférieur au reste → le paiement reste en <span className="text-amber-400 font-semibold">Partiel</span> et le nouveau solde est conservé.
              </p>

              {versementError && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-400">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {versementError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/5">
              <button
                type="button"
                onClick={() => setVersementTarget(null)}
                className="btn-secondary text-sm py-2 px-4"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleValiderVersement}
                disabled={verserMutation.isPending}
                className="btn-primary text-sm py-2 px-5 flex items-center gap-1.5 disabled:opacity-60"
              >
                {verserMutation.isPending ? 'Enregistrement…' : 'Valider l\'encaissement'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Modal Nouveau Paiement ─────────────────────────────────────────── */}
      {showNewForm && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setShowNewForm(false)}
        >
          <div
            className="card w-full max-w-md bg-[#0f172a] border border-primary-500/40 shadow-2xl p-6 relative"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setShowNewForm(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="font-heading text-lg font-bold text-white mb-5">Nouveau Paiement</h2>

            <div className="space-y-4">
              {/* Élève */}
              <div>
                <label className="label">Élève *</label>
                <select
                  className="input"
                  value={newEleve}
                  onChange={e => setNewEleve(Number(e.target.value))}
                >
                  <option value="">— Sélectionner un élève —</option>
                  {elevesList.map((el: any) => (
                    <option key={el.id} value={el.id}>
                      {el.prenom} {el.nom}
                    </option>
                  ))}
                </select>
              </div>

              {/* Groupe */}
              <div>
                <label className="label">Groupe *</label>
                <select
                  className="input"
                  value={newGroupe}
                  onChange={e => setNewGroupe(Number(e.target.value))}
                >
                  <option value="">— Sélectionner un groupe —</option>
                  {groupesList?.map((g: any) => (
                    <option key={g.id} value={g.id}>{g.nom}</option>
                  ))}
                </select>
              </div>

              {/* Mois + Année */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Mois *</label>
                  <select
                    className="input"
                    value={newMoisNum}
                    onChange={e => setNewMoisNum(Number(e.target.value))}
                  >
                    {MOIS_LABELS.map((m, i) => (
                      <option key={i} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Année *</label>
                  <select
                    className="input"
                    value={newAnnee}
                    onChange={e => setNewAnnee(Number(e.target.value))}
                  >
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>

              {/* Montant */}
              <div>
                <label className="label">Montant Total Dû (DA) *</label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  className="input font-mono"
                  placeholder="ex: 2500"
                  value={newMontant}
                  onChange={e => setNewMontant(e.target.value)}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Le paiement sera créé avec statut <span className="text-amber-400 font-semibold">Impayé</span>.
                  Vous pourrez ensuite enregistrer des versements partiels ou totaux.
                </p>
              </div>

              {/* Erreur */}
              {newError && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5 text-sm text-red-400">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {newError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/5">
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                className="btn-secondary text-sm py-2 px-4"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleCreatePaiement}
                disabled={createMutation.isPending}
                className="btn-primary text-sm py-2 px-5 disabled:opacity-60"
              >
                {createMutation.isPending ? 'Création…' : 'Créer le paiement'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Modal Reçu de Paiement ─────────────────────────────────────────── */}
      {selectedReceipt && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
          onClick={() => setSelectedReceipt(null)}
        >
          <div
            id="printable-receipt"
            className="card w-full max-w-md bg-[#0f172a] border border-primary-500/40 shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedReceipt(null)}
              className="no-print absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header reçu */}
            <div className="text-center pb-4 border-b border-white/10 receipt-header-print">
              <div className="print-only text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">
                AymnEDU — Centre de Soutien Scolaire
              </div>
              <span className={`no-print inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold mb-2 ${
                selectedReceipt.statut === 'paye'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
              }`}>
                {selectedReceipt.statut === 'paye' ? 'Paiement Validé (Soldé) ✓' : 'Acompte / Versement Partiel ⏳'}
              </span>
              <h2 className="font-heading text-xl font-bold text-white receipt-title-print">
                {selectedReceipt.statut === 'paye' ? 'Reçu d\'encaissement' : 'Reçu d\'acompte'}
              </h2>
              <p className="text-xs text-primary-400 font-mono mt-1">
                {selectedReceipt.recu_numero || `REC-${String(selectedReceipt.id).padStart(4, '0')}`}
              </p>
            </div>

            <div className="py-4 space-y-3 text-sm">
              {[
                { label: 'Élève :', value: selectedReceipt.eleve_nom || '—' },
                { label: 'Groupe :', value: selectedReceipt.groupe_nom || '—' },
                { label: 'Mois concerné :', value: selectedReceipt.mois || '—' },
                {
                  label: 'Date d\'encaissement :',
                  value: selectedReceipt.date_paiement
                    ? new Date(selectedReceipt.date_paiement).toLocaleDateString('fr-DZ', {
                        year: 'numeric', month: 'long', day: 'numeric',
                      })
                    : "Aujourd'hui",
                },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between py-1 border-b border-white/5 receipt-row-print">
                  <span className="text-slate-400">{label}</span>
                  <span className="font-semibold text-white value">{value}</span>
                </div>
              ))}

              <div className="flex justify-between py-1 border-b border-white/5 receipt-row-print">
                <span className="text-slate-400">Statut :</span>
                <span className={`font-semibold value ${selectedReceipt.statut === 'paye' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {selectedReceipt.statut === 'paye' ? 'Réglé en totalité' : 'Versement partiel'}
                </span>
              </div>

              {selectedReceipt.statut === 'partiel' && (
                <>
                  <div className="flex justify-between py-1 border-b border-white/5 receipt-row-print">
                    <span className="text-slate-400">Total dû pour ce mois :</span>
                    <span className="font-semibold text-white value">
                      {Number(selectedReceipt.montant).toLocaleString('fr-DZ')} DA
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5 receipt-row-print">
                    <span className="text-slate-400">Reste à payer :</span>
                    <span className="font-semibold text-amber-400 value">
                      {Math.max(0, Number(selectedReceipt.montant) - Number(selectedReceipt.montant_verse || 0)).toLocaleString('fr-DZ')} DA
                    </span>
                  </div>
                </>
              )}

              <div className={`flex justify-between py-2.5 px-3 rounded-lg border receipt-total-print items-center ${
                selectedReceipt.statut === 'paye'
                  ? 'bg-primary-500/10 border-primary-500/20'
                  : 'bg-amber-500/10 border-amber-500/20'
              }`}>
                <span className={`font-semibold ${selectedReceipt.statut === 'paye' ? 'text-primary-300' : 'text-amber-300'}`}>
                  {selectedReceipt.statut === 'paye' ? 'Montant total réglé :' : 'Montant versé à ce jour :'}
                </span>
                <span className={`font-heading font-bold text-xl ${selectedReceipt.statut === 'paye' ? 'text-primary-400' : 'text-amber-400'}`}>
                  {(selectedReceipt.statut === 'paye' ? Number(selectedReceipt.montant) : Number(selectedReceipt.montant_verse || 0)).toLocaleString('fr-DZ')} DA
                </span>
              </div>
            </div>

            {/* Cachet & Signature (impression uniquement) */}
            <div className="print-only receipt-stamp-print text-xs">
              <div>
                <p className="font-semibold text-slate-700">Cachet de l'établissement :</p>
                <div className="h-16 w-36 border border-dashed border-slate-400 rounded mt-1 flex items-center justify-center text-[10px] text-slate-400">
                  Emplacement cachet
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-slate-700">Signature caisse :</p>
                <div className="h-16 w-36 border border-dashed border-slate-400 rounded mt-1 ml-auto"></div>
              </div>
            </div>
            <div className="print-only text-center text-[10px] text-slate-500 mt-4 border-t border-slate-200 pt-2">
              Ce reçu fait foi de paiement et doit être conservé par le tuteur légal pour toute réclamation.
            </div>

            {/* Boutons action */}
            <div className="no-print flex flex-wrap gap-2.5 justify-end pt-3 border-t border-white/5 mt-2">
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="btn-secondary text-sm py-2 px-3"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={() => generateReceiptPdf(selectedReceipt)}
                className="btn-secondary text-sm flex items-center gap-2 py-2 px-3.5 text-primary-400 hover:text-primary-300 border-primary-500/30 hover:bg-primary-500/10 transition-colors"
                title="Télécharger le fichier PDF"
              >
                <Download className="w-4 h-4" />
                Télécharger PDF
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-primary text-sm flex items-center gap-2 py-2 px-3.5"
                title="Imprimer sur votre imprimante"
              >
                <Printer className="w-4 h-4" />
                Imprimer
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
