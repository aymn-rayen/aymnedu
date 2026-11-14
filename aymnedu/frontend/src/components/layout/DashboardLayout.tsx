import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { subscriptionApi } from '@/api'
import { SubscriptionModal } from '@/components/subscription/SubscriptionModal'
import {
  LayoutDashboard, Users, BookOpen, CreditCard, ClipboardCheck,
  Calendar, LogOut, GraduationCap, School, Users2, Sparkles,
  AlertTriangle, Clock, ChevronRight
} from 'lucide-react'

// ── Navigation items per role ──────────────────────────────────────────────
const NAV_BY_ROLE: Record<string, { to: string; label: string; icon: React.ElementType }[]> = {
  directeur: [
    { to: '/app/dashboard',    label: 'Tableau de bord', icon: LayoutDashboard },
    { to: '/app/eleves',       label: 'Élèves',           icon: Users },
    { to: '/app/groupes',      label: 'Groupes',          icon: BookOpen },
    { to: '/app/enseignants',  label: 'Enseignants',      icon: School },
    { to: '/app/paiements',    label: 'Paiements',        icon: CreditCard },
    { to: '/app/presences',    label: 'Présences',        icon: ClipboardCheck },
    { to: '/app/planning',     label: 'Planning',         icon: Calendar },
    { to: '/app/roles',        label: 'Gestion des accès', icon: Users2 },
  ],
  secretaire: [
    { to: '/app/eleves',       label: 'Élèves',           icon: Users },
    { to: '/app/groupes',      label: 'Groupes',          icon: BookOpen },
    { to: '/app/paiements',    label: 'Paiements',        icon: CreditCard },
    { to: '/app/presences',    label: 'Présences',        icon: ClipboardCheck },
    { to: '/app/planning',     label: 'Planning',         icon: Calendar },
  ],
  enseignant: [
    { to: '/app/presences',    label: 'Présences',        icon: ClipboardCheck },
    { to: '/app/planning',     label: 'Planning',         icon: Calendar },
    { to: '/app/groupes',      label: 'Mes Groupes',      icon: BookOpen },
  ],
}

const ROLE_BADGES: Record<string, { label: string; color: string }> = {
  directeur:  { label: 'Directeur',  color: 'text-violet-400 bg-violet-500/15' },
  secretaire: { label: 'Secrétaire', color: 'text-sky-400 bg-sky-500/15' },
  enseignant: { label: 'Enseignant', color: 'text-emerald-400 bg-emerald-500/15' },
}

export function DashboardLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [isSubModalOpen, setIsSubModalOpen] = useState(false)

  const { data: sub } = useQuery({
    queryKey: ['subscription'],
    queryFn: subscriptionApi.get,
    staleTime: 60 * 1000,
  })

  const handleLogout = () => {
    logout()
    navigate('/app/login')
  }

  const navItems = NAV_BY_ROLE[user?.role ?? 'directeur'] ?? NAV_BY_ROLE.directeur
  const roleBadge = ROLE_BADGES[user?.role ?? 'directeur']

  const isExpired = sub?.is_expired || sub?.subscription_status === 'expired'
  const isTrial = sub?.subscription_status === 'trial'

  return (
    <div className="flex h-screen overflow-hidden bg-[#0b0f19]">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r border-white/5 bg-[#0d1220]">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="font-heading font-bold text-xl text-white">
              Aymn<span className="text-primary-400">EDU</span>
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''}`
              }
            >
              <Icon className="w-4.5 h-4.5 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Subscription Sidebar Widget (Directeur) */}
        {sub && user?.role === 'directeur' && (
          <div className="px-3 pb-3">
            <button
              onClick={() => setIsSubModalOpen(true)}
              className="w-full text-left p-3 rounded-xl bg-slate-800/40 hover:bg-slate-800/80 border border-white/5 hover:border-primary-500/30 transition-all duration-150 group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary-400" /> Abonnement
                </span>
                {isExpired ? (
                  <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">Expiré</span>
                ) : isTrial ? (
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                    Essai {sub.days_remaining}j
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">Pro</span>
                )}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span className="truncate">{sub.nom_centre || 'Mon Centre'}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-primary-400 transition-colors" />
              </div>
            </button>
          </div>
        )}

        {/* User Card */}
        <div className="px-3 py-4 border-t border-white/5">
          <div className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 cursor-pointer group">
            <div className="w-8 h-8 rounded-full bg-primary-500/20 border border-primary-500/30 flex items-center justify-center text-primary-400 font-bold text-sm flex-shrink-0">
              {user?.full_name?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user?.full_name}</p>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${roleBadge.color}`}>
                {roleBadge.label}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="text-slate-600 hover:text-red-400 transition-colors duration-150 opacity-0 group-hover:opacity-100"
              title="Déconnexion"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* Top Subscription Notification Banners */}
        {isExpired ? (
          <div className="bg-red-500/15 border-b border-red-500/30 px-6 py-2.5 flex items-center justify-between flex-wrap gap-2 text-xs text-red-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>
                <strong>Période d'essai terminée (14 jours écoulés).</strong> L'enregistrement de nouvelles données (élèves, groupes, paiements) est bloqué.
              </span>
            </div>
            <button
              onClick={() => setIsSubModalOpen(true)}
              className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-colors shadow-sm"
            >
              Activer mon forfait Pro (4 500 DA)
            </button>
          </div>
        ) : isTrial ? (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2 flex items-center justify-between flex-wrap gap-2 text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>
                Période d'essai Starter : <strong>{sub?.days_remaining ?? 0} jour(s) restant(s)</strong> • Élèves : {sub?.current_eleves ?? 0}/{sub?.max_eleves ?? 50}.
              </span>
            </div>
            <button
              onClick={() => setIsSubModalOpen(true)}
              className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold rounded-lg border border-amber-500/30 transition-colors"
            >
              Passer au Forfait Pro
            </button>
          </div>
        ) : null}

        <div className="p-6 lg:p-8 flex-1">
          <Outlet />
        </div>
      </main>

      {/* Subscription Modal */}
      <SubscriptionModal
        isOpen={isSubModalOpen}
        onClose={() => setIsSubModalOpen(false)}
        subscription={sub}
      />
    </div>
  )
}
