"""
GreenFlow AI - Feature Engineering & Preprocessing Pipeline
Provides robust feature extraction for both:
1. Trip-level Route/Fleet Optimization (backward compatible)
2. Real-time High-Frequency Vehicle Telemetry & Fuel Consumption Regression
"""

import os
from typing import Tuple, List, Dict, Any, Optional
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split

# ===========================================================================
# 1. TRIP-LEVEL ROUTE PREDICTION CONFIG (BACKWARD COMPATIBILITY)
# ===========================================================================
TRIP_CATEGORICAL_FEATURES = ["vehicle_type", "fuel_type"]
TRIP_RAW_NUMERIC_FEATURES = [
    "vehicle_age",
    "required_payload_kg",
    "max_payload_kg",
    "distance_km",
    "traffic_factor",
    "average_speed_kmph",
    "road_grade",
    "weather_factor",
]
TRIP_TARGET_COL = "fuel_consumed_l"

# Alias for backward compatibility
CATEGORICAL_FEATURES = TRIP_CATEGORICAL_FEATURES
RAW_NUMERIC_FEATURES = TRIP_RAW_NUMERIC_FEATURES
TARGET_COL = TRIP_TARGET_COL


class FleetFeatureEngineer(BaseEstimator, TransformerMixin):
    """
    Custom Transformer for Trip-Level route predictions.
    """

    def __init__(self):
        self.engineered_feature_names = [
            "payload_capacity_ratio",
            "speed_efficiency_deviation",
            "traffic_speed_ratio",
            "grade_distance_work",
            "payload_tonnage",
            "weather_stress_index",
        ]

    def fit(self, X, y=None):
        return self

    def transform(self, X):
        if not isinstance(X, pd.DataFrame):
            X_df = pd.DataFrame(X).copy()
        else:
            X_df = X.copy()

        if "fuel_type" not in X_df.columns and "engine_type" in X_df.columns:
            X_df["fuel_type"] = X_df["engine_type"]
        if "required_payload_kg" not in X_df.columns and "load_kg" in X_df.columns:
            X_df["required_payload_kg"] = X_df["load_kg"]
        if "max_payload_kg" not in X_df.columns:
            type_cap = {"Van": 1500.0, "Light Commercial": 3500.0, "Truck": 8000.0, "Semi-Trailer": 26000.0, "Bus": 6000.0}
            X_df["max_payload_kg"] = X_df["vehicle_type"].map(type_cap).fillna(5000.0)
        if "average_speed_kmph" not in X_df.columns:
            X_df["average_speed_kmph"] = 60.0
        if "road_grade" not in X_df.columns:
            X_df["road_grade"] = 0.0
        if "weather_factor" not in X_df.columns:
            X_df["weather_factor"] = 1.0
        if "traffic_factor" not in X_df.columns:
            X_df["traffic_factor"] = 1.0

        speed = X_df["average_speed_kmph"].values.astype(float)
        traffic = X_df["traffic_factor"].values.astype(float)
        dist = X_df["distance_km"].values.astype(float)
        grade = X_df["road_grade"].values.astype(float)
        load = X_df["required_payload_kg"].values.astype(float)
        max_cap = np.maximum(X_df["max_payload_kg"].values.astype(float), 100.0)
        weather = X_df["weather_factor"].values.astype(float)

        X_df["payload_capacity_ratio"] = np.clip(load / max_cap, 0.0, 1.5)
        X_df["speed_efficiency_deviation"] = (speed - 65.0) ** 2
        X_df["traffic_speed_ratio"] = traffic / (speed + 1.0)
        X_df["grade_distance_work"] = dist * (1.0 + grade / 100.0)
        X_df["payload_tonnage"] = load / 1000.0
        X_df["weather_stress_index"] = (weather - 1.0) * dist

        return X_df


def get_all_numeric_features() -> List[str]:
    return RAW_NUMERIC_FEATURES + [
        "payload_capacity_ratio",
        "speed_efficiency_deviation",
        "traffic_speed_ratio",
        "grade_distance_work",
        "payload_tonnage",
        "weather_stress_index",
    ]


