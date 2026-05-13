import type { Frame, PixelGrid } from '../../../types';
import type { MotionTemplate, MotionConfig, SuggestionFrame } from '../types';
import { getEasing } from '../easing';
import { analyzeSprite } from '../regionDetect';
import { healMotionGaps } from '../gapFill';
import { createEmptyGrid } from '../../frameHelpers';

export const bounceTemplate: MotionTemplate = {
  id: 'bounce',
  name: 'Bounce',
  description: 'Squash & stretch — legs compress, body follows, head leads',
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
    const analysis = analyzeSprite(sourceGrid, gridSize);
    const easingFn = getEasing(config.easing);

    const frameCount = Math.max(1, Math.min(8, config.frameCount));
    const intensity = Math.max(0.5, Math.min(4, config.intensity));

    for (let i = 0; i < frameCount; i++) {
      const t = easingFn(i / Math.max(1, frameCount - 1));

      // Bounce curve: down then up
      let phase: number;
      let direction: number;
      if (t < 0.5) {
        phase = t / 0.5;
        direction = -1;
      } else {
        phase = (t - 0.5) / 0.5;
        direction = 1;
      }

      // Build transform params per region
      const regionTransforms = new Map<string, {
        yOffset: number;
        xScale: number;
        yScale: number;
        centerX: number;
        centerY: number;
      }>();

      for (const region of analysis.regions) {
        regionTransforms.set(region.id, {
          yOffset: getBounceYOffset(region, intensity, phase, direction),
          xScale: getBounceXScale(region, phase, direction),
          yScale: getBounceYScale(region, phase, direction),
          centerX: region.center.x,
          centerY: region.center.y,
        });
      }

      // Build per-pixel transform lookup
      const pixelTransforms = new Map<string, { dx: number; dy: number }>();

      for (const region of analysis.regions) {
        const xf = regionTransforms.get(region.id)!;
        for (const p of region.pixels) {
          const relX = p.x - xf.centerX;
          const relY = p.y - xf.centerY;
          const nx = Math.round(xf.centerX + relX * xf.xScale);
          const ny = Math.round(xf.centerY + relY * xf.yScale + xf.yOffset);
          pixelTransforms.set(`${p.x},${p.y}`, { dx: nx - p.x, dy: ny - p.y });
        }
      }

      // Copy-based rendering: write to new grid, no gaps
      const grid = createEmptyGrid(gridSize);

      // Process pixels back-to-front (bottom rows first) so upper body draws on top
      for (let y = gridSize - 1; y >= 0; y--) {
        for (let x = 0; x < gridSize; x++) {
          const color = sourceGrid[y]?.[x];
          if (!color) continue;

          const xf = pixelTransforms.get(`${x},${y}`);
          const nx = x + (xf?.dx ?? 0);
          const ny = y + (xf?.dy ?? 0);

          if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
            if (!grid[ny][nx]) {
              grid[ny][nx] = color;
            }
          }
        }
      }

      results.push({ grid: healMotionGaps(grid, sourceGrid, gridSize), opacity: 0.5, tint: '#7c3aed' });
    }

    return results;
  },
};

function getBounceYOffset(
  region: { verticalZone: string },
  intensity: number,
  phase: number,
  direction: number,
): number {
  const base = intensity * phase;

  if (direction < 0) {
    if (region.verticalZone === 'lower') return Math.round(base * 1.2);
    if (region.verticalZone === 'middle') return Math.round(base * 0.8);
    return Math.round(base * 0.4);
  } else {
    if (region.verticalZone === 'upper') return Math.round(-base * 1.2);
    if (region.verticalZone === 'middle') return Math.round(-base * 0.8);
    return Math.round(-base * 0.3);
  }
}

function getBounceXScale(
  region: { verticalZone: string },
  phase: number,
  direction: number,
): number {
  const squash = 0.1 * phase;

  if (direction < 0) {
    if (region.verticalZone === 'lower') return 1 + squash * 1.2;
    if (region.verticalZone === 'middle') return 1 + squash * 0.8;
    return 1 + squash * 0.3;
  } else {
    if (region.verticalZone === 'lower') return 1 - squash * 0.5;
    return 1;
  }
}

function getBounceYScale(
  region: { verticalZone: string },
  phase: number,
  direction: number,
): number {
  const amount = 0.15 * phase;

  if (direction < 0) {
    if (region.verticalZone === 'lower') return 1 - amount * 1.2;
    if (region.verticalZone === 'middle') return 1 - amount * 0.6;
    return 1 - amount * 0.2;
  } else {
    if (region.verticalZone === 'upper') return 1 + amount * 1.2;
    if (region.verticalZone === 'middle') return 1 + amount * 0.6;
    return 1 + amount * 0.2;
  }
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
