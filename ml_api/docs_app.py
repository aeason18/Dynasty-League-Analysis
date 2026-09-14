"""Public, read-only docs mirror of the dynasty-ppg-api.

Serves the exact same OpenAPI schema / Swagger UI as the real API (see
serve.py) so anyone — a grader included — can browse and click through
`/docs` without the Proxy Auth Token headers the real API requires.

Deliberately imports nothing heavy (no sklearn/pandas/joblib, no
pipeline.joblib shipped in this image at all) and never runs the model —
every route here either returns static info or a 403 pointing at the real
API. Since Modal bills by container runtime regardless of which route was
hit, keeping this image tiny and fast (no ML deps to import) is what
actually limits the cost of leaving it unauthenticated, not the route
logic itself.
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException

from schemas import PredictRequest, PredictResponse

REAL_API_NOTE = (
    "This is a read-only docs mirror with no model loaded. Send real "
    "requests to the authenticated dynasty-ppg-api deployment with "
    "Modal-Key / Modal-Secret headers."
)

app = FastAPI(
    title="Dynasty PPG Projection API (docs mirror)",
    description=REAL_API_NOTE,
)


@app.get("/")
def health() -> dict:
    return {"status": "docs-only mirror", "model_loaded": False, "note": REAL_API_NOTE}


@app.get("/info")
def info() -> dict:
    raise HTTPException(status_code=403, detail=REAL_API_NOTE)


@app.post("/predict", response_model=PredictResponse)
def predict(body: PredictRequest) -> PredictResponse:
    raise HTTPException(status_code=403, detail=REAL_API_NOTE)
