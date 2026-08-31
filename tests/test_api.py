from fastapi.testclient import TestClient

from app.backend.main import create_app
from src.schemas import PredictionRequest, PredictionResponse


class FakePredictor:
    def predict(self, request: PredictionRequest) -> PredictionResponse:
        return PredictionResponse(
            predicted_price=600_000,
            lower_bound=550_000,
            upper_bound=650_000,
        )


def test_health_reports_loaded_model() -> None:
    with TestClient(create_app(FakePredictor())) as client:  # type: ignore[arg-type]
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "model_loaded": True}


def test_predict_returns_expected_contract() -> None:
    payload = {
        "town": "TAMPINES",
        "flat_type": "4 ROOM",
        "floor_area_sqm": 93,
        "storey_range": "07 TO 09",
        "flat_model": "Model A",
        "lease_commence_date": 1995,
    }
    with TestClient(create_app(FakePredictor())) as client:  # type: ignore[arg-type]
        response = client.post("/predict", json=payload)
    assert response.status_code == 200
    assert response.json()["currency"] == "SGD"
    assert response.json()["lower_bound"] < response.json()["predicted_price"]


def test_predict_rejects_invalid_area() -> None:
    payload = {
        "town": "TAMPINES",
        "flat_type": "4 ROOM",
        "floor_area_sqm": 10,
        "storey_range": "07 TO 09",
        "flat_model": "Model A",
        "lease_commence_date": 1995,
    }
    with TestClient(create_app(FakePredictor())) as client:  # type: ignore[arg-type]
        response = client.post("/predict", json=payload)
    assert response.status_code == 422


def test_predict_rejects_unknown_town() -> None:
    payload = {
        "town": "UNKNOWN",
        "flat_type": "4 ROOM",
        "floor_area_sqm": 93,
        "storey_range": "07 TO 09",
        "flat_model": "Model A",
        "lease_commence_date": 1995,
    }
    with TestClient(create_app(FakePredictor())) as client:  # type: ignore[arg-type]
        response = client.post("/predict", json=payload)
    assert response.status_code == 422
