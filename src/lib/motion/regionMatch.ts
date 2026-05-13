import type { PixelRegion, RegionMatch, SpriteAnalysis } from './types';

/**
 * Match regions between two sprite analyses.
 * Uses position, size, color, and type similarity to find correspondences.
 */
export function matchRegions(
  startAnalysis: SpriteAnalysis,
  endAnalysis: SpriteAnalysis,
): RegionMatch[] {
  const matches: RegionMatch[] = [];
  const usedEnd = new Set<string>();
  const startRegions = getMatchableRegions(startAnalysis.regions);
  const endRegions = getMatchableRegions(endAnalysis.regions);

  // Score all pairs, then greedy-assign best matches
  const candidates: { start: PixelRegion; end: PixelRegion; score: number }[] = [];

  for (const start of startRegions) {
    for (const end of endRegions) {
      const score = computeRegionSimilarity(start, end, startAnalysis, endAnalysis);
      if (score > 0.2) {
        candidates.push({ start, end, score });
      }
    }
  }

  // Sort by score descending, greedy assign
  candidates.sort((a, b) => b.score - a.score);

  const usedStart = new Set<string>();
  for (const c of candidates) {
    if (usedStart.has(c.start.id) || usedEnd.has(c.end.id)) continue;
    usedStart.add(c.start.id);
    usedEnd.add(c.end.id);

    matches.push({
      startRegion: c.start,
      endRegion: c.end,
      similarity: c.score,
      offset: {
        dx: Math.round(c.end.center.x - c.start.center.x),
        dy: Math.round(c.end.center.y - c.start.center.y),
      },
    });
  }

  return matches;
}

function getMatchableRegions(regions: PixelRegion[]): PixelRegion[] {
  if (regions.length <= 256) return regions;
  return [...regions]
    .sort((a, b) => b.pixels.length - a.pixels.length)
    .slice(0, 256);
}

/**
 * Compute similarity between two regions (0-1).
 */
function computeRegionSimilarity(
  a: PixelRegion,
  b: PixelRegion,
  startAnalysis: SpriteAnalysis,
  endAnalysis: SpriteAnalysis,
): number {
  let score = 0;
  let weights = 0;

  // 1. Type match (strong signal)
  const typeWeight = 3;
  weights += typeWeight;
  if (a.regionType === b.regionType && a.regionType !== 'unknown') {
    score += typeWeight;
  } else if (a.regionType === 'unknown' || b.regionType === 'unknown') {
    score += typeWeight * 0.3; // partial credit
  }

  // 2. Relative position in sprite
  const posWeight = 2;
  weights += posWeight;
  const aRelX = (a.center.x - startAnalysis.totalBounds.x) / Math.max(1, startAnalysis.totalBounds.width);
  const aRelY = (a.center.y - startAnalysis.totalBounds.y) / Math.max(1, startAnalysis.totalBounds.height);
  const bRelX = (b.center.x - endAnalysis.totalBounds.x) / Math.max(1, endAnalysis.totalBounds.width);
  const bRelY = (b.center.y - endAnalysis.totalBounds.y) / Math.max(1, endAnalysis.totalBounds.height);
  const posDist = Math.hypot(aRelX - bRelX, aRelY - bRelY);
  score += posWeight * Math.max(0, 1 - posDist);

  // 3. Relative size
  const sizeWeight = 1.5;
  weights += sizeWeight;
  const sizeDist = Math.abs(a.relativeSize - b.relativeSize);
  score += sizeWeight * Math.max(0, 1 - sizeDist * 3);

  // 4. Color match
  const colorWeight = 1.5;
  weights += colorWeight;
  if (a.dominantColor && b.dominantColor) {
    if (a.dominantColor === b.dominantColor) {
      score += colorWeight;
    } else {
      const dist = colorDistance(a.dominantColor, b.dominantColor);
      score += colorWeight * Math.max(0, 1 - dist / 200);
    }
  }

  // 5. Vertical zone match
  const zoneWeight = 1;
  weights += zoneWeight;
  if (a.verticalZone === b.verticalZone) {
    score += zoneWeight;
  }

  return score / weights;
}

/**
 * Euclidean distance in RGB space between two hex colors.
 */
function colorDistance(hex1: string, hex2: string): number {
  const r1 = parseInt(hex1.slice(1, 3), 16);
  const g1 = parseInt(hex1.slice(3, 5), 16);
  const b1 = parseInt(hex1.slice(5, 7), 16);
  const r2 = parseInt(hex2.slice(1, 3), 16);
  const g2 = parseInt(hex2.slice(3, 5), 16);
  const b2 = parseInt(hex2.slice(5, 7), 16);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
}

/**
 * Find unmatched pixels in the start frame (pixels that don't belong to any matched region).
 */
export function findUnmatchedPixels(
  startAnalysis: SpriteAnalysis,
  matches: RegionMatch[],
): { x: number; y: number }[] {
  const matchedSet = new Set<string>();
  for (const m of matches) {
    for (const p of m.startRegion.pixels) {
      matchedSet.add(`${p.x},${p.y}`);
    }
  }

  const unmatched: { x: number; y: number }[] = [];
  for (const region of startAnalysis.regions) {
    for (const p of region.pixels) {
      if (!matchedSet.has(`${p.x},${p.y}`)) {
        unmatched.push(p);
      }
    }
  }
  return unmatched;
}
