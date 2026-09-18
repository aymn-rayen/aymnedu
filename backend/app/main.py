from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine
from app.api.routes import (
    auth_router,
    eleves_router,
    enseignants_router,
    groupes_router,
    paiements_router,
    presences_router,
    emplois_router,
    dashboard_router,
)

# Create tables on startup (use Alembic in production)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
PREFIX = "/api/v1"
app.include_router(auth_router,        prefix=PREFIX)
app.include_router(eleves_router,      prefix=PREFIX)
app.include_router(enseignants_router, prefix=PREFIX)
app.include_router(groupes_router,     prefix=PREFIX)
app.include_router(paiements_router,   prefix=PREFIX)
app.include_router(presences_router,   prefix=PREFIX)
app.include_router(emplois_router,     prefix=PREFIX)
app.include_router(dashboard_router,   prefix=PREFIX)


@app.get("/", tags=["health"])
def health_check():
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.APP_VERSION}
