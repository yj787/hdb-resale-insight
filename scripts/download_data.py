from __future__ import annotations

import csv
import json
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd


DATASET_ID = "d_8b84c4ee58e3cfc0ece0d773c8ca6abc"
API_URL = "https://data.gov.sg/api/action/datastore_search"
ROOT = Path(__file__).resolve().parents[1]
RAW_PATH = ROOT / "data" / "raw" / "hdb_resale_2017_onwards.csv"
METADATA_PATH = ROOT / "artifacts" / "metadata.json"


def fetch_page(offset: int, limit: int) -> dict:
    query = urllib.parse.urlencode(
        {"resource_id": DATASET_ID, "offset": offset, "limit": limit}
    )
    with urllib.request.urlopen(f"{API_URL}?{query}", timeout=120) as response:
        payload = json.load(response)
    if not payload.get("success"):
        raise RuntimeError("data.gov.sg returned an unsuccessful response")
    return payload["result"]


def main() -> None:
    RAW_PATH.parent.mkdir(parents=True, exist_ok=True)
    METADATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    offset, limit, total = 0, 10_000, None
    fieldnames = None

    with RAW_PATH.open("w", newline="", encoding="utf-8") as stream:
        writer = None
        while total is None or offset < total:
            result = fetch_page(offset, limit)
            records = result["records"]
            total = int(result["total"])
            if records and writer is None:
                fieldnames = [key for key in records[0] if key != "_id"]
                writer = csv.DictWriter(stream, fieldnames=fieldnames)
                writer.writeheader()
            for record in records:
                record.pop("_id", None)
                writer.writerow(record)
            offset += len(records)
            print(f"Downloaded {offset:,}/{total:,}")
            if not records:
                break

    frame = pd.read_csv(RAW_PATH, usecols=["month"])
    metadata = {
        "dataset_id": DATASET_ID,
        "source": f"https://data.gov.sg/datasets/{DATASET_ID}/view",
        "downloaded_at_utc": datetime.now(timezone.utc).isoformat(),
        "rows": int(len(frame)),
        "min_month": str(frame["month"].min()),
        "max_month": str(frame["month"].max()),
    }
    METADATA_PATH.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Saved {RAW_PATH}")


if __name__ == "__main__":
    main()

