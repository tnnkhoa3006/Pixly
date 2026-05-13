import type { Frame, PixelGrid } from '../../types';
import type {
  SuggestionFrame,
  InterpolationConfig,
  TweenConstraints,
  SpriteAnalysis,
  RegionMatch,
  PixelCorrespondence,
  PaletteAnalysis,
} from './types';
import { analyzeSprite } from './regionDetect';
import { matchRegions } from './regionMatch';
import { getEasing } from './easing';
import { createEmptyGrid } from '../frameHelpers';
import { extractPalette, applyConstraints, clampToGrid, constrainDisplacement, getDefaultConstraints } from './constraints';

const DEFAULT_INTERP_CONFIG: InterpolationConfig = {
  frameCount: 4,
  easing: 'easeInOut',
  useRegionMatching: true,
  constraints: getDefaultConstraints(),
};

/**
 * Generate interpolated frames between a start and end keyframe.
 * Uses region-aware pixel correspondence for intelligent in-betweening.
 */
export function interpolateKeyframes(
  startFrame: Frame,
  endFrame: Frame,
  config: Partial<InterpolationConfig>,
  gridSize: number,
): SuggestionFrame[] {
  const mergedConfig = { ...DEFAULT_INTERP_CONFIG, ...config };
  const constraints = mergedConfig.constraints;

  const startGrid = getMergedGrid(startFrame, gridSize);
  const endGrid = getMergedGrid(endFrame, gridSize);

  const startAnalysis = analyzeSprite(startGrid, gridSize);
  const endAnalysis = analyzeSprite(endGrid, gridSize);

  // Extract palette from both frames for constraint enforcement
  const startPalette = extractPalette(startGrid, gridSize);
  const endPalette = extractPalette(endGrid, gridSize);
  const combinedPalette: PaletteAnalysis = {
    colors: [...new Set([...startPalette.colors, ...endPalette.colors])],
    colorFrequency: new Map([
      ...startPalette.colorFrequency,
      ...endPalette.colorFrequency,
    ]),
    primaryColors: [...new Set([...startPalette.primaryColors, ...endPalette.primaryColors])],
  };

  // Build pixel correspondences
  let correspondences: PixelCorrespondence[];

  if (mergedConfig.useRegionMatching) {
    correspondences = buildRegionAwareCorrespondences(
      startGrid, endGrid, startAnalysis, endAnalysis, gridSize, constraints,
    );
  } else {
    correspondences = buildDirectCorrespondences(startGrid, endGrid, gridSize);
  }

  // Generate intermediate frames
  const results: SuggestionFrame[] = [];
  const frameCount = Math.max(1, Math.min(8, mergedConfig.frameCount));
  const easingFn = getEasing(mergedConfig.easing);

  for (let i = 0; i < frameCount; i++) {
    const rawT = i / Math.max(1, frameCount - 1);
    const t = easingFn(rawT);

    const grid = interpolateFrame(
      startGrid, endGrid, correspondences, t, gridSize, constraints,
    );

    // Apply constraints (palette lock, gap fill)
    const constrained = applyConstraints(grid, gridSize, constraints, combinedPalette);

    results.push({ grid: constrained, opacity: 0.5, tint: '#7c3aed' });
  }

  return results;
}

/**
 * Build pixel correspondences using region matching.
 * Pixels in matched regions are corresponded by relative position within the region.
 * Unmatched pixels use nearest-neighbor matching.
 */
