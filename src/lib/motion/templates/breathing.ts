import type { Frame, PixelGrid } from '../../../types';
import type { MotionTemplate, MotionConfig, SuggestionFrame } from '../types';
import { getEasing, pingPong } from '../easing';
import { getOutlinePixels } from '../regionDetect';
import { createEmptyGrid } from '../../frameHelpers';

export const breathingTemplate: MotionTemplate = {
  id: 'breathing',
  name: 'Breathing',
  description: 'Subtle expand/shift to make sprites feel alive',
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
    const outline = getOutlinePixels(sourceGrid, gridSize);
    const easingFn = getEasing(config.easing);

    // Find vertical center of the sprite
    let sumY = 0;
    for (const p of outline) sumY += p.y;
    const centerY = outline.length > 0 ? sumY / outline.length : gridSize / 2;

    const frameCount = Math.max(1, Math.min(8, config.frameCount));
    const intensity = Math.max(0.1, Math.min(3, config.intensity));

    for (let i = 0; i < frameCount; i++) {
      const t = pingPong(easingFn(i / Math.max(1, frameCount - 1)));
      const offset = Math.round(intensity * t);

      const grid = cloneGrid(sourceGrid, gridSize);

      // Shift outline pixels: upper half moves up, lower half moves down
      // This creates a subtle "expand" breathing effect
      const shifted = new Set<string>();

      for (const p of outline) {
        const key = `${p.x},${p.y}`;
        if (shifted.has(key)) continue;

        const color = sourceGrid[p.y]?.[p.x];
        if (!color) continue;

        const isUpperHalf = p.y < centerY;
        const dy = isUpperHalf ? -offset : offset;

        const newY = p.y + dy;
        if (newY < 0 || newY >= gridSize) continue;

        // Only shift if target is empty
        if (!grid[newY]?.[p.x]) {
          grid[p.y][p.x] = null;
          grid[newY][p.x] = color;
          shifted.add(`${p.x},${newY}`);
        }
      }

      results.push({
        grid,
        opacity: 0.5,
        tint: '#7c3aed',
      });
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
