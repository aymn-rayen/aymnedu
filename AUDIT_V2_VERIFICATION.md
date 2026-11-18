# AYMNEDU — RAPPORT D'AUDIT TECHNIQUE V2 : VÉRIFICATION CRITIQUE & MATURITÉ SAAS

**Date de l'audit :** 17 Novembre 2026  
**Type d'évaluation :** Deuxième Audit Indépendant & Contre-Expertise Technique  
**Équipe d'audit :** Collège d'Experts (Principal Software Architect, Senior SaaS Engineer, Application Security Engineer, PostgreSQL Specialist, Lead DevOps Engineer, QA Automation Engineer)  
**Version analysée :** Commit `560124a` sur le dépôt `aymnedu`  

---

## 1. INTRODUCTION & MÉTHODOLOGIE DE VÉRIFICATION

Cet audit a été conduit avec une posture de scepticisme systématique. Aucun constat du rapport précédent n'a été accepté sans vérification directe dans le code source, sans exécution de tests automatisés ou sans analyse des modèles de données et flux réseau.

### Définitions Rigoureuses des Statuts de Vérification :
- **VERIFIED** : Affirmation confirmée directement dans le code source ou validée par un test reproductible.
- **PARTIALLY VERIFIED** : Affirmation contenant une part de vérité mais imprécise ou incomplète face à l'état actuel du code.
- **FALSE** : Affirmation réfutée par les faits et le code source.
- **NOT IMPLEMENTED** : Fonctionnalité inexistante dans la base de code.
- **NOT VERIFIED** : Preuve insuffisante pour statuer formellement.

---

## 2. MATRICE DE CONFRONTATION AVEC L'AUDIT PRÉCÉDENT