function buildRegionAwareCorrespondences(
  startGrid: PixelGrid,
  endGrid: PixelGrid,
  startAnalysis: SpriteAnalysis,
  endAnalysis: SpriteAnalysis,
  gridSize: number,
  constraints: TweenConstraints,
): PixelCorrespondence[] {
  const correspondences: PixelCorrespondence[] = [];
  const matched = new Set<string>(); // "x,y" of start pixels already matched

  const regionMatches = matchRegions(startAnalysis, endAnalysis);

  // For each matched region pair, build pixel-level correspondences
  for (const rm of regionMatches) {
    const regionCorrespondences = buildRegionPairCorrespondences(
      startGrid, endGrid, rm, gridSize, constraints,
    );
    for (const c of regionCorrespondences) {
      correspondences.push(c);
      matched.add(`${c.startX},${c.startY}`);
    }
  }

  // Match remaining start pixels to nearest end pixel by color
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const color = startGrid[y]?.[x];
      if (!color || matched.has(`${x},${y}`)) continue;

      const nearest = findNearestColorPixel(endGrid, x, y, color, gridSize, constraints.maxDisplacement * 2);
      if (nearest) {
        correspondences.push({
          startX: x, startY: y,
          endX: nearest.x, endY: nearest.y,
          color,
        });
      } else {
        // No match found — pixel stays in place (will fade out)
        correspondences.push({
          startX: x, startY: y,
          endX: x, endY: y,
          color,
        });
      }
    }
  }

  // Add end pixels that weren't matched (they fade in)
  const endMatched = new Set(correspondences.map(c => `${c.endX},${c.endY}`));
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const color = endGrid[y]?.[x];
      if (!color || endMatched.has(`${x},${y}`)) continue;
      // These pixels appear from nearest start position
      const nearest = findNearestColorPixel(startGrid, x, y, color, gridSize, constraints.maxDisplacement * 2);
      if (nearest) {
        correspondences.push({
          startX: nearest.x, startY: nearest.y,
          endX: x, endY: y,
          color,
        });
      }
    }
  }

  return correspondences;
}

/**
 * Build pixel correspondences within a matched region pair.
 * Uses relative position within each region's bounding box.
 */
function buildRegionPairCorrespondences(
  startGrid: PixelGrid,
  endGrid: PixelGrid,
  match: RegionMatch,
  gridSize: number,
  constraints: TweenConstraints,
): PixelCorrespondence[] {
  const { startRegion, endRegion } = match;
  const correspondences: PixelCorrespondence[] = [];

  // Build a lookup of end region pixels by relative position
  const endBB = endRegion.boundingBox;
  const startBB = startRegion.boundingBox;

  // Map each start pixel to the best matching end pixel
  for (const sp of startRegion.pixels) {
    const color = startGrid[sp.y]?.[sp.x];
    if (!color) continue;

    // Find corresponding position in end region (proportional mapping)
    const relX = startBB.width > 1 ? (sp.x - startBB.x) / (startBB.width - 1) : 0.5;
    const relY = startBB.height > 1 ? (sp.y - startBB.y) / (startBB.height - 1) : 0.5;

    const targetX = Math.round(endBB.x + relX * Math.max(0, endBB.width - 1));
    const targetY = Math.round(endBB.y + relY * Math.max(0, endBB.height - 1));

    // Find nearest actual end pixel to the target position with same or similar color
    let bestX = targetX;
    let bestY = targetY;
    let bestDist = Infinity;

    for (const ep of endRegion.pixels) {
      const endColor = endGrid[ep.y]?.[ep.x];
      if (!endColor) continue;

      const dist = Math.hypot(ep.x - targetX, ep.y - targetY);
      const colorBonus = endColor === color ? 0 : 2;
      const totalDist = dist + colorBonus;

      if (totalDist < bestDist) {
        bestDist = totalDist;
        bestX = ep.x;
        bestY = ep.y;
      }
    }

    // Apply displacement constraint
    let dx = bestX - sp.x;
    let dy = bestY - sp.y;
    const constrained = constrainDisplacement(dx, dy, constraints.maxDisplacement);

    correspondences.push({
      startX: sp.x,
      startY: sp.y,
      endX: clampToGrid(sp.x + constrained.dx, gridSize),
      endY: clampToGrid(sp.y + constrained.dy, gridSize),
      color,
    });
  }

  return correspondences;
}

/**
 * Find the nearest pixel of a given color within a search radius.
 */
