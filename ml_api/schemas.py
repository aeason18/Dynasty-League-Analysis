"""Request/response models shared by serve.py (the real, authenticated API)
and docs_app.py (the public, read-only docs mirror) — kept in one place so
the two deployments can never drift out of schema sync. Deliberately has no
dependency on sklearn/pandas/joblib: docs_app.py's whole point is a minimal,
cheap-to-run image, and importing this module must not pull those in.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class PredictRequest(BaseModel):
    position: Literal["QB", "RB", "WR", "TE"]
    season_ppg: float = Field(..., ge=0, le=60, description="This season's points-per-game (played weeks only)")
    season_games_played: int = Field(..., ge=1, le=18, description="Weeks actually played this season")
    season_total_points: float = Field(..., ge=0, le=1000, description="This season's total fantasy points")
    years_exp: int = Field(..., ge=0, le=25, description="NFL seasons of experience")


class PredictResponse(BaseModel):
    predicted_next_season_ppg: float
    input: PredictRequest
