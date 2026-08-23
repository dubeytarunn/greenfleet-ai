"""
GreenFlow AI - Vehicle Data Model
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class VehicleModel(BaseModel):
    """
    Vehicle representation adhering strictly to Person 3 & ML team contracts.
    """
    vehicle_id: str = Field(..., description="Unique vehicle identifier (e.g. V001)")
    vehicle_type: str = Field(..., description="Vehicle category (Standard, Van, Commercial Truck, Hazmat truck, Semi-Trailer)")
    fuel_type: str = Field(..., description="Fuel type (e.g. Diesel, Petrol, Hybrid, CNG)")
    vehicle_age: int = Field(..., ge=0, description="Age of vehicle in years")
    fuel_capacity_l: float = Field(..., gt=0, description="Fuel tank capacity in litres")
    max_payload_kg: float = Field(..., gt=0, description="Maximum payload capacity in kilograms")
    available: bool = Field(default=True, description="Whether vehicle is ready for dispatch")
    
    # Optional operational metadata
    current_location: Optional[str] = Field(default="Depot Central", description="Current physical location / base")
    operating_cost_per_km: Optional[float] = Field(default=None, description="Operating cost per km ($/km)")
    fuel_efficiency_kmpl: Optional[float] = Field(default=None, description="Nominal fuel efficiency in km/L")

    model_config = {
        "json_schema_extra": {
            "example": {
                "vehicle_id": "V001",
                "vehicle_type": "Truck",
                "fuel_type": "Diesel",
                "vehicle_age": 3,
                "fuel_capacity_l": 180.0,
                "max_payload_kg": 5000.0,
                "available": True,
                "current_location": "Depot North",
                "operating_cost_per_km": 1.45,
                "fuel_efficiency_kmpl": 3.8
            }
        }
    }


class VehicleListResponse(BaseModel):
    """API response for fleet listing."""
    total_vehicles: int
    available_vehicles: int
    vehicles: List[VehicleModel]
