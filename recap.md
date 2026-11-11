# 📋 Rapport d'Audit & Synthèse d'Expertise Fullstack — AymnEDU

> **Rôles d'évaluation** : Développeur Fullstack Senior & Tech Lead (React / TypeScript + Python / FastAPI / PostgreSQL)  
> **Cible** : Projet **AymnEDU** (SaaS de gestion multi-tenant pour centres de soutien scolaire en Algérie)  
> **Date d'évaluation** : 17 Septembre 2026  
> **Note globale Fullstack** : **5.2 / 10** (Niveau Prototype / MVP Avancé — Bel habillage mais dettes techniques backend importantes)

---

## 🎯 1. Synthèse Exécutive du Lead Fullstack

En analysant le projet de bout en bout (Frontend, Backend, BDD, API, Sécurité et DevOps), **AymnEDU** présente un contraste très net :

* **Côté pile (Le Frontend)** : Une interface très propre, moderne et séduisante. Les choix technologiques sont pertinents (React 18, Vite, Tailwind CSS, TanStack Query, React Hook Form avec validation Zod).
* **Côté face (Le Backend & la Donnée)** : Des raccourcis d'implémentation typiques d'un MVP développé rapidement ou d'un profil junior/intermédiaire :
  * Absence de couche de service (toute la logique est dans les routes).
  * Faille d'autorisation RBAC (les rôles ne sont pas vérifiés sur les routes).
  * Contrat d'API incomplet (routes d'édition manquantes).
  * Zéro test automatisé et zéro migration de base de données gérée.

---

## 🏗️ 2. Fiche Technique Complète

| Domaine | Stack & Outils | Appréciation Senior |
| :--- | :--- | :--- |
| **Frontend UI** | React 18, TypeScript, Vite, Tailwind CSS | **Très bon** : Design sombre soigné, composants réactifs, FullCalendar, Recharts. |
| **Frontend State & Forms**| TanStack Query v5, React Hook Form, Zod | **Excellent choix** : Gestion de cache serveur optimisée, validation de schémas typée. |
| **Backend API** | FastAPI (Python 3.12), Pydantic v2 | **Moyen** : Framework moderne et rapide, mais architecture non découplée (monolithique). |
| **ORM & BDD** | SQLAlchemy 2.0, PostgreSQL 16 / SQLite local | **Passable** : Modèles relationnels corrects mais manque d'intégrité, pas d'Alembic. |
| **Sécurité & Auth** | JWT (Access/Refresh), BCrypt | **Insuffisant** : BCrypt OK, mais RBAC passoire et tokens stockés dans LocalStorage. |
| **Tâches asynchrones**| Celery + Redis (déclarés) | **Fantôme** : Listés dans les dépendances mais jamais instanciés ni utilisés. |
| **Qualité & Tests** | Aucun (`pytest`, `vitest`, `jest` absents) | **Inacceptable en prod** : 0% de couverture de test. |

---

## 🔬 3. Audit Approfondi par Couche Technique

