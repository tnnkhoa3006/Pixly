import type { PixelGrid } from '../../types';
import type { TweenConstraints, PaletteAnalysis } from './types';

const DEFAULT_CONSTRAINTS: TweenConstraints = {
  paletteLock: true,
  gridSnap: true,
  preserveOutline: true,
  maxDisplacement: 16,
};

export function getDefaultConstraints(): TweenConstraints {
  return { ...DEFAULT_CONSTRAINTS };
}

/**
 * Extract the palette from a pixel grid.
 */
export function extractPalette(grid: PixelGrid, gridSize: number): PaletteAnalysis {
  const colorFrequency = new Map<string, number>();

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const color = grid[y]?.[x];
      if (color) {
        colorFrequency.set(color, (colorFrequency.get(color) ?? 0) + 1);
      }
    }
  }

  const colors = Array.from(colorFrequency.keys());
  const sorted = colors.sort((a, b) => (colorFrequency.get(b) ?? 0) - (colorFrequency.get(a) ?? 0));
  const primaryColors = sorted.slice(0, 8);

  return { colors, colorFrequency, primaryColors };
}

/**
 * Snap a color to the nearest color in the palette.
 */
export function snapToPalette(color: string, palette: PaletteAnalysis): string {
  if (!palette.colors.length) return color;
  if (palette.colors.includes(color)) return color;

  const r1 = parseInt(color.slice(1, 3), 16);
  const g1 = parseInt(color.slice(3, 5), 16);
  const b1 = parseInt(color.slice(5, 7), 16);

  let bestColor = palette.colors[0];
  let bestDist = Infinity;

  for (const c of palette.colors) {
    const r2 = parseInt(c.slice(1, 3), 16);
    const g2 = parseInt(c.slice(3, 5), 16);
    const b2 = parseInt(c.slice(5, 7), 16);
    const dist = Math.hypot(r1 - r2, g1 - g2, b1 - b2);
    if (dist < bestDist) {
      bestDist = dist;
      bestColor = c;
    }
  }

  return bestColor;
}

/**
 * Apply palette constraint to a grid: snap all colors to the allowed palette.
 */
export function applyPaletteConstraint(grid: PixelGrid, gridSize: number, palette: PaletteAnalysis): PixelGrid {
  const result = grid.map(row => [...row]);
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const color = result[y]?.[x];
      if (color) {
        result[y][x] = snapToPalette(color, palette);
      }
    }
  }
  return result;
}

/**
 * Clamp a coordinate to grid bounds.
 */
export function clampToGrid(value: number, gridSize: number): number {
  return Math.max(0, Math.min(gridSize - 1, Math.round(value)));
}

/**
 * Apply displacement constraint: limit how far a pixel can move.
 */
export function constrainDisplacement(
  dx: number,
  dy: number,
  maxDisplacement: number,
): { dx: number; dy: number } {
  const dist = Math.hypot(dx, dy);
  if (dist <= maxDisplacement) return { dx, dy };
  const scale = maxDisplacement / dist;
  return { dx: Math.round(dx * scale), dy: Math.round(dy * scale) };
}

/**
 * Fill single-pixel gaps in a grid (outline preservation).
 * If a pixel has colored neighbors on opposite sides but is empty, fill with the dominant neighbor color.
 */
export function fillGaps(grid: PixelGrid, gridSize: number): PixelGrid {
  const result = grid.map(row => [...row]);

  for (let y = 1; y < gridSize - 1; y++) {
    for (let x = 1; x < gridSize - 1; x++) {
      if (result[y][x]) continue;

      const left = result[y][x - 1];
      const right = result[y][x + 1];
      const up = result[y - 1][x];
      const down = result[y + 1][x];

      // Horizontal gap
      if (left && left === right) {
        result[y][x] = left;
        continue;
      }
      // Vertical gap
      if (up && up === down) {
        result[y][x] = up;
        continue;
      }
      // Diagonal bridge (2 of 4 neighbors same color)
      const neighbors = [left, right, up, down].filter(Boolean) as string[];
      if (neighbors.length >= 3) {
        const counts = new Map<string, number>();
        for (const n of neighbors) counts.set(n, (counts.get(n) ?? 0) + 1);
        for (const [color, count] of counts) {
          if (count >= 2) {
            result[y][x] = color;
            break;
          }
        }
      }
    }
  }

  return result;
}

/**
 * Apply all constraints to an interpolated grid.
 */
export function applyConstraints(
  grid: PixelGrid,
  gridSize: number,
  constraints: TweenConstraints,
  sourcePalette?: PaletteAnalysis,
): PixelGrid {
  let result = grid;

  if (constraints.gridSnap) {
    // Grid snap is implicit in pixel art (integer coords), but ensure no fractional values
    result = result.map(row => row.map(c => c ?? null));
  }

  if (constraints.paletteLock && sourcePalette) {
    result = applyPaletteConstraint(result, gridSize, sourcePalette);
  }

  if (constraints.preserveOutline) {
    result = fillGaps(result, gridSize);
  }

  return result;
}
