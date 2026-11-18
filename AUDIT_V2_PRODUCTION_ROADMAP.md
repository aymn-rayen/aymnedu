# AYMNEDU — FEUILLE DE ROUTE DE MISE EN PRODUCTION (ROADMAP V2)
## Plan d'Action Priorisé, Estimation de Charge & Critères d'Acceptation

**Date :** 17 Novembre 2026  
**Auditeur :** Principal Software Architect & DevOps Lead  
**Objectif :** Transformer le MVP AymnEDU en plateforme SaaS commerciale résiliente, sécurisée et monétisable.  

---

## 1. VUE D'ENSEMBLE DES PHASES D'EXÉCUTION

```
[ PHASE 1 : CORRECTIFS CRITIQUES ]   --> 4 à 5 jours-homme  (Indispensable avant le 1er client)
[ PHASE 2 : MOTEUR COMMERCIAL SAAS ]  --> 7 à 9 jours-homme  (Indispensable pour la commercialisation)
[ PHASE 3 : RÉSILIENCE & QA AUTOMATION] --> 5 à 6 jours-homme  (Nécessaire pour le passage à l'échelle)
[ PHASE 4 : AUTOMATISATIONS & SCALING] --> 6 à 8 jours-homme  (Post-lancement / Croissance)
-----------------------------------------------------------------------------------------------
TOTAL ESTIMÉ : 22 à 28 jours-homme de développement senior.
```

---

## 2. DÉTAIL DES PHASES ET TÂCHES

### PHASE 1 : CORRECTIFS CRITIQUES (BLOQUANTS ABSOLUS - P0)
*À réaliser avant tout déploiement auprès d'une véritable école.*

#### Tâche 1.1 : Colmater la faille IDOR Cross-Tenant sur les présences
- **Fichier :** `backend/app/services/presence_service.py`
- **Action :** Vérifier que chaque `groupe_id` de la liste appartient au `centre_id` authentifié avant insertion en base.
- **Charge :** 0.5 jour-homme.
- **Critère d'acceptation :** Un test unitaire injectant un groupe d'un autre centre doit échouer ou ignorer l'enregistrement sans impacter le centre tiers.

#### Tâche 1.2 : Élimination du stockage des JWT dans `localStorage`
- **Fichiers :** `frontend/src/hooks/useAuth.tsx`, `frontend/src/api/client.ts`
- **Action :** Supprimer les `localStorage.setItem('access_token')` et `localStorage.setItem('refresh_token')`. Conserver l'access token dans l'état mémoire React (ou variable de module), et laisser le navigateur gérer le refresh token via le cookie HttpOnly SameSite.
- **Charge :** 1.5 jour-homme.
- **Critère d'acceptation :** Aucun token visible dans l'onglet Application > Local Storage du navigateur. L'authentification persiste lors du rafraîchissement de page via l'appel `/auth/refresh`.

#### Tâche 1.3 : Éradication des codes d'activation hardcodés
- **Fichiers :** `backend/app/services/subscription_service.py`, `app/models/__init__.py`
- **Action :** Créer la table `license_vouchers`. Remplacer la condition statique `if clean_code in ("PRO30", ...)` par une vérification en base avec marquage du voucher comme consommé (`is_redeemed = True`).
- **Charge :** 1.5 jour-homme.
- **Critère d'acceptation :** La saisie de `PRO365` est rejetée par une erreur 400. Seul un voucher généré aléatoirement en base permet l'activation, et il ne peut être utilisé qu'une seule fois.

#### Tâche 1.4 : Révocation des sessions lors de la désactivation d'un utilisateur
- **Fichier :** `backend/app/api/routes/utilisateurs.py`
- **Action :** Dans `delete_utilisateur`, ajouter l'appel à `session_service.revoke_all_sessions(db, user_id)`.
- **Charge :** 0.25 jour-homme.
- **Critère d'acceptation :** Dès qu'un compte est désactivé, son refresh token est immédiatement invalidé dans la table `refresh_tokens`.

#### Tâche 1.5 : Correction de la migration Alembic offline
- **Fichier :** `backend/migrations/versions/03dd511366e5_phase3_unique_softdelete_collisions.py`
- **Action :** Supprimer l'usage de `inspect(bind)` non supporté sur les `MockConnection`. Rendre les opérations DDL pures.
- **Charge :** 0.5 jour-homme.
- **Critère d'acceptation :** La commande `python -m alembic upgrade head --sql` s'exécute avec succès et génère le script SQL complet sans exception Python.

---

### PHASE 2 : MOTEUR COMMERCIAL & FACTURATION ALGÉRIE (P1)
*Nécessaire pour encaisser les abonnements et administrer les centres.*

#### Tâche 2.1 : Module Super-Admin (Backend & Interface Web)
- **Action :** 
  - Création du modèle `platform_admins`.
  - Endpoints réservés : liste des centres, métriques globales (nombre d'écoles actives, MRR, nombre total d'élèves), prolongation d'abonnement manuelle, génération de vouchers.
  - Interface dédiée (route `/admin` protégée).
- **Charge :** 3 jours-homme.
- **Critère d'acceptation :** L'éditeur peut se connecter et voir en direct tous les centres, leurs dates d'expiration, et générer un code de 1 mois ou 1 an.

