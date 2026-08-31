from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from catboost import CatBoostRegressor


FEATURES = [
    "town",
    "flat_type",
    "storey_range",
    "floor_area_sqm",
    "flat_model",
    "lease_commence_date",
    "remaining_lease_months",
    "year",
    "month_number",
    "storey_mid",
    "flat_age",
]
CATEGORICAL_FEATURES = ["town", "flat_type", "storey_range", "flat_model"]


def feature_frame(frame: pd.DataFrame) -> pd.DataFrame:
    result = frame[FEATURES].copy()
    for column in CATEGORICAL_FEATURES:
        result[column] = result[column].fillna("UNKNOWN").astype(str)
    return result


def build_model() -> CatBoostRegressor:
    return CatBoostRegressor(
        loss_function="RMSE",
        iterations=900,
        depth=8,
        learning_rate=0.06,
        l2_leaf_reg=5,
        random_seed=42,
        verbose=100,
        allow_writing_files=False,
    )


def fit_model(model: CatBoostRegressor, frame: pd.DataFrame) -> CatBoostRegressor:
    model.fit(
        feature_frame(frame),
        np.log1p(frame["resale_price"]),
        cat_features=CATEGORICAL_FEATURES,
    )
    return model


def predict_price(model: CatBoostRegressor, frame: pd.DataFrame) -> np.ndarray:
    return np.expm1(model.predict(feature_frame(frame)))


def conformal_radius(
    actual: np.ndarray, predicted: np.ndarray, coverage: float = 0.8
) -> float:
    if not 0 < coverage < 1:
        raise ValueError("coverage must be between 0 and 1")
    residuals = np.abs(np.asarray(actual) - np.asarray(predicted))
    level = min(1.0, np.ceil((len(residuals) + 1) * coverage) / len(residuals))
    return float(np.quantile(residuals, level, method="higher"))


def regression_metrics(actual: np.ndarray, predicted: np.ndarray) -> dict[str, float]:
    actual = np.asarray(actual, dtype=float)
    predicted = np.asarray(predicted, dtype=float)
    error = actual - predicted
    mae = np.mean(np.abs(error))
    rmse = np.sqrt(np.mean(error**2))
    denominator = np.sum((actual - actual.mean()) ** 2)
    r2 = 1 - np.sum(error**2) / denominator
    mape = np.mean(np.abs(error / actual))
    return {"mae": float(mae), "rmse": float(rmse), "r2": float(r2), "mape": float(mape)}


def save_json(payload: dict, path: str | Path) -> None:
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

