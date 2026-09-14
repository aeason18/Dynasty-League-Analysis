"""FastAPI service for the dynasty next-season-PPG pipeline.

Loads the fitted bundle once at import time. Never refits — if
pipeline.joblib is missing, corrupt, or built with a scikit-learn version
this process doesn't have, every endpoint responds 503 instead of crashing
or (worse) silently rebuilding an unfitted pipeline.
"""

from __future__ import annotations

import sys
from pathlib import Path

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException

sys.path.insert(0, str(Path(__file__).parent))
import pipeline_def  # noqa: F401 — must be imported so joblib can resolve PositionalScaler when unpickling
from schemas import PredictRequest, PredictResponse

ARTIFACT_PATH = Path(__file__).parent / "pipeline.joblib"

_bundle: dict | None = None
_load_error: str | None = None

try:
    _bundle = joblib.load(ARTIFACT_PATH)
except Exception as exc:  # noqa: BLE001 — any load failure should degrade to 503, not a crash
    _load_error = f"{type(exc).__name__}: {exc}"

app = FastAPI(title="Dynasty PPG Projection API")


def _require_bundle() -> dict:
    if _bundle is None:
        raise HTTPException(status_code=503, detail=f"Model artifact not loaded: {_load_error}")
    return _bundle


@app.get("/")
def health() -> dict:
    return {"status": "ok" if _bundle is not None else "degraded", "model_loaded": _bundle is not None}


@app.get("/info")
def info() -> dict:
    bundle = _require_bundle()
    return {
        "feature_columns": bundle["feature_columns"],
        "target_column": bundle["target_column"],
        "position_categories": bundle["position_categories"],
        "metadata": bundle["metadata"],
    }


@app.post("/predict", response_model=PredictResponse)
def predict(body: PredictRequest) -> PredictResponse:
    bundle = _require_bundle()
    row = pd.DataFrame([body.model_dump()])[bundle["feature_columns"]]
    prediction = float(bundle["pipeline"].predict(row)[0])
    return PredictResponse(predicted_next_season_ppg=round(prediction, 2), input=body)
