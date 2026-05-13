import type { Frame, PixelGrid } from '../../types';
import type { SpriteAnalysis, TemplateScore } from './types';
import { analyzeSprite } from './regionDetect';
import { getAllTemplates } from './templates';
import { createEmptyGrid } from '../frameHelpers';

/**
 * Analyze a sprite and score which motion templates best fit it.
 * Returns sorted list of template recommendations.
 */
export function suggestTemplates(
  frame: Frame,
  gridSize: number,
): TemplateScore[] {
  const mergedGrid = getMergedGrid(frame, gridSize);
  const analysis = analyzeSprite(mergedGrid, gridSize);
  const templates = getAllTemplates();

  return templates
    .map(t => ({
      templateId: t.id,
      ...scoreTemplate(t.id, analysis, mergedGrid, gridSize),
    }))
    .sort((a, b) => b.score - a.score);
}

function scoreTemplate(
  templateId: string,
  analysis: SpriteAnalysis,
  grid: PixelGrid,
  gridSize: number,
): { score: number; reason: string } {
  const { regions, totalBounds, centerOfMass } = analysis;
  const hasHead = regions.some(r => r.regionType === 'head');
  const hasBody = regions.some(r => r.regionType === 'body');
  const hasLegs = regions.some(r => r.regionType === 'leg');
  const hasArms = regions.some(r => r.regionType === 'arm');
  const regionCount = regions.length;

  switch (templateId) {
    case 'breathing': {
      // Good for humanoid sprites with head + body + legs
      let score = 0;
      const reasons: string[] = [];
      if (hasHead && hasBody) { score += 0.4; reasons.push('head+body detected'); }
      if (hasLegs) { score += 0.2; reasons.push('legs anchor well'); }
      if (regionCount >= 3) { score += 0.2; reasons.push('multi-region sprite'); }
      // Subtle motion suits larger sprites
      if (totalBounds.height > gridSize * 0.5) { score += 0.2; reasons.push('tall sprite'); }
      return { score: Math.min(1, score), reason: reasons.join(', ') || 'general purpose' };
    }

    case 'bounce': {
      let score = 0;
      const reasons: string[] = [];
      if (hasLegs) { score += 0.4; reasons.push('legs for squash-stretch'); }
      if (hasHead && hasBody) { score += 0.3; reasons.push('full body motion'); }
      // Compact sprites bounce better
      if (totalBounds.width > totalBounds.height * 0.5) { score += 0.15; reasons.push('compact shape'); }
      if (regionCount >= 2) { score += 0.15; reasons.push('multi-region'); }
      return { score: Math.min(1, score), reason: reasons.join(', ') || 'dynamic motion' };
    }

    case 'swing': {
      let score = 0;
      const reasons: string[] = [];
      // Good for sprites with accessories or elongated parts
      const hasAccessories = regions.some(r => r.regionType === 'accessory');
      if (hasAccessories) { score += 0.3; reasons.push('accessories to swing'); }
      // Asymmetric sprites
      const leftWeight = regions.filter(r => r.center.x < centerOfMass.x).length;
      const rightWeight = regions.filter(r => r.center.x >= centerOfMass.x).length;
      if (Math.abs(leftWeight - rightWeight) > 0) { score += 0.2; reasons.push('asymmetric layout'); }
      if (hasArms) { score += 0.2; reasons.push('arms can swing'); }
      // Narrow sprites swing well
      if (totalBounds.width < totalBounds.height) { score += 0.15; reasons.push('tall/narrow'); }
      return { score: Math.min(1, score), reason: reasons.join(', ') || 'pendulum motion' };
    }

    case 'flicker': {
      let score = 0;
      const reasons: string[] = [];
      // Check color diversity
      const colorSet = new Set<string>();
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          if (grid[y]?.[x]) colorSet.add(grid[y][x]!);
        }
      }
      if (colorSet.size >= 3) { score += 0.3; reasons.push('color diversity'); }
      // Small sprites flicker well (particles, effects)
      if (totalBounds.width < gridSize * 0.4 && totalBounds.height < gridSize * 0.4) {
        score += 0.3; reasons.push('small sprite');
      }
      // Few regions = simple shapes (fire, magic)
      if (regionCount <= 3) { score += 0.2; reasons.push('simple shape'); }
      return { score: Math.min(1, score), reason: reasons.join(', ') || 'palette effect' };
    }

    case 'impact': {
      let score = 0;
      const reasons: string[] = [];
      // Good for centered, compact sprites
      const centerDistX = Math.abs(centerOfMass.x - gridSize / 2) / gridSize;
      if (centerDistX < 0.15) { score += 0.3; reasons.push('centered sprite'); }
      if (hasBody) { score += 0.2; reasons.push('body for shake'); }
      // Medium-sized sprites
      const areaRatio = (totalBounds.width * totalBounds.height) / (gridSize * gridSize);
      if (areaRatio > 0.15 && areaRatio < 0.6) { score += 0.2; reasons.push('good size'); }
      if (regionCount >= 2) { score += 0.15; reasons.push('multi-region'); }
      return { score: Math.min(1, score), reason: reasons.join(', ') || 'impact effect' };
    }

    case 'fire': {
      let score = 0;
      const reasons: string[] = [];
      // Check for warm colors (red, orange, yellow)
      let warmPixels = 0;
      let totalPixels = 0;
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          const c = grid[y]?.[x];
          if (!c) continue;
          totalPixels++;
          const r = parseInt(c.slice(1, 3), 16);
          const g = parseInt(c.slice(3, 5), 16);
          const b = parseInt(c.slice(5, 7), 16);
          if (r > 150 && g < r && b < g * 0.7) warmPixels++;
        }
      }
      if (totalPixels > 0 && warmPixels / totalPixels > 0.3) {
        score += 0.5; reasons.push('warm colors detected');
      }
      // Elongated vertically (flame shape)
      if (totalBounds.height > totalBounds.width * 1.3) {
        score += 0.2; reasons.push('flame-like shape');
      }
      // Few regions
      if (regionCount <= 2) { score += 0.15; reasons.push('simple shape'); }
      return { score: Math.min(1, score), reason: reasons.join(', ') || 'fire effect' };
    }

    default:
      return { score: 0.1, reason: 'unknown template' };
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
