import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import {
  LayoutDashboard, Users, BookOpen, CreditCard, ClipboardCheck, Calendar, LogOut, GraduationCap, School,
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/app/dashboard',    label: 'Tableau de bord', icon: LayoutDashboard },
  { to: '/app/eleves',       label: 'Élèves',           icon: Users },
  { to: '/app/groupes',      label: 'Groupes',           icon: BookOpen },
  { to: '/app/enseignants',  label: 'Enseignants',       icon: School },
  { to: '/app/paiements',    label: 'Paiements',         icon: CreditCard },
  { to: '/app/presences',    label: 'Présences',         icon: ClipboardCheck },
  { to: '/app/planning',     label: 'Planning',          icon: Calendar },
]

export function DashboardLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/app/login')
  }

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
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
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
              <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
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
