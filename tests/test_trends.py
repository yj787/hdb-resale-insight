import pandas as pd

from src.trends import forecast_series


def test_forecast_has_requested_horizon() -> None:
    months = pd.date_range("2022-01-01", periods=36, freq="MS")
    frame = pd.DataFrame(
        {
            "month": months,
            "median_price_per_sqm": [5000 + index * 10 for index in range(36)],
        }
    )
    result = forecast_series(frame, horizon=6)
    assert len(result) == 6
    assert result["month"].min() > frame["month"].max()