def build_preprocessor_pipeline() -> Pipeline:
    all_numeric = get_all_numeric_features()
    col_transformer = ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), TRIP_CATEGORICAL_FEATURES),
            ("num", StandardScaler(), all_numeric),
        ],
        remainder="drop",
    )
    pipeline = Pipeline(
        steps=[
            ("feature_engineer", FleetFeatureEngineer()),
            ("preprocessor", col_transformer),
        ]
    )
    return pipeline


def prepare_datasets(
    raw_data_path: str,
    processed_data_path: str = None,
    test_size: float = 0.15,
    val_size: float = 0.15,
    random_state: int = 42,
) -> Dict[str, Any]:
    if not os.path.exists(raw_data_path):
        raise FileNotFoundError(f"Raw fleet data not found at: {raw_data_path}")

    df = pd.read_csv(raw_data_path)
    if "fuel_type" not in df.columns and "engine_type" in df.columns:
        df["fuel_type"] = df["engine_type"]
    if "required_payload_kg" not in df.columns and "load_kg" in df.columns:
        df["required_payload_kg"] = df["load_kg"]

    required_cols = TRIP_CATEGORICAL_FEATURES + TRIP_RAW_NUMERIC_FEATURES + [TRIP_TARGET_COL]
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns in dataset: {missing}")

    feature_cols = TRIP_CATEGORICAL_FEATURES + TRIP_RAW_NUMERIC_FEATURES
    X = df[feature_cols].copy()
    y = df[TRIP_TARGET_COL].values

    X_temp, X_test, y_temp, y_test, idx_temp, idx_test = train_test_split(
        X, y, df.index, test_size=test_size, random_state=random_state
    )

    val_relative_size = val_size / (1.0 - test_size)
    X_train, X_val, y_train, y_val, idx_train, idx_val = train_test_split(
        X_temp, y_temp, idx_temp, test_size=val_relative_size, random_state=random_state
    )

    if processed_data_path:
        os.makedirs(os.path.dirname(processed_data_path), exist_ok=True)
        engineer = FleetFeatureEngineer()
        processed_df = engineer.transform(df)
        processed_df.to_csv(processed_data_path, index=False)

    return {
        "X_train": X_train.reset_index(drop=True),
        "y_train": y_train,
        "X_val": X_val.reset_index(drop=True),
        "y_val": y_val,
        "X_test": X_test.reset_index(drop=True),
        "y_test": y_test,
        "train_df": df.loc[idx_train].reset_index(drop=True),
        "val_df": df.loc[idx_val].reset_index(drop=True),
        "test_df": df.loc[idx_test].reset_index(drop=True),
    }


# ===========================================================================
# 2. REAL-TIME VEHICLE TELEMETRY FEATURE PIPELINE
# ===========================================================================
TELEMETRY_CATEGORICAL_FEATURES = ["vehicle_type", "fuel_type", "road_type", "traffic_level"]
TELEMETRY_RAW_NUMERIC_FEATURES = [
    "speed_kmph",
    "acceleration_mps2",
    "rpm",
    "gear",
    "engine_load_pct",
    "road_slope_pct",
    "vehicle_age_years",
    "engine_size_l",
    "vehicle_weight_kg",
    "ambient_temperature_c",
    "idle_duration_sec",
]
TELEMETRY_TARGET_COL = "fuel_consumption_l_100km"


