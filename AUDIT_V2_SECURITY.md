# AYMNEDU — RAPPORT DE SÉCURITÉ APPROFONDIE V2
## Analyse des Vulnérabilités, Menaces Cross-Tenant & Surface d'Attaque

**Date d'audit :** 17 Novembre 2026  
**Expertise :** Application Security & Penetration Testing  
**Périmètre :** Backend FastAPI, Frontend React, Schéma PostgreSQL, Flux d'authentification  

---

## 1. CARTOGRAPHIE DES RISQUES & CLASSIFICATION GLOBALE

| ID | Vulnérabilité / Problème de Sécurité | Emplacement (Fichier & Lignes) | Sévérité | Statut |
|:---|:---|:---|:---:|:---:|
| **SEC-01** | Injection Cross-Tenant de Présences (IDOR / Manque de validation parent) | `backend/app/services/presence_service.py:85-107` | **HIGH** | Confirmé |
| **SEC-02** | Persistance du stockage JWT en `localStorage` (Exposition XSS) | `frontend/src/hooks/useAuth.tsx:20-68` & `client.ts:18` | **HIGH** | Confirmé |
| **SEC-03** | Codes d'activation SaaS codés en dur & Bypass de licence | `backend/app/services/subscription_service.py:158-173` | **HIGH** | Confirmé |
| **SEC-04** | Déconnexion/Désactivation d'utilisateur sans révocation de session | `backend/app/api/routes/utilisateurs.py:122-135` | **MEDIUM** | Confirmé |
| **SEC-05** | Divulgation publique de l'annuaire des centres (`/centres/search`) | `backend/app/api/routes/auth.py:224-235` | **MEDIUM** | Confirmé |
| **SEC-06** | Absence totale de réinitialisation de mot de passe & vérification d'email | `backend/app/api/routes/auth.py` | **MEDIUM** | Confirmé |
| **SEC-07** | Absence de Row-Level Security (RLS) au niveau de PostgreSQL | Base de données PostgreSQL | **LOW** | Architectural |

---

## 2. VULNÉRABILITÉS DÉTAILLÉES & SCÉNARIOS D'ATTAQUE

### SEC-01 : Injection Cross-Tenant de Présences (IDOR)
- **Fichier :** `backend/app/services/presence_service.py`
- **Fonction :** `save_presences_batch(db: Session, centre_id: int, items: list[PresenceIn])`
- **Code incriminé :**
```python
    eleve_ids = list({item.eleve_id for item in items})
    valid_eleve_rows = db.query(Eleve.id).filter(
        Eleve.id.in_(eleve_ids),
        Eleve.centre_id == centre_id,
    ).all()
    valid_eleves = {row[0] for row in valid_eleve_rows}

    groupe_ids = list({item.groupe_id for item in items})
    dates = list({item.date_seance for item in items})
...
    for item in items:
        if item.eleve_id not in valid_eleves:
            continue
        # AUCUNE VÉRIFICATION QUE item.groupe_id APPARTIENT AU centre_id !
        db.add(Presence(**item.model_dump()))
```
- **Scénario d'attaque :**
  1. L'attaquant est un directeur ou une secrétaire authentifiée dans le Centre A.
  2. L'attaquant intercepte ou génère une requête `POST /api/v1/presences` contenant un élève de son propre établissement (`centre_id = A`), mais spécifiant un `groupe_id = 999` appartenant au Centre B.
  3. Le contrôle `item.eleve_id in valid_eleves` réussit car l'élève appartient bien au Centre A.
  4. Le service ne vérifie **jamais** si le groupe appartient au Centre A.
  5. Une ligne est insérée dans la table `presences` liant l'élève du Centre A au groupe du Centre B, polluant le registre d'appel et les rapports d'assiduité du concurrent.
