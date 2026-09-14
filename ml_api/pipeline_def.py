from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin


class PositionalScaler(BaseEstimator, TransformerMixin):


    def __init__(self, columns: list[str], group_col: str = "position"):
        self.columns = columns
        self.group_col = group_col

    def fit(self, X: pd.DataFrame, y=None) -> "PositionalScaler":
        global_means = X[self.columns].mean()
        global_stds = X[self.columns].std().replace(0, 1.0)

        self.fallback_stats_ = {col: (float(global_means[col]), float(global_stds[col])) for col in self.columns}

        self.stats_ = {}
        for position, group in X.groupby(self.group_col):
            position_means = group[self.columns].mean()
            position_stds = group[self.columns].std().replace(0, 1.0)

            self.stats_[position] = {col: (float(position_means[col]), (float(position_stds[col]))) for col in self.columns}

        return self

    def transform(self, X: pd.DataFrame) -> np.ndarray:
      out = np.zeros((len(X), len(self.columns)), dtype=float)
      for i, (_, row) in enumerate(X.iterrows()):
        position = row[self.group_col]
        if position in self.stats_:
          stats = self.stats_[position]
        else:
          stats = self.fallback_stats_

        for j, col in enumerate(self.columns):
          mean, std = stats[col]
          out[i, j] = (float(row[col]) - mean) / std

      return out

    def get_feature_names_out(self, input_features=None) -> np.ndarray:
        return np.array([f"{col}_scaled" for col in self.columns])
