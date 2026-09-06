// Ordinary least squares, fit separately per position (QB/RB/WR/TE/K score
// on very different scales, so pooling them would bias the fit toward
// whichever position has the most training rows).
//
// Features: a player's prior-season PPG and games played predict their
// next-season PPG. Trained on this league's own season-over-season history
// (every player who played in both season N and season N+1, for each
// available consecutive pair of completed seasons).

export interface TrainingExample {
  position: string;
  priorPpg: number;
  priorGames: number;
  nextPpg: number;
}

export interface PositionModel {
  position: string;
  intercept: number;
  coefPpg: number;
  coefGames: number;
  n: number;
  r2: number;
}

// Solves the 3x3 normal-equations system (X^T X) beta = X^T y via Gaussian
// elimination. Small and fixed-size, so hand-rolling this avoids pulling in
// a linear algebra dependency for one call site.
function solve3x3(a: number[][], b: number[]): number[] {
  const m = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < 3; col++) {
    let pivot = col;
    for (let row = col + 1; row < 3; row++) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
    }
    [m[col], m[pivot]] = [m[pivot], m[col]];
    if (Math.abs(m[col][col]) < 1e-9) continue; // singular-ish; leave as 0 contribution
    for (let row = 0; row < 3; row++) {
      if (row === col) continue;
      const factor = m[row][col] / m[col][col];
      for (let k = col; k <= 3; k++) m[row][k] -= factor * m[col][k];
    }
  }
  return [0, 1, 2].map((i) => (Math.abs(m[i][i]) < 1e-9 ? 0 : m[i][3] / m[i][i]));
}

const MIN_EXAMPLES_PER_POSITION = 8;

export function fitPositionRegressions(examples: TrainingExample[]): Map<string, PositionModel> {
  const byPosition = new Map<string, TrainingExample[]>();
  for (const ex of examples) {
    if (!byPosition.has(ex.position)) byPosition.set(ex.position, []);
    byPosition.get(ex.position)!.push(ex);
  }

  const models = new Map<string, PositionModel>();
  for (const [position, rows] of byPosition) {
    if (rows.length < MIN_EXAMPLES_PER_POSITION) continue;

    // Normal equations for y = b0 + b1*ppg + b2*games
    let sX1 = 0, sX2 = 0, sX1X1 = 0, sX1X2 = 0, sX2X2 = 0, sY = 0, sX1Y = 0, sX2Y = 0;
    const n = rows.length;
    for (const r of rows) {
      sX1 += r.priorPpg;
      sX2 += r.priorGames;
      sX1X1 += r.priorPpg * r.priorPpg;
      sX1X2 += r.priorPpg * r.priorGames;
      sX2X2 += r.priorGames * r.priorGames;
      sY += r.nextPpg;
      sX1Y += r.priorPpg * r.nextPpg;
      sX2Y += r.priorGames * r.nextPpg;
    }

    const [intercept, coefPpg, coefGames] = solve3x3(
      [
        [n, sX1, sX2],
        [sX1, sX1X1, sX1X2],
        [sX2, sX1X2, sX2X2],
      ],
      [sY, sX1Y, sX2Y]
    );

    const meanY = sY / n;
    let ssRes = 0, ssTot = 0;
    for (const r of rows) {
      const pred = intercept + coefPpg * r.priorPpg + coefGames * r.priorGames;
      ssRes += (r.nextPpg - pred) ** 2;
      ssTot += (r.nextPpg - meanY) ** 2;
    }
    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    models.set(position, { position, intercept, coefPpg, coefGames, n, r2 });
  }
  return models;
}

export function predictPpg(model: PositionModel, priorPpg: number, priorGames: number): number {
  const pred = model.intercept + model.coefPpg * priorPpg + model.coefGames * priorGames;
  return Math.max(0, pred);
}
