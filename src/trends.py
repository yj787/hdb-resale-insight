from __future__ import annotations

import numpy as np
import pandas as pd


def monthly_market(frame: pd.DataFrame) -> pd.DataFrame:
    data = frame.copy()
    data["price_per_sqm"] = data["resale_price"] / data["floor_area_sqm"]
    return (
        data.groupby(["town", "flat_type", "month"], as_index=False)
        .agg(
            median_price=("resale_price", "median"),
            median_price_per_sqm=("price_per_sqm", "median"),
            transactions=("resale_price", "size"),
        )
        .sort_values(["town", "flat_type", "month"])
    )


def forecast_series(group: pd.DataFrame, horizon: int = 12) -> pd.DataFrame:
    series = group.sort_values("month").tail(48).copy()
    if len(series) < 18:
        return pd.DataFrame()
    values = np.log(series["median_price_per_sqm"].to_numpy(dtype=float))
    x = np.arange(len(values), dtype=float)
    weights = np.linspace(0.35, 1.0, len(values))
    slope, intercept = np.polyfit(x, values, 1, w=weights)
    slope = float(np.clip(slope, -0.015, 0.015))

    residual = values - (intercept + slope * x)
    months = series["month"].dt.month.to_numpy()
    seasonal = {
        month: float(np.median(residual[months == month]))
        for month in range(1, 13)
        if np.any(months == month)
    }
    future_months = pd.date_range(
        series["month"].max() + pd.offsets.MonthBegin(1), periods=horizon, freq="MS"
    )
    future_x = np.arange(len(values), len(values) + horizon, dtype=float)
    prediction = np.exp(
        intercept
        + slope * future_x
        + np.array([seasonal.get(month.month, 0.0) for month in future_months])
    )
    uncertainty = max(float(np.std(residual)), 0.025)
    return pd.DataFrame(
        {
            "month": future_months,
            "forecast_price_per_sqm": prediction,
            "lower": prediction * np.exp(-1.28 * uncertainty),
            "upper": prediction * np.exp(1.28 * uncertainty),
        }
    )

