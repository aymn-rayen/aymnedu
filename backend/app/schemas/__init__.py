from app.schemas.eleve import EleveCreate, EleveUpdate, EleveOut
from app.schemas.enseignant import EnseignantCreate, EnseignantOut
from app.schemas.groupe import GroupeCreate, GroupeUpdate, GroupeOut
from app.schemas.paiement import PaiementCreate, PaiementOut
from app.schemas.presence import PresenceIn, PresenceOut
from app.schemas.seance import SeanceCreate, SeanceUpdate, SeanceOut
from app.schemas.dashboard import DashboardStatsOut

__all__ = [
    "EleveCreate", "EleveUpdate", "EleveOut",
    "EnseignantCreate", "EnseignantOut",
    "GroupeCreate", "GroupeUpdate", "GroupeOut",
    "PaiementCreate", "PaiementOut",
    "PresenceIn", "PresenceOut",
    "SeanceCreate", "SeanceUpdate", "SeanceOut",
    "DashboardStatsOut",
]
