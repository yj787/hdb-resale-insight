from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from app.backend.service import PricePredictor
from src.schemas import HealthResponse, PredictionRequest, PredictionResponse


def allowed_origins() -> list[str]:
    configured = os.getenv("HDB_ALLOWED_ORIGINS")
    if configured:
        return [origin.strip() for origin in configured.split(",") if origin.strip()]
    return [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://hdb-resale-insight.equal-cove-8327.chatgpt.site",
    ]


def create_app(predictor: PricePredictor | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        if predictor is not None:
            app.state.predictor = predictor
            app.state.model_error = None
        else:
            try:
                app.state.predictor = PricePredictor()
                app.state.model_error = None
            except Exception as exc:
                app.state.predictor = None
                app.state.model_error = str(exc)
        yield

    app = FastAPI(
        title="HDB Resale Insight API",
        version="0.1.0",
        description="CatBoost inference API for HDB resale price estimation.",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins(),
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

    @app.get("/health", response_model=HealthResponse)
    async def health(request: Request) -> HealthResponse:
        loaded = request.app.state.predictor is not None
        return HealthResponse(status="ok" if loaded else "error", model_loaded=loaded)

    @app.post("/predict", response_model=PredictionResponse)
    async def predict(payload: PredictionRequest, request: Request) -> PredictionResponse:
        model = request.app.state.predictor
        if model is None:
            raise HTTPException(status_code=503, detail="CatBoost model is unavailable")
        try:
            return model.predict(payload)
        except Exception as exc:
            raise HTTPException(status_code=500, detail="Model prediction failed") from exc

    return app


app = create_app()
