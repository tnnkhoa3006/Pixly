import type { Frame, PixelGrid } from '../../../types';
import type { MotionTemplate, MotionConfig, SuggestionFrame } from '../types';

import { createEmptyGrid } from '../../frameHelpers';

export const flickerTemplate: MotionTemplate = {
  id: 'flicker',
  name: 'Flicker',
  description: 'Palette jitter — great for fire, magic, electricity',
  icon: 'Zap',
  defaultConfig: {
    frameCount: 4,
    intensity: 1,
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

    // Collect all unique colors in the sprite
    const colors = new Set<string>();
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const c = sourceGrid[y]?.[x];
        if (c) colors.add(c);
      }
    }
    const colorArray = [...colors];
    if (colorArray.length === 0) return [];

    const frameCount = Math.max(1, Math.min(8, config.frameCount));
    const intensity = Math.max(0.1, Math.min(2, config.intensity));

    // Build color swap map from palette analysis
    const sortedColors = colorArray.map(hex => ({
      hex,
      brightness: getBrightness(hex),
    })).sort((a, b) => a.brightness - b.brightness);

    for (let i = 0; i < frameCount; i++) {
      const grid = cloneGrid(sourceGrid, gridSize);

      // Jitter: swap some adjacent-brightness colors randomly
      const swapChance = intensity * 0.3;
      const seed = i * 7919; // deterministic pseudo-random

      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          const color = grid[y]?.[x];
          if (!color) continue;

          const idx = sortedColors.findIndex(c => c.hex === color);
          if (idx < 0) continue;

          // Deterministic random based on position + frame
          const hash = ((x * 31 + y * 17 + seed) % 100) / 100;

          if (hash < swapChance && sortedColors.length > 1) {
            // Swap with adjacent brightness color
            const direction = hash < swapChance / 2 ? 1 : -1;
            const targetIdx = Math.max(0, Math.min(sortedColors.length - 1, idx + direction));
            if (targetIdx !== idx) {
              grid[y][x] = sortedColors[targetIdx].hex;
            }
          }
        }
      }

      results.push({ grid, opacity: 0.5, tint: '#7c3aed' });
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