- **Impact :** Altération de l'intégrité des données d'un tiers, corruption des statistiques de présence.
- **Remédiation impérative :**
```python
    valid_groupe_rows = db.query(Groupe.id).filter(
        Groupe.id.in_(groupe_ids),
        Groupe.centre_id == centre_id,
        Groupe.deleted_at == None,
    ).all()
    valid_groupes = {row[0] for row in valid_groupe_rows}
    
    # Dans la boucle :
    if item.eleve_id not in valid_eleves or item.groupe_id not in valid_groupes:
        continue
```

---

### SEC-02 : Stockage persistant des JWT en `localStorage` (XSS Exposure)
- **Fichiers :** `frontend/src/hooks/useAuth.tsx` & `frontend/src/api/client.ts`
- **Analyse technique :**
  Bien que le backend dépose un cookie HttpOnly `refresh_token` lors du login, le frontend intercepte la réponse JSON et persiste à la fois `access_token` et `refresh_token` dans le `window.localStorage` :
  ```typescript
  // frontend/src/hooks/useAuth.tsx:39-40
  localStorage.setItem('access_token', tokens.access_token)
  localStorage.setItem('refresh_token', tokens.refresh_token)
  ```
- **Scénario d'attaque :**
  En cas d'injection XSS (via un nom d'élève non nettoyé dans une modal ou un composant FullCalendar), un script malveillant exécuté dans le contexte du navigateur extrait les jetons via `localStorage.getItem('refresh_token')` et les exfiltre vers un serveur distant, accordant à l'attaquant une session permanente (RTR comprise).
- **Remédiation recommandée :**
  1. Conserver l'access token **uniquement en mémoire volatile (state React / closure)**.
  2. Utiliser le cookie `HttpOnly`, `SameSite=Lax`, `Secure` pour le refresh token (qui est déjà configuré par le backend).
  3. Supprimer tout appel à `localStorage` pour les tokens d'authentification.

---

### SEC-03 : Bypass de Licence SaaS par Codes Hardcodés
- **Fichier :** `backend/app/services/subscription_service.py:158-173`
- **Code incriminé :**
```python
    if clean_code in ("AYMN-PRO-1MOIS", "PRO30", "AYMNEDU30"):
        centre.subscription_plan = "pro"
        centre.subscription_status = "active"
        centre.subscription_expires_at = now + timedelta(days=30)
    elif clean_code in ("AYMN-PRO-1AN", "PRO365", "AYMNEDU365"):
        centre.subscription_plan = "pro"
        centre.subscription_expires_at = now + timedelta(days=365)
```
- **Scénario d'attaque :**
  N'importe quel client ayant vent de l'un de ces mots-clés (ou ayant inspecté une fuite de code / dev) peut saisir `PRO365` dans la boîte de dialogue d'abonnement et activer gratuitement un an d'utilisation Soutien Pro (2000 élèves). L'opération peut être répétée indéfiniment à expiration.
- **Impact commercial :** Perte totale de contrôle sur la monétisation et la facturation du service.
- **Remédiation :**
  Créer une table `license_keys` avec des jetons aléatoires à usage unique (UUIDv4 chiffrés), associés à un centre ou révocables après première utilisation.

---

### SEC-04 : Désactivation d'utilisateur sans révocation de session active
- **Fichier :** `backend/app/api/routes/utilisateurs.py:116-135`
- **Code incriminé :**
```python
@router.delete("/{user_id}", status_code=204)
def delete_utilisateur(...):
    ...
    user.is_active = False
    db.commit()
```
- **Faiblesse :**
  Lorsqu'un directeur révoque les accès d'une secrétaire ou d'un enseignant parti de l'établissement, le compte passe à `is_active = False`. Cependant, les refresh tokens actifs associés à cet utilisateur dans la table `refresh_tokens` ne sont pas révoqués (`revoked_at` reste `NULL`).
  Bien que `get_current_user` vérifie `user.is_active`, si une vérification de token sans requête DB est un jour optimisée ou mise en cache, l'accès persiste. De surcroît, les sessions orphelines polluent la table.