### 3.1. Frontend (Note : 7.2 / 10)
#### ✅ Ce qui est bien fait :
* **Stack moderne & outillage rapide** : Vite + TypeScript offre un temps de build et un hot reload ultra performants.
* **Composants soignés** :
  * [`DashboardPage.tsx`](file:///c:/Users/almaw/Desktop/test_ecole/aymnedu/frontend/src/pages/DashboardPage.tsx) : Cartes KPI avec micro-animations, barre de progression dynamique.
  * [`PlanningPage.tsx`](file:///c:/Users/almaw/Desktop/test_ecole/aymnedu/frontend/src/pages/PlanningPage.tsx) : Intégration de FullCalendar pour l'affichage de l'emploi du temps hebdomadaire.
* **Formulaires robustes avec Zod** : Dans [`ElevesPage.tsx`](file:///c:/Users/almaw/Desktop/test_ecole/aymnedu/frontend/src/pages/ElevesPage.tsx) et [`GroupesPage.tsx`](file:///c:/Users/almaw/Desktop/test_ecole/aymnedu/frontend/src/pages/GroupesPage.tsx), la validation avec `zodResolver` est propre et empêche les soumissions corrompues.
* **Invalidation intelligente du cache** : Les mutations utilisent `qc.invalidateQueries({ queryKey: ['...'] })` pour rafraîchir l'UI sans recharger la page.

#### ⚠️ Les bugs & faiblesses Frontend :
1. **Redirection brisée sur 401** : Dans [`frontend/src/api/client.ts`](file:///c:/Users/almaw/Desktop/test_ecole/aymnedu/frontend/src/api/client.ts#L34), en cas de refresh token expiré, le code fait :
   ```typescript
   window.location.href = '/login'
   ```
   Or dans [`App.tsx`](file:///c:/Users/almaw/Desktop/test_ecole/aymnedu/frontend/src/App.tsx), la route de login est `/app/login` ! L'utilisateur est donc redirigé vers la page d'accueil (`/`) au lieu du formulaire de connexion.
2. **Stockage JWT en LocalStorage** : Le refresh token est stocké dans le `localStorage`, ce qui expose l'application au vol de session en cas de faille XSS. Un cookie `HttpOnly; SameSite=Strict` est le standard de l'industrie.
3. **Pagination manquante dans l'UI** : L'API backend renvoie des données paginées (`total`, `page`, `pages`, `items`), mais l'UI de la liste des élèves ne propose aucun composant de pagination (boutons Précédent/Suivant).

---

### 3.2. Backend & Architecture API (Note : 4.5 / 10)
#### ✅ Ce qui est bien fait :
* Utilisation de FastAPI et Pydantic v2 pour la validation des payloads entrants.
* Hachage des mots de passe sécurisé avec `bcrypt.gensalt()` dans [`security.py`](file:///c:/Users/almaw/Desktop/test_ecole/aymnedu/backend/app/core/security.py).

#### 🔴 Les défauts critiques Backend :
1. **Contrat d'API désynchronisé (Routes PUT inexistantes)** :
   Le fichier client [`frontend/src/api/index.ts`](file:///c:/Users/almaw/Desktop/test_ecole/aymnedu/frontend/src/api/index.ts) implémente des méthodes de modification :
   * `PUT /api/v1/eleves/{id}`
   * `PUT /api/v1/groupes/{id}`
   * `PUT /api/v1/emplois-du-temps/{id}`
   
   👉 **Ces routes n'existent pas dans FastAPI** ([`resources.py`](file:///c:/Users/almaw/Desktop/test_ecole/aymnedu/backend/app/api/routes/resources.py)). Si l'utilisateur tente d'éditer une fiche existante, l'API répondra par un code d'erreur **405 Method Not Allowed**.

2. **Absence de découpage en couches (No Layered Architecture)** :
   * Les dossiers [`app/schemas/`](file:///c:/Users/almaw/Desktop/test_ecole/aymnedu/backend/app/schemas) et [`app/services/`](file:///c:/Users/almaw/Desktop/test_ecole/aymnedu/backend/app/services) sont **vides**.
   * Tout le code (schémas Pydantic, queries SQL, logique métier, validation de paramètres) est entassé dans un seul fichier [`resources.py`](file:///c:/Users/almaw/Desktop/test_ecole/aymnedu/backend/app/api/routes/resources.py) de 324 lignes.
   * Il n'y a pas de séparation entre le contrôleur HTTP et la logique métier.

3. **Goulot d'étranglement de requêtes N+1** :
   Dans la récupération des groupes ([`resources.py#L135`](file:///c:/Users/almaw/Desktop/test_ecole/aymnedu/backend/app/api/routes/resources.py#L135)) :
   ```python
   groupes = db.query(Groupe).filter(Groupe.centre_id == user.centre_id).all()
   for g in groupes:
       count = db.query(InscriptionGroupe).filter(InscriptionGroupe.groupe_id == g.id).count() # 1 query SQL par groupe !
   ```
   Pour 50 groupes, 51 requêtes SQL sont déclenchées au lieu d'une jointure agrégée avec `func.count()`.

4. **Valeurs factices codées en dur (Hardcoded)** :
   Dans [`resources.py#L320`](file:///c:/Users/almaw/Desktop/test_ecole/aymnedu/backend/app/api/routes/resources.py#L320), le taux de présence hebdomadaire renvoie `85` en dur sans calcul réel.

5. **Planning sans détection de collision** :
   L'insertion d'une séance dans `create_seance` n'effectue aucun test d'intersection horaire (`heure_debut < H_fin AND heure_fin > H_debut`). Deux cours peuvent occuper la même salle au même moment.

---

### 3.3. Base de Données & Intégrité (Note : 4.5 / 10)
#### ✅ Ce qui est bien fait :
* Séparation stricte des données de chaque école par la colonne `centre_id`.
* Types énumérés pour les statuts (`actif`/`inactif`, rôles, statuts de paiement).

#### ⚠️ Les problèmes majeurs de BDD :
1. **Suppression physique destructrice (`CASCADE`)** :
   Dans [`models/__init__.py`](file:///c:/Users/almaw/Desktop/test_ecole/aymnedu/backend/app/models/__init__.py#L75), supprimer un élève supprime tous ses paiements et présences. En gestion d'entreprise, c'est une violation légale et comptable (perte des reçus de caisse). Il faut un **Soft Delete** (`statut = 'inactif'` ou `deleted_at`).
2. **Absence de contraintes d'unicité critiques** :
   * Sur `inscriptions_groupes` : Pas de `UniqueConstraint('eleve_id', 'groupe_id')`. Un élève peut être inscrit 5 fois au même groupe.
   * Sur `presences` : Pas de `UniqueConstraint('groupe_id', 'eleve_id', 'date_seance')`. Risque d'avoir plusieurs feuilles d'émargement contradictoires pour la même séance.
3. **Absence d'historique de migrations Alembic** :
   Le dossier [`migrations/`](file:///c:/Users/almaw/Desktop/test_ecole/aymnedu/backend/migrations) est vide. En production avec PostgreSQL, modifier une colonne nécessitera de recréer manuellement les tables sans système de versionnement de schéma.

---

### 3.4. Sécurité & Contrôle d'Accès (Note : 4.0 / 10)
1. **Broken Access Control (Faille OWASP n°1)** :
   Bien que le projet définisse `require_role()` dans `auth.py`, **aucune route ressource ne l'utilise**. Un professeur avec des accès limités peut supprimer un élève, consulter la trésorerie ou modifier des paiements via des requêtes HTTP directes.
2. **Gestion des secrets** :
   Dans [`seed.py`](file:///c:/Users/almaw/Desktop/test_ecole/aymnedu/backend/seed.py#L45), une clé secrète par défaut `aymnedu_secret_key_1234_local` est injectée dans le `.env` en fallback. En production, un démarrage doit échouer si une vraie clé aléatoire de 256 bits n'est pas fournie.

---

### 3.5. DevOps, Qualité & Tests (Note : 2.0 / 10)
* **Tests** : 0 test unitaire, 0 test d'intégration, 0 test E2E.
* **CI/CD** : Aucun pipeline de build, de linting ou de test automatisé (pas de `.github/workflows`).
* **Docker Compose** : Présent ([`docker-compose.yml`](file:///c:/Users/almaw/Desktop/test_ecole/aymnedu/docker-compose.yml)), mais sans reverse proxy Nginx, sans gestion des certificats SSL/TLS ni configuration de cache de production.

---

## 📊 4. Grille de Notation Fullstack Détaillée

```
┌───────────────────────────────────────┬────────────┬────────────────────────────────────────────────────────┐
│ Catégorie                             │    Note    │ Observation du Lead Fullstack                          │
├───────────────────────────────────────┼────────────┼────────────────────────────────────────────────────────┤
│ 1. Frontend & Ergonomie (UI/UX)       │  7.2 / 10  │ Très beau rendu Tailwind, composants réactifs propres  │
│ 2. Architecture Frontend (State/TS)   │  6.8 / 10  │ TanStack Query et Zod bien gérés, petit bug d'URL 401  │
│ 3. Architecture Backend & API REST    │  4.5 / 10  │ Monolithique dans resources.py, routes PUT manquantes  │
│ 4. Modélisation Base de Données (ORM) │  4.5 / 10  │ Multi-tenant OK mais cascades destructrices, 0 Alembic │
│ 5. Sécurité & Authentification (RBAC) │  4.0 / 10  │ JWT + BCrypt OK, mais RBAC non branché sur les routes  │
│ 6. Performance & Optimisation SQL     │  4.0 / 10  │ Requêtes N+1 sur les groupes et paiements              │
│ 7. Tests & Couverture Qualité         │  1.0 / 10  │ 0 test (pytest / vitest)                               │
│ 8. DevOps & Production Readiness      │  3.5 / 10  │ Docker basique, pas de CI/CD, clés par défaut          │
└───────────────────────────────────────┴────────────┴────────────────────────────────────────────────────────┘
```

### 🏆 **NOTE FINALE PONDÉRÉE : 5.2 / 10**

### 💬 Verdict du Tech Lead :
> **Niveau actuel : Bon prototype MVP de niveau Développeur Intermédiaire / Junior.**
> Le projet a une vraie valeur marchande sur le secteur des cours de soutien en Algérie et le frontend donne immédiatement confiance. En revanche, le backend ne tient pas la promesse d'un code de niveau "Senior" : c'est un CRUD rapide qui manque de rigueur architecturale (découpage en couches, routes manquantes, N+1 queries, rôles non sécurisés et absence totale de tests).

---

## 🛠️ 5. Roadmap Prioritaire pour Passer de 5.2 à 8.5+/10

### 🟢 Étape 1 : Corriger les blocages fonctionnels (1 à 2 jours)
1. **Ajouter les routes de modification manquantes** dans `resources.py` :
   * `PUT /api/v1/eleves/{id}` (mise à jour d'un élève)
   * `PUT /api/v1/groupes/{id}` (mise à jour d'un groupe)
   * `PUT /api/v1/emplois-du-temps/{id}` (mise à jour d'une séance)
2. **Corriger la redirection 401** dans `client.ts` : remplacer `/login` par `/app/login`.
3. **Sécuriser avec le RBAC** : Appliquer `Depends(require_role("directeur"))` sur les routes de suppression et financières.

### 🟡 Étape 2 : Restructurer le Backend (3 à 5 jours)
1. **Éclater `resources.py` en couches propres** :
   * Extraire les DTOs Pydantic dans `app/schemas/` (`eleve.py`, `groupe.py`, `paiement.py`).
   * Créer une couche `app/services/` pour encapsuler la logique métier (calcul d'assiduité, détection de conflit de planning).
2. **Supprimer les requêtes N+1** : Utiliser `joinedload` ou une sous-requête `group_by` pour calculer le nombre d'élèves par groupe en une seule requête SQL.
3. **Activer Alembic** : Générer la première migration initiale (`alembic revision --autogenerate`).

### 🔴 Étape 3 : Fiabiliser la Base de Données & la Sécurité (3 à 5 jours)
1. **Remplacer `CASCADE` par un Soft Delete** (`is_active = False`) sur les élèves pour conserver l'historique comptable.
2. **Ajouter les contraintes d'unicité SQL** : `UniqueConstraint('eleve_id', 'groupe_id')` et `UniqueConstraint('groupe_id', 'eleve_id', 'date_seance')`.
3. **Détecter les collisions de créneaux** : Bloquer tout chevauchement horaire pour la même salle ou le même professeur.

### 🟣 Étape 4 : Industrialisation & Tests (5 jours)
1. **Écrire une suite de tests `pytest`** : Tester l'authentification, les autorisations selon les rôles et le cycle de vie d'un paiement.
2. **Configurer GitHub Actions** : Lancer automatiquement les tests et le linter à chaque commit.
