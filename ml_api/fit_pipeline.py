"""Fits the dynasty next-season-PPG pipeline against live Supabase data and
dumps a bundle to pipeline.joblib.

This is the ONLY place the pipeline gets fitted. serve.py just loads the
resulting artifact — it never refits at boot, so the artifact is the single
source of truth for "what the model learned." Re-run this script (and
`modal deploy` again) any time pipeline_def.py changes or new seasons of
data land in Supabase.

Data note: `years_exp` comes from the current `players` row, not a
season-specific snapshot — Sleeper doesn't give us historical experience
counts, so for older season-rows this slightly overstates how experienced
the player actually was *at that time*. Acceptable for a class-assignment
demo; would need a real per-season experience table to fix properly.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import requests
import sklearn
from dotenv import load_dotenv
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

sys.path.insert(0, str(Path(__file__).parent))
from pipeline_def import PositionalScaler  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(REPO_ROOT / ".env.local")

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
SUPABASE_ANON_KEY = os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]

INCLUDED_POSITIONS = {"QB", "RB", "WR", "TE"}
FEATURE_COLUMNS = ["position", "season_ppg", "season_games_played", "season_total_points", "years_exp"]
NUMERIC_COLUMNS = ["season_ppg", "season_games_played", "season_total_points", "years_exp"]
TARGET_COLUMN = "next_season_ppg"

ARTIFACT_PATH = Path(__file__).parent / "pipeline.joblib"


def supabase_select(table: str, select: str, filters: str = "") -> list[dict]:
    """Fetches every row from a Supabase REST table/view, paginating past
    PostgREST's default 1000-row cap (see project memory: a naive
    unpaginated .select() on matchup_players silently dropped ~70% of a
    season's rows before this exact bug was caught once already)."""
    headers = {"apikey": SUPABASE_ANON_KEY, "Authorization": f"Bearer {SUPABASE_ANON_KEY}"}
    rows: list[dict] = []
    page_size = 1000
    offset = 0
    while True:
        url = f"{SUPABASE_URL}/rest/v1/{table}?select={select}{filters}"
        headers["Range"] = f"{offset}-{offset + page_size - 1}"
        resp = requests.get(url, headers=headers, timeout=30)
        resp.raise_for_status()
        page = resp.json()
        rows.extend(page)
        if len(page) < page_size:
            break
        offset += page_size
    return rows


def load_season_player_stats() -> pd.DataFrame:
    print("Fetching leagues...")
    leagues = pd.DataFrame(supabase_select("leagues", "league_id,season"))

    print("Fetching players...")
    players = pd.DataFrame(supabase_select("players", "player_id,position,years_exp"))

    print("Fetching matchup_players (paginated)...")
    mp = pd.DataFrame(supabase_select("matchup_players", "league_id,player_id,points,did_play"))
    print(f"  -> {len(mp)} matchup_players rows")

    mp = mp[mp["did_play"] != False]  # noqa: E712 — keep True and null, drop explicit False

    df = mp.merge(leagues, on="league_id").merge(players, on="player_id")
    df = df[df["position"].isin(INCLUDED_POSITIONS)]

    season_stats = (
        df.groupby(["player_id", "season", "position", "years_exp"], dropna=False)
        .agg(season_total_points=("points", "sum"), season_games_played=("points", "count"))
        .reset_index()
    )
    season_stats["season_ppg"] = season_stats["season_total_points"] / season_stats["season_games_played"]
    season_stats = season_stats[season_stats["season_games_played"] > 0]
    return season_stats


def build_training_pairs(season_stats: pd.DataFrame) -> pd.DataFrame:
    """One row per (player, season t) with that season's stats as features
    and season t+1's PPG as the target — only kept when both seasons exist."""
    by_player_season = season_stats.set_index(["player_id", "season"])
    rows = []
    for (player_id, season), row in by_player_season.iterrows():
        next_season = str(int(season) + 1)
        next_key = (player_id, next_season)
        if next_key in by_player_season.index:
            next_row = by_player_season.loc[next_key]
            rows.append(
                {
                    "player_id": player_id,
                    "season": season,
                    "position": row["position"],
                    "season_ppg": row["season_ppg"],
                    "season_games_played": row["season_games_played"],
                    "season_total_points": row["season_total_points"],
                    "years_exp": row["years_exp"] if pd.notna(row["years_exp"]) else 0,
                    TARGET_COLUMN: next_row["season_ppg"],
                }
            )
    return pd.DataFrame(rows)


def build_pipeline() -> Pipeline:
    return Pipeline(
        [
            (
                "features",
                ColumnTransformer(
                    [
                        (
                            "pos_scale",
                            PositionalScaler(columns=NUMERIC_COLUMNS, group_col="position"),
                            NUMERIC_COLUMNS + ["position"],
                        ),
                        ("pos_onehot", OneHotEncoder(handle_unknown="ignore"), ["position"]),
                    ]
                ),
            ),
            ("model", Ridge(alpha=1.0)),
        ]
    )


def main() -> None:
    season_stats = load_season_player_stats()
    print(f"Season-player rows: {len(season_stats)} across seasons {sorted(season_stats['season'].unique())}")

    training = build_training_pairs(season_stats)
    print(f"Season-over-season training pairs: {len(training)}")
    if len(training) < 20:
        print(
            "WARNING: fewer than 20 training rows — this league only has a few seasons of "
            "history, so treat any predictions as illustrative, not reliable.",
            file=sys.stderr,
        )

    X = training[FEATURE_COLUMNS]
    y = training[TARGET_COLUMN]

    # Honest holdout metric from a throwaway split — the artifact we ship
    # is refit on ALL available data below, so this number describes how
    # the *approach* performs, not the exact deployed weights.
    holdout_mae = holdout_r2 = None
    if len(training) >= 10:
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        eval_pipeline = build_pipeline()
        eval_pipeline.fit(X_train, y_train)
        preds = eval_pipeline.predict(X_test)
        holdout_mae = float(mean_absolute_error(y_test, preds))
        holdout_r2 = float(r2_score(y_test, preds))
        print(f"Holdout MAE: {holdout_mae:.2f} PPG, R^2: {holdout_r2:.3f} (n_test={len(X_test)})")

    pipeline = build_pipeline()
    pipeline.fit(X, y)

    bundle = {
        "pipeline": pipeline,
        "feature_columns": FEATURE_COLUMNS,
        "target_column": TARGET_COLUMN,
        "position_categories": sorted(INCLUDED_POSITIONS),
        "metadata": {
            "steps": [(name, type(step).__name__) for name, step in pipeline.steps],
            "built_at": datetime.now(timezone.utc).isoformat(),
            "sklearn_version": sklearn.__version__,
            "n_training_rows": int(len(training)),
            "seasons_used": sorted(season_stats["season"].unique().tolist()),
            "positions_included": sorted(INCLUDED_POSITIONS),
            "holdout_mae": holdout_mae,
            "holdout_r2": holdout_r2,
        },
    }

    joblib.dump(bundle, ARTIFACT_PATH)
    print(f"Wrote {ARTIFACT_PATH} ({ARTIFACT_PATH.stat().st_size} bytes)")
    print(json.dumps(bundle["metadata"], indent=2))


if __name__ == "__main__":
    main()
