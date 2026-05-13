import type { PixelGrid } from '../../types';
import type { PixelRegion, RegionType, SpriteAnalysis } from './types';

/**
 * Analyze a sprite: detect connected regions, classify them semantically,
 * compute outline, center of mass, and relative sizes.
 */
export function analyzeSprite(grid: PixelGrid, gridSize: number): SpriteAnalysis {
  const rawRegions = detectConnectedRegions(grid, gridSize);
  const totalBounds = computeTotalBounds(grid, gridSize);
  const centerOfMass = computeCenterOfMass(grid, gridSize);
  const outlinePixels = getOutlinePixels(grid, gridSize);
  const totalArea = totalBounds.width * totalBounds.height;

  // Classify each region
  const regions: PixelRegion[] = rawRegions.map((r) => ({
    ...r,
    relativeSize: totalArea > 0 ? r.pixels.length / totalArea : 0,
    verticalZone: classifyVerticalZone(r.center.y, totalBounds),
    regionType: classifyRegionType(r, totalBounds, rawRegions),
  }));

  // Merge small adjacent regions of same color into their largest neighbor
  const merged = mergeSmallRegions(regions, gridSize);

  return {
    regions: merged,
    totalBounds,
    centerOfMass,
    outlinePixels,
  };
}

function detectConnectedRegions(grid: PixelGrid, gridSize: number): PixelRegion[] {
  const visited = Array.from({ length: gridSize }, () => Array(gridSize).fill(false));
  const regions: PixelRegion[] = [];

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (visited[y][x] || !grid[y]?.[x]) continue;

      const color = grid[y][x];
      const pixels: { x: number; y: number }[] = [];
      const stack: { x: number; y: number }[] = [{ x, y }];
      visited[y][x] = true;

      while (stack.length > 0) {
        const p = stack.pop()!;
        pixels.push(p);

        for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
          const nx = p.x + dx;
          const ny = p.y + dy;
          if (
            nx >= 0 && nx < gridSize &&
            ny >= 0 && ny < gridSize &&
            !visited[ny][nx] &&
            grid[ny]?.[nx] === color
          ) {
            visited[ny][nx] = true;
            stack.push({ x: nx, y: ny });
          }
        }
      }

      let minX = pixels[0].x, maxX = pixels[0].x;
      let minY = pixels[0].y, maxY = pixels[0].y;
      for (const p of pixels) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }

      regions.push({
        id: `region-${regions.length}`,
        pixels,
        boundingBox: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
        center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
        dominantColor: color,
        regionType: 'unknown',
        verticalZone: 'middle',
        relativeSize: 0,
      });
    }
  }

  return regions;
}

function computeTotalBounds(grid: PixelGrid, gridSize: number) {
  let minX = gridSize, maxX = 0, minY = gridSize, maxY = 0;
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (grid[y]?.[x]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function computeCenterOfMass(grid: PixelGrid, gridSize: number) {
  let sumX = 0, sumY = 0, count = 0;
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (grid[y]?.[x]) {
        sumX += x;
        sumY += y;
        count++;
      }
    }
  }
  return count > 0
    ? { x: sumX / count, y: sumY / count }
    : { x: gridSize / 2, y: gridSize / 2 };
}

function classifyVerticalZone(
  centerY: number,
  totalBounds: { y: number; height: number },
): 'upper' | 'middle' | 'lower' {
  const relY = (centerY - totalBounds.y) / totalBounds.height;
  if (relY < 0.33) return 'upper';
  if (relY < 0.66) return 'middle';
  return 'lower';
}

function classifyRegionType(
  region: PixelRegion,
  totalBounds: { x: number; y: number; width: number; height: number },
  _allRegions: PixelRegion[],
): RegionType {
  const { boundingBox: bb, relativeSize, center } = region;
  const spriteH = totalBounds.height;
  const spriteW = totalBounds.width;

  // Head: top 30% of sprite, roughly centered horizontally
  const relY = (center.y - totalBounds.y) / spriteH;
  const relX = (center.x - totalBounds.x) / spriteW;
  const isCentered = relX > 0.25 && relX < 0.75;

  if (relY < 0.35 && isCentered && relativeSize < 0.4) {
    return 'head';
  }

  // Body: large region in the middle
  if (relativeSize > 0.15 && relY > 0.2 && relY < 0.7) {
    return 'body';
  }

  // Arms: regions extending horizontally from center, middle vertical zone
  const extendsHorizontal = bb.width > bb.height * 1.2;
  if (extendsHorizontal && relY > 0.2 && relY < 0.65) {
    return 'arm';
  }

  // Legs: bottom 40% of sprite, narrow regions
  if (relY > 0.6 && bb.height > bb.width) {
    return 'leg';
  }

  // Small regions are likely accessories
  if (relativeSize < 0.05) {
    return 'accessory';
  }

  return 'unknown';
}

function mergeSmallRegions(regions: PixelRegion[], _gridSize: number): PixelRegion[] {
  // Don't merge if only 1-2 regions
  if (regions.length <= 2) return regions;

  const SMALL_THRESHOLD = 0.02; // less than 2% of sprite area
  const result: PixelRegion[] = [];
  const merged = new Set<string>();

  for (const region of regions) {
    if (merged.has(region.id)) continue;

    if (region.relativeSize < SMALL_THRESHOLD) {
      // Find nearest larger region to merge into
      let nearest: PixelRegion | null = null;
      let minDist = Infinity;

      for (const other of regions) {
        if (other.id === region.id || merged.has(other.id)) continue;
        if (other.relativeSize < SMALL_THRESHOLD) continue;

        const dist = Math.hypot(
          region.center.x - other.center.x,
          region.center.y - other.center.y,
        );
        if (dist < minDist) {
          minDist = dist;
          nearest = other;
        }
      }

      if (nearest && minDist < 6) {
        // Merge into nearest
        nearest.pixels.push(...region.pixels);
        // Recompute bounding box
        const allX = nearest.pixels.map(p => p.x);
        const allY = nearest.pixels.map(p => p.y);
        nearest.boundingBox = {
          x: Math.min(...allX), y: Math.min(...allY),
          width: Math.max(...allX) - Math.min(...allX) + 1,
          height: Math.max(...allY) - Math.min(...allY) + 1,
        };
        nearest.center = {
          x: (nearest.boundingBox.x + nearest.boundingBox.x + nearest.boundingBox.width) / 2,
          y: (nearest.boundingBox.y + nearest.boundingBox.y + nearest.boundingBox.height) / 2,
        };
        merged.add(region.id);
        continue;
      }
    }

    result.push(region);
  }

  return result;
}

export function getOutlinePixels(grid: PixelGrid, gridSize: number): { x: number; y: number }[] {
  const outline: { x: number; y: number }[] = [];

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (!grid[y]?.[x]) continue;

      const hasEmptyNeighbor =
        (y === 0 || !grid[y - 1]?.[x]) ||
        (y === gridSize - 1 || !grid[y + 1]?.[x]) ||
        (x === 0 || !grid[y]?.[x - 1]) ||
        (x === gridSize - 1 || !grid[y]?.[x + 1]);

      if (hasEmptyNeighbor) {
        outline.push({ x, y });
      }
    }
  }

  return outline;
}

/** Get a color for visualizing a region type */
export function getRegionTypeColor(type: RegionType): string {
  switch (type) {
    case 'head': return '#f472b6';      // pink
    case 'body': return '#60a5fa';      // blue
    case 'arm': return '#34d399';       // green
    case 'leg': return '#fbbf24';       // yellow
    case 'accessory': return '#a78bfa'; // purple
    default: return '#9ca3af';          // gray
  }
}
