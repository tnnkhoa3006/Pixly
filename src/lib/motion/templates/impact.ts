import type { Frame, PixelGrid } from '../../../types';
import type { MotionTemplate, MotionConfig, SuggestionFrame } from '../types';
import { getEasing } from '../easing';
import { createEmptyGrid } from '../../frameHelpers';

export const impactTemplate: MotionTemplate = {
  id: 'impact',
  name: 'Impact',
  description: 'Shake + smear — great for hits, explosions, landing',
  icon: 'Target',
  defaultConfig: {
    frameCount: 4,
    intensity: 2,
    easing: 'easeOut',
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

    const frameCount = Math.max(1, Math.min(8, config.frameCount));
    const intensity = Math.max(0.5, Math.min(4, config.intensity));

    const shakePattern = [1, -1, 0.5, 0];

    for (let i = 0; i < frameCount; i++) {
      const t = easingFn(i / Math.max(1, frameCount - 1));
      const shakeIdx = Math.min(i, shakePattern.length - 1);
      const shakeAmount = shakePattern[shakeIdx] * intensity * (1 - t);
      const offset = Math.round(shakeAmount);

      if (offset === 0) {
        // No shake — copy original
        results.push({ grid: cloneGrid(sourceGrid, gridSize), opacity: 0.5, tint: '#7c3aed' });
        continue;
      }

      // Copy-based: start from source, shift pixels, fill gaps with smear
      const grid = createEmptyGrid(gridSize);

      // Write shifted pixels
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          const color = sourceGrid[y]?.[x];
          if (!color) continue;
          const nx = x + offset;
          if (nx >= 0 && nx < gridSize) {
            grid[y][nx] = color;
          }
        }
      }

      // Smear: fill gaps between original and shifted positions
      const sign = Math.sign(offset);
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          if (grid[y]?.[x]) continue; // already filled
          if (!sourceGrid[y]?.[x]) continue; // was empty originally

          // Check if this pixel is in the "smear zone" (between original and shifted)
          const shiftedX = x + offset;
          if (shiftedX < 0 || shiftedX >= gridSize) continue;

          // Fill with the color from the direction of shake
          const srcX = x - sign;
          if (srcX >= 0 && srcX < gridSize && grid[y]?.[srcX]) {
            grid[y][x] = grid[y][srcX];
          }
        }
      }

      results.push({ grid, opacity: 0.5, tint: '#7c3aed' });
    }

    return results;
  },
};

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
