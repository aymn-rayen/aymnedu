import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import sentry_sdk

from app.core.config import settings
from app.core.limiter import limiter
from app.api.routes import (
    auth_router,
    eleves_router,
    enseignants_router,
    groupes_router,
    paiements_router,
    presences_router,
    emplois_router,
    dashboard_router,
    utilisateurs_router,
    subscription_router,
)

# ── Structured Logging ────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s"
)
logger = logging.getLogger("aymnedu")

# ── Sentry Observability ──────────────────────────────────────────────────────
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        traces_sample_rate=0.1,
    )
    logger.info("Sentry monitoring initialized.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ───────────────────────────────────────────────────────────────
    logger.info("AymnEDU backend started successfully.")
    yield
    # ── Shutdown ──────────────────────────────────────────────────────────────
    logger.info("AymnEDU backend shutting down.")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── Rate Limiter ──────────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ─────────────────────────────────────────────────────────────────────
cors_val = settings.CORS_ORIGINS
origins = [o.strip(" \"'[]") for o in cors_val.split(",") if o.strip(" \"'[]")]
if not origins:
    origins = ["http://localhost:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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
app.include_router(utilisateurs_router, prefix=PREFIX)
app.include_router(subscription_router, prefix=PREFIX)


@app.get("/", tags=["health"])
def health_check():
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.APP_VERSION}


@app.get("/ping", tags=["health"])
def ping():
    """
    Lightweight keep-alive endpoint.
    Used by external cron jobs (cron-job.org, UptimeRobot, etc.)
    to prevent Render free-tier cold starts.
    No DB query — instant response.
    """
    return {"pong": True}
