import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import {
  LayoutDashboard, Users, BookOpen, CreditCard, ClipboardCheck,
  Calendar, LogOut, GraduationCap, School, Users2
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

  const handleLogout = () => {
    logout()
    navigate('/app/login')
  }

  const navItems = NAV_BY_ROLE[user?.role ?? 'directeur'] ?? NAV_BY_ROLE.directeur
  const roleBadge = ROLE_BADGES[user?.role ?? 'directeur']

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

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 lg:p-8 animate-fadeIn">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
