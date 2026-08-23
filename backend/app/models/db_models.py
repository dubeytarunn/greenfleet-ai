"""SQLAlchemy ORM table definitions backing the SQLite persistence layer."""

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String
from sqlalchemy.sql import func

from backend.app.core.db import Base


class VehicleORM(Base):
    __tablename__ = "vehicles"

    vehicle_id = Column(String, primary_key=True)
    vehicle_type = Column(String, nullable=False)
    fuel_type = Column(String, nullable=False)
    vehicle_age = Column(Integer, nullable=False)
    fuel_capacity_l = Column(Float, nullable=False)
    max_payload_kg = Column(Float, nullable=False)
    available = Column(Boolean, nullable=False, default=True)
    current_location = Column(String, nullable=True)
    operating_cost_per_km = Column(Float, nullable=True)
    fuel_efficiency_kmpl = Column(Float, nullable=True)


class BehaviorLogORM(Base):
    __tablename__ = "behavior_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    vehicle_id = Column(String, nullable=False, index=True)
    ts = Column(DateTime(timezone=True), server_default=func.now())
    brake_freq = Column(Float, nullable=False)
    gear_irregularity = Column(Float, nullable=False)
    harsh_accel = Column(Float, nullable=False)
    score = Column(Float, nullable=False)
