from app.api.routes.auth import router as auth_router
from app.api.routes.eleves import router as eleves_router
from app.api.routes.enseignants import router as enseignants_router
from app.api.routes.groupes import router as groupes_router
from app.api.routes.paiements import router as paiements_router
from app.api.routes.presences import router as presences_router
from app.api.routes.emplois import router as emplois_router
from app.api.routes.dashboard import router as dashboard_router

__all__ = [
    "auth_router",
    "eleves_router",
    "enseignants_router",
    "groupes_router",
    "paiements_router",
    "presences_router",
    "emplois_router",
    "dashboard_router",
]