#### Tâche 2.2 : Gestion des preuves de virement BaridiMob / CCP
- **Action :**
  - Ajout d'un formulaire d'upload de reçu dans `SubscriptionModal.tsx`.
  - Notification ou affichage dans l'espace Super-Admin pour validation comptable.
- **Charge :** 2 jours-homme.
- **Critère d'acceptation :** Un directeur peut uploader son récépissé de virement postal. L'administrateur valide le reçu, ce qui active instantanément le forfait du centre.

#### Tâche 2.3 : Intégration de la passerelle Chargily Pay (E-Paiement CIB / EDAHABIA)
- **Action :**
  - Implémentation du SDK ou client API REST Chargily Pay V2.
  - Création du webhook `POST /api/v1/webhooks/chargily` avec vérification de signature cryptographique.
- **Charge :** 2 jours-homme.
- **Critère d'acceptation :** Paiement test réussi en sandbox avec une carte EDAHABIA de test, prolongement automatique de l'abonnement du centre à la réception du webhook.

#### Tâche 2.4 : Correction du calcul de chiffre d'affaires sur le Dashboard
- **Fichier :** `backend/app/services/dashboard_service.py`
- **Action :** Modifier la somme SQL pour agréger `Paiement.montant_verse` sur tous les paiements du mois (qu'ils soient `paye` ou `partiel`).
- **Charge :** 0.5 jour-homme.
- **Critère d'acceptation :** Les acomptes versés sont correctement comptabilisés dans le montant encaissé affiché sur le tableau de bord.

---

### PHASE 3 : RÉSILIENCE, SÉCURITÉ & ASSURANCE QUALITÉ (P2)
*Garantir la fiabilité opérationnelle et l'expérience utilisateur.*

#### Tâche 3.1 : Procédure de mot de passe oublié & vérification des emails
- **Action :**
  - Mise en place d'un service d'envoi d'e-mails transactionnels (SMTP / Resend / Brevo).
  - Endpoints `POST /auth/forgot-password` et `POST /auth/reset-password` avec jeton chiffré temporaire (validité 1 heure).
- **Charge :** 2 jours-homme.
- **Critère d'acceptation :** Un utilisateur ayant oublié son mot de passe reçoit un lien sécurisé et peut définir un nouveau mot de passe sans intervention de l'administrateur.

#### Tâche 3.2 : Mise en place des tests automatisés Frontend
- **Action :**
  - Configuration de Vitest et React Testing Library dans `frontend/`.
  - Écriture de tests d'intégration sur les flux critiques : Connexion, Inscription d'un élève, Encaissement d'un paiement, Génération du reçu PDF.
- **Charge :** 2 jours-homme.
- **Critère d'acceptation :** La commande `npm test` s'exécute dans la CI GitHub Actions avec un taux de réussite de 100%.

#### Tâche 3.3 : Optimisation des bundles et Code-Splitting
- **Action :**
  - Découpage par `React.lazy()` des pages lourdes (`PlanningPage.tsx` avec FullCalendar, `DashboardPage.tsx` avec Recharts).
  - Configuration de `manualChunks` dans `vite.config.ts`.
- **Charge :** 1 jour-homme.
- **Critère d'acceptation :** Le bundle principal `index.js` passe sous la barre des 350 Ko (vs 1 108 Ko actuellement).

---

### PHASE 4 : AUTOMATISATIONS & SCALABILITÉ POST-LANCEMENT (P3)

#### Tâche 4.1 : Notifications SMS / WhatsApp aux parents d'élèves
- **Action :** Intégration d'une passerelle SMS locale ou WhatsApp Business API pour alerter en cas d'absence non justifiée ou de retard de paiement.
- **Charge :** 3 jours-homme.

#### Tâche 4.2 : Sauvegardes automatisées & Plan de reprise d'activité (PRA)
- **Action :** Configuration d'un script cron ou conteneur de dump PostgreSQL quotidien vers un stockage objet S3/Wasabi chiffré, avec rétention de 30 jours et test de restauration automatisé.
- **Charge :** 1.5 jour-homme.

#### Tâche 4.3 : Activation de PostgreSQL Row-Level Security (RLS)
- **Action :** Migration progressive vers RLS pour verrouiller l'accès aux données au niveau du moteur PostgreSQL lui-même.
- **Charge :** 2.5 jours-homme.

---

## 3. SYNTHÈSE DE LA CHARGE ET DU CALENDRIER

| Étape | Durée Calendaire Estimée | Jalons Clés |
|---|:---:|---|
| **Sprint 1 (Correctifs Critiques)** | Semaine 1 | Faille IDOR colmatée, Vouchers réels, Stockage JWT sécurisé. |
| **Sprint 2 (Moteur Commercial SaaS)**| Semaines 2 & 3 | Espace Super-Admin opérationnel, Virement BaridiMob géré, Chargily Pay branché. |
| **Sprint 3 (QA & Résilience)** | Semaine 4 | Mot de passe oublié, Tests frontend CI/CD, Bundles allégés. |
| **LANCEMENT COMMERCIAL (GO LIVE)** | **Fin de Semaine 4** | **Plateforme prête pour acquisition clients payants.** |

