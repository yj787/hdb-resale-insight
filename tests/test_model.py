import numpy as np

from app.backend.service import PricePredictor
from src.model import conformal_radius, regression_metrics
from src.schemas import PredictionRequest


def test_metrics_are_exact_for_perfect_predictions() -> None:
    actual = np.array([100.0, 200.0, 300.0])
    metrics = regression_metrics(actual, actual.copy())
    assert metrics["mae"] == 0
    assert metrics["rmse"] == 0
    assert metrics["r2"] == 1
    assert metrics["mape"] == 0


def test_conformal_radius_is_non_negative() -> None:
    radius = conformal_radius(
        np.array([100.0, 200.0, 300.0]), np.array([90.0, 210.0, 280.0]), 0.8
    )
    assert radius >= 0


def test_saved_catboost_model_produces_ordered_price_interval() -> None:
    result = PricePredictor().predict(
        PredictionRequest(
            town="TAMPINES",
            flat_type="4 ROOM",
            floor_area_sqm=93,
            storey_range="07 TO 09",
            flat_model="Model A",
            lease_commence_date=1995,
        )
    )
    assert result.lower_bound < result.predicted_price < result.upper_bound
    assert result.currency == "SGD"
