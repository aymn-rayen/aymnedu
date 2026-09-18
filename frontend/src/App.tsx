import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import LandingPage from '@/pages/LandingPage'
import RegisterCenterPage from '@/pages/RegisterCenterPage'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import ElevesPage from '@/pages/ElevesPage'
import GroupesPage from '@/pages/GroupesPage'
import PaiementsPage from '@/pages/PaiementsPage'
import PresencesPage from '@/pages/PresencesPage'
import PlanningPage from '@/pages/PlanningPage'
import EnseignantsPage from '@/pages/EnseignantsPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0b0f19]">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!user) return <Navigate to="/app/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/register" element={<RegisterCenterPage />} />
        <Route path="/app/login" element={<LoginPage />} />

        {/* Private Routes (Protected) */}
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="eleves" element={<ElevesPage />} />
          <Route path="groupes" element={<GroupesPage />} />
          <Route path="enseignants" element={<EnseignantsPage />} />
          <Route path="paiements" element={<PaiementsPage />} />
          <Route path="presences" element={<PresencesPage />} />
          <Route path="planning" element={<PlanningPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}

