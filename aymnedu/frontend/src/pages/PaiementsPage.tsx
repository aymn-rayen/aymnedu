import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { paiementsApi, groupesApi, elevesApi, caisseApi } from '@/api'
import { useAuth } from '@/hooks/useAuth'
import {
  CheckCircle, AlertTriangle, Receipt, Printer, Download,
  X, ChevronLeft, ChevronRight, Plus, Banknote, Coins,
  Calendar, Lock, ShieldCheck, CheckCheck, Clock, UserCheck
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
  const { user } = useAuth()
  const isDirecteur = user?.role === 'directeur'

  // ── Onglet Actif ──────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'paiements' | 'caisse'>('paiements')

  // ── Filtres liste des paiements ───────────────────────────────────────────
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

  // ── Modal Génération Échéances Mensuelles (Directeur) ─────────────────────
  const [showGenererModal, setShowGenererModal] = useState(false)
  const [genererMoisNum, setGenererMoisNum] = useState<number>(CURRENT_MONTH)
  const [genererAnnee, setGenererAnnee] = useState<number>(CURRENT_YEAR)
  const [genererFeedback, setGenererFeedback] = useState<string | null>(null)

  // ── Caisse du Jour & Clôture ──────────────────────────────────────────────
  const [caisseDate, setCaisseDate] = useState<string>(() => new Date().toISOString().split('T')[0])
  const [showFermerModal, setShowFermerModal] = useState(false)
  const [especesReelInput, setEspecesReelInput] = useState<string>('')
  const [notesCaisseInput, setNotesCaisseInput] = useState<string>('')
  const [caisseError, setCaisseError] = useState<string | null>(null)

  // Données pour le formulaire de création manuelle
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

  // ── Queries Paiements ─────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['paiements', statut, filterMois, page],
    queryFn: () => paiementsApi.list({
      statut: statut || undefined,
      mois: filterMois > 0 ? `${filterMois}` : undefined,
      page,
    }),
    enabled: activeTab === 'paiements',
  })

  // ── Query Caisse du Jour ──────────────────────────────────────────────────
  const { data: caisseData, isLoading: isLoadingCaisse } = useQuery({
    queryKey: ['caisse-jour', caisseDate],
    queryFn: () => caisseApi.getJour(caisseDate),
    enabled: activeTab === 'caisse',
  })

  // ── Mutations ─────────────────────────────────────────────────────────────
  const verserMutation = useMutation({
    mutationFn: ({ id, montant }: { id: number; montant: number }) =>
      paiementsApi.verser(id, montant),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['paiements'] })
      qc.invalidateQueries({ queryKey: ['caisse-jour'] })
      setVersementTarget(null)
      setVersementMontant('')
      setVersementError('')
    },
    onError: (err: any) => {
      setVersementError(err?.response?.data?.detail ?? "Erreur lors de l'enregistrement du versement.")
    },
  })

  const createMutation = useMutation({
    mutationFn: paiementsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['paiements'] })
      setShowNewForm(false)
      setNewEleve('')
      setNewGroupe('')
      setNewMontant('')
      setNewError('')
    },
    onError: (err: any) => {
      setNewError(err?.response?.data?.detail ?? "Erreur lors de la création du paiement.")
    },
  })

  const genererMutation = useMutation({
    mutationFn: (mois: string) => paiementsApi.genererMois(mois),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['paiements'] })
      setGenererFeedback(res.message)
      setTimeout(() => {
        setShowGenererModal(false)
        setGenererFeedback(null)
      }, 3500)
    },
    onError: (err: any) => {
      setGenererFeedback(err?.response?.data?.detail ?? "Erreur lors de la génération.")
    },
  })

  const fermerCaisseMutation = useMutation({
    mutationFn: () => {
      setCaisseError(null)
      return caisseApi.fermer({
        date_cloture: caisseDate,
        total_especes_reel: parseFloat(especesReelInput || '0'),
        notes: notesCaisseInput || undefined,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['caisse-jour'] })
      setShowFermerModal(false)
      setEspecesReelInput('')
      setNotesCaisseInput('')
    },
    onError: (err: any) => {
      setCaisseError(err?.response?.data?.detail ?? "Erreur lors de la fermeture de la caisse.")
    },
  })

  const validerCaisseMutation = useMutation({
    mutationFn: () => caisseApi.valider({ date_cloture: caisseDate }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['caisse-jour'] })
    },
    onError: (err: any) => {
      alert(err?.response?.data?.detail ?? "Erreur lors de la validation.")
    },
  })

  // Handlers
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

  const handleLancerGeneration = () => {
    const moisStr = `${genererAnnee}-${String(genererMoisNum).padStart(2, '0')}`
    genererMutation.mutate(moisStr)
  }

  // Totaux de page
  const totalEncaisse = data?.items?.reduce((s, p) => s + Number(p.montant_verse || 0), 0) ?? 0
  const totalReste = data?.items?.reduce((s, p) => {
    const total = Number(p.montant || 0)
    const verse = Number(p.montant_verse || 0)
    return s + Math.max(0, total - verse)
  }, 0) ?? 0

  return (
    <div className="space-y-6 text-[#1E293B]">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#1E293B]">Finances & Caisse</h1>
          <p className="text-[#64748B] text-sm mt-1">
            Suivi des échéances mensuelles, règlements et clôtures journalières de caisse
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {isDirecteur && activeTab === 'paiements' && (
            <button
              onClick={() => { setShowGenererModal(true); setGenererFeedback(null) }}
              className="btn-secondary flex items-center gap-2 text-sm border-blue-200 text-[#2563EB] hover:bg-blue-50"
              title="Générer les créances mensuelles pour tous les élèves inscrits"
            >
              <Calendar className="w-4 h-4" />
              Générer les échéances
            </button>
          )}

          {activeTab === 'paiements' && (
            <button
              onClick={() => { setShowNewForm(true); setNewError('') }}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" />
              Nouveau paiement
            </button>
          )}
        </div>
      </div>

      {/* Onglets de navigation */}
      <div className="flex border-b border-[#E2E8F0] gap-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('paiements')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-2 select-none ${
            activeTab === 'paiements'
              ? 'border-[#2563EB] text-[#2563EB]'
              : 'border-transparent text-[#64748B] hover:text-[#1E293B]'
          }`}
        >
          <Coins className="w-4 h-4" /> Suivi des Échéances & Paiements
        </button>
        <button
          onClick={() => setActiveTab('caisse')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-2 select-none ${
            activeTab === 'caisse'
              ? 'border-[#2563EB] text-[#2563EB]'
              : 'border-transparent text-[#64748B] hover:text-[#1E293B]'
          }`}
        >
          <Banknote className="w-4 h-4" /> Point de Caisse du Jour & Clôture
        </button>
      </div>

      {/* ========================================================================= */}
      {/* ONGLET 1 : SUIVI DES ÉCHÉANCES & PAIEMENTS                               */}
      {/* ========================================================================= */}
      {activeTab === 'paiements' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Cartes KPI */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="card border-blue-100 bg-white">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-[#2563EB]" />
                <span className="text-xs font-medium text-[#64748B]">Total Encaissé (cette page)</span>
              </div>
              <p className="font-heading text-2xl font-bold text-[#2563EB]">
                {totalEncaisse.toLocaleString('fr-DZ')} DA
              </p>
            </div>
            <div className="card border-amber-100 bg-white">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-medium text-[#64748B]">Reste à Recouvrer (cette page)</span>
              </div>
              <p className="font-heading text-2xl font-bold text-amber-600">
                {totalReste.toLocaleString('fr-DZ')} DA
              </p>
            </div>
          </div>

          {/* Filtres */}
          <div className="flex gap-3 flex-wrap items-center">
            <select
              className="input w-auto text-sm"
              value={filterMois}
              onChange={e => { setFilterMois(Number(e.target.value)); setPage(1) }}
            >
              <option value={0}>Tous les mois</option>
              {MOIS_LABELS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select
              className="input w-auto text-sm"
              value={statut}
              onChange={e => { setStatut(e.target.value); setPage(1) }}
            >
              <option value="">Tous les statuts</option>
              <option value="paye">Payé (Soldé)</option>
              <option value="partiel">Partiel (Acompte versé)</option>
              <option value="impaye">Impayé (0 DA)</option>
            </select>
          </div>

          {/* Tableau */}
          <div className="card p-0 overflow-hidden bg-white shadow-xs border border-[#E2E8F0]">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="table-header">Élève</th>
                    <th className="table-header">Groupe</th>
                    <th className="table-header">Mois</th>
                    <th className="table-header text-right">Total Dû</th>
                    <th className="table-header text-right">Versé</th>
                    <th className="table-header text-right">Reste</th>
                    <th className="table-header text-center">Statut</th>
                    <th className="table-header">Dernier Reçu</th>
                    <th className="table-header text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={9} className="table-cell text-center text-[#64748B] py-12">Chargement…</td></tr>
                  ) : !data?.items?.length ? (
                    <tr><td colSpan={9} className="table-cell text-center text-[#64748B] py-12">Aucun paiement trouvé.</td></tr>
                  ) : data.items.map(p => {
                    const total = Number(p.montant || 0)
                    const verse = Number(p.montant_verse || 0)
                    const reste = Math.max(0, total - verse)
                    return (
                      <tr key={p.id} className="table-row">
                        <td className="table-cell font-semibold text-[#1E293B]">{p.eleve_nom}</td>
                        <td className="table-cell text-[#64748B]">{p.groupe_nom}</td>
                        <td className="table-cell font-mono text-xs text-[#64748B]">{p.mois}</td>
                        <td className="table-cell text-right font-medium">{total.toLocaleString('fr-DZ')} DA</td>
                        <td className="table-cell text-right text-emerald-600 font-semibold">{verse.toLocaleString('fr-DZ')} DA</td>
                        <td className="table-cell text-right">
                          <span className={`font-semibold ${reste > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                            {reste > 0 ? `${reste.toLocaleString('fr-DZ')} DA` : '0 DA'}
                          </span>
                        </td>
                        <td className="table-cell text-center">
                          <span className={
                            p.statut === 'paye' ? 'badge-success'
                            : p.statut === 'partiel' ? 'bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-amber-300'
                            : 'badge-danger'
                          }>
                            {p.statut === 'paye' ? 'Payé' : p.statut === 'partiel' ? 'Partiel' : 'Impayé'}
                          </span>
                        </td>
                        <td className="table-cell font-mono text-xs text-[#2563EB]">
                          {p.recu_numero ? (
                            <button
                              onClick={() => setSelectedReceipt(p)}
                              className="hover:underline flex items-center gap-1 text-[#2563EB] font-bold"
                              title="Voir et imprimer le reçu"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                              {p.recu_numero}
                            </button>
                          ) : '—'}
                        </td>
                        <td className="table-cell text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {p.statut !== 'paye' && (
                              <button
                                onClick={() => openVersementModal(p)}
                                className="btn-primary text-xs py-1 px-2.5 flex items-center gap-1"
                              >
                                <Banknote className="w-3.5 h-3.5" />
                                {p.statut === 'partiel' ? 'Compléter' : 'Encaisser'}
                              </button>
                            )}
                            {p.statut === 'paye' && (
                              <button
                                onClick={() => setSelectedReceipt(p)}
                                className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1"
                              >
                                <Printer className="w-3.5 h-3.5" /> Reçu
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
              <div className="flex items-center justify-between px-4 py-3 border-t border-[#E2E8F0] bg-slate-50">
                <span className="text-xs text-[#64748B]">
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 2 : POINT DE CAISSE DU JOUR & CLÔTURE                             */}
      {/* ========================================================================= */}
      {activeTab === 'caisse' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Barre supérieure : Sélecteur de date & Statut */}
          <div className="card bg-white p-5 border border-[#E2E8F0] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Date du point :</label>
              <input
                type="date"
                className="input w-auto font-medium"
                value={caisseDate}
                onChange={e => setCaisseDate(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3">
              {/* Badge de statut */}
              {caisseData?.statut === 'ouverte' && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-[#2563EB] border border-blue-200 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Caisse Ouverte (Encaissements en cours)
                </span>
              )}
              {caisseData?.statut === 'en_attente_validation' && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-300 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5" /> Fermée par Secrétaire — En attente validation Directeur
                </span>
              )}
              {caisseData?.statut === 'validee' && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" /> Caisse Validée & Verrouillée
                </span>
              )}

              {/* Bouton Fermer (Secrétaire ou Directeur) */}
              {caisseData?.statut === 'ouverte' && (
                <button
                  onClick={() => {
                    setEspecesReelInput(String(caisseData.total_especes_theorique || ''))
                    setShowFermerModal(true)
                  }}
                  className="btn-primary text-xs flex items-center gap-1.5 py-2"
                >
                  <Lock className="w-3.5 h-3.5" /> Fermer la Caisse du Jour
                </button>
              )}

              {/* Bouton Valider (Directeur Seul) */}
              {caisseData?.statut === 'en_attente_validation' && isDirecteur && (
                <button
                  onClick={() => validerCaisseMutation.mutate()}
                  disabled={validerCaisseMutation.isPending}
                  className="btn-primary bg-emerald-600 hover:bg-emerald-700 text-xs flex items-center gap-1.5 py-2"
                >
                  <CheckCheck className="w-3.5 h-3.5" /> Valider & Verrouiller Définitivement
                </button>
              )}
            </div>
          </div>

          {/* Cartes Métriques Caisse */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card border-blue-100 bg-white">
              <div className="flex items-center gap-2 mb-1">
                <Banknote className="w-4 h-4 text-[#2563EB]" />
                <span className="text-xs font-medium text-[#64748B]">Espèces Théoriques (Comptoir)</span>
              </div>
              <p className="font-heading text-2xl font-bold text-[#2563EB]">
                {(caisseData?.total_especes_theorique ?? 0).toLocaleString('fr-DZ')} DA
              </p>
            </div>

            <div className="card border-indigo-100 bg-white">
              <div className="flex items-center gap-2 mb-1">
                <Receipt className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-medium text-[#64748B]">BaridiMob / Virement</span>
              </div>
              <p className="font-heading text-2xl font-bold text-indigo-700">
                {(caisseData?.total_baridimob_theorique ?? 0).toLocaleString('fr-DZ')} DA
              </p>
            </div>

            <div className="card border-emerald-100 bg-white">
              <div className="flex items-center gap-2 mb-1">
                <Coins className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-medium text-[#64748B]">Total Encaissé Aujourd'hui</span>
              </div>
              <p className="font-heading text-2xl font-bold text-emerald-700">
                {(caisseData?.total_theorique ?? 0).toLocaleString('fr-DZ')} DA
              </p>
              <p className="text-[11px] text-[#64748B] mt-1">{caisseData?.nb_versements ?? 0} reçu(s) émis</p>
            </div>

            <div className={`card bg-white ${
              caisseData?.ecart && caisseData.ecart !== 0 ? 'border-red-200 ring-1 ring-red-300' : 'border-slate-200'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-medium text-[#64748B]">Écart de Caisse Constaté</span>
              </div>
              <p className={`font-heading text-2xl font-bold ${
                (caisseData?.ecart ?? 0) === 0 ? 'text-emerald-600' : 'text-red-600'
              }`}>
                {caisseData?.total_especes_reel !== null && caisseData?.total_especes_reel !== undefined
                  ? `${(caisseData.ecart ?? 0) > 0 ? '+' : ''}${(caisseData.ecart ?? 0).toLocaleString('fr-DZ')} DA`
                  : '—'}
              </p>
              <p className="text-[11px] text-[#64748B] mt-1">
                {caisseData?.total_especes_reel !== null && caisseData?.total_especes_reel !== undefined
                  ? `Recompté : ${caisseData.total_especes_reel.toLocaleString('fr-DZ')} DA`
                  : 'En attente de recomptage'}
              </p>
            </div>
          </div>

          {/* Tableau des versements du jour */}
          <div className="card p-0 overflow-hidden bg-white shadow-xs border border-[#E2E8F0]">
            <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between bg-slate-50">
              <h3 className="font-heading font-bold text-sm text-[#1E293B]">
                Lignes d'encaissement de la journée ({caisseData?.versements?.length ?? 0})
              </h3>
              <button onClick={() => window.print()} className="btn-secondary py-1 px-3 text-xs flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5" /> Imprimer feuille de caisse
              </button>
            </div>

            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Heure</th>
                  <th className="table-header">N° Reçu</th>
                  <th className="table-header">Élève</th>
                  <th className="table-header">Groupe</th>
                  <th className="table-header">Mode</th>
                  <th className="table-header">Encaissé par</th>
                  <th className="table-header text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingCaisse ? (
                  <tr><td colSpan={7} className="table-cell text-center text-[#64748B] py-12">Chargement de la caisse…</td></tr>
                ) : !caisseData?.versements?.length ? (
                  <tr><td colSpan={7} className="table-cell text-center text-[#64748B] py-12">Aucun encaissement enregistré pour cette date.</td></tr>
                ) : (
                  caisseData.versements.map(v => (
                    <tr key={v.id} className="table-row">
                      <td className="table-cell font-mono text-xs text-[#64748B]">
                        {new Date(v.date_versement).toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="table-cell font-mono text-xs font-bold text-[#2563EB]">{v.recu_numero}</td>
                      <td className="table-cell font-semibold text-[#1E293B]">{v.eleve_nom ?? '—'}</td>
                      <td className="table-cell text-[#64748B]">{v.groupe_nom ?? '—'}</td>
                      <td className="table-cell">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          v.mode_reglement === 'especes'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        }`}>
                          {v.mode_reglement === 'especes' ? '💵 Espèces' : '📱 BaridiMob'}
                        </span>
                      </td>
                      <td className="table-cell text-xs text-[#64748B]">{v.recu_par_nom ?? 'Secrétariat'}</td>
                      <td className="table-cell text-right font-bold text-emerald-700">
                        {v.montant.toLocaleString('fr-DZ')} DA
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1 : GÉNÉRATION MENSUELLE DES ÉCHÉANCES (DIRECTEUR)                 */}
      {/* ========================================================================= */}
      {showGenererModal && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn"
          onClick={() => setShowGenererModal(false)}
        >
          <div
            className="card w-full max-w-md bg-white border border-[#E2E8F0] shadow-2xl p-6 relative"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setShowGenererModal(false)}
              className="absolute top-4 right-4 text-[#64748B] hover:text-[#1E293B]"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-blue-50 text-[#2563EB] border border-blue-200">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-heading font-bold text-lg text-[#1E293B]">Générer les Échéances Mensuelles</h2>
                <p className="text-xs text-[#64748B]">Action réservée à la direction de l'école</p>
              </div>
            </div>

            <p className="text-xs text-[#64748B] leading-relaxed mb-4">
              Cette action parcourt automatiquement <strong>tous les élèves actifs inscrits dans des groupes</strong> et crée leurs échéances impayées au tarif officiel du groupe.
              <br /><br />
              <span className="font-semibold text-emerald-700">✓ Idempotence garantie :</span> aucun doublon ne sera créé pour les élèves qui ont déjà une facture pour ce mois.
            </p>

            {genererFeedback && (
              <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-[#2563EB] font-medium">
                {genererFeedback}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div>
                <label className="label">Mois</label>
                <select
                  className="input"
                  value={genererMoisNum}
                  onChange={e => setGenererMoisNum(Number(e.target.value))}
                >
                  {MOIS_LABELS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Année</label>
                <select
                  className="input"
                  value={genererAnnee}
                  onChange={e => setGenererAnnee(Number(e.target.value))}
                >
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => setShowGenererModal(false)}
                className="btn-secondary text-sm"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={handleLancerGeneration}
                disabled={genererMutation.isPending}
                className="btn-primary text-sm flex items-center gap-2"
              >
                {genererMutation.isPending ? 'Génération en cours…' : 'Lancer la génération en 1 clic'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 2 : FERMETURE DE CAISSE DU JOUR (RECOMPTAGE PHYSIQUE)             */}
      {/* ========================================================================= */}
      {showFermerModal && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn"
          onClick={() => setShowFermerModal(false)}
        >
          <div
            className="card w-full max-w-md bg-white border border-[#E2E8F0] shadow-2xl p-6 relative"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setShowFermerModal(false)}
              className="absolute top-4 right-4 text-[#64748B] hover:text-[#1E293B]"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-heading font-bold text-lg text-[#1E293B]">Clôture de Caisse Journalière</h2>
                <p className="text-xs text-[#64748B]">Date : {caisseDate}</p>
              </div>
            </div>

            {caisseError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600">
                {caisseError}
              </div>
            )}

            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-[#E2E8F0] text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Espèces théoriques selon logiciel :</span>
                  <span className="font-bold text-[#1E293B]">{(caisseData?.total_especes_theorique ?? 0).toLocaleString('fr-DZ')} DA</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">BaridiMob théorique :</span>
                  <span className="font-bold text-[#1E293B]">{(caisseData?.total_baridimob_theorique ?? 0).toLocaleString('fr-DZ')} DA</span>
                </div>
              </div>

              <div>
                <label className="label">Montant liquide physique recompté (DA) *</label>
                <input
                  type="number"
                  step="50"
                  className="input font-bold text-lg text-emerald-700"
                  placeholder="ex: 45000"
                  value={especesReelInput}
                  onChange={e => setEspecesReelInput(e.target.value)}
                />
                {(() => {
                  const reel = parseFloat(especesReelInput || '0')
                  const theo = caisseData?.total_especes_theorique ?? 0
                  const diff = reel - theo
                  return (
                    <p className={`text-xs mt-1.5 font-semibold ${diff === 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      Écart calculé : {diff > 0 ? `+${diff.toLocaleString('fr-DZ')}` : diff.toLocaleString('fr-DZ')} DA
                      {diff === 0 && ' (Caisse parfaitement équilibrée ✓)'}
                    </p>
                  )
                })()}
              </div>

              <div>
                <label className="label">Remarques ou observations (Optionnel)</label>
                <textarea
                  className="input text-xs"
                  rows={2}
                  placeholder="ex: Remis sous enveloppe scellée au directeur..."
                  value={notesCaisseInput}
                  onChange={e => setNotesCaisseInput(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#E2E8F0] mt-6">
              <button
                type="button"
                onClick={() => setShowFermerModal(false)}
                className="btn-secondary text-sm"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => fermerCaisseMutation.mutate()}
                disabled={fermerCaisseMutation.isPending}
                className="btn-primary text-sm flex items-center gap-1.5"
              >
                {fermerCaisseMutation.isPending ? 'Enregistrement…' : 'Confirmer la Fermeture'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 3 : VERSEMENT PARTIEL / TOTAL SUR UN PAIEMENT                      */}
      {/* ========================================================================= */}
      {versementTarget && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          onClick={() => setVersementTarget(null)}
        >
          <div
            className="card w-full max-w-md bg-white border border-[#E2E8F0] shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setVersementTarget(null)}
              className="absolute top-4 right-4 text-[#64748B] hover:text-[#1E293B]"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 rounded-xl bg-blue-50 text-[#2563EB] border border-blue-200">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-heading text-lg font-bold text-[#1E293B]">
                  {versementTarget.statut === 'partiel' ? 'Compléter le versement' : 'Encaisser le paiement'}
                </h2>
                <p className="text-xs text-[#64748B]">Mois : {versementTarget.mois}</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-[#E2E8F0] text-xs space-y-1 mb-4">
              <div className="flex justify-between">
                <span className="text-[#64748B]">Élève :</span>
                <span className="font-semibold text-[#1E293B]">{versementTarget.eleve_nom}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Groupe :</span>
                <span className="font-semibold text-[#1E293B]">{versementTarget.groupe_nom}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Total du cours :</span>
                <span className="font-semibold text-[#1E293B]">{Number(versementTarget.montant).toLocaleString('fr-DZ')} DA</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200">
                <span className="text-[#64748B]">Reste à régler :</span>
                <span className="font-bold text-amber-600">
                  {Math.max(0, Number(versementTarget.montant) - Number(versementTarget.montant_verse || 0)).toLocaleString('fr-DZ')} DA
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <label className="label">Montant à encaisser (DA) *</label>
              <input
                type="number"
                step="50"
                className="input text-lg font-bold text-emerald-700"
                placeholder="Montant à encaisser"
                value={versementMontant}
                onChange={e => setVersementMontant(e.target.value)}
              />

              {versementError && (
                <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-600 rounded-xl">
                  {versementError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => setVersementTarget(null)}
                className="btn-secondary text-sm"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleValiderVersement}
                disabled={verserMutation.isPending}
                className="btn-primary text-sm flex items-center gap-1.5"
              >
                {verserMutation.isPending ? 'Enregistrement…' : 'Valider l\'encaissement'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 4 : REÇU DE PAIEMENT IMPRIMABLE                                    */}
      {/* ========================================================================= */}
      {selectedReceipt && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn"
          onClick={() => setSelectedReceipt(null)}
        >
          <div
            id="printable-receipt"
            className="card w-full max-w-md bg-white border border-[#E2E8F0] shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedReceipt(null)}
              className="no-print absolute top-4 right-4 text-[#64748B] hover:text-[#1E293B]"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center pb-4 border-b border-[#E2E8F0]">
              <div className="text-xs font-semibold uppercase tracking-widest text-[#64748B] mb-1">
                AymnEDU — Centre de Soutien Scolaire
              </div>
              <h2 className="font-heading text-xl font-bold text-[#1E293B]">
                {selectedReceipt.statut === 'paye' ? 'Reçu d\'encaissement' : 'Reçu d\'acompte'}
              </h2>
              <p className="text-xs text-[#2563EB] font-mono mt-1 font-bold">
                {selectedReceipt.recu_numero || `REC-${String(selectedReceipt.id).padStart(4, '0')}`}
              </p>
            </div>

            <div className="py-4 space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-[#64748B]">Élève :</span>
                <span className="font-semibold text-[#1E293B]">{selectedReceipt.eleve_nom || '—'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-[#64748B]">Groupe :</span>
                <span className="font-semibold text-[#1E293B]">{selectedReceipt.groupe_nom || '—'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-[#64748B]">Mois concerné :</span>
                <span className="font-semibold text-[#1E293B]">{selectedReceipt.mois || '—'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-[#64748B]">Date :</span>
                <span className="font-semibold text-[#1E293B]">
                  {selectedReceipt.date_paiement
                    ? new Date(selectedReceipt.date_paiement).toLocaleDateString('fr-DZ', { year: 'numeric', month: 'long', day: 'numeric' })
                    : "Aujourd'hui"}
                </span>
              </div>
              <div className="flex justify-between py-2 px-3 rounded-lg bg-emerald-50 border border-emerald-200 mt-3 items-center">
                <span className="font-bold text-emerald-900">Montant versé :</span>
                <span className="font-heading font-bold text-lg text-emerald-700">
                  {Number(selectedReceipt.montant_verse || selectedReceipt.montant).toLocaleString('fr-DZ')} DA
                </span>
              </div>
            </div>

            <div className="no-print flex gap-2.5 justify-end pt-3 border-t border-[#E2E8F0] mt-2">
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="btn-secondary text-xs py-2 px-3"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={() => generateReceiptPdf(selectedReceipt)}
                className="btn-secondary text-xs flex items-center gap-1.5 py-2 px-3 text-[#2563EB]"
              >
                <Download className="w-3.5 h-3.5" /> PDF
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-primary text-xs flex items-center gap-1.5 py-2 px-3"
              >
                <Printer className="w-3.5 h-3.5" /> Imprimer
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Modal Nouveau Paiement Manuel ─────────────────────────────────── */}
      {showNewForm && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          onClick={() => setShowNewForm(false)}
        >
          <div
            className="card w-full max-w-md bg-white border border-[#E2E8F0] shadow-2xl p-6 relative"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setShowNewForm(false)}
              className="absolute top-4 right-4 text-[#64748B] hover:text-[#1E293B]"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="font-heading text-lg font-bold text-[#1E293B] mb-5">Créer un Paiement Manuel</h2>

            <div className="space-y-4">
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

              <div>
                <label className="label">Montant Total Dû (DA) *</label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  className="input font-mono font-bold"
                  placeholder="ex: 2500"
                  value={newMontant}
                  onChange={e => setNewMontant(e.target.value)}
                />
              </div>

              {newError && (
                <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-600 rounded-xl">
                  {newError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                className="btn-secondary text-sm"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleCreatePaiement}
                disabled={createMutation.isPending}
                className="btn-primary text-sm"
              >
                {createMutation.isPending ? 'Création…' : 'Créer le paiement'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