function findNearestColorPixel(
  grid: PixelGrid,
  x: number,
  y: number,
  targetColor: string,
  gridSize: number,
  radius: number,
): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestDist = Infinity;

  const r = Math.ceil(radius);
  const minY = Math.max(0, y - r);
  const maxY = Math.min(gridSize - 1, y + r);
  const minX = Math.max(0, x - r);
  const maxX = Math.min(gridSize - 1, x + r);

  for (let py = minY; py <= maxY; py++) {
    for (let px = minX; px <= maxX; px++) {
      if (grid[py]?.[px] === targetColor) {
        const dist = Math.hypot(px - x, py - y);
        if (dist < bestDist) {
          bestDist = dist;
          best = { x: px, y: py };
        }
      }
    }
  }

  return best;
}

/**
 * Build simple direct correspondences (nearest pixel of same color).
 * Used as fallback when region matching is disabled.
 */
function buildDirectCorrespondences(
  startGrid: PixelGrid,
  endGrid: PixelGrid,
  gridSize: number,
): PixelCorrespondence[] {
  const correspondences: PixelCorrespondence[] = [];

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const color = startGrid[y]?.[x];
      if (!color) continue;

      const nearest = findNearestColorPixel(endGrid, x, y, color, gridSize, gridSize);
      correspondences.push({
        startX: x, startY: y,
        endX: nearest?.x ?? x,
        endY: nearest?.y ?? y,
        color,
      });
    }
  }

  return correspondences;
}

/**
 * Interpolate a single frame at parameter t ∈ [0, 1].
 */
function interpolateFrame(
  startGrid: PixelGrid,
  endGrid: PixelGrid,
  correspondences: PixelCorrespondence[],
  t: number,
  gridSize: number,
  constraints: TweenConstraints,
): PixelGrid {
  const grid = createEmptyGrid(gridSize);

  // Sort correspondences by Y (bottom-to-top) for proper layering
  const sorted = [...correspondences].sort((a, b) => b.startY - a.startY);

  for (const c of sorted) {
    // Linear interpolation of position
    let ix: number;
    let iy: number;

    if (constraints.gridSnap) {
      ix = Math.round(c.startX + (c.endX - c.startX) * t);
      iy = Math.round(c.startY + (c.endY - c.startY) * t);
    } else {
      ix = c.startX + (c.endX - c.startX) * t;
      iy = c.startY + (c.endY - c.startY) * t;
    }

    ix = clampToGrid(ix, gridSize);
    iy = clampToGrid(iy, gridSize);

    // First writer wins (back-to-front priority)
    if (!grid[iy][ix]) {
      grid[iy][ix] = c.color;
    }
  }

  // Fill gaps left by pixel movement
  return fillMovementGaps(grid, startGrid, endGrid, t, gridSize);
}

/**
 * Fill single-pixel gaps created by pixels moving apart.
 */
function fillMovementGaps(
  grid: PixelGrid,
  _startGrid: PixelGrid,
  _endGrid: PixelGrid,
  _t: number,
  gridSize: number,
): PixelGrid {
  const result = grid.map(row => [...row]);

  for (let y = 1; y < gridSize - 1; y++) {
    for (let x = 1; x < gridSize - 1; x++) {
      if (result[y][x]) continue;

      const left = result[y][x - 1];
      const right = result[y][x + 1];
      const up = result[y - 1][x];
      const down = result[y + 1][x];

      // Fill if surrounded on opposite sides by same color
      if (left && left === right) {
        result[y][x] = left;
      } else if (up && up === down) {
        result[y][x] = up;
      }
      // Fill if 3+ neighbors share a color
      else {
        const neighbors = [left, right, up, down].filter(Boolean) as string[];
        if (neighbors.length >= 3) {
          const counts = new Map<string, number>();
          for (const n of neighbors) counts.set(n, (counts.get(n) ?? 0) + 1);
          for (const [color, count] of counts) {
            if (count >= 2) {
              result[y][x] = color;
              break;
            }
          }
        }
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
