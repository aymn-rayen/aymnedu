import os
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

# 1. Provide test environment variables before importing app
os.environ["SECRET_KEY"] = "test-secret-key-at-least-32-characters-long"
os.environ["CORS_ORIGINS"] = "http://localhost:5173"

from app.core.database import Base, get_db
from app.core.limiter import limiter
from app.core.security import hash_password, create_access_token
from app.models import Centre, Utilisateur, RoleEnum
from app.main import app

# Disable rate limiter for functional test runs
limiter.enabled = False

# SQLite in-memory test database with StaticPool
TEST_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(autouse=True)
def init_test_db():
    """Create fresh database tables for each test and drop them afterwards."""
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db_session():
    """Yields a database session connected to the test DB."""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db_session):
    """FastAPI TestClient with overridden get_db dependency."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def create_centre_and_user(db_session):
    """Factory fixture to create a test centre and director user with auth headers."""
    def _create(nom_centre: str, email: str, role: RoleEnum = RoleEnum.directeur):
        centre = Centre(nom=nom_centre, wilaya="16 - Alger", is_active=True)
        db_session.add(centre)
        db_session.flush()

        user = Utilisateur(
            centre_id=centre.id,
            email=email,
            full_name=f"User {email}",
            hashed_password=hash_password("password123"),
            role=role,
            is_active=True,
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        token = create_access_token({"sub": str(user.id), "centre_id": centre.id})
        headers = {"Authorization": f"Bearer {token}"}
        return centre, user, headers

    return _create