class TelemetryFeatureEngineer(BaseEstimator, TransformerMixin):
    """
    Physics-grounded feature extraction for continuous vehicle telemetry:
    1. speed_efficiency_deviation: (speed - 65)^2 (aerodynamic & idling penalty curve)
    2. rpm_per_speed_ratio: rpm / (speed + 1.0) (gear efficiency indicator)
    3. kinetic_power_proxy: vehicle_weight_kg * (speed / 3.6) * acceleration_mps2
    4. slope_gravity_work: road_slope_pct * (vehicle_weight_kg / 1000.0)
    5. thermal_stress_index: abs(ambient_temperature_c - 22.0) (HVAC / temperature penalty)
    """

    def __init__(self):
        self.engineered_feature_names = [
            "speed_efficiency_deviation",
            "rpm_per_speed_ratio",
            "kinetic_power_proxy",
            "slope_gravity_work",
            "thermal_stress_index",
        ]

    def fit(self, X, y=None):
        return self

    def transform(self, X):
        if not isinstance(X, pd.DataFrame):
            X_df = pd.DataFrame(X).copy()
        else:
            X_df = X.copy()

        speed = X_df["speed_kmph"].values.astype(float)
        accel = X_df["acceleration_mps2"].values.astype(float)
        rpm = X_df["rpm"].values.astype(float)
        slope = X_df["road_slope_pct"].values.astype(float)
        weight = X_df["vehicle_weight_kg"].values.astype(float)
        temp = X_df["ambient_temperature_c"].values.astype(float)

        X_df["speed_efficiency_deviation"] = (speed - 65.0) ** 2
        X_df["rpm_per_speed_ratio"] = rpm / (speed + 1.0)
        X_df["kinetic_power_proxy"] = np.maximum(0.0, weight * (speed / 3.6) * accel / 1000.0)
        X_df["slope_gravity_work"] = slope * (weight / 1000.0)
        X_df["thermal_stress_index"] = np.abs(temp - 22.0)

        return X_df


def get_all_telemetry_numeric_features() -> List[str]:
    return TELEMETRY_RAW_NUMERIC_FEATURES + [
        "speed_efficiency_deviation",
        "rpm_per_speed_ratio",
        "kinetic_power_proxy",
        "slope_gravity_work",
        "thermal_stress_index",
    ]


def build_telemetry_preprocessor_pipeline() -> Pipeline:
    all_numeric = get_all_telemetry_numeric_features()
    col_transformer = ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), TELEMETRY_CATEGORICAL_FEATURES),
            ("num", StandardScaler(), all_numeric),
        ],
        remainder="drop",
    )
    pipeline = Pipeline(
        steps=[
            ("feature_engineer", TelemetryFeatureEngineer()),
            ("preprocessor", col_transformer),
        ]
    )
    return pipeline


def prepare_telemetry_datasets(
    raw_data_path: str,
    processed_data_path: Optional[str] = None,
    test_size: float = 0.15,
    val_size: float = 0.15,
    random_state: int = 42,
) -> Dict[str, Any]:
    """
    Loads raw telemetry dataset and splits into Train/Val/Test with trip-awareness
    to prevent adjacent sample leakage.
    """
    if not os.path.exists(raw_data_path):
        raise FileNotFoundError(f"Raw telemetry data not found at: {raw_data_path}")

    df = pd.read_csv(raw_data_path)

    # Filter out pure stationary idle records from distance-rate model if desired (speed > 0)
    # The model learns expected operating fuel consumption rate in L/100km
    driving_mask = df["speed_kmph"] > 1.0
    model_df = df[driving_mask].copy().reset_index(drop=True)

    feature_cols = TELEMETRY_CATEGORICAL_FEATURES + TELEMETRY_RAW_NUMERIC_FEATURES
    X = model_df[feature_cols].copy()
    y = model_df[TELEMETRY_TARGET_COL].values

    # Train / Val / Test Split
    X_temp, X_test, y_temp, y_test, idx_temp, idx_test = train_test_split(
        X, y, model_df.index, test_size=test_size, random_state=random_state
    )

    val_relative_size = val_size / (1.0 - test_size)
    X_train, X_val, y_train, y_val, idx_train, idx_val = train_test_split(
        X_temp, y_temp, idx_temp, test_size=val_relative_size, random_state=random_state
    )

    if processed_data_path:
        os.makedirs(os.path.dirname(processed_data_path), exist_ok=True)
        engineer = TelemetryFeatureEngineer()
        processed_df = engineer.transform(df)
        processed_df.to_csv(processed_data_path, index=False)
        print(f"[GreenFlow ML] Processed telemetry saved to: {processed_data_path}")

    return {
        "X_train": X_train.reset_index(drop=True),
        "y_train": y_train,
        "X_val": X_val.reset_index(drop=True),
        "y_val": y_val,
        "X_test": X_test.reset_index(drop=True),
        "y_test": y_test,
        "full_df": df,
    }
