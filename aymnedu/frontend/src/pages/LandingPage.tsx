import { Link } from 'react-router-dom'
import {
  GraduationCap,
  Users,
  CreditCard,
  Calendar,
  CheckSquare,
  TrendingUp,
  ArrowRight,
  Shield,
  Zap
} from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0b0f19] text-[#f8fafc] font-sans selection:bg-primary-500/30 selection:text-white">
      {/* ── Nav Bar ────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-[#0b0f19]/70 border-b border-white/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary-500/10 border border-primary-500/20 rounded-xl">
              <GraduationCap className="w-6 h-6 text-primary-400" />
            </div>
            <span className="font-extrabold text-2xl tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              Aymn<span className="text-primary-400">EDU</span>
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#features" className="hover:text-white transition-colors">Fonctionnalités</a>
            <a href="#pricing" className="hover:text-white transition-colors">Tarifs</a>
            <a href="#about" className="hover:text-white transition-colors">À propos</a>
          </div>

          <div className="flex items-center gap-4">
            <Link
              to="/app/login"
              className="text-sm font-semibold hover:text-white text-slate-350 transition-colors px-4 py-2 hover:bg-white/5 rounded-lg"
            >
              Connexion
            </Link>
            <Link
              to="/register"
              className="bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm px-4 py-2 rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary-500/20 inline-flex items-center gap-1.5"
            >
              Essayer gratuitement
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-24 pb-20 px-6">
        {/* Decorative background glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 text-xs font-semibold uppercase tracking-wider mb-8 animate-fadeIn">
            <Zap className="w-3.5 h-3.5" />
            Logiciel tout-en-un pour centres de soutien en Algérie
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 bg-gradient-to-b from-white via-slate-100 to-slate-400 bg-clip-text text-transparent leading-none">
            Gérez votre établissement scolaire sans effort
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Inscriptions, paiements mensuels, absences, plannings et enseignants. Gagnez des heures précieuses et offrez à votre centre une gestion moderne et numérisée.
          </p>

          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <Link
              to="/register"
              className="w-full sm:w-auto bg-primary-500 hover:bg-primary-600 text-white font-semibold px-8 py-4 rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary-500/25 text-base inline-flex items-center justify-center gap-2"
            >
              Créer un compte centre
              <ArrowRight className="w-5 h-5" />
            </Link>
            <a
              href="#features"
              className="w-full sm:w-auto bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold px-8 py-4 rounded-xl transition-all duration-200 text-base inline-flex justify-center items-center"
            >
              Découvrir les fonctionnalités
            </a>
          </div>
        </div>
      </section>

      {/* ── Features section ───────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6 border-t border-white/5 bg-[#090d16]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-extrabold mb-4">
              Tout ce dont votre école a besoin
            </h2>
            <p className="text-slate-450 text-base leading-relaxed">
              Une plateforme simple et robuste conçue spécifiquement pour les centres de cours de soutien et de langues.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-[#121829] border border-white/5 hover:border-white/10 p-8 rounded-2xl transition-all duration-200 hover:-translate-y-1">
              <div className="w-12 h-12 bg-primary-500/10 border border-primary-500/20 rounded-xl flex items-center justify-center mb-6 text-primary-400">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Gestion des Élèves</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Suivez les fiches d'inscription complètes, les informations des parents, les niveaux scolaires et le statut de chaque élève.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-[#121829] border border-white/5 hover:border-white/10 p-8 rounded-2xl transition-all duration-200 hover:-translate-y-1">
              <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center mb-6 text-emerald-450">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Groupes & Emplois du Temps</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Créez vos classes par matière, assignez un enseignant et planifiez les séances de la semaine avec validation anti-conflits de salles.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-[#121829] border border-white/5 hover:border-white/10 p-8 rounded-2xl transition-all duration-200 hover:-translate-y-1">
              <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center mb-6 text-amber-450">
                <CreditCard className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Gestion des Paiements</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Suivi automatique des mensualités scolaires. Enregistrez les encaissements, générez des reçus et identifiez instantanément les impayés.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-[#121829] border border-white/5 hover:border-white/10 p-8 rounded-2xl transition-all duration-200 hover:-translate-y-1">
              <div className="w-12 h-12 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-center mb-6 text-purple-400">
                <CheckSquare className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Absences & Présences</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Faites l'appel numérique en classe en tant que secrétaire ou enseignant, suivez les retards et conservez un historique propre.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-[#121829] border border-white/5 hover:border-white/10 p-8 rounded-2xl transition-all duration-200 hover:-translate-y-1">
              <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center mb-6 text-blue-450">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Statistiques Globale</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Visualisez vos performances financières, le taux de remplissage de vos groupes et le taux d'assiduité des élèves sur un tableau de bord.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-[#121829] border border-white/5 hover:border-white/10 p-8 rounded-2xl transition-all duration-200 hover:-translate-y-1">
              <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-center mb-6 text-rose-450">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Rôle & Permissions</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Directeur, Secrétaire, Enseignant : des espaces adaptés avec des accès sécurisés selon le rôle pour préserver les données critiques.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing section ────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-6 border-t border-white/5 bg-[#0b0f19]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-extrabold mb-4">
              Des tarifs clairs et adaptés
            </h2>
            <p className="text-slate-400 text-base">
              Essayez gratuitement pendant 14 jours, sans engagement et sans carte de crédit requise.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Trial / Starter */}
            <div className="bg-[#121829] border border-white/5 p-8 rounded-2xl flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-primary-400 px-3 py-1 bg-primary-500/10 rounded-full">Essai Gratuit</span>
                <h3 className="text-2xl font-bold mt-4 mb-2 text-white">Starter</h3>
                <p className="text-slate-400 text-sm mb-6">Idéal pour tester toutes les fonctionnalités avec votre équipe.</p>
                <div className="text-4xl font-extrabold text-white mb-6">
                  0 DA <span className="text-sm font-normal text-slate-500">/ 14 jours</span>
                </div>
                <ul className="space-y-3.5 text-sm text-slate-300 mb-8">
                  <li className="flex items-center gap-2">✓ Support complet de toutes les pages MVP</li>
                  <li className="flex items-center gap-2">✓ Inscriptions d'élèves illimitées</li>
                  <li className="flex items-center gap-2">✓ Création de groupes et plannings</li>
                  <li className="flex items-center gap-2">✓ 1 compte centre & Rôles illimités</li>
                </ul>
              </div>
              <Link
                to="/register"
                className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10 font-semibold py-3 px-4 rounded-xl text-center transition-all duration-200"
              >
                Commencer mon essai
              </Link>
            </div>

            {/* Pro Plan */}
            <div className="bg-[#121829] border-2 border-primary-500/50 p-8 rounded-2xl relative flex flex-col justify-between shadow-2xl shadow-primary-500/5">
              <div className="absolute -top-3.5 right-6 text-xs font-bold uppercase tracking-wider bg-primary-505 bg-primary-500 text-white px-3.5 py-1 rounded-full">
                Le plus populaire
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-primary-300 px-3 py-1 bg-primary-500/10 rounded-full">Abonnement Pro</span>
                <h3 className="text-2xl font-bold mt-4 mb-2 text-white">Soutien Pro</h3>
                <p className="text-slate-400 text-sm mb-6">La solution permanente pour votre école de soutien.</p>
                <div className="text-4xl font-extrabold text-white mb-6">
                  4,500 DA <span className="text-sm font-normal text-slate-500">/ mois</span>
                </div>
                <ul className="space-y-3.5 text-sm text-slate-300 mb-8">
                  <li className="flex items-center gap-2">✓ Tout le Starter sans limite de temps</li>
                  <li className="flex items-center gap-2">✓ Sauvegardes quotidiennes sécurisées</li>
                  <li className="flex items-center gap-2">✓ Support client prioritaire 7j/7</li>
                  <li className="flex items-center gap-2">✓ Rapports financiers exportables</li>
                </ul>
              </div>
              <Link
                to="/register"
                className="w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold py-3 px-4 rounded-xl text-center transition-all duration-200 hover:shadow-lg hover:shadow-primary-500/20"
              >
                Activer Soutien Pro
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer id="about" className="bg-[#090d16] border-t border-white/5 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-500/10 border border-primary-500/20 rounded-lg">
              <GraduationCap className="w-5 h-5 text-primary-400" />
            </div>
            <span className="font-bold text-lg text-white">
              Aymn<span className="text-primary-400">EDU</span>
            </span>
          </div>

          <p className="text-slate-505 text-sm text-slate-500 text-center md:text-right">
            &copy; {new Date().getFullYear()} AymnEDU. Tous droits réservés. Élaboré pour les centres d'éducation en Algérie.
          </p>
        </div>
      </footer>
    </div>
  )
}
