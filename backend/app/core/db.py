"""
GreenFleet AI — SQLite persistence layer
=========================================
Lightweight SQLAlchemy setup backing the fleet vehicle registry and
per-vehicle driving-behavior telemetry log, so registrations and telemetry
samples survive a server restart (previously pure in-memory / client-only).
"""

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DB_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
    "greenfleet.db",
)

engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


def init_db() -> None:
    """Creates all ORM tables if they don't already exist. Safe to call repeatedly."""
    from backend.app.models import db_models  # noqa: F401 (registers tables on Base)
    Base.metadata.create_all(bind=engine)


def get_session():
    return SessionLocal()