| # | Affirmation du précédent audit | Preuve réelle constatée dans le code | Statut | Correction & Réalité Technique |
|---|---|---|:---:|---|
| **1** | Frontend en React 18 + TypeScript + Vite | `aymnedu/frontend/package.json` : `react: 18.3.1`, `typescript: 5.2.2`, `vite: 5.3.1`. Build complet `tsc && vite build` exécuté en 10.78s. | **VERIFIED** | Confirmé sans réserve. L'architecture SPA React 18 fonctionne avec TailwindCSS et React Query. |
| **2** | Backend en FastAPI + SQLAlchemy + PostgreSQL | `backend/requirements.txt` : `fastapi==0.111.0`, `sqlalchemy==2.0.30`, `psycopg2-binary==2.9.9`. Routes montées dans `app/main.py`. | **VERIFIED** | Confirmé. La pile Python FastAPI + SQLAlchemy 2.0 est bien en place avec configuration async/sync. |
| **3** | Multi-tenancy logique basé sur `centre_id` | Présence de `centre_id` sur `centres`, `utilisateurs`, `eleves`, `groupes`, `paiements`, `seances`. Requêtes filtrées dans les services. | **PARTIALLY VERIFIED** | **Nuance critique :** Les tables de jointure `inscriptions_groupes` et la table `presences` **n'ont pas de colonne `centre_id`**. De plus, `save_presences_batch` ne vérifie pas l'appartenance du `groupe_id` au centre de l'utilisateur ! |
| **4** | RBAC avec rôles Directeur, Secrétaire, Enseignant | `RoleEnum` défini dans `app/models/__init__.py`. Décorateur `require_role()` dans `auth.py`. | **VERIFIED** | Les 3 rôles existent et sont appliqués sur les endpoints backend (ex: `paiements` interdit aux enseignants). Absence de rôle `super_admin`. |
| **5** | Modules fonctionnels (élèves, groupes, profs, planning, paiements) | Tous les contrôleurs et services existent et sont connectés à la base. Calculs réels, absence de mocks statiques sur les routes de données. | **VERIFIED** | Les modules sont réellement fonctionnels au sens applicatif, avec gestion de la suppression logique (soft-delete). |
| **6** | JWT stockés dans `localStorage` | `frontend/src/hooks/useAuth.tsx` lignes 20, 39, 48 et `frontend/src/api/client.ts` ligne 18 utilisent `localStorage.getItem('access_token')` et `localStorage.getItem('refresh_token')`. | **VERIFIED** | **Vrai et persistant !** Malgré l'ajout récent d'un cookie HttpOnly côté backend, le frontend continue d'écrire et de lire activement les tokens dans le `localStorage`. |
| **7** | Endpoint public exposé `/auth/centres/{id}/roles` | `app/api/routes/auth.py` ligne 237 : l'endpoint a été décoré avec `Depends(get_current_user)` et un contrôle `current_user.centre_id != centre_id`. | **PARTIALLY VERIFIED** | La fuite publique a été colmatée, **mais cela a rendu la route `/auth/login-role` inopérante** pour les utilisateurs non connectés ! L'endpoint `/auth/centres/search` reste quant à lui 100% public. |
| **8** | Migrations Alembic incomplètes | 3 migrations existent : `0001_initial_schema.py`, `03dd511366e5`, `0002_add_refresh_tokens.py`. `alembic upgrade head` réussit en ligne. | **PARTIALLY VERIFIED** | La migration en ligne réussit, mais **la génération SQL hors-ligne (`alembic upgrade head --sql`) plante** avec `NoInspectionAvailable` à cause d'un `inspect(bind)` inadapté dans `03dd511366e5`. |
| **9** | Absence de moteur d'abonnement SaaS | Présence de `subscription_service.py` et `SubscriptionModal.tsx` avec blocage HTTP 402 en écriture après 14 jours. | **PARTIALLY VERIFIED** | Un garde-fou a été ajouté sur la création d'élèves/groupes/paiements, **mais les codes d'activation sont des chaînes codées en dur** (`AYMN-PRO-1MOIS`, `PRO365`), sans table de transactions ni facturation. |
| **10** | Absence de tableau de bord Super Admin | Aucun modèle, aucune route, aucune interface pour l'administrateur de la plateforme AymnEDU. | **VERIFIED** | Confirmé. L'éditeur du logiciel n'a aucun moyen d'administrer les centres sans passer par pgAdmin ou SQL direct. |
| **11** | Absence d'intégration de passerelle de paiement | Aucun appel API vers Chargily, SATIM ou CIB. Le paiement repose sur des instructions manuelles BaridiMob / CCP. | **VERIFIED** | Confirmé. Aucune passerelle automatisée n'existe. |
| **12** | Seulement 13 tests backend et 0 test frontend | Exécution de `pytest` : **23 tests backend découverts et passés avec succès** (0.67s). Frontend : 0 test. | **PARTIALLY VERIFIED** | Le volume de tests backend a augmenté (23 au lieu de 13 grâce à l'ajout des tests de sessions, d'abonnements et d'isolation), mais le frontend n'a toujours aucun test automatisé. |
| **13** | Configuration Docker et déploiement incomplète | `Dockerfile` backend multi-stage avec utilisateur non-root `appuser`, `Dockerfile` frontend + `nginx.conf` durci avec headers de sécurité, `docker-compose.yml` avec healthchecks, CI GitHub Actions. | **FALSE** | **L'affirmation d'incomplétude est désormais fausse.** Les configurations Docker et CI/CD ont été refondues et sont de qualité production. |

---

## 3. ANALYSE CRITIQUE DES CONTRADICTIONS ET ÉVOLUTIONS

### A. La contradiction du stockage des tokens JWT
L'audit précédent recommandait le passage aux cookies HttpOnly. Une tentative partielle a été réalisée côté backend (`set_refresh_cookie`), mais le frontend n'a pas été migré vers une gestion transparente par cookie :
- Le frontend continue de récupérer le token depuis `data.access_token` et `data.refresh_token` et de l'injecter dans `localStorage`.
- L'intercepteur Axios continue de lire `localStorage.getItem('access_token')`.
- **Conclusion de l'auditeur :** La vulnérabilité au vol de session via XSS n'est pas résolue tant que le frontend conserve cette logique.

### B. Le piège de l'endpoint `/roles` et la régression de `/login-role`
En voulant fermer la faille de divulgation d'utilisateurs (`/centres/{id}/roles`), une dépendance d'authentification stricte a été ajoutée. Or, la page de connexion alternative `/login-role` demandait à un enseignant ou une secrétaire de sélectionner son école, puis son nom, puis son mot de passe.
- Cet endpoint nécessite maintenant d'être déjà connecté pour lister le personnel de l'école.
- Par conséquent, la fonctionnalité de login par sélection de rôle est devenue techniquement inaccessible et morte dans sa forme initiale.

### C. Le dilemme des migrations Alembic
La chaîne de révisions est linéaire (`0001_initial_schema` -> `03dd511366e5` -> `0002_add_refresh_tokens`), et une création de base vierge fonctionne via `alembic upgrade head`. Cependant :
- Le script `03dd511366e5` fait appel à `inspect(bind)` au lieu d'opérations DDL pures.
- Cela empêche la génération de scripts SQL statiques (`--sql`), indispensable dans les environnements de déploiement d'entreprise où les migrations sont appliquées par des DBAs ou des pipelines d'infrastructure as code sans accès direct à l'environnement d'exécution.

---

## 4. TABLEAU RÉCAPITULATIF DES CONSTATS TECHNIQUES

```
+------------------------------------+-----------------------+-----------------------------+
| Domaine Audité                     | Statut Réel           | Évaluation V2               |
+------------------------------------+-----------------------+-----------------------------+
| Architecture Frontend (React/TS)   | Solide, typé, propre  | Conforme aux standards      |
| Architecture Backend (FastAPI)     | Modulaire, découplé   | Très satisfaisante          |
| Isolation Multi-Tenant             | Logique applicative   | Présence de failles ciblées |
| Sécurité Authentification / JWT    | En transition         | Risque XSS maintenu         |
| Moteur SaaS & Monétisation         | Embryonnaire          | Non prêt pour la prod       |
| Intégrité Base & Migrations        | Fonctionnelle en ligne| Fragile en mode offline     |
| Automatisation des Tests           | 23 tests backend pass.| Zéro couverture frontend    |
| Conteneurisation & DevOps          | Production-ready      | Excellent niveau atteint    |
+------------------------------------+-----------------------+-----------------------------+
```

