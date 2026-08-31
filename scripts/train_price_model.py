from __future__ import annotations

from pathlib import Path

import numpy as np

from src.data import exclude_current_month, prepare_transactions, split_by_month
from src.model import (
    build_model,
    conformal_radius,
    fit_model,
    predict_price,
    regression_metrics,
    save_json,
)


ROOT = Path(__file__).resolve().parents[1]
RAW_PATH = ROOT / "data" / "raw" / "hdb_resale_2017_onwards.csv"
MODEL_PATH = ROOT / "artifacts" / "price_model.cbm"
METRICS_PATH = ROOT / "artifacts" / "metrics.json"


def main() -> None:
    frame = exclude_current_month(prepare_transactions(RAW_PATH))
    train, calibration, test = split_by_month(frame)
    model = fit_model(build_model(), train)

    calibration_prediction = predict_price(model, calibration)
    log_radius = conformal_radius(
        np.log1p(calibration["resale_price"].to_numpy()),
        np.log1p(calibration_prediction),
        coverage=0.8,
    )
    test_prediction = predict_price(model, test)
    lower = np.expm1(np.log1p(test_prediction) - log_radius)
    upper = np.expm1(np.log1p(test_prediction) + log_radius)
    actual = test["resale_price"].to_numpy()
    metrics = regression_metrics(actual, test_prediction)
    metrics.update(
        {
            "interval_target_coverage": 0.8,
            "interval_actual_coverage": float(np.mean((actual >= lower) & (actual <= upper))),
            "interval_log_radius": log_radius,
            "train_rows": len(train),
            "calibration_rows": len(calibration),
            "test_rows": len(test),
            "train_end": str(train["month"].max().date()),
            "calibration_start": str(calibration["month"].min().date()),
            "test_start": str(test["month"].min().date()),
            "test_end": str(test["month"].max().date()),
        }
    )
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    model.save_model(MODEL_PATH)
    save_json(metrics, METRICS_PATH)
    print(metrics)


if __name__ == "__main__":
    main()
