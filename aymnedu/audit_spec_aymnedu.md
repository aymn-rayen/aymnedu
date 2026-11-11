# 🛡️ Rapport d'Expertise & Audit Spécification SaaS — AymnEDU

**Rôles d'expertise** : Architecte Logiciel Senior, Lead QA Engineer, Product Manager SaaS  
**Application cible** : AymnEDU (Gestion Multi-Tenant de Centres de Soutien Scolaire en Algérie)

---

## MODULE 1 : Inscription du Centre & Authentification Multi-tenant

### 1. Scénario d'utilisation & Flux de données
```
[Page /register] --(POST /api/v1/auth/register)--> [FastAPI auth.py]
  ├── 1. Validation Pydantic (nom_centre, email, password...)
  ├── 2. Vérification unicité email global dans la table 'utilisateurs'
  ├── 3. Transaction SQL Atomique :
  │     ├── INSERT INTO centres (nom, wilaya, telephone, subscription_plan='starter')
  │     └── INSERT INTO utilisateurs (centre_id, email, hashed_password, role='directeur')
  └── 4. Retourne TokenResponse (JWT Access Token + Refresh Token)

[Frontend Axios] --> Stocke Access Token (LocalStorage/Memory) --> Redirection /app/dashboard
[Toutes Requêtes HTTP] --> Header Authorization: Bearer <token>
  └── Middleware get_current_user() extrait payload -> {sub: user_id, centre_id: X}
```

### 2. Cas Limites & Pièges (Edge Cases)
* ⚠️ **E-mail partagé entre centres** : Si un secrétaire ou un professeur travaille dans deux centres de soutien scolaire différents, la contrainte `email UNIQUE` globale dans `utilisateurs` l'empêche de créer son compte dans le 2ème centre.
* ⚠️ **Fuite Multi-tenant par ID Guessing (IDOR)** : Si un utilisateur modifie l'ID dans les paramètres URL (`/api/v1/eleves/105`), l'API doit impérativement joindre la clause `WHERE centre_id = user.centre_id`. Si une seule route oublie `filter(centre_id == user.centre_id)`, les données d'un centre concurrent fuitent.
* ⚠️ **Absence de revalidation du rôle ou statut `is_active`** : Si le directeur désactive un compte secrétaire (`is_active = False`), le JWT existant reste valide jusqu'à son expiration (30 min).
* ⚠️ **Sécurité JWT en LocalStorage** : Le stockage des tokens JWT dans `localStorage` expose l'application aux attaques XSS.

### 3. Verdict & Corrections / Améliorations
* 🔴 **Critique (BDD/API)** : Basculer les Refresh Tokens vers des cookies HTTP-Only SameSite=Strict pour bloquer les failles XSS.
* 🟡 **Amélioration BDD** : Remplacer l'unicité de l'email par la clé composée `(email, centre_id)` pour permettre à un enseignant/intervenant de figurer dans plusieurs établissements.
* 🟢 **Amélioration UX** : Ajouter un sélecteur de Wilaya d'Algérie (58 Wilayas) avec masque de saisie téléphonique (+213 / 05/06/07).

---

## MODULE 2 : Dashboard & KPIs (`/app/dashboard`)

### 1. Scénario d'utilisation & Flux de données
```
[Page /app/dashboard] --(GET /api/v1/dashboard/stats)--> [FastAPI resources.py]
  ├── Query 1: COUNT(eleves) WHERE centre_id = X AND statut = 'actif'
  ├── Query 2: COUNT(groupes) WHERE centre_id = X
  ├── Query 3: SUM(montant) FROM paiements WHERE centre_id = X AND statut = 'paye' AND mois = 'YYYY-MM'
  ├── Query 4: COUNT(paiements) WHERE centre_id = X AND statut = 'impaye' AND mois = 'YYYY-MM'
  └── Returns JSON: {total_eleves, eleves_actifs, montant_encaisse, impayes_total, ...}

[Frontend Recharts] --> Rendu des KPI Cards + Courbe de revenus mensuels + Pie Chart par Niveau
```

### 2. Cas Limites & Pièges (Edge Cases)
* ⚠️ **Performance SQL sur gros volumes** : L'exécution de 5 à 6 requêtes `COUNT()` et `SUM()` synchrones sans indexation sur `(centre_id, mois, statut)` provoquera un ralentissement sensible (SQL latency > 800ms) dès que la table atteint 50 000 enregistrements.
* ⚠️ **Valeur Nulle sur SUM()** : Si aucun paiement `payé` n'existe pour le mois, `SUM()` renvoie `NULL` au lieu de `0.0`, provoquant un crash JS `TypeError: Cannot read properties of null (reading 'toFixed')`.
* ⚠️ **Calcul du Taux de Présence Hebdomadaire fictif** : Actuellement, le taux de présence dans `dashboard_stats` renvoie une valeur codée en dur (`"taux_presence_hebdo": 85`).

