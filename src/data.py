from __future__ import annotations

import re
from pathlib import Path

import pandas as pd


REQUIRED_COLUMNS = {
    "month",
    "town",
    "flat_type",
    "block",
    "street_name",
    "storey_range",
    "floor_area_sqm",
    "flat_model",
    "lease_commence_date",
    "remaining_lease",
    "resale_price",
}


def remaining_lease_months(value: object) -> int | None:
    if pd.isna(value):
        return None
    text = str(value).lower()
    years = re.search(r"(\d+)\s+year", text)
    months = re.search(r"(\d+)\s+month", text)
    if not years and not months:
        return None
    return int(years.group(1)) * 12 + (int(months.group(1)) if months else 0)


def prepare_transactions(path: str | Path) -> pd.DataFrame:
    frame = pd.read_csv(path)
    missing = REQUIRED_COLUMNS - set(frame.columns)
    if missing:
        raise ValueError(f"Missing required columns: {sorted(missing)}")

    frame = frame.loc[:, sorted(REQUIRED_COLUMNS)].copy()
    frame["month"] = pd.to_datetime(frame["month"], format="%Y-%m", errors="coerce")
    frame["floor_area_sqm"] = pd.to_numeric(frame["floor_area_sqm"], errors="coerce")
    frame["lease_commence_date"] = pd.to_numeric(
        frame["lease_commence_date"], errors="coerce"
    )
    frame["resale_price"] = pd.to_numeric(frame["resale_price"], errors="coerce")
    frame["remaining_lease_months"] = frame["remaining_lease"].map(
        remaining_lease_months
    )

    frame = frame.dropna(
        subset=[
            "month",
            "town",
            "flat_type",
            "storey_range",
            "floor_area_sqm",
            "flat_model",
            "lease_commence_date",
            "resale_price",
        ]
    )
    frame = frame[
        frame["floor_area_sqm"].between(20, 300)
        & frame["resale_price"].between(50_000, 2_500_000)
    ].copy()

    frame["year"] = frame["month"].dt.year
    frame["month_number"] = frame["month"].dt.month
    frame["storey_mid"] = (
        frame["storey_range"].str.extractall(r"(\d+)")[0].astype(float)
        .groupby(level=0)
        .mean()
        .reindex(frame.index)
    )
    frame["flat_age"] = frame["year"] - frame["lease_commence_date"]
    frame["address"] = frame["block"].astype(str) + " " + frame["street_name"]
    return frame.sort_values("month").reset_index(drop=True)


def split_by_month(
    frame: pd.DataFrame, calibration_months: int = 3, test_months: int = 6
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    months = frame["month"].drop_duplicates().sort_values().tolist()
    required = calibration_months + test_months + 1
    if len(months) < required:
        raise ValueError(f"At least {required} distinct months are required")
    test_start = months[-test_months]
    calibration_start = months[-(test_months + calibration_months)]
    train = frame[frame["month"] < calibration_start].copy()
    calibration = frame[
        (frame["month"] >= calibration_start) & (frame["month"] < test_start)
    ].copy()
    test = frame[frame["month"] >= test_start].copy()
    return train, calibration, test


def exclude_current_month(
    frame: pd.DataFrame, as_of: pd.Timestamp | None = None
) -> pd.DataFrame:
    reference = as_of if as_of is not None else pd.Timestamp.now()
    current_period = reference.to_period("M")
    return frame[frame["month"].dt.to_period("M") < current_period].copy()
