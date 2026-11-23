import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api'
import { setAccessToken } from '@/api/client'
import type { CentreAdminView, LicenseVoucher, AdminStats } from '@/types'
import {
  ShieldAlert, Lock, Mail, CheckCircle2, AlertTriangle, Clock,
  Copy, Check, PlusCircle, LogOut, RefreshCw,
  Search, Sparkles, Building2, Ticket, CheckSquare, XCircle
} from 'lucide-react'

export default function SuperAdminPage() {
  const queryClient = useQueryClient()

  // Admin Auth state
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false)
  const [adminEmail, setAdminEmail] = useState('admin@aymnedu.dz')
  const [adminPassword, setAdminPassword] = useState('admin123456')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'centres' | 'vouchers'>('centres')
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  // Voucher generator form state
  const [voucherPlan, setVoucherPlan] = useState<'pro' | 'starter'>('pro')
  const [voucherDays, setVoucherDays] = useState(30)
  const [voucherMaxEleves, setVoucherMaxEleves] = useState(500)
  const [voucherCount, setVoucherCount] = useState(1)
  const [voucherNote, setVoucherNote] = useState('')
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  const showNotification = (msg: string) => {
    setActionSuccess(msg)
    setTimeout(() => setActionSuccess(null), 4000)
  }

  // Handle Admin Login
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError(null)
    try {
      const data = await adminApi.login({ email: adminEmail.trim(), password: adminPassword })
      setAccessToken(data.access_token)
      setIsAdminLoggedIn(true)
    } catch (err: any) {
      setAuthError(err?.response?.data?.detail || 'Identifiants super-admin invalides.')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleAdminLogout = () => {
    setAccessToken(null)
    setIsAdminLoggedIn(false)
  }

  // Queries (enabled only when logged in)
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<AdminStats>({
    queryKey: ['admin-stats'],
    queryFn: adminApi.stats,
    enabled: isAdminLoggedIn,
  })

  const { data: centres = [], isLoading: centresLoading, refetch: refetchCentres } = useQuery<CentreAdminView[]>({
    queryKey: ['admin-centres'],
    queryFn: adminApi.centres,
    enabled: isAdminLoggedIn,
  })

  const { data: vouchers = [], isLoading: vouchersLoading, refetch: refetchVouchers } = useQuery<LicenseVoucher[]>({
    queryKey: ['admin-vouchers'],
    queryFn: adminApi.vouchers,
    enabled: isAdminLoggedIn,
  })

  // Mutations
  const activateMutation = useMutation({
    mutationFn: ({ id, days, note }: { id: number; days: number; note: string }) =>
      adminApi.activateCentre(id, { plan: 'pro', duration_days: days, max_eleves: 500, note }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-centres'] })
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
      showNotification(`Abonnement prolongé de ${variables.days} jours pour le centre #${variables.id} !`)
    },
  })

  const toggleStatusMutation = useMutation({
    mutationFn: (id: number) => adminApi.toggleStatus(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-centres'] })
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
      showNotification('Statut du centre mis à jour.')
    },
  })

  const createVouchersMutation = useMutation({
    mutationFn: () =>
      adminApi.createVouchers({
        plan: voucherPlan,
        duration_days: voucherDays,
        max_eleves: voucherMaxEleves,
        count: voucherCount,
        note: voucherNote.trim() || undefined,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-vouchers'] })
      setVoucherNote('')
      showNotification(`${data.length} coupon(s) de licence généré(s) avec succès !`)
    },
  })

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(text)
    setTimeout(() => setCopiedCode(null), 2500)
  }

  // Filtered centres
  const filteredCentres = centres.filter((c) => {
    const q = searchQuery.toLowerCase()
    return c.nom.toLowerCase().includes(q) || (c.wilaya && c.wilaya.toLowerCase().includes(q))
  })

  // ── Unauthenticated State: Login Screen ──────────────────────────────────
  if (!isAdminLoggedIn) {
    return (
      <div className="min-h-screen bg-[#070b14] flex items-center justify-center p-6 text-slate-100">
        <div className="relative w-full max-w-md bg-white border border-amber-500/30 rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-4">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h1 className="font-heading text-2xl font-bold text-[#1E293B]">Espace Super-Admin</h1>
            <p className="text-xs text-amber-400/80 font-medium mt-1">Accès réservé à l'éditeur AymnEDU</p>
          </div>

          {authError && (
            <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Email Administrateur</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  type="email"
                  required
                  className="w-full bg-slate-900 border border-[#E2E8F0] rounded-xl px-4 py-2.5 pl-10 text-sm text-[#1E293B] focus:outline-none focus:border-amber-500/50"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Mot de passe Super-Admin</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  type="password"
                  required
                  className="w-full bg-slate-900 border border-[#E2E8F0] rounded-xl px-4 py-2.5 pl-10 text-sm text-[#1E293B] font-mono focus:outline-none focus:border-amber-500/50"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full mt-6 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {authLoading ? 'Vérification…' : 'Accéder au Back-Office'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-[#E2E8F0] text-center">
            <span className="text-[11px] text-slate-500">
              Identifiants par défaut : <code className="text-slate-400">admin@aymnedu.dz / admin123456</code>
            </span>
          </div>
        </div>
      </div>
    )
  }

  // ── Authenticated State: Control Center ──────────────────────────────────
  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 p-6 md:p-8">
      {/* Toast Notification */}
      {actionSuccess && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-500/90 text-[#1E293B] text-xs font-semibold px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 border border-emerald-400/30 animate-fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Header bar */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-[#1E293B]">AymnEDU Control Center</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                SUPER-ADMIN
              </span>
            </div>
            <p className="text-xs text-slate-400">Gestion centrale des clients, abonnements et coupons de licence</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              refetchStats()
              refetchCentres()
              refetchVouchers()
              showNotification('Données actualisées !')
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-[#E2E8F0] flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Actualiser
          </button>
          <button
            onClick={handleAdminLogout}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Quitter
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-6 pt-6">
        {/* KPI Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-[#E2E8F0]">
            <span className="text-[11px] text-slate-400 block font-medium">Total Écoles</span>
            <span className="text-2xl font-bold text-[#1E293B] mt-1 block">
              {statsLoading ? '—' : stats?.total_centres ?? 0}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-amber-500/20">
            <span className="text-[11px] text-amber-400 block font-medium">Essais Actifs</span>
            <span className="text-2xl font-bold text-amber-300 mt-1 block">
              {statsLoading ? '—' : stats?.active_trials ?? 0}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-emerald-500/20">
            <span className="text-[11px] text-emerald-400 block font-medium">Abonnés Pro</span>
            <span className="text-2xl font-bold text-emerald-300 mt-1 block">
              {statsLoading ? '—' : stats?.active_paid ?? 0}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-red-500/20">
            <span className="text-[11px] text-red-400 block font-medium">Expirés</span>
            <span className="text-2xl font-bold text-red-300 mt-1 block">
              {statsLoading ? '—' : stats?.expired_centres ?? 0}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-sky-500/20">
            <span className="text-[11px] text-sky-400 block font-medium">Total Élèves</span>
            <span className="text-2xl font-bold text-sky-300 mt-1 block">
              {statsLoading ? '—' : stats?.total_eleves ?? 0}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-950/60 to-slate-900 border border-indigo-500/30">
            <span className="text-[11px] text-indigo-300 block font-medium">MRR Estimé</span>
            <span className="text-xl font-extrabold text-[#1E293B] mt-1 block">
              {statsLoading ? '—' : `${(stats?.mrr_estime_dzd ?? 0).toLocaleString('fr-DZ')} DA`}
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-3">
          <button
            onClick={() => setActiveTab('centres')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${
              activeTab === 'centres'
                ? 'bg-primary-500/20 text-primary-300 border border-primary-500/40'
                : 'text-slate-400 hover:text-[#1E293B] hover:bg-slate-50'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Établissements Clients ({centres.length})
          </button>
          <button
            onClick={() => setActiveTab('vouchers')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${
              activeTab === 'vouchers'
                ? 'bg-primary-500/20 text-primary-300 border border-primary-500/40'
                : 'text-slate-400 hover:text-[#1E293B] hover:bg-slate-50'
            }`}
          >
            <Ticket className="w-4 h-4" />
            Générateur de Licences ({vouchers.length})
          </button>
        </div>

        {/* ── TAB 1: CENTRES MANAGEMENT ───────────────────────────────────── */}
        {activeTab === 'centres' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Rechercher par nom d'école ou wilaya…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-[#E2E8F0] rounded-xl px-4 py-2 pl-9 text-xs text-[#1E293B] focus:outline-none focus:border-primary-500/50"
                />
              </div>
              <span className="text-xs text-slate-500">
                Affichage de {filteredCentres.length} sur {centres.length} centre(s)
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-[#E2E8F0] bg-slate-900/60 shadow-xl">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/70 text-[11px] uppercase tracking-wider text-slate-400 border-b border-[#E2E8F0]">
                  <tr>
                    <th className="px-4 py-3.5">Centre & Localisation</th>
                    <th className="px-4 py-3.5">Contact</th>
                    <th className="px-4 py-3.5">Élèves</th>
                    <th className="px-4 py-3.5">Statut</th>
                    <th className="px-4 py-3.5">Échéance</th>
                    <th className="px-4 py-3.5 text-right">Actions de Validation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {centresLoading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-500">
                        Chargement des établissements…
                      </td>
                    </tr>
                  ) : filteredCentres.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-500">
                        Aucun établissement trouvé.
                      </td>
                    </tr>
                  ) : (
                    filteredCentres.map((centre) => {
                      const isTrial = centre.subscription_status === 'trial'
                      const isActive = centre.subscription_status === 'active'

                      return (
                        <tr key={centre.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3.5">
                            <span className="font-bold text-[#1E293B] block text-sm">{centre.nom}</span>
                            <span className="text-[11px] text-slate-400">
                              Wilaya : {centre.wilaya || 'Non spécifiée'} • ID #{centre.id}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 font-mono text-slate-400">
                            {centre.telephone || '—'}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="font-semibold text-[#1E293B]">{centre.total_eleves}</span>
                            <span className="text-[11px] text-slate-500"> / {centre.max_eleves}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            {isActive ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                <CheckCircle2 className="w-3 h-3" /> Soutien Pro
                              </span>
                            ) : isTrial ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                <Clock className="w-3 h-3" /> Essai 14j
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                                <AlertTriangle className="w-3 h-3" /> Expiré
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-slate-400">
                            {centre.subscription_expires_at
                              ? new Date(centre.subscription_expires_at).toLocaleDateString('fr-DZ')
                              : centre.trial_ends_at
                              ? new Date(centre.trial_ends_at).toLocaleDateString('fr-DZ')
                              : '—'}
                          </td>
                          <td className="px-4 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() =>
                                activateMutation.mutate({
                                  id: centre.id,
                                  days: 30,
                                  note: 'Validation BaridiMob/CCP 1 mois',
                                })
                              }
                              title="Valider virement 1 mois (4 500 DA)"
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 transition-colors"
                            >
                              +30 j (Pro)
                            </button>
                            <button
                              onClick={() =>
                                activateMutation.mutate({
                                  id: centre.id,
                                  days: 365,
                                  note: 'Validation virement Annuel (45 000 DA)',
                                })
                              }
                              title="Valider virement 1 an"
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 border border-indigo-500/30 transition-colors"
                            >
                              +1 an
                            </button>
                            <button
                              onClick={() => toggleStatusMutation.mutate(centre.id)}
                              title={centre.is_active ? 'Suspendre ce centre' : 'Réactiver ce centre'}
                              className={`p-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                centre.is_active
                                  ? 'text-red-400 bg-red-500/10 border-red-500/30 hover:bg-red-500/20'
                                  : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20'
                              }`}
                            >
                              {centre.is_active ? <XCircle className="w-3.5 h-3.5" /> : <CheckSquare className="w-3.5 h-3.5" />}
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 2: VOUCHERS GENERATION ──────────────────────────────────── */}
        {activeTab === 'vouchers' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Voucher Generator Form */}
            <div className="bg-slate-900/60 border border-[#E2E8F0] rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-[#E2E8F0]">
                <Ticket className="w-5 h-5 text-primary-400" />
                <h3 className="font-bold text-[#1E293B] text-sm">Générer un Coupon de Licence</h3>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Durée & Forfait</label>
                <select
                  value={voucherDays}
                  onChange={(e) => {
                    const days = parseInt(e.target.value)
                    setVoucherDays(days)
                    setVoucherPlan('pro')
                    setVoucherMaxEleves(days >= 300 ? 2000 : 500)
                  }}
                  className="w-full bg-slate-950 border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#1E293B] focus:outline-none"
                >
                  <option value={30}>Soutien Pro — 1 Mois (30 jours, 500 élèves)</option>
                  <option value={90}>Soutien Pro — 3 Mois (90 jours, 500 élèves)</option>
                  <option value={365}>Soutien Pro — 1 An (365 jours, 2 000 élèves)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Nombre de coupons</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={voucherCount}
                  onChange={(e) => setVoucherCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-slate-950 border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#1E293B] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Note / Référence Client (facultatif)
                </label>
                <input
                  type="text"
                  placeholder="Ex : Virement BaridiMob École En-Nadjah #45821"
                  value={voucherNote}
                  onChange={(e) => setVoucherNote(e.target.value)}
                  className="w-full bg-slate-950 border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#1E293B] focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() => createVouchersMutation.mutate()}
                disabled={createVouchersMutation.isPending}
                className="w-full py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-primary-500 to-indigo-500 text-[#1E293B] hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <PlusCircle className="w-4 h-4" />
                {createVouchersMutation.isPending ? 'Génération…' : 'Créer les Coupons à Usage Unique'}
              </button>
            </div>

            {/* List of generated vouchers */}
            <div className="lg:col-span-2 bg-slate-900/60 border border-[#E2E8F0] rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <h3 className="font-bold text-[#1E293B] text-sm">Registre des Coupons Disponibles & Utilisés</h3>
                </div>
                <span className="text-xs text-slate-500">{vouchers.length} coupon(s)</span>
              </div>

              <div className="overflow-y-auto max-h-[500px] space-y-2.5 pr-1">
                {vouchersLoading ? (
                  <p className="text-xs text-slate-500 text-center py-6">Chargement des coupons…</p>
                ) : vouchers.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">
                    Aucun coupon créé pour le moment. Utilisez le formulaire ci-contre.
                  </p>
                ) : (
                  vouchers.map((voucher) => (
                    <div
                      key={voucher.id}
                      className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                        voucher.is_redeemed
                          ? 'bg-slate-950/40 border-[#E2E8F0] opacity-60'
                          : 'bg-slate-950/80 border-emerald-500/30'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-[#1E293B] select-all">
                            {voucher.code}
                          </span>
                          {voucher.is_redeemed ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400">
                              Consommé
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              Valide ({voucher.duration_days}j)
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          {voucher.is_redeemed ? (
                            <span>
                              Utilisé par : <strong className="text-[#1E293B]">{voucher.redeemed_by_centre_nom || `Centre #${voucher.redeemed_by_centre_id}`}</strong> le{' '}
                              {voucher.redeemed_at ? new Date(voucher.redeemed_at).toLocaleDateString('fr-DZ') : ''}
                            </span>
                          ) : (
                            <span>
                              Forfait {voucher.plan.toUpperCase()} • Max {voucher.max_eleves} élèves •{' '}
                              {voucher.note || 'Sans note'}
                            </span>
                          )}
                        </p>
                      </div>

                      {!voucher.is_redeemed && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(voucher.code)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-50 hover:bg-white/10 text-slate-300 hover:text-[#1E293B] border border-[#E2E8F0] flex items-center gap-1.5 transition-colors"
                          title="Copier le code pour l'envoyer au client (WhatsApp/Email)"
                        >
                          {copiedCode === voucher.code ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">Copié !</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copier</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
