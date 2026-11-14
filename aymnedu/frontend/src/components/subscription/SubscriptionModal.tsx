import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { subscriptionApi } from '@/api'
import { SubscriptionInfo } from '@/types'
import {
  X, CheckCircle2, AlertTriangle, ShieldCheck, Copy, Check,
  Sparkles, CreditCard, Clock, Phone, ArrowRight
} from 'lucide-react'

interface SubscriptionModalProps {
  isOpen: boolean
  onClose: () => void
  subscription?: SubscriptionInfo
}

export function SubscriptionModal({ isOpen, onClose, subscription }: SubscriptionModalProps) {
  const queryClient = useQueryClient()
  const [activationCode, setActivationCode] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const { data: instructions } = useQuery({
    queryKey: ['subscription-instructions'],
    queryFn: subscriptionApi.getInstructions,
    enabled: isOpen,
  })

  const activateMutation = useMutation({
    mutationFn: (code: string) => subscriptionApi.activate(code),
    onSuccess: (data) => {
      setSuccessMsg(`Félicitations ! Votre forfait ${data.subscription_plan.toUpperCase()} a été activé avec succès.`)
      setErrorMsg(null)
      setActivationCode('')
      queryClient.invalidateQueries({ queryKey: ['subscription'] })
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail || "Code d'activation invalide. Veuillez vérifier votre saisie."
      setErrorMsg(detail)
      setSuccessMsg(null)
    },
  })

  if (!isOpen) return null

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2500)
  }

  const handleActivate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!activationCode.trim()) return
    setErrorMsg(null)
    setSuccessMsg(null)
    activateMutation.mutate(activationCode.trim())
  }

  const isExpired = subscription?.is_expired || subscription?.subscription_status === 'expired'
  const isTrial = subscription?.subscription_status === 'trial'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-slate-900 to-indigo-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-500/20 border border-primary-500/30 flex items-center justify-center text-primary-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Gestion de l'Abonnement</h2>
              <p className="text-xs text-slate-400">Centre : {subscription?.nom_centre || 'Votre Centre'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Current Status Overview Card */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-white/5 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">État du compte :</span>
                {isExpired ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30">
                    <AlertTriangle className="w-3.5 h-3.5" /> Période d'essai expirée
                  </span>
                ) : isTrial ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    <Clock className="w-3.5 h-3.5" /> Essai gratuit ({subscription?.days_remaining ?? 0}j restants)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <ShieldCheck className="w-3.5 h-3.5" /> Forfait Pro Actif ({subscription?.days_remaining ?? 0}j)
                  </span>
                )}
              </div>

              <div className="text-right">
                <span className="text-xs text-slate-400 font-medium">Forfait : </span>
                <span className="text-xs font-bold text-white uppercase">{subscription?.subscription_plan || 'Starter'}</span>
              </div>
            </div>

            {/* Quota Progress */}
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1 font-medium">
                <span>Élèves enregistrés : {subscription?.current_eleves ?? 0} / {subscription?.max_eleves ?? 50}</span>
                <span>
                  {Math.round(((subscription?.current_eleves ?? 0) / Math.max(1, subscription?.max_eleves ?? 50)) * 100)}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-700/50 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    isExpired ? 'bg-red-500' : 'bg-primary-500'
                  }`}
                  style={{
                    width: `${Math.min(
                      100,
                      ((subscription?.current_eleves ?? 0) / Math.max(1, subscription?.max_eleves ?? 50)) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Plan Pro Offer Box */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/30 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary-500/20 text-primary-400 border border-primary-500/30">
                  RECOMMANDÉ POUR LES ÉCOLES
                </span>
                <h3 className="text-lg font-bold text-white mt-1.5">Forfait Soutien Pro</h3>
                <p className="text-xs text-slate-400">Tout inclus pour gérer votre centre sans restriction</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-extrabold text-white">4 500 DA</span>
                <span className="text-xs text-slate-400 block font-normal">/ mois (ou 45 000 DA/an)</span>
              </div>
            </div>

            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                Jusqu'à 500 élèves inscrits
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                Gestion paiements & reçus PDF officiels
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                Emploi du temps & détection collisions
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                Suivi présences & alertes WhatsApp
              </li>
            </ul>
          </div>

          {/* Payment Instructions Algeria (BaridiMob & CCP) */}
          <div className="p-5 rounded-xl bg-slate-800/30 border border-white/5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <CreditCard className="w-4 h-4 text-primary-400" />
              Paiement en Algérie (BaridiMob / Mandat CCP)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* BaridiMob RIP */}
              <div className="p-3 rounded-lg bg-slate-900/80 border border-white/5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">RIP BaridiMob</span>
                  <span className="font-mono text-white text-xs font-semibold select-all">
                    {instructions?.baridimob_rip || '00799999002345678945'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(instructions?.baridimob_rip || '00799999002345678945', 'rip')}
                  className="p-1.5 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                  title="Copier le RIP"
                >
                  {copiedField === 'rip' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              {/* Compte CCP */}
              <div className="p-3 rounded-lg bg-slate-900/80 border border-white/5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Compte CCP</span>
                  <span className="font-mono text-white text-xs font-semibold select-all">
                    {instructions?.ccp_compte || '0023456789 clé 45'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(instructions?.ccp_compte || '0023456789 clé 45', 'ccp')}
                  className="p-1.5 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                  title="Copier le CCP"
                >
                  {copiedField === 'ccp' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-500/20 text-xs text-slate-300 space-y-1.5">
              <p className="font-semibold text-indigo-300 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> Validation rapide sous 15 minutes :
              </p>
              <p className="text-[11px] leading-relaxed text-slate-300">
                1. Effectuez votre virement de <strong>4 500 DA</strong>.<br />
                2. Envoyez la capture du reçu par WhatsApp au <strong>+213 550 12 34 56</strong> avec le nom de votre centre.<br />
                3. Vous recevrez instantanément votre code d'activation à saisir ci-dessous.
              </p>
            </div>
          </div>

          {/* Activate Code Form */}
          <form onSubmit={handleActivate} className="p-5 rounded-xl bg-slate-800/40 border border-white/10 space-y-3">
            <label className="block text-xs font-semibold text-slate-200">
              Activer une licence ou un code reçu
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={activationCode}
                onChange={(e) => setActivationCode(e.target.value)}
                placeholder="Ex : AYMN-PRO-1MOIS"
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500 uppercase tracking-wider font-mono font-medium"
              />
              <button
                type="submit"
                disabled={activateMutation.isPending || !activationCode.trim()}
                className="btn-primary px-5 py-2.5 text-xs font-bold rounded-xl flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50"
              >
                {activateMutation.isPending ? 'Activation...' : 'Activer'}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                {successMsg}
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-slate-900/60 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">Besoin d'aide ? Support : contact@aymnedu.dz</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
