import type { Frame, PixelGrid } from '../../../types';
import type { MotionTemplate, MotionConfig, SuggestionFrame } from '../types';
import { getEasing } from '../easing';
import { createEmptyGrid } from '../../frameHelpers';

export const bounceTemplate: MotionTemplate = {
  id: 'bounce',
  name: 'Bounce',
  description: 'Squash & stretch with weight feeling',
  icon: 'ArrowDownUp',
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

    const spriteW = maxX - minX + 1;
    const spriteH = maxY - minY + 1;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const frameCount = Math.max(1, Math.min(8, config.frameCount));
    const intensity = Math.max(0.5, Math.min(4, config.intensity));

    for (let i = 0; i < frameCount; i++) {
      const t = easingFn(i / Math.max(1, frameCount - 1));

      // Bounce curve: go down then up
      let yOffset: number;
      let yScale: number;
      let xScale: number;

      if (t < 0.5) {
        // Going down — squash
        const phase = t / 0.5;
        yOffset = Math.round(intensity * phase);
        yScale = 1 - 0.15 * phase;
        xScale = 1 + 0.1 * phase;
      } else {
        // Going up — stretch
        const phase = (t - 0.5) / 0.5;
        yOffset = Math.round(intensity * (1 - phase));
        yScale = 1 + 0.1 * phase;
        xScale = 1 - 0.05 * phase;
      }

      const grid = applyBounceTransform(
        sourceGrid, gridSize,
        minX, minY, maxX, maxY,
        spriteW, spriteH,
        centerX, centerY,
        yOffset, xScale, yScale,
      );

      results.push({
        grid,
        opacity: 0.5,
        tint: '#7c3aed',
      });
    }

    return results;
  },
};

function applyBounceTransform(
  source: PixelGrid,
  gridSize: number,
  minX: number, minY: number,
  maxX: number, maxY: number,
  _spriteW: number, _spriteH: number,
  centerX: number, centerY: number,
  yOffset: number,
  xScale: number,
  yScale: number,
): PixelGrid {
  const result = createEmptyGrid(gridSize);

  for (let sy = minY; sy <= maxY; sy++) {
    for (let sx = minX; sx <= maxX; sx++) {
      const color = source[sy]?.[sx];
      if (!color) continue;

      // Transform relative to sprite center
      const relX = sx - centerX;
      const relY = sy - centerY;

      // Apply scale
      let nx = Math.round(centerX + relX * xScale);
      let ny = Math.round(centerY + relY * yScale);

      // Apply vertical offset (bounce)
      ny += yOffset;

      // Clamp to grid
      if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize) continue;

      result[ny][nx] = color;
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
