"""
Module découpé dans le cadre de la Phase 2 (Architecture 3-Tiers) :
- Schémas Pydantic : app.schemas.*
- Logique Métier & Données : app.services.*
- Contrôleurs API : app.api.routes.*

Ce module est conservé pour assurer la rétrocompatibilité des imports.
"""
from app.api.routes import (
    eleves_router,
    enseignants_router,
    groupes_router,
    paiements_router,
    presences_router,
    emplois_router,
    dashboard_router,
)

__all__ = [
    "eleves_router",
    "enseignants_router",
    "groupes_router",
    "paiements_router",
    "presences_router",
    "emplois_router",
    "dashboard_router",
]



