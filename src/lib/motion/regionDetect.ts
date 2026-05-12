import type { PixelGrid } from '../../types';
import type { PixelRegion } from './types';

export function detectRegions(grid: PixelGrid, gridSize: number): PixelRegion[] {
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
      });
    }
  }

  return regions;
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