### 3. Verdict & Corrections / Améliorations
* 🔴 **Correction API (BDD)** : Remplacer la valeur en dur de présence par une vraie aggrégation SQL :
  `SELECT (COUNT(CASE WHEN statut='present' THEN 1 END) * 100.0 / COUNT(*)) FROM presences WHERE ...`
* 🟡 **Optimisation BDD** : Ajouter des index composites PostgreSQL :
  `CREATE INDEX idx_paiements_stats ON paiements (centre_id, mois, statut);`
* 🟢 **UX/UI Product** : Formater tous les montants en Dinars Algériens (`15 000 DA` ou `15.000,00 DZD`) avec un filtre de période configurable (Mois en cours, Mois dernier, Année).

---

## MODULE 3 : Gestion des Élèves & Inscriptions Multiples

### 1. Scénario d'utilisation & Flux de données
```
1. Saisie Élève : [Modal Création Élève] --(POST /api/v1/eleves)--> INSERT INTO eleves
2. Inscription Groupe : [Modal Inscription] --(POST /api/v1/eleves/{id}/inscrire)-->
   ├── Vérifier si groupe.centre_id == user.centre_id
   ├── Vérifier la capacité max du groupe : COUNT(inscriptions) < capacite_max
   └── INSERT INTO inscriptions_groupes (eleve_id, groupe_id, date_debut)
```

### 2. Cas Limites & Pièges (Edge Cases)
* ⚠️ **Double Inscription (Race Condition)** : Si deux secrétaires inscrivent simultanément le dernier élève d'un groupe de capacité 20, le groupe se retrouve à 21 élèves sans contrainte SQL d'unicité et de verrou.
* ⚠️ **Incohérence de Niveau** : Possibilité technique d'inscrire un élève de niveau `5AP` (Primaire) dans un groupe `3AS` (Terminale BAC).
* ⚠️ **Suppression d'un Élève inscrit** : Si un élève est supprimé (`DELETE FROM eleves`), la suppression en cascade (`CASCADE`) détruit son historique de paiements et reçus légaux.

### 3. Verdict & Corrections / Améliorations
* 🔴 **Sécurité BDD** : Remplacer la suppression physique `DELETE` des élèves par un **Soft Delete** (`is_deleted = True` ou `statut = 'inactif'`) pour préserver l'historique comptable et la conformité fiscale.
* 🔴 **Contrainte BDD** : Ajouter une contrainte d'unicité SQL sur la table de liaison :
  `UNIQUE(eleve_id, groupe_id)` pour bloquer les doublons d'inscription.
* 🟡 **Logique Métier** : Avertir l'utilisateur (Warning UI) lors de l'inscription si le niveau de l'élève diffère du niveau du groupe.

---

## MODULE 4 : Anti-collision des Salles, Groupes & Planning

### 1. Scénario d'utilisation & Flux de données
```
[Création Séance] --(POST /api/v1/emplois-du-temps)--> [Validation Anti-Collision]
  ├── 1. Vérifier si SALLE réservée au même créneau :
  │     SELECT 1 FROM seances WHERE salle = X AND jour = J AND (heure_debut < H_fin AND heure_fin > H_debut)
  ├── 2. Vérifier si ENSEIGNANT occupé au même créneau :
  │     SELECT 1 FROM seances WHERE enseignant_id = Y AND jour = J AND (heure_debut < H_fin AND heure_fin > H_debut)
  └── 3. Si aucun conflit -> INSERT INTO seances
```

### 2. Cas Limites & Pièges (Edge Cases)
* ⚠️ **Chevauchement d'horaires (Overlapping Intervals)** : Un simple test `heure_debut == H_debut` ne détecte pas le chevauchement si un cours A est de 14h-16h et qu'on essaie de créer un cours B de 15h-17h.
* ⚠️ **Créneaux hors limites** : Horaires invalides (`heure_debut >= heure_fin` ex: 16h00 -> 15h00).
* ⚠️ **Gestion des Salles non spécifiées** : Si deux séances ont `salle = NULL`, l'algorithme ne doit pas déclarer un conflit de salle.

### 3. Verdict & Corrections / Améliorations
* 🔴 **Algorithme API (Incontournable)** : Implémenter l'équation stricte d'intersection d'intervalles dans l'API avant tout INSERT :
  ```python
  conflit_salle = db.query(Seance).filter(
      Seance.centre_id == user.centre_id,
      Seance.salle == body.salle,
      Seance.jour_semaine == body.jour_semaine,
      Seance.heure_debut < body.heure_fin,
      Seance.heure_fin > body.heure_debut
  ).first()
  if conflit_salle:
      raise HTTPException(400, "La salle est déjà occupée sur ce créneau !")
  ```
* 🟡 **UX / Planning** : Implémenter un filtre par Salle et par Professeur sur l'agenda FullCalendar.

---

## MODULE 5 : Gestion Financière & Paiements

