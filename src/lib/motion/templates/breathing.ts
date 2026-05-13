import type { Frame, PixelGrid } from '../../../types';
import type { MotionTemplate, MotionConfig, SuggestionFrame } from '../types';
import { getEasing, pingPong } from '../easing';
import { analyzeSprite } from '../regionDetect';
import { healMotionGaps } from '../gapFill';
import { createEmptyGrid } from '../../frameHelpers';

export const breathingTemplate: MotionTemplate = {
  id: 'breathing',
  name: 'Breathing',
  description: 'Subtle expand/shift — head & chest rise, legs anchor',
  icon: 'Wind',
  defaultConfig: {
    frameCount: 3,
    intensity: 1,
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
    const intensity = Math.max(0.1, Math.min(3, config.intensity));

    // Precompute per-pixel offset map
    const pixelOffsets = new Map<string, number>(); // "x,y" → dy offset

    for (const region of analysis.regions) {
      const baseOffset = getRegionBaseOffset(region.verticalZone, region.regionType, intensity);
      for (const p of region.pixels) {
        pixelOffsets.set(`${p.x},${p.y}`, baseOffset);
      }
    }

    for (let i = 0; i < frameCount; i++) {
      const t = pingPong(easingFn(i / Math.max(1, frameCount - 1)));

      // Build new grid: copy-based, no gaps
      const grid = createEmptyGrid(gridSize);

      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          const color = sourceGrid[y]?.[x];
          if (!color) continue;

          const baseOffset = pixelOffsets.get(`${x},${y}`) ?? 0;
          const dy = Math.round(baseOffset * t);
          const newY = y + dy;

          if (newY >= 0 && newY < gridSize) {
            // Only write if target is empty (first writer wins = back-to-front)
            if (!grid[newY][x]) {
              grid[newY][x] = color;
            }
          }
        }
      }

      results.push({ grid: healMotionGaps(grid, sourceGrid, gridSize), opacity: 0.5, tint: '#7c3aed' });
    }

    return results;
  },
};

function getRegionBaseOffset(
  zone: 'upper' | 'middle' | 'lower',
  type: string,
  intensity: number,
): number {
  if (zone === 'upper') {
    if (type === 'head') return -intensity;
    if (type === 'arm') return -intensity * 0.7;
    return -intensity * 0.5;
  }
  if (zone === 'middle') {
    if (type === 'body') return -intensity * 0.4;
    return -intensity * 0.3;
  }
  if (zone === 'lower') {
    if (type === 'leg') return intensity * 0.2;
    return 0;
  }
  return 0;
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