- **Remédiation :**
  Appeler explicitement `session_service.revoke_all_sessions(db, user.id)` dans `delete_utilisateur`.

---

### SEC-05 : Divulgation publique de l'annuaire des écoles (`/centres/search`)
- **Fichier :** `backend/app/api/routes/auth.py:224-235`
- **Constat :**
  L'endpoint `GET /api/v1/auth/centres/search?q=` ne requiert aucune authentification et renvoie le nom, la wilaya et le numéro de téléphone de tous les centres enregistrés.
- **Risque :**
  Scraping facile de la liste complète des clients d'AymnEDU par des concurrents ou des démarcheurs téléphoniques.
- **Remédiation :**
  Limiter le retour aux centres dont l'inscription est publique, ou soumettre cette recherche à un rate-limit drastique (ex: 10 requêtes / heure / IP) et à une authentification préalable.

---

## 3. ÉVALUATION DE L'ISOLATION MULTI-TENANT & ANALYSE RLS (ROW-LEVEL SECURITY)

### Architecture Actuelle : Isolation Applicative
AymnEDU utilise un modèle de **base de données partagée avec schéma partagé (Shared Database, Shared Schema)**. La séparation repose sur :
1. L'injection du `centre_id` extrait du JWT dans chaque fonction de service.
2. Des clauses `.filter(Model.centre_id == centre_id)`.

#### Points forts :
- Simple à déployer et à maintenir.
- Pas de surcharge liée à la gestion de centaines de schémas PostgreSQL distincts.
- L'immense majorité des contrôleurs (`eleves`, `groupes`, `paiements`, `seances`) applique correctement ce filtre.

#### Faiblesses identifiées :
- Les tables `presences` et `inscriptions_groupes` sont des tables de second niveau dépourvues de `centre_id`. Si une jointure est omise dans une future requête analytique ou un export, il y a risque immédiat de fuite inter-centres.
- L'erreur humaine (oubli d'une clause `.filter(centre_id == ...)` lors d'un développement futur) n'est pas bloquée par le moteur de base de données.

### Faut-il activer PostgreSQL Row-Level Security (RLS) ?
**Avis d'expert : NON dans l'immédiat, OUI à moyen terme.**

| Critère | RLS PostgreSQL | Isolation Applicative (Actuelle) |
|---|---|---|
| **Garantie de non-fuite** | Maximale (bloqué au niveau du kernel DB) | Moyenne (dépend de la rigueur du code Python) |
| **Complexité opérationnelle** | Élevée (nécessite `SET LOCAL app.current_tenant_id` sur chaque transaction SQLAlchemy) | Faible (standard Python / ORM) |
| **Impact sur le Connection Pooling** | Délicat avec PgBouncer ou StaticPool si mal réinitialisé | Aucun |
| **Recommandation AymnEDU** | Phase 2 (après 50 clients payants) | **Suffisante pour la Phase MVP**, sous réserve de corriger `save_presences_batch` et d'ajouter des tests d'intégration stricts. |

---

## 4. TESTS DE NON-RÉGRESSION SÉCURITÉ CONDUITS LORS DE L'AUDIT

La suite de tests dédiée à l'isolation et aux sessions a été exécutée :
- `test_tenant_isolation_eleves` : **PASSÉ** (le centre A ne peut lire les élèves du centre B).
- `test_tenant_isolation_groupes` : **PASSÉ** (le centre A ne peut lire les groupes du centre B).
- `test_tenant_isolation_paiements` : **PASSÉ** (le centre A ne peut lire les paiements du centre B).
- `test_refresh_token_rotation_success` : **PASSÉ** (l'ancien token est révoqué lors de l'échange).
- `test_refresh_token_reuse_detection_revokes_family` : **PASSÉ** (la réutilisation d'un token volé révoque toute la famille de sessions).
- `test_logout_revokes_session` : **PASSÉ**.
- `test_revoke_all_sessions` : **PASSÉ**.

