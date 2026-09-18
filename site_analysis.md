# 📌 Analyse Complète d'AymnEDU — Logiciel de Gestion pour Centres de Soutien Scolaire

> **AymnEDU** est une solution SaaS (Software-as-a-Service) Web multi-tenant conçue spécifiquement pour la gestion administrative, financière et pédagogique des **centres de soutien scolaire et d'école privée en Algérie**.

---

## 📐 Architecture Technique

```mermaid
graph TD
    Client["Client Web (React 18 + Vite + Tailwind)"] -->|HTTP / JSON (Axios)| API["Backend REST API (FastAPI)"]
    API -->|JWT Security & RBAC| Auth["Module Auth & Permissions"]
    API -->|SQLAlchemy 2.0 ORM| BDD[(Base de Données PostgreSQL 16)]
    API -->|Docs Interactives| Docs["Swagger UI / OpenAPI (/docs)"]
```

### 1. Frontend (Interface Utilisateur)
* **Framework & Tooling** : React 18 avec TypeScript, Bundler Vite.
* **Design & Styling** : Tailwind CSS avec mode sombre modernisé, palette de couleurs personnalisée (Indigo/Bleu/Slate/Glassmorphism).
* **Gestion d'État & Data Fetching** : TanStack React Query (`@tanstack/react-query`) pour le cache et les requêtes asynchrones réactives.
* **Composants spécialisés** :
  * **Graphiques** : `Recharts` (Visualisation du chiffre d'affaires, statistiques d'assiduité).
  * **Emploi du Temps** : `FullCalendar` (Planning hebdomadaire interactif).
  * **Icônes & UI** : `lucide-react` & `clsx` / `tailwind-merge`.

### 2. Backend (Logique Métier & APIs)
* **Framework** : FastAPI (Python 3.12).
* **ORM & Migrations** : SQLAlchemy 2.0 & Alembic.
* **Sécurité & Auth** : JWT (JSON Web Tokens) avec Access Tokens (30 min) & Refresh Tokens (7 jours), Hachage BCrypt des mots de passe.
* **Architecture Multi-tenant** : Isolation stricte des données par centre via la clé étrangère `centre_id` sur toutes les entités.

### 3. Base de Données (PostgreSQL)
* **Serveur actif** : PostgreSQL 16 (Base `aymnedu`).
* **Structure ORM (8 Tables)** :
  1. `centres` : Établissements abonnés.
  2. `utilisateurs` : Comptes administrateurs, secrétaires et enseignants.
  3. `eleves` : Fiches des élèves inscrits.
  4. `groupes` : Groupes de cours par niveau et matière.
  5. `inscriptions_groupes` : Association Élève ↔ Groupe.
  6. `paiements` : Suivi des mensualités et reçus d'encaissement.
  7. `presences` : Appel numérique par groupe et séance.
  8. `seances` : Planning hebdomadaire des salles et cours.

---

## 🔐 Rôles & Niveaux d'Accès (RBAC)

L'application intègre 3 profils d'utilisateurs distincts :

| Rôle | Périmètre d'Accès |
| :--- | :--- |
| **`directeur`** | Accès total : Statistiques globales, gestion financière, gestion des utilisateurs/profs, paramétrage du centre. |
| **`secretaire`** | Accès opérationnel : Inscription des élèves, encaissement des mensualités, génération des reçus. |
| **`enseignant`** | Accès pédagogique : Prise d'appel (présences/absences) pour ses groupes, consultation de son planning. |

---

## 🚀 Fonctionnalités Détaillées par Module

### 1. Site Vitrine & Onboarding (`/` & `/register`)
* **Landing Page (`/`)** : Présentation dynamique de la plateforme, avantages pour les centres algériens, tarification (Starter, Pro, Enterprise).
* **Inscription de Centre (`/register`)** : Création autonome d'un nouveau centre et du compte Directeur associé en un seul formulaire.
* **Connexion Sécurisée (`/app/login`)** : Authentification par email/mot de passe avec conservation du token JWT.

### 2. Tableau de Bord Interactif (`/app/dashboard`)
* **Indicateurs Clés (KPIs en temps réel)** :
  * Total des élèves actifs.
  * Chiffre d'affaires mensuel (en Dinars DZD).
  * Montant des impayés du mois en cours.
  * Taux global de présence et nombre de groupes actifs.
* **Visualisations Graphiques** :
  * Graphique d'évolution des revenus mensuels.
  * Répartition des élèves par niveau d'études (3AS, 4AM, 1AS...).

### 3. Gestion des Élèves (`/app/eleves`)
* **Fiches Élèves** : Prénom, nom, niveau scolaire, téléphone du responsable légal, date d'inscription.
* **Recherche & Filtrage** : Recherche instantanée par nom/téléphone et filtre par niveau.
* **Inscriptions multiples** : Affectation d'un élève à un ou plusieurs groupes de soutien.
* **Statuts** : Gestion du statut Élève (`actif` / `inactif`).

### 4. Gestion des Groupes & Matières (`/app/groupes`)
* **Création de Groupes** : Intitulé du cours, matière (Maths, Physique, Arabe...), niveau d'études, capacité maximale de la salle.
* **Affectation d'Enseignants** : Attribution d'un professeur référent par groupe.
* **Suivi de Remplissage** : Jauge visuelle de capacité (ex: *18/20 élèves inscrits*).

### 5. Gestion des Enseignants (`/app/enseignants`)
* **Répertoire des Professeurs** : Coordonnées, matières enseignées, statut des comptes.
* **Création de Comptes Profs** : Génération d'accès sécurisés pour que les enseignants puissent se connecter.

### 6. Gestion Financière & Paiements (`/app/paiements`)
* **Suivi des Cotisations** : Vue claire des paiements mensuels par élève et par groupe.
* **Statuts de Paiement** : `payé`, `impayé`, `partiel`.
* **Génération de Reçus** : Numérotation automatique des reçus d'encaissement (`REC-2026-XXXX`).
* **Filtres de Caisse** : Filtrage par mois et recherche des impayés pour relancer les parents.

### 7. Gestion des Présences (`/app/presences`)
* **Appel Numérique** : Interface rapide pour cocher les élèves `Présents`, `Absents` ou `En Retard`.
* **Saisie du Retard** : Comptabilisation des minutes de retard.
* **Historique d'Assiduité** : Consultation du taux de présence par élève ou par groupe.

### 8. Planning & Emploi du Temps (`/app/planning`)
* **Vue Hebdomadaire** : Visualisation claire des créneaux par jour et par salle (*Salle 1, Salle Labo...*).
* **Anti-collision** : Prévention du surdimensionnement des salles et des conflits d'horaires.

---

## 🎯 Synthèse des Identifiants de Test (Mode Démo)

| Compte | Email | Mot de passe | Rôle |
| :--- | :--- | :--- | :--- |
| **Directeur** | `directeur@aymnedu.dz` | `admin1234` | Administration Complète |
| **Secrétaire** | `secretaire@aymnedu.dz` | `secretaire1234` | Gestion & Caisse |
| **Enseignant** | `slimane.maths@aymnedu.dz` | `prof1234` | Espace Professeur |