### 1. Scénario d'utilisation & Flux de données
```
1. Génération Échéances : Début de mois -> Génération automatique des paiements 'impayé' pour chaque élève inscrit dans un groupe.
2. Encaissement : [Page Paiements] -> Clic "Marquer Payé" / Saisie Montant
   ├── POST/PATCH /api/v1/paiements/{id}/payer
   ├── Calcul de l'état : Si montant < tarif_groupe -> statut = 'partiel', Sinon 'paye'
   ├── Génération du Reçu séquentiel par Centre : REC-{ANNÉE}-{ID_CENTRE}-{SÉQUENCE:05d}
   └── UPDATE paiements SET statut='paye', date_paiement=NOW(), recu_numero=...
```

### 2. Cas Limites & Pièges (Edge Cases)
* ⚠️ **Collision de Numéros de Reçus** : Si le numéro de reçu utilise `REC-{DATE}-{ID_PAIEMENT}`, la suppression ou la modification d'un paiement casse la séquence comptable.
* ⚠️ **Modification des Tarifs en cours d'année** : Si le tarif d'un groupe passe de 2500 DA à 3000 DA, les paiements passés ne doivent pas être recalculés rétroactivement.
* ⚠️ **Absence de Paiement Partiel** : Si un élève paye 1500 DA sur 2500 DA, le système actuel bascule le paiement directement à `paye` au lieu de gérer le solde restant (`partiel`).

### 3. Verdict & Corrections / Améliorations
* 🔴 **Correction Logique Financière (API & BDD)** :
  * Ajouter les colonnes `montant_recu` (Numeric) et `solde_restant` (Numeric) sur la table `paiements`.
  * Gérer les 3 statuts : `impaye` (0 DA), `partiel` (0 < montant < tarif), `paye` (montant >= tarif).
* 🔴 **Conformité Comptable** : Imprimer/Générer un reçu PDF téléchargeable au format A5 avec en-tête du centre, nom de l'élève, matière, mois et tampon/signature.

---

## MODULE 6 : Prise d'Appel & Gestion des Présences

### 1. Scénario d'utilisation & Flux de données
```
[Page /app/presences] 
  ├── 1. Sélection du Groupe et de la Date
  ├── 2. Chargement de la liste des élèves inscrits dans ce groupe
  ├── 3. Saisie par l'Enseignant/Secrétaire : [Présent / Absent / Retard (min)]
  └── 4. Envoi Batch : POST /api/v1/presences/batch
        └── UPSERT dans la table 'presences' (INSERT ou UPDATE si déjà saisi)
```

### 2. Cas Limites & Pièges (Edge Cases)
* ⚠️ **Élèves ajoutés après la date de séance** : Si un élève s'inscrit le 15 du mois, l'historique d'appel du 5 du mois ne doit pas le marquer comme "Absent non justifié".
* ⚠️ **Doublon d'appel sur la même séance** : Risque d'insérer 2 lignes pour la même séance si la contrainte d'unicité `(groupe_id, eleve_id, date_seance)` manque en base.

### 3. Verdict & Corrections / Améliorations
* 🔴 **Contrainte BDD** : Ajouter `UNIQUE(groupe_id, eleve_id, date_seance)` sur la table `presences`.
* 🟡 **Notification (Feature Produit)** : Déclencher un indicateur d'alerte dans le profil élève si un élève accumule 3 absences consécutives.

---

## MODULE 7 : Sécurité RBAC (Directeur vs Secrétaire vs Enseignant)

### 1. Scénario d'utilisation & Flux de données
```
[Client Web] --(API Request avec JWT)--> [FastAPI Middleware]
  ├── get_current_user() -> extrait le rôle (directeur, secretaire, enseignant)
  └── require_role("directeur", "secretaire") -> Vérifie les permissions de la route
        ├── Si OK -> Exécute la logique métier
        └── Si KO -> Renvoie HTTP 403 Forbidden ("Accès refusé")
```

### 2. Cas Limites & Pièges (Edge Cases)
* ⚠️ **Privilèges Enseignant trop larges** : Si l'enseignant peut accéder aux routes `/api/v1/paiements` ou `/api/v1/dashboard/stats`, il a accès à la chiffre d'affaires et aux données financières globales du centre.
* ⚠️ **Sécurité par le Front-end uniquement** : Cacher un bouton "Supprimer" dans React sans protéger la route DELETE dans FastAPI permet à n'importe quel utilisateur d'envoyer la requête via Postman/cURL.

### 3. Verdict & Corrections / Améliorations
* 🔴 **Sécurité API Stricte** : Décorer systématiquement chaque groupe de routes avec `Depends(require_role(...))` :
  * Routes Financières & Suppressions : `require_role("directeur")`
  * Routes Inscriptions & Présences : `require_role("directeur", "secretaire")`
  * Routes Consultations Cours & Présences Enseignant : `require_role("directeur", "secretaire", "enseignant")`

---

## 🏁 Synthèse Globale du Modèle de Maturité Produit

```
[Sécurité & Multi-tenant]   🟢 Excellent (Isolation centre_id validée)
[Logique Financière & DZD]  🟡 Bon (Nécessite gestion des solde partiels)
[Anti-collision Planning]   🟡 À renforcer (Requête d'intersection d'intervalles)
[Périmètre RBAC API]        🟢 Conforme (Décorateurs de rôles fonctionnels)
```
