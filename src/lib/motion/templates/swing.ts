import type { Frame, PixelGrid } from '../../../types';
import type { MotionTemplate, MotionConfig, SuggestionFrame } from '../types';
import { getEasing, pingPong } from '../easing';
import { createEmptyGrid } from '../../frameHelpers';

export const swingTemplate: MotionTemplate = {
  id: 'swing',
  name: 'Swing',
  description: 'Pendulum arc motion — great for capes, tails, weapons',
  icon: 'RotateCcw',
  defaultConfig: {
    frameCount: 4,
    intensity: 2,
    easing: 'easeInOut',
  },

  generate(
    startFrame: Frame,
    _endFrame: Frame | null,
    config: MotionConfig,
    gridSize: number,
  ): SuggestionFrame[] {
    const results: SuggestionFrame[] = [];
    const sourceGrid = getMergedGrid(startFrame, gridSize);
    const easingFn = getEasing(config.easing);

    // Find sprite bounding box
    let minX = gridSize, maxX = 0, minY = gridSize, maxY = 0;
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        if (sourceGrid[y]?.[x]) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (minX > maxX || minY > maxY) return [];

    const centerX = (minX + maxX) / 2;
    const centerY = minY; // pivot at top

    const frameCount = Math.max(1, Math.min(8, config.frameCount));
    const intensity = Math.max(0.5, Math.min(4, config.intensity));

    // Precompute pixel positions for rotation
    const pixels: { x: number; y: number; color: string }[] = [];
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const color = sourceGrid[y]?.[x];
        if (color) pixels.push({ x, y, color });
      }
    }

    for (let i = 0; i < frameCount; i++) {
      const t = pingPong(easingFn(i / Math.max(1, frameCount - 1)));
      const angle = (t - 0.5) * 2 * intensity * 5;

      const grid = cloneGrid(sourceGrid, gridSize);
      const rad = (angle * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      // Clear only the pixels that will move
      for (const p of pixels) {
        grid[p.y][p.x] = null;
      }

      // Write rotated pixels to new positions
      for (const p of pixels) {
        const dx = p.x - centerX;
        const dy = p.y - centerY;
        const nx = Math.round(centerX + dx * cos - dy * sin);
        const ny = Math.round(centerY + dx * sin + dy * cos);

        if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
          if (!grid[ny][nx]) {
            grid[ny][nx] = p.color;
          }
        }
      }

      // Fill gaps: for any null pixel that was originally filled,
      // copy from nearest filled neighbor in the result
      fillGaps(grid, sourceGrid, gridSize);

      results.push({ grid, opacity: 0.5, tint: '#7c3aed' });
    }

    return results;
  },
};

function fillGaps(grid: PixelGrid, source: PixelGrid, gridSize: number): void {
  // For each pixel that was originally filled but is now empty,
  // look at its neighbors in the result grid
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (!source[y]?.[x]) continue; // was already empty
      if (grid[y]?.[x]) continue;    // already filled

      // Find nearest non-null neighbor in result grid
      for (let r = 1; r <= 2; r++) {
        let found = false;
        for (const [dx, dy] of [[0, -r], [0, r], [-r, 0], [r, 0]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize && grid[ny]?.[nx]) {
            grid[y][x] = grid[ny][nx];
            found = true;
            break;
          }
        }
        if (found) break;
      }
    }
  }
}

function cloneGrid(grid: PixelGrid, gridSize: number): PixelGrid {
  const clone = createEmptyGrid(gridSize);
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      clone[y][x] = grid[y]?.[x] ?? null;
    }
  }
  return clone;
}

function getMergedGrid(frame: Frame, gridSize: number): PixelGrid {
  const merged = createEmptyGrid(gridSize);
  for (const layer of frame.layers) {
    if (!layer.visible) continue;
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const color = layer.grid[y]?.[x];
        if (color) merged[y][x] = color;
      }
    }
  }
  return merged;
}
