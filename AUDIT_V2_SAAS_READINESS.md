# AYMNEDU — MATURITÉ SAAS & PRÉPARATION COMMERCIALE V2
## Analyse de la Viabilité Commerciale, Architecture d'Abonnement & Réalité du Marché Algérien

**Date d'audit :** 17 Novembre 2026  
**Expertise :** SaaS Technical Lead & SaaS Product Architect  
**Périmètre :** Modèle économique B2B, Gestion des licences, Encaissements, Portails d'administration  

---

## 1. DISTINCTION FONDAMENTALE : APPLICATION MULTI-TENANT vs VRAI SAAS

Un piège classique des projets logiciels est de confondre une **application multi-tenant fonctionnelle** avec une **véritable plateforme SaaS commerciale**.

```
+---------------------------------------------------------------------------------------------------+
| 1. SITE WEB                  : Vitrine promotionnelle statique ou semi-dynamique.                 |
| 2. APPLICATION WEB CRUD      : Gestion de données opérationnelles persistantes.                   |
| 3. APPLICATION MULTI-TENANT  : Données de plusieurs clients isolées dans une même base.          |
|    >>> AYMNEDU SE SITUE ICI ACTUELLEMENT <<<                                                      |
| 4. VÉRITABLE SAAS COMMERCIAL : Multi-tenant + Monétisation automatisée + Gestion du cycle de vie |
|    (Self-onboarding, Essais bornés, Paywall, Facturation, Entitlements, Super-Admin, Métrologie) |
+---------------------------------------------------------------------------------------------------+
```

### Où en est AymnEDU ?
AymnEDU dispose d'un socle applicatif multi-tenant robuste pour la gestion quotidienne d'un centre (élèves, plannings, présences, frais de scolarité). Cependant, **le moteur de monétisation SaaS reste au stade embryonnaire**.

---

## 2. INVENTAIRE DES COMPOSANTS SAAS EXISTANTS vs MANQUANTS

| Composant SaaS Vital | Statut AymnEDU | Preuve dans le Code & Limites Réelles |
|---|:---:|---|
| **Auto-enregistrement (Self-Serve Onboarding)** | **PARTIEL** | `POST /auth/register` crée simultanément le `Centre` et le compte `directeur`. Mais aucune vérification d'email n'est faite. |
| **Période d'essai bornée (Free Trial)** | **IMPLÉMENTÉ** | La période d'essai est fixée à 14 jours (`trial_ends_at = now + 14d`). Passé ce délai, `subscription_status` bascule à `expired`. |
| **Verrouillage à expiration (Paywall)** | **PARTIEL** | La fonction `assert_subscription_active()` renvoie un code `HTTP 402 Payment Required` lors de la création d'élèves, groupes, séances et paiements. Mais la mise à jour de données existantes et la gestion des enseignants restent accessibles ! |
| **Limitation des quotas par forfait** | **IMPLÉMENTÉ** | Le quota d'élèves (`max_eleves`) est vérifié à chaque ajout d'élève (`assert_subscription_allows_write`). |
| **Passerelle de paiement en ligne** | **ABSENT** | Aucune API de paiement connectée (Chargily, SATIM). |
| **Gestion des codes d'activation / Licences** | **VULNÉRABLE** | Codes statiques en clair dans le code (`PRO30`, `PRO365`), contournables à volonté. |
| **Historique de facturation SaaS & Reçus éditeur** | **ABSENT** | Aucune table ne consigne les abonnements souscrits par les centres ni les montants perçus par AymnEDU. |
| **Tableau de bord Super-Admin (Plateforme)** | **ABSENT** | L'éditeur ne dispose d'aucune interface pour voir la liste des centres inscrits, leur statut, leur consommation ou prolonger manuellement un compte. |
| **Gestion des relances & Notifications d'expiration** | **ABSENT** | Aucun e-mail ou SMS n'avertit le directeur à J-3 ou à J-0 de la fin de sa période d'essai. |

---

## 3. ARCHITECTURE DE FACTURATION SAAS ADAPTÉE AU MARCHÉ ALGÉRIEN

