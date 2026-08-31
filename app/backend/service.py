from __future__ import annotations

import json
import os
from pathlib import Path

import numpy as np
import pandas as pd
from catboost import CatBoostRegressor

from src.model import predict_price
from src.schemas import PredictionRequest, PredictionResponse


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MODEL_PATH = ROOT / "artifacts" / "price_model.cbm"
DEFAULT_METRICS_PATH = ROOT / "artifacts" / "metrics.json"
MODEL_REFERENCE_MONTH = pd.Timestamp("2026-07-01")


class PricePredictor:
    def __init__(self, model_path: Path | None = None, metrics_path: Path | None = None) -> None:
        self.model_path = model_path or Path(os.getenv("HDB_MODEL_PATH", DEFAULT_MODEL_PATH))
        self.metrics_path = metrics_path or Path(os.getenv("HDB_METRICS_PATH", DEFAULT_METRICS_PATH))
        if not self.model_path.is_file():
            raise FileNotFoundError(f"CatBoost model not found: {self.model_path}")
        if not self.metrics_path.is_file():
            raise FileNotFoundError(f"Model metrics not found: {self.metrics_path}")

        self.model = CatBoostRegressor()
        self.model.load_model(self.model_path)
        self.metrics = json.loads(self.metrics_path.read_text(encoding="utf-8"))
        self.interval_log_radius = float(self.metrics["interval_log_radius"])

    def predict(self, request: PredictionRequest) -> PredictionResponse:
        storeys = [int(value) for value in request.storey_range.split(" TO ")]
        remaining_months = max(
            0,
            (request.lease_commence_date + 99 - MODEL_REFERENCE_MONTH.year) * 12
            - (MODEL_REFERENCE_MONTH.month - 1),
        )
        frame = pd.DataFrame(
            [{
                "town": request.town,
                "flat_type": request.flat_type,
                "storey_range": request.storey_range,
                "floor_area_sqm": request.floor_area_sqm,
                "flat_model": request.flat_model,
                "lease_commence_date": request.lease_commence_date,
                "remaining_lease_months": remaining_months,
                "year": MODEL_REFERENCE_MONTH.year,
                "month_number": MODEL_REFERENCE_MONTH.month,
                "storey_mid": sum(storeys) / len(storeys),
                "flat_age": MODEL_REFERENCE_MONTH.year - request.lease_commence_date,
            }]
        )
        predicted = float(predict_price(self.model, frame)[0])
        lower = float(np.expm1(np.log1p(predicted) - self.interval_log_radius))
        upper = float(np.expm1(np.log1p(predicted) + self.interval_log_radius))
        return PredictionResponse(
            predicted_price=round(predicted, 2),
            lower_bound=round(lower, 2),
            upper_bound=round(upper, 2),
        )
