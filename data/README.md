# Data directory

The full HDB resale transaction extract is intentionally excluded from Git.

- Source: [data.gov.sg — Resale flat prices based on registration date from Jan-2017 onwards](https://data.gov.sg/datasets/d_8b84c4ee58e3cfc0ece0d773c8ca6abc/view)
- Download command: `python -m scripts.download_data`
- Expected local file: `data/raw/hdb_resale_2017_onwards.csv`
- `sample.csv` contains five public rows only, for schema inspection and tests.

The source data is subject to the Singapore Open Data Licence. Check the source page for current terms and updates.
