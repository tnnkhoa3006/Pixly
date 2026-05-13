import type { Frame, PixelGrid } from '../../../types';
import type { MotionTemplate, MotionConfig, SuggestionFrame } from '../types';
import { getEasing } from '../easing';
import { createEmptyGrid } from '../../frameHelpers';

export const fireTemplate: MotionTemplate = {
  id: 'fire',
  name: 'Fire',
  description: 'Upward flicker + palette cycling — great for torches, flames',
  icon: 'Flame',
  defaultConfig: {
    frameCount: 4,
    intensity: 1.5,
    easing: 'linear',
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

    const colorSet = new Set<string>();
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const c = sourceGrid[y]?.[x];
        if (c) colorSet.add(c);
      }
    }
    const palette = [...colorSet].map(hex => ({
      hex,
      brightness: getBrightness(hex),
    })).sort((a, b) => a.brightness - b.brightness);

    if (palette.length === 0) return [];

    const frameCount = Math.max(1, Math.min(8, config.frameCount));
    const intensity = Math.max(0.5, Math.min(3, config.intensity));

    // Precompute palette lookup for fast cycling
    const paletteMap = new Map<string, string>();
    for (let i = 0; i < palette.length; i++) {
      paletteMap.set(palette[i].hex, palette[i].hex);
    }

    for (let i = 0; i < frameCount; i++) {
      const t = easingFn(i / Math.max(1, frameCount - 1));
      const grid = cloneGrid(sourceGrid, gridSize);

      const drift = Math.round(intensity * t);
      const cycleOffset = Math.floor(t * palette.length * 0.5);

      // Build cycled palette map for this frame
      const cycledMap = new Map<string, string>();
      for (let j = 0; j < palette.length; j++) {
        const targetIdx = Math.min(palette.length - 1, j + cycleOffset);
        cycledMap.set(palette[j].hex, palette[targetIdx].hex);
      }

      // Apply upward drift: shift pixels up, keep base
      if (drift > 0) {
        const shifted = createEmptyGrid(gridSize);

        // Write shifted pixels (top portion rises)
        for (let y = 0; y < gridSize; y++) {
          for (let x = 0; x < gridSize; x++) {
            const color = sourceGrid[y]?.[x];
            if (!color) continue;

            const newY = y - drift;
            if (newY >= 0 && newY < gridSize) {
              // Apply palette cycling to shifted pixels
              const cycledColor = cycledMap.get(color) ?? color;

              // Horizontal jitter for flame tips (upper 30%)
              const hash = ((x * 31 + y * 17 + i * 7919) % 100) / 100;
              const jitterX = y < gridSize * 0.3 && hash < 0.3 * intensity
                ? Math.round((hash - 0.15) * 2)
                : 0;
              const newX = Math.max(0, Math.min(gridSize - 1, x + jitterX));

              if (!shifted[newY][newX]) {
                shifted[newY][newX] = cycledColor;
              }
            }
          }
        }

        // Keep original pixels at the base (bottom) as anchor
        for (let y = 0; y < gridSize; y++) {
          for (let x = 0; x < gridSize; x++) {
            if (!shifted[y]?.[x] && sourceGrid[y]?.[x]) {
              shifted[y][x] = sourceGrid[y][x];
            }
          }
        }

        results.push({ grid: shifted, opacity: 0.5, tint: '#7c3aed' });
      } else {
        // No drift — just apply palette cycling in-place
        for (let y = 0; y < gridSize; y++) {
          for (let x = 0; x < gridSize; x++) {
            const color = grid[y]?.[x];
            if (color) {
              grid[y][x] = cycledMap.get(color) ?? color;
            }
          }
        }
        results.push({ grid, opacity: 0.5, tint: '#7c3aed' });
      }
    }

    return results;
  },
};

function getBrightness(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return r * 0.299 + g * 0.587 + b * 0.114;
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

function cloneGrid(grid: PixelGrid, gridSize: number): PixelGrid {
  const clone = createEmptyGrid(gridSize);
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      clone[y][x] = grid[y]?.[x] ?? null;
    }
  }
  return clone;
}
