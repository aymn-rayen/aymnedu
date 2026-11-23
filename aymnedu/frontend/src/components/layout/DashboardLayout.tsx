import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { subscriptionApi } from '@/api'
import { SubscriptionModal } from '@/components/subscription/SubscriptionModal'
import { QuickCashierModal } from '@/components/cashier/QuickCashierModal'
import {
  LayoutDashboard, Users, BookOpen, CreditCard, ClipboardCheck,
  Calendar, LogOut, GraduationCap, School, Users2, Sparkles,
  AlertTriangle, Clock, ChevronRight, Search, Command
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
  directeur:  { label: 'Directeur',  color: 'text-blue-700 bg-blue-50 border border-blue-200' },
  secretaire: { label: 'Secrétaire', color: 'text-indigo-700 bg-indigo-50 border border-indigo-200' },
  enseignant: { label: 'Enseignant', color: 'text-emerald-700 bg-emerald-50 border border-emerald-200' },
}

export function DashboardLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [isSubModalOpen, setIsSubModalOpen] = useState(false)
  const [isCashierOpen, setIsCashierOpen] = useState(false)

  // Global Ctrl + K / Cmd + K shortcut to trigger Fast Cashier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsCashierOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

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
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC] text-[#1E293B]">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r border-[#E2E8F0] bg-white shadow-xs">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shadow-xs">
              <GraduationCap className="w-5 h-5 text-[#2563EB]" />
            </div>
            <span className="font-heading font-bold text-xl text-[#1E293B]">
              Aymn<span className="text-[#2563EB]">EDU</span>
            </span>
          </div>
        </div>

        {/* Quick Cashier Button (Top of Sidebar) */}
        <div className="px-3 pt-3">
          <button
            type="button"
            onClick={() => setIsCashierOpen(true)}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200 text-[#2563EB] font-semibold text-xs transition-all shadow-2xs group"
          >
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-[#2563EB]" />
              <span>Recherche / Caisse</span>
            </div>
            <span className="flex items-center gap-0.5 text-[10px] bg-white px-1.5 py-0.5 rounded border border-blue-200 text-[#2563EB] font-mono">
              <Command className="w-2.5 h-2.5" /> K
            </span>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
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
              className="w-full text-left p-3 rounded-xl bg-slate-50 hover:bg-blue-50/50 border border-[#E2E8F0] hover:border-blue-300 transition-all duration-150 group shadow-2xs"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-[#64748B] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" /> Abonnement
                </span>
                {isExpired ? (
                  <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">Expiré</span>
                ) : isTrial ? (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                    Essai {sub.days_remaining}j
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-[#10B981] bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">Pro</span>
                )}
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#334155]">
                <span className="truncate font-medium">{sub.nom_centre || 'Mon Centre'}</span>
                <ChevronRight className="w-3.5 h-3.5 text-[#64748B] group-hover:text-[#2563EB] transition-colors" />
              </div>
            </button>
          </div>
        )}

        {/* User Card */}
        <div className="px-3 py-4 border-t border-[#E2E8F0] bg-slate-50/50">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-100/80 cursor-pointer group transition-colors">
            <div className="w-9 h-9 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-[#2563EB] font-bold text-sm flex-shrink-0 shadow-2xs">
              {user?.full_name?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#1E293B] truncate">{user?.full_name}</p>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${roleBadge.color}`}>
                {roleBadge.label}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="text-[#64748B] hover:text-red-600 transition-colors duration-150 p-1 rounded-md hover:bg-white"
              title="Déconnexion"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* Top Header Bar with Fast Cashier Search trigger */}
        <header className="h-14 px-6 border-b border-[#E2E8F0] bg-white flex items-center justify-between flex-shrink-0">
          <button
            type="button"
            onClick={() => setIsCashierOpen(true)}
            className="flex items-center gap-3 px-4 py-2 rounded-xl bg-slate-100/80 hover:bg-slate-200/70 border border-[#E2E8F0] text-xs text-[#64748B] hover:text-[#1E293B] transition-all w-80 justify-between cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-[#64748B]" />
              <span>Rechercher un élève (Caisse rapide)...</span>
            </span>
            <kbd className="font-mono bg-white text-[#475569] text-[10px] font-semibold px-1.5 py-0.5 rounded border border-[#CBD5E1] shadow-2xs">
              Ctrl + K
            </kbd>
          </button>

          <div className="flex items-center gap-3 text-xs text-[#64748B]">
            <span className="hidden sm:inline font-medium text-[#334155]">{sub?.nom_centre || 'AymnEDU'}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[11px] font-semibold text-emerald-600">Système opérationnel</span>
          </div>
        </header>

        {/* Top Subscription Notification Banners */}
        {isExpired ? (
          <div className="bg-red-50 border-b border-red-200 px-6 py-2.5 flex items-center justify-between flex-wrap gap-2 text-xs text-red-700">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>
                <strong>Période d'essai terminée (14 jours écoulés).</strong> L'enregistrement de nouvelles données (élèves, groupes, paiements) est bloqué.
              </span>
            </div>
            <button
              onClick={() => setIsSubModalOpen(true)}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors shadow-sm"
            >
              Activer mon forfait Pro (4 500 DA)
            </button>
          </div>
        ) : isTrial ? (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center justify-between flex-wrap gap-2 text-xs text-amber-800">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>
                Période d'essai Starter : <strong>{sub?.days_remaining ?? 0} jour(s) restant(s)</strong> • Élèves : {sub?.current_eleves ?? 0}/{sub?.max_eleves ?? 50}.
              </span>
            </div>
            <button
              onClick={() => setIsSubModalOpen(true)}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition-colors shadow-xs"
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

      {/* Killer Feature: Quick Cashier Modal (Ctrl + K) */}
      <QuickCashierModal
        isOpen={isCashierOpen}
        onClose={() => setIsCashierOpen(false)}
      />
    </div>
  )
}
