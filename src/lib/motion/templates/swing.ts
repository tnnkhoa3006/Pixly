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

    for (let i = 0; i < frameCount; i++) {
      const t = pingPong(easingFn(i / Math.max(1, frameCount - 1)));
      // Swing angle: -intensity to +intensity degrees
      const angle = (t - 0.5) * 2 * intensity * 5; // ±5° per intensity unit

      const grid = applySwingTransform(
        sourceGrid, gridSize,
        centerX, centerY, angle,
      );

      results.push({ grid, opacity: 0.5, tint: '#7c3aed' });
    }

    return results;
  },
};

function applySwingTransform(
  source: PixelGrid,
  gridSize: number,
  pivotX: number,
  pivotY: number,
  angleDeg: number,
): PixelGrid {
  const result = createEmptyGrid(gridSize);
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const color = source[y]?.[x];
      if (!color) continue;

      const dx = x - pivotX;
      const dy = y - pivotY;
      const nx = Math.round(pivotX + dx * cos - dy * sin);
      const ny = Math.round(pivotY + dx * sin + dy * cos);

      if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
        result[ny][nx] = color;
      }
    }
  }

  return result;
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
