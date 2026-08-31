from __future__ import annotations

import json
from pathlib import Path

from src.data import exclude_current_month, prepare_transactions
from src.trends import forecast_series, monthly_market


ROOT = Path(__file__).resolve().parents[1]
RAW_PATH = ROOT / "data" / "raw" / "hdb_resale_2017_onwards.csv"
OUTPUT_PATH = ROOT / "web" / "public" / "data" / "trends.json"


def rounded(value: float) -> int:
    return int(round(float(value)))


def main() -> None:
    transactions = exclude_current_month(prepare_transactions(RAW_PATH))
    market = monthly_market(transactions)
    payload: dict[str, object] = {
        "as_of": str(transactions["month"].max().date()),
        "series": {},
    }
    output_series: dict[str, object] = {}
    for (town, flat_type), group in market.groupby(["town", "flat_type"]):
        if len(group) < 24:
            continue
        history = group.tail(36)
        forecast = forecast_series(group)
        if forecast.empty:
            continue
        key = f"{town}|{flat_type}"
        recent = (
            transactions[
                (transactions["town"] == town)
                & (transactions["flat_type"] == flat_type)
            ]
            .sort_values("month", ascending=False)
            .head(8)
        )
        output_series[key] = {
            "history": [
                {
                    "month": str(row.month.date())[:7],
                    "price": rounded(row.median_price),
                    "price_per_sqm": rounded(row.median_price_per_sqm),
                    "transactions": int(row.transactions),
                }
                for row in history.itertuples()
            ],
            "forecast": [
                {
                    "month": str(row.month.date())[:7],
                    "price_per_sqm": rounded(row.forecast_price_per_sqm),
                    "lower": rounded(row.lower),
                    "upper": rounded(row.upper),
                }
                for row in forecast.itertuples()
            ],
            "recent": [
                {
                    "month": str(row.month.date())[:7],
                    "block": str(row.block),
                    "street": str(row.street_name),
                    "area": rounded(row.floor_area_sqm),
                    "storey": str(row.storey_range),
                    "price": rounded(row.resale_price),
                }
                for row in recent.itertuples()
            ],
        }
    payload["series"] = output_series
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(f"Saved {len(output_series)} market series to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
