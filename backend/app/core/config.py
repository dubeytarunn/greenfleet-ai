"""
GreenFlow AI - Core Configuration & Environmental Parameters
"""

from typing import Dict
try:
    from pydantic_settings import BaseSettings
except ImportError:
    from pydantic import BaseModel as BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "GreenFlow AI"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    
    # Deterministic simulation seed
    RANDOM_SEED: int = 42
    
    # DEFRA / UK Gov GHG Standard Conversion Factors (kg CO2 per litre / unit of fuel)
    EMISSION_FACTORS_KG_CO2_PER_LITRE: Dict[str, float] = {
        "Diesel": 2.68,
        "Petrol": 2.31,
        "Hybrid": 1.85,
        "CNG": 1.95,
        "Electric": 0.45,
        "Default": 2.65,
    }
    
    # Regional Fleet Fuel Pricing (INR ₹ per unit: L, kg, kWh)
    FUEL_PRICES_PER_LITRE: Dict[str, float] = {
        "Diesel": 95.0,
        "Petrol": 102.0,
        "Hybrid": 102.0,
        "CNG": 85.0,
        "Electric": 9.0,
        "Default": 95.0,
    }

    # Internal Carbon Shadow Pricing & Governance Constants
    CARBON_SHADOW_PRICE_INR_PER_TONNE: float = 2500.0   # ₹2.50 / kg CO2
    DEFAULT_SHIFT_CARBON_BUDGET_KG: float = 1500.0      # 1,500 kg CO2 shift quota
    DEFAULT_RISK_AVERSION_LAMBDA: float = 0.50          # Moderate risk aversion lambda
    
    # Baseline Operating Cost per KM ($/km by vehicle category)
    VEHICLE_TYPE_BASE_COST_PER_KM: Dict[str, float] = {
        "Van": 0.45,
        "Light Commercial": 0.75,
        "Truck": 1.25,
        "Semi-Trailer": 2.10,
        "Bus": 1.50,
        "Default": 0.95,
    }

    # Inefficiency threshold: If assigned vehicle fuel consumption exceeds 1.35x minimum possible for that route
    INEFFICIENCY_THRESHOLD_RATIO: float = 1.35


settings = Settings()
