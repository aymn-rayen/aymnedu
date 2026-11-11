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
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
    },
    {
      label: 'Groupes Actifs',
      value: isLoading ? '—' : (stats?.total_groupes ?? 0),
      sub: 'groupes ouverts',
      icon: BookOpen,
      color: 'text-violet-400',
      bg: 'bg-violet-500/10',
      border: 'border-violet-500/20',
    },
    {
      label: 'Encaissé ce mois',
      value: isLoading ? '—' : `${(stats?.montant_encaisse ?? 0).toLocaleString('fr-DZ')} DA`,
      sub: isLoading ? '' : `${stats?.paiements_du_mois ?? 0} paiements`,
      icon: CreditCard,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
    },
    {
      label: 'Impayés ce mois',
      value: isLoading ? '—' : (stats?.impayes_du_mois ?? 0),
      sub: 'en attente de règlement',
      icon: AlertCircle,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
      alert: !isLoading && (stats?.impayes_du_mois ?? 0) > 0,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-white">Tableau de bord</h1>
        <p className="text-slate-400 text-sm mt-1">Vue d'ensemble de votre centre de soutien scolaire</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kards.map(({ label, value, sub, icon: Icon, color, bg, border, alert }) => (
          <div
            key={label}
            className={`card border ${border} relative overflow-hidden ${alert ? 'ring-1 ring-red-500/30' : ''}`}
          >
            <div className={`absolute top-4 right-4 w-9 h-9 rounded-xl ${bg} border ${border} flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <p className="text-sm text-slate-400">{label}</p>
            <p className={`font-heading text-3xl font-bold mt-1 ${isLoading ? 'text-slate-600' : alert ? 'text-red-400' : 'text-white'}`}>
              {value}
            </p>
            {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Attendance Rate */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-primary-400" />
            <h2 className="font-heading font-semibold text-white">Taux de présence (7 derniers jours)</h2>
          </div>
          <div className="flex items-end gap-3">
            <span className={`font-heading text-5xl font-bold ${
              isLoading ? 'text-slate-600'
              : (stats?.taux_presence_hebdo ?? 0) >= 80 ? 'text-emerald-400'
              : (stats?.taux_presence_hebdo ?? 0) >= 60 ? 'text-amber-400'
              : 'text-red-400'
            }`}>
              {isLoading ? '—' : `${stats?.taux_presence_hebdo ?? 0}%`}
            </span>
            <span className="text-sm text-slate-400 mb-1.5">des séances enregistrées</span>
          </div>
          <div className="mt-4 w-full h-2 bg-[#1b2542] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                (stats?.taux_presence_hebdo ?? 0) >= 80
                  ? 'bg-gradient-to-r from-emerald-500 to-green-400'
                  : (stats?.taux_presence_hebdo ?? 0) >= 60
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                  : 'bg-gradient-to-r from-red-500 to-rose-400'
              }`}
              style={{ width: isLoading ? '0%' : `${stats?.taux_presence_hebdo ?? 0}%` }}
            />
          </div>
          <p className="text-xs text-slate-600 mt-2">
            {!isLoading && (stats?.taux_presence_hebdo ?? 0) === 100 && 'Aucune donnée cette semaine — affichage du taux global'}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-slate-400" />
            <h2 className="font-heading font-semibold text-white">Actions rapides</h2>
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
                className="flex items-center justify-between px-4 py-3 rounded-xl border border-white/5 hover:border-primary-500/20 hover:bg-primary-500/5 transition-all duration-150 group"
              >
                <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{label}</span>
                <span className="text-primary-500 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
