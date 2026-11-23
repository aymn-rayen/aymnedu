import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '@/api'
import { Users, BookOpen, CreditCard, TrendingUp, BarChart3, AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: dashboardApi.stats,
  })

  const kards = [
    {
      label: 'Élèves Inscrits',
      value: isLoading ? '—' : (stats?.total_eleves ?? 0),
      sub: isLoading ? '' : `${stats?.eleves_actifs ?? 0} actifs`,
      icon: Users,
      color: 'text-[#2563EB]',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
    },
    {
      label: 'Groupes Actifs',
      value: isLoading ? '—' : (stats?.total_groupes ?? 0),
      sub: 'groupes ouverts',
      icon: BookOpen,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      border: 'border-indigo-200',
    },
    {
      label: 'Encaissé ce mois',
      value: isLoading ? '—' : `${(stats?.montant_encaisse ?? 0).toLocaleString('fr-DZ')} DA`,
      sub: isLoading ? '' : `${stats?.paiements_du_mois ?? 0} paiements`,
      icon: CreditCard,
      color: 'text-[#10B981]',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
    },
    {
      label: 'Impayés ce mois',
      value: isLoading ? '—' : (stats?.impayes_du_mois ?? 0),
      sub: 'en attente de règlement',
      icon: AlertCircle,
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-200',
      alert: !isLoading && (stats?.impayes_du_mois ?? 0) > 0,
    },
  ]

  return (
    <div className="space-y-6 text-[#1E293B]">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-[#1E293B]">Tableau de bord</h1>
        <p className="text-[#64748B] text-sm mt-1">Vue d'ensemble de votre centre de soutien scolaire</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kards.map(({ label, value, sub, icon: Icon, color, bg, border, alert }) => (
          <div
            key={label}
            className={`card border ${border} relative overflow-hidden bg-white shadow-xs ${alert ? 'ring-1 ring-red-400' : ''}`}
          >
            <div className={`absolute top-4 right-4 w-10 h-10 rounded-xl ${bg} border ${border} flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <p className="text-sm font-medium text-[#64748B]">{label}</p>
            <p className={`font-heading text-3xl font-bold mt-1.5 ${isLoading ? 'text-slate-400' : alert ? 'text-red-600' : 'text-[#1E293B]'}`}>
              {value}
            </p>
            {sub && <p className="text-xs text-[#64748B] mt-1">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Attendance Rate */}
        <div className="card bg-white shadow-xs border border-[#E2E8F0]">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-[#2563EB]" />
            <h2 className="font-heading font-semibold text-[#1E293B]">Taux de présence (7 derniers jours)</h2>
          </div>
          <div className="flex items-end gap-3">
            <span className={`font-heading text-5xl font-bold ${
              isLoading ? 'text-slate-400'
              : (stats?.taux_presence_hebdo ?? 0) >= 80 ? 'text-[#10B981]'
              : (stats?.taux_presence_hebdo ?? 0) >= 60 ? 'text-amber-500'
              : 'text-red-600'
            }`}>
              {isLoading ? '—' : `${stats?.taux_presence_hebdo ?? 0}%`}
            </span>
            <span className="text-sm text-[#64748B] mb-1.5">des séances enregistrées</span>
          </div>
          <div className="mt-4 w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                (stats?.taux_presence_hebdo ?? 0) >= 80
                  ? 'bg-gradient-to-r from-emerald-500 to-green-500'
                  : (stats?.taux_presence_hebdo ?? 0) >= 60
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500'
                  : 'bg-gradient-to-r from-red-500 to-rose-500'
              }`}
              style={{ width: isLoading ? '0%' : `${stats?.taux_presence_hebdo ?? 0}%` }}
            />
          </div>
          <p className="text-xs text-[#64748B] mt-2.5">
            {!isLoading && (stats?.taux_presence_hebdo ?? 0) === 100 && 'Aucune donnée cette semaine — affichage du taux global'}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="card bg-white shadow-xs border border-[#E2E8F0]">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-[#2563EB]" />
            <h2 className="font-heading font-semibold text-[#1E293B]">Actions rapides</h2>
          </div>
          <div className="space-y-2">
            {[
              { label: 'Inscrire un nouvel élève',    href: '/app/eleves' },
              { label: 'Saisir un paiement',          href: '/app/paiements' },
              { label: 'Prendre les présences',       href: '/app/presences' },
              { label: 'Gérer les emplois du temps',  href: '/app/planning' },
            ].map(({ label, href }) => (
              <Link
                key={href}
                to={href}
                className="flex items-center justify-between px-4 py-3 rounded-xl border border-[#E2E8F0] hover:border-blue-300 hover:bg-blue-50/50 transition-all duration-150 group shadow-2xs"
              >
                <span className="text-sm font-medium text-[#334155] group-hover:text-[#2563EB] transition-colors">{label}</span>
                <span className="text-[#2563EB] opacity-0 group-hover:opacity-100 transition-opacity font-bold">→</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
