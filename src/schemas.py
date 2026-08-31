from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator


Town = Literal[
    "ANG MO KIO", "BEDOK", "BISHAN", "BUKIT BATOK", "BUKIT MERAH",
    "BUKIT PANJANG", "BUKIT TIMAH", "CENTRAL AREA", "CHOA CHU KANG",
    "CLEMENTI", "GEYLANG", "HOUGANG", "JURONG EAST", "JURONG WEST",
    "KALLANG/WHAMPOA", "MARINE PARADE", "PASIR RIS", "PUNGGOL",
    "QUEENSTOWN", "SEMBAWANG", "SENGKANG", "SERANGOON", "TAMPINES",
    "TOA PAYOH", "WOODLANDS", "YISHUN",
]
FlatType = Literal[
    "1 ROOM", "2 ROOM", "3 ROOM", "4 ROOM", "5 ROOM", "EXECUTIVE",
    "MULTI-GENERATION",
]


class PredictionRequest(BaseModel):
    town: Town
    flat_type: FlatType
    floor_area_sqm: float = Field(ge=20, le=300)
    storey_range: str = Field(min_length=8, max_length=8, pattern=r"^\d{2} TO \d{2}$")
    flat_model: str = Field(min_length=2, max_length=80)
    lease_commence_date: int = Field(ge=1960, le=2026)

    @model_validator(mode="after")
    def validate_storey_order(self) -> "PredictionRequest":
        low, high = (int(value) for value in self.storey_range.split(" TO "))
        if low > high or high > 60:
            raise ValueError("storey_range must be an ascending range up to storey 60")
        return self


class PredictionResponse(BaseModel):
    predicted_price: float
    lower_bound: float
    upper_bound: float
    currency: Literal["SGD"] = "SGD"


class HealthResponse(BaseModel):
    status: Literal["ok", "error"]
    model_loaded: bool
