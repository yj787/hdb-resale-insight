import pandas as pd

from src.data import exclude_current_month, remaining_lease_months, split_by_month


def test_remaining_lease_months() -> None:
    assert remaining_lease_months("61 years 04 months") == 736
    assert remaining_lease_months("94 years") == 1128


def test_split_by_month_keeps_time_order() -> None:
    frame = pd.DataFrame(
        {
            "month": pd.date_range("2025-01-01", periods=12, freq="MS"),
            "resale_price": range(12),
        }
    )
    train, calibration, test = split_by_month(frame, calibration_months=3, test_months=3)
    assert train["month"].max() < calibration["month"].min()
    assert calibration["month"].max() < test["month"].min()


def test_exclude_current_month() -> None:
    frame = pd.DataFrame(
        {"month": pd.to_datetime(["2026-07-01", "2026-08-01"])}
    )
    result = exclude_current_month(frame, as_of=pd.Timestamp("2026-08-31"))
    assert result["month"].tolist() == [pd.Timestamp("2026-07-01")]
