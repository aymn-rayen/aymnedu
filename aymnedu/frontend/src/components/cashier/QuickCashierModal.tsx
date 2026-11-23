import React, { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { elevesApi, paiementsApi } from '@/api'
import type { EleveQuickSummary, EleveUnpaidPaiement } from '@/types'
import {
  Search, X, Phone, BookOpen, AlertCircle, CheckCircle2,
  Coins, Loader2, CreditCard, Sparkles, Command
} from 'lucide-react'

interface QuickCashierModalProps {
  isOpen: boolean
  onClose: () => void
}

export function QuickCashierModal({ isOpen, onClose }: QuickCashierModalProps) {
  const qc = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedEleve, setSelectedEleve] = useState<EleveQuickSummary | null>(null)

  // Payment encaissement state
  const [payingPaiement, setPayingPaiement] = useState<EleveUnpaidPaiement | null>(null)
  const [montantVerse, setMontantVerse] = useState<number>(0)
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)

  // Debounce search input (250ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim())
    }, 250)
    return () => clearTimeout(handler)
  }, [searchTerm])

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setSelectedEleve(null)
      setPayingPaiement(null)
      setPaymentSuccess(null)
      setPaymentError(null)
    }
  }, [isOpen])

  // Keyboard escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (payingPaiement) {
          setPayingPaiement(null)
        } else if (selectedEleve) {
          setSelectedEleve(null)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, payingPaiement, selectedEleve, onClose])

  // Query search
  const { data: results = [], isFetching } = useQuery({
    queryKey: ['quick-search-eleves', debouncedSearch],
    queryFn: () => elevesApi.quickSearch(debouncedSearch),
    enabled: isOpen && debouncedSearch.length >= 2,
    staleTime: 5000,
  })

  // Keep selectedEleve fresh if results change
  useEffect(() => {
    if (selectedEleve && results.length > 0) {
      const updated = results.find(e => e.id === selectedEleve.id)
      if (updated) setSelectedEleve(updated)
    }
  }, [results])

  // Mutation: Encaissement Rapide
  const verserMutation = useMutation({
    mutationFn: ({ id, montant }: { id: number; montant: number }) =>
      paiementsApi.verser(id, montant),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quick-search-eleves'] })
      qc.invalidateQueries({ queryKey: ['paiements'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      setPaymentSuccess(`Paiement de ${montantVerse.toLocaleString('fr-DZ')} DA enregistré avec succès !`)
      setPaymentError(null)
      setPayingPaiement(null)
      setTimeout(() => setPaymentSuccess(null), 3500)
    },
    onError: (err: any) => {
      setPaymentError(err?.response?.data?.detail || "Erreur lors de l'encaissement")
    },
  })

  const openCashierFor = (paiement: EleveUnpaidPaiement) => {
    setPayingPaiement(paiement)
    setMontantVerse(paiement.reste)
    setPaymentSuccess(null)
    setPaymentError(null)
  }

  const handleConfirmPayment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!payingPaiement || montantVerse <= 0) return
    verserMutation.mutate({ id: payingPaiement.id, montant: Number(montantVerse) })
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white border border-[#E2E8F0] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[82vh] text-[#1E293B]"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Search Bar */}
        <div className="p-4 border-b border-[#E2E8F0] bg-white flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#2563EB] flex-shrink-0">
            <Search className="w-5 h-5" />
          </div>

          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value)
                if (selectedEleve) setSelectedEleve(null)
              }}
              placeholder="Tapez le prénom ou nom de l'élève (ex: Amine, Benali)..."
              className="w-full text-base font-medium placeholder-slate-400 bg-transparent outline-none text-[#1E293B]"
            />
          </div>

          {isFetching && <Loader2 className="w-5 h-5 text-[#2563EB] animate-spin flex-shrink-0" />}

          <div className="flex items-center gap-1.5 text-xs text-[#64748B] bg-slate-100 px-2 py-1 rounded-md border border-[#E2E8F0]">
            <Command className="w-3 h-3" />
            <span>K</span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#64748B] hover:text-[#1E293B] hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Feedback Banner */}
        {paymentSuccess && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-2.5 flex items-center gap-2 text-xs font-semibold text-[#10B981] animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{paymentSuccess}</span>
          </div>
        )}

        {paymentError && (
          <div className="bg-red-50 border-b border-red-200 px-5 py-2.5 flex items-center gap-2 text-xs font-semibold text-red-600 animate-fadeIn">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{paymentError}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* If user is currently completing an encaissement */}
          {payingPaiement && (
            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-[#2563EB]" />
                  <h3 className="font-bold text-sm text-[#1E293B]">
                    Encaisser le versement — {payingPaiement.groupe_nom} ({payingPaiement.mois})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPayingPaiement(null)}
                  className="text-xs text-[#64748B] hover:text-[#1E293B] underline"
                >
                  Retour
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-white border border-[#E2E8F0]">
                  <span className="text-[#64748B] block">Total mensualité</span>
                  <span className="font-semibold text-[#1E293B]">{payingPaiement.montant.toLocaleString('fr-DZ')} DA</span>
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-[#E2E8F0]">
                  <span className="text-[#64748B] block">Reste dû</span>
                  <span className="font-bold text-red-600">{payingPaiement.reste.toLocaleString('fr-DZ')} DA</span>
                </div>
              </div>

              <form onSubmit={handleConfirmPayment} className="space-y-3 pt-1">
                <div>
                  <label className="label text-xs">Montant à encaisser aujourd'hui (DA) *</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      max={payingPaiement.reste}
                      value={montantVerse}
                      onChange={e => setMontantVerse(Number(e.target.value))}
                      className="input py-2 font-mono font-bold text-base"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setMontantVerse(payingPaiement.reste)}
                      className="btn-secondary text-xs px-3 py-2 flex-shrink-0"
                    >
                      Tout solder ({payingPaiement.reste} DA)
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setPayingPaiement(null)}
                    className="btn-secondary text-xs py-2 px-4"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={verserMutation.isPending || montantVerse <= 0}
                    className="btn-primary text-xs py-2 px-5 flex items-center gap-1.5"
                  >
                    {verserMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
                    Valider le reçu
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Prompt when empty */}
          {debouncedSearch.length < 2 && (
            <div className="text-center py-10 text-slate-400">
              <Sparkles className="w-8 h-8 mx-auto mb-2 text-[#2563EB]" />
              <p className="text-sm font-medium text-[#1E293B]">Recherche Ultra-Rapide Caisse</p>
              <p className="text-xs text-[#64748B] mt-1 max-w-sm mx-auto">
                Tapez au moins 2 lettres du prénom ou du nom pour afficher instantanément la fiche de l'élève, ses groupes et ses impayés.
              </p>
            </div>
          )}

          {/* Results list */}
          {debouncedSearch.length >= 2 && results.length === 0 && !isFetching && (
            <div className="text-center py-8 text-[#64748B] text-sm">
              Aucun élève trouvé pour « <span className="font-semibold text-[#1E293B]">{debouncedSearch}</span> ».
            </div>
          )}

          {debouncedSearch.length >= 2 && results.map(eleve => {
            const hasDue = eleve.total_reste_du > 0

            return (
              <div
                key={eleve.id}
                className={`p-4 rounded-xl border transition-all ${
                  hasDue
                    ? 'border-red-200 bg-red-50/20 hover:border-red-300'
                    : 'border-[#E2E8F0] bg-white hover:border-blue-200'
                } shadow-2xs`}
              >
                {/* Header: Name, Level, Status, Due Alert */}
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                      hasDue ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-blue-50 text-[#2563EB] border border-blue-200'
                    }`}>
                      {eleve.prenom[0]?.toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-[#1E293B]">
                        {eleve.prenom} {eleve.nom}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-[#64748B] mt-0.5">
                        <span className="font-medium text-[#334155]">{eleve.niveau || 'Niveau non spécifié'}</span>
                        {eleve.telephone_responsable && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 font-mono">
                              <Phone className="w-3 h-3 text-[#64748B]" />
                              {eleve.telephone_responsable}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Due Alert Badge / Good Standing Badge */}
                  <div>
                    {hasDue ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200 shadow-2xs">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Reste {eleve.total_reste_du.toLocaleString('fr-DZ')} DA à régler
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-[#10B981] border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" /> À jour (0 DA)
                      </span>
                    )}
                  </div>
                </div>

                {/* Groups Enrolled */}
                <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold text-[#64748B] flex items-center gap-1 mr-1">
                    <BookOpen className="w-3 h-3" /> Groupes :
                  </span>
                  {eleve.groupes.length === 0 ? (
                    <span className="text-xs text-[#64748B] italic">Non inscrit à des groupes</span>
                  ) : (
                    eleve.groupes.map(g => (
                      <span
                        key={g.id}
                        className="px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-[#334155] border border-[#E2E8F0]"
                      >
                        {g.nom} {g.matiere ? `(${g.matiere})` : ''}
                      </span>
                    ))
                  )}
                </div>

                {/* Direct Action: Unpaid Months & 1-Click Encaisser */}
                {hasDue && (
                  <div className="mt-3 pt-3 border-t border-red-200/60 space-y-2">
                    <span className="text-xs font-semibold text-red-800 block">
                      Paiements en attente de règlement :
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {eleve.impayes.map(imp => (
                        <div
                          key={imp.id}
                          className="p-2.5 rounded-lg bg-white border border-red-200 flex items-center justify-between text-xs shadow-2xs"
                        >
                          <div>
                            <span className="font-bold text-[#1E293B] block">{imp.groupe_nom}</span>
                            <span className="text-[#64748B] text-[11px]">
                              Mois : <strong className="text-[#1E293B] font-mono">{imp.mois}</strong> · Reste :{' '}
                              <strong className="text-red-600 font-mono">{imp.reste.toLocaleString('fr-DZ')} DA</strong>
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => openCashierFor(imp)}
                            className="btn-primary text-xs py-1 px-3 flex items-center gap-1 font-bold shadow-xs hover:scale-102 transition-transform"
                          >
                            <CreditCard className="w-3 h-3" />
                            Encaisser
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Modal Footer / Hint */}
        <div className="px-4 py-2.5 border-t border-[#E2E8F0] bg-slate-50 flex items-center justify-between text-xs text-[#64748B]">
          <span>Appuyez sur <kbd className="px-1.5 py-0.5 bg-white border border-[#E2E8F0] rounded font-mono text-[10px]">Échap</kbd> pour fermer</span>
          <span>AymnEDU FastCashier™</span>
        </div>
      </div>
    </div>
  )
}
