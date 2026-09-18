# AymnEDU — Logiciel de gestion pour centres de soutien scolaire en Algérie

## Stack Technique

| Couche | Technologie |
| :--- | :--- |
| **Frontend** | React + TypeScript + Vite + Tailwind CSS |
| **Backend** | FastAPI (Python 3.12) |
| **Base de données** | PostgreSQL 16 |
| **Cache & Files** | Redis 7 |
| **ORM** | SQLAlchemy 2 + Alembic |
| **Auth** | JWT (Access + Refresh Token) + BCrypt |
| **Conteneurs** | Docker + Docker Compose |

---

## Structure du projet

```
aymnedu/
├── frontend/          # React + TypeScript + Vite + Tailwind
│   ├── src/
│   │   ├── api/       # Axios client + services API typés
│   │   ├── components/# Layout sidebar, composants réutilisables
│   │   ├── hooks/     # useAuth (JWT Context)
│   │   ├── pages/     # Dashboard, Élèves, Groupes, Paiements, Présences, Planning
│   │   └── types/     # Interfaces TypeScript
│   └── Dockerfile
├── backend/           # FastAPI + SQLAlchemy
│   ├── app/
│   │   ├── api/routes/ # auth.py, resources.py
│   │   ├── core/       # config.py, database.py, security.py
│   │   ├── models/     # SQLAlchemy ORM (Centre, Élève, Groupe, Paiement, Présence, Seance)
│   │   └── main.py     # Entrée FastAPI + CORS + routers
│   ├── requirements.txt
│   └── Dockerfile
└── docker-compose.yml
```

---

## Démarrage rapide (Développement)

### 1. Backend (FastAPI)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Linux/Mac
pip install -r requirements.txt
cp .env.example .env          # Puis modifiez .env
uvicorn app.main:app --reload --port 8080
```
> API Docs disponibles sur : http://localhost:8080/docs

### 2. Frontend (React)

```bash
cd frontend
npm install
npm run dev
```
> Application disponible sur : http://localhost:5173

### 3. Docker Compose (Tout en même temps)

```bash
# Depuis la racine aymnedu/
docker compose up --build
```

---

## Rôles Utilisateurs

| Rôle | Accès |
| :--- | :--- |
| `directeur` | Tous les modules + statistiques globales |
| `secretaire` | Inscriptions élèves + encaissements |
| `enseignant` | Présences + consultation planning |

---

## Modules MVP

1. **Gestion des Élèves** — Inscription, fiche, recherche
2. **Gestion des Groupes** — Création, niveaux, taux de remplissage
3. **Gestion des Paiements** — Mensualités, reçus, impayés
4. **Gestion des Emplois du Temps** — Planning hebdomadaire anti-conflits
5. **Gestion des Présences** — Appel numérique par groupe

---

## Variables d'environnement

Voir [`backend/.env.example`](./backend/.env.example)
