export type Point = {
  x: number;
  y: number;
};

export type GeometryTool = 'line' | 'rect' | 'circle';

export function rasterizeLine(x0: number, y0: number, x1: number, y1: number): Point[] {
  const points: Point[] = [];
  let currX = x0;
  let currY = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    points.push({ x: currX, y: currY });
    if (currX === x1 && currY === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      currX += sx;
    }
    if (e2 < dx) {
      err += dx;
      currY += sy;
    }
  }

  return points;
}

export function rasterizeRect(x0: number, y0: number, x1: number, y1: number): Point[] {
  const points: Point[] = [];
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      points.push({ x, y });
    }
  }

  return points;
}

export function rasterizeCircle(x0: number, y0: number, x1: number, y1: number): Point[] {
  const points: Point[] = [];
  const radius = Math.floor(Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2));

  for (let y = y0 - radius; y <= y0 + radius; y++) {
    for (let x = x0 - radius; x <= x0 + radius; x++) {
      if ((x - x0) ** 2 + (y - y0) ** 2 <= radius * radius) {
        points.push({ x, y });
      }
    }
  }

  return points;
}

export function rasterizeGeometry(tool: GeometryTool, x0: number, y0: number, x1: number, y1: number): Point[] {
  if (tool === 'line') return rasterizeLine(x0, y0, x1, y1);
  if (tool === 'rect') return rasterizeRect(x0, y0, x1, y1);
  return rasterizeCircle(x0, y0, x1, y1);
}
