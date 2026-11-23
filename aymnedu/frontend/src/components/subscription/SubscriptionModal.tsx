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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-white border border-[#E2E8F0] rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] text-[#1E293B]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E2E8F0] flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#2563EB]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#1E293B]">Gestion de l'Abonnement</h2>
              <p className="text-xs text-[#64748B]">Centre : {subscription?.nom_centre || 'Votre Centre'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#1E293B] hover:bg-slate-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Current Status Overview Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-[#E2E8F0] space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#64748B] font-medium">État du compte :</span>
                {isExpired ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-200">
                    <AlertTriangle className="w-3.5 h-3.5" /> Période d'essai expirée
                  </span>
                ) : isTrial ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    <Clock className="w-3.5 h-3.5" /> Essai gratuit ({subscription?.days_remaining ?? 0}j restants)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-[#10B981] border border-emerald-200">
                    <ShieldCheck className="w-3.5 h-3.5" /> Forfait Pro Actif ({subscription?.days_remaining ?? 0}j)
                  </span>
                )}
              </div>

              <div className="text-right">
                <span className="text-xs text-[#64748B] font-medium">Forfait : </span>
                <span className="text-xs font-bold text-[#1E293B] uppercase">{subscription?.subscription_plan || 'Starter'}</span>
              </div>
            </div>

            {/* Quota Progress */}
            <div>
              <div className="flex justify-between text-xs text-[#64748B] mb-1 font-medium">
                <span>Élèves enregistrés : {subscription?.current_eleves ?? 0} / {subscription?.max_eleves ?? 50}</span>
                <span>
                  {Math.round(((subscription?.current_eleves ?? 0) / Math.max(1, subscription?.max_eleves ?? 50)) * 100)}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    isExpired ? 'bg-red-500' : 'bg-[#2563EB]'
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
          <div className="p-5 rounded-2xl bg-blue-50/50 border border-blue-200 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-[#2563EB] border border-blue-200">
                  RECOMMANDÉ POUR LES ÉCOLES
                </span>
                <h3 className="text-lg font-bold text-[#1E293B] mt-1.5">Forfait Soutien Pro</h3>
                <p className="text-xs text-[#64748B]">Tout inclus pour gérer votre centre sans restriction</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-extrabold text-[#1E293B]">4 500 DA</span>
                <span className="text-xs text-[#64748B] block font-normal">/ mois (ou 45 000 DA/an)</span>
              </div>
            </div>

            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#334155]">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981] flex-shrink-0" />
                Jusqu'à 500 élèves inscrits
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981] flex-shrink-0" />
                Gestion paiements & reçus PDF officiels
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981] flex-shrink-0" />
                Emploi du temps & détection collisions
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981] flex-shrink-0" />
                Suivi présences & alertes WhatsApp
              </li>
            </ul>
          </div>

          {/* Payment Instructions Algeria (BaridiMob & CCP) */}
          <div className="p-5 rounded-xl bg-slate-50 border border-[#E2E8F0] space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#1E293B]">
              <CreditCard className="w-4 h-4 text-[#2563EB]" />
              Paiement en Algérie (BaridiMob / Mandat CCP)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* BaridiMob RIP */}
              <div className="p-3 rounded-lg bg-white border border-[#E2E8F0] flex items-center justify-between shadow-2xs">
                <div>
                  <span className="text-[10px] text-[#64748B] font-bold uppercase block">RIP BaridiMob</span>
                  <span className="font-mono text-[#1E293B] text-xs font-semibold select-all">
                    {instructions?.baridimob_rip || '00799999002345678945'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(instructions?.baridimob_rip || '00799999002345678945', 'rip')}
                  className="p-1.5 rounded-md hover:bg-slate-100 text-[#64748B] hover:text-[#1E293B] transition-colors"
                  title="Copier le RIP"
                >
                  {copiedField === 'rip' ? <Check className="w-4 h-4 text-[#10B981]" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              {/* Compte CCP */}
              <div className="p-3 rounded-lg bg-white border border-[#E2E8F0] flex items-center justify-between shadow-2xs">
                <div>
                  <span className="text-[10px] text-[#64748B] font-bold uppercase block">Compte CCP</span>
                  <span className="font-mono text-[#1E293B] text-xs font-semibold select-all">
                    {instructions?.ccp_compte || '0023456789 clé 45'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(instructions?.ccp_compte || '0023456789 clé 45', 'ccp')}
                  className="p-1.5 rounded-md hover:bg-slate-100 text-[#64748B] hover:text-[#1E293B] transition-colors"
                  title="Copier le CCP"
                >
                  {copiedField === 'ccp' ? <Check className="w-4 h-4 text-[#10B981]" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-blue-50/80 border border-blue-200 text-xs text-[#334155] space-y-1.5">
              <p className="font-semibold text-[#2563EB] flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> Validation rapide sous 15 minutes :
              </p>
              <p className="text-[11px] leading-relaxed text-[#475569]">
                1. Effectuez votre virement de <strong>4 500 DA</strong>.<br />
                2. Envoyez la capture du reçu par WhatsApp au <strong>+213 550 12 34 56</strong> avec le nom de votre centre.<br />
                3. Vous recevrez instantanément votre code d'activation à saisir ci-dessous.
              </p>
            </div>
          </div>

          {/* Activate Code Form */}
          <form onSubmit={handleActivate} className="p-5 rounded-xl bg-slate-50 border border-[#E2E8F0] space-y-3">
            <label className="block text-xs font-semibold text-[#1E293B]">
              Activer une licence ou un code reçu
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={activationCode}
                onChange={(e) => setActivationCode(e.target.value)}
                placeholder="Ex : AYMN-PRO-1MOIS"
                className="flex-1 input uppercase tracking-wider font-mono font-medium"
              />
              <button
                type="submit"
                disabled={activateMutation.isPending || !activationCode.trim()}
                className="btn-primary px-5 py-2.5 text-xs font-bold rounded-lg flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50"
              >
                {activateMutation.isPending ? 'Activation...' : 'Activer'}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-[#10B981] text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                {successMsg}
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E2E8F0] bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-[#64748B]">Besoin d'aide ? Support : contact@aymnedu.dz</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-[#475569] hover:text-[#1E293B] hover:bg-slate-200/50 rounded-lg transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