En Algérie, le paiement des abonnements B2B ne peut pas reposer uniquement sur une carte bancaire internationale (Stripe) ni même exclusivement sur le e-paiement instantané (les directeurs d'écoles privées règlent fréquemment par virement CCP, BaridiMob ou chèque/espèces).

L'architecture SaaS d'AymnEDU doit donc supporter un **modèle hybride (Dual-Track)** :

```
                                  +---------------------------+
                                  | Nouveau Centre / Directeur |
                                  +---------------------------+
                                                |
                                     (14 Jours Essai Gratuit)
                                                |
                                    +-----------------------+
                                    | Expiration de l'Essai |
                                    +-----------------------+
                                                |
                      +-------------------------+-------------------------+
                      |                                                   |
           [ PISTE 1 : AUTOMATIQUE ]                              [ PISTE 2 : MANUELLE ]
        Passerelle E-Paiement Algérie                           Virement BaridiMob / CCP / Chèque
            (Chargily Pay API v2)                                         |
                      |                                        1. Envoi du reçu via formulaire
        - Carte EDAHABIA / CIB                                 2. Vérification par le Super-Admin
        - Webhook sécurisé instantané                          3. Validation et activation en 1 clic
                      |                                                   |
                      +-------------------------+-------------------------+
                                                |
                                    +-----------------------+
                                    | Activation Automatique|
                                    |   Table: subscriptions |
                                    |  + Facture PDF AymnEDU|
                                    +-----------------------+
```

### A. Intégration Recommandée de Chargily Pay (Piste Automatique)
Chargily Pay est la passerelle de paiement leader en Algérie pour les SaaS, agréée par le GIE Monétique :
- **Intégration :** API REST V2 avec redirection vers page de paiement sécurisée.
- **Cartes supportées :** Carte EDAHABIA (Algérie Poste) et Carte CIB (Banques algériennes).
- **Implémentation Backend nécessaire :**
  1. `POST /api/v1/subscription/checkout` : génère un lien de paiement Chargily avec métadonnées (`centre_id`, `plan`, `duree`).
  2. `POST /api/v1/webhooks/chargily` : endpoint sécurisé par signature HMAC-SHA256 validant le paiement et prolongeant `subscription_expires_at` sans intervention humaine.

### B. Gestion des Paiements Hors-Ligne (Piste BaridiMob & CCP)
Pour les directeurs effectuant un virement BaridiMob ou mandat postal :
1. **Frontend :** Écran de versement avec upload de la capture d'écran du reçu postal / virement BaridiMob.
2. **Backend :** Table `payment_proofs` (id, centre_id, montant, date, image_url, statut: en_attente / validé / rejeté).
3. **Super-Admin :** Interface permettant à l'équipe AymnEDU de valider la preuve en 1 clic, ce qui active automatiquement le compte pour 30 jours ou 365 jours.

---

## 4. SCHÉMA DE DONNÉES SAAS REQUIS (MODÈLES MANQUANTS)

Pour transformer AymnEDU en véritable SaaS commercial, les 3 tables suivantes doivent être créées :

### 1. Table `subscriptions` (Historique des abonnements du centre)
```sql
CREATE TABLE subscriptions (
    id SERIAL PRIMARY KEY,
    centre_id INTEGER NOT NULL REFERENCES centres(id) ON DELETE CASCADE,
    plan VARCHAR(50) NOT NULL,              -- "starter", "pro"
    duree_mois INTEGER NOT NULL,            -- 1, 3, 12
    montant_dzd NUMERIC(10, 2) NOT NULL,    -- 4500, 45000
    moyen_paiement VARCHAR(50) NOT NULL,    -- "chargily", "baridimob", "ccp", "especes"
    reference_transaction VARCHAR(100),
    starts_at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);
```

### 2. Table `license_vouchers` (Codes prépayés à usage unique)
Remplace définitivement les codes statiques codés en dur :
```sql
CREATE TABLE license_vouchers (
    id SERIAL PRIMARY KEY,
    code_hash VARCHAR(64) UNIQUE NOT NULL,  -- SHA-256 du code fourni au client
    plan VARCHAR(50) NOT NULL,              -- "pro"
    duree_jours INTEGER NOT NULL,           -- 30, 365
    max_eleves INTEGER DEFAULT 500,
    is_redeemed BOOLEAN DEFAULT FALSE,
    redeemed_by_centre_id INTEGER REFERENCES centres(id),
    redeemed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT now()
);
```

### 3. Rôle et Table `platform_admins` (Super Admin AymnEDU)
```sql
CREATE TABLE platform_admins (
    id SERIAL PRIMARY KEY,
    email VARCHAR(200) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT now()
);
```

---

## 5. CONCLUSION SUR LA PRÉPARATION COMMERCIALE

AymnEDU possède les fonctionnalités métiers d'un produit attrayant pour les centres de soutien scolaire. Néanmoins, **son modèle commercial ne peut pas être exploité en l'état sans causer des pertes financières et des failles d'intégrité**.

Le passage à l'exploitation commerciale requiert impérativement :
1. La suppression des codes d'activation hardcodés.
2. Le portail d'administration pour l'éditeur.
3. Le module de vérification des virements BaridiMob / CCP ou l'intégration Chargily Pay.

