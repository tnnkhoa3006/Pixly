import type { PixelGrid } from '../../types';

type Neighbor = { color: string; distance: number };

const DEFAULT_MAX_GAP = 3;
const DEFAULT_PASSES = 2;

/**
 * Repairs small cracks created by per-pixel motion rounding.
 * Only pixels that were filled in the source grid are eligible, so intentional
 * transparent holes in the original art are preserved.
 */
export function healMotionGaps(
  grid: PixelGrid,
  sourceGrid: PixelGrid,
  gridSize: number,
  maxGap: number = DEFAULT_MAX_GAP,
  passes: number = DEFAULT_PASSES,
): PixelGrid {
  let current = grid;

  for (let pass = 0; pass < passes; pass++) {
    let changed = false;
    const next = current.map(row => [...row]);

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        if (current[y]?.[x]) continue;
        if (!sourceGrid[y]?.[x]) continue;

        const color = chooseGapColor(current, sourceGrid, x, y, gridSize, maxGap);
        if (!color) continue;

        next[y][x] = color;
        changed = true;
      }
    }

    current = next;
    if (!changed) break;
  }

  return current;
}

function chooseGapColor(
  grid: PixelGrid,
  sourceGrid: PixelGrid,
  x: number,
  y: number,
  gridSize: number,
  maxGap: number,
): string | null {
  const sourceColor = sourceGrid[y]?.[x] ?? null;
  const left = nearestColor(grid, x, y, -1, 0, gridSize, maxGap);
  const right = nearestColor(grid, x, y, 1, 0, gridSize, maxGap);
  const up = nearestColor(grid, x, y, 0, -1, gridSize, maxGap);
  const down = nearestColor(grid, x, y, 0, 1, gridSize, maxGap);

  const horizontal = left && right
    ? {
      color: pickBetweenNeighbors(left, right, sourceColor),
      span: left.distance + right.distance,
      sameColor: left.color === right.color,
    }
    : null;

  const vertical = up && down
    ? {
      color: pickBetweenNeighbors(up, down, sourceColor),
      span: up.distance + down.distance,
      sameColor: up.color === down.color,
    }
    : null;

  if (horizontal && vertical) {
    if (horizontal.sameColor !== vertical.sameColor) {
      return horizontal.sameColor ? horizontal.color : vertical.color;
    }
    return horizontal.span <= vertical.span ? horizontal.color : vertical.color;
  }

  if (horizontal) return horizontal.color;
  if (vertical) return vertical.color;

  return dominantImmediateNeighbor(grid, sourceColor, x, y, gridSize);
}

function nearestColor(
  grid: PixelGrid,
  x: number,
  y: number,
  dx: number,
  dy: number,
  gridSize: number,
  maxDistance: number,
): Neighbor | null {
  for (let distance = 1; distance <= maxDistance; distance++) {
    const nx = x + dx * distance;
    const ny = y + dy * distance;
    if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize) return null;

    const color = grid[ny]?.[nx];
    if (color) return { color, distance };
  }

  return null;
}

function pickBetweenNeighbors(a: Neighbor, b: Neighbor, sourceColor: string | null): string {
  if (a.color === b.color) return a.color;
  if (sourceColor && (sourceColor === a.color || sourceColor === b.color)) return sourceColor;
  return a.distance <= b.distance ? a.color : b.color;
}

function dominantImmediateNeighbor(
  grid: PixelGrid,
  sourceColor: string | null,
  x: number,
  y: number,
  gridSize: number,
): string | null {
  const counts = new Map<string, number>();

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize) continue;
      const color = grid[ny]?.[nx];
      if (!color) continue;
      counts.set(color, (counts.get(color) ?? 0) + (color === sourceColor ? 2 : 1));
    }
  }

  let bestColor: string | null = null;
  let bestScore = 0;
  for (const [color, score] of counts) {
    if (score > bestScore) {
      bestColor = color;
      bestScore = score;
    }
  }

  return bestScore >= 3 ? bestColor : null;
}

