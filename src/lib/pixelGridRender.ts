import type { PixelGrid } from '../types';

export type Rgba = readonly [number, number, number, number];

function parseHexColor(color: string): Rgba | null {
  if (color[0] !== '#') return null;

  if (color.length === 4) {
    const r = parseInt(color[1] + color[1], 16);
    const g = parseInt(color[2] + color[2], 16);
    const b = parseInt(color[3] + color[3], 16);
    return [r, g, b, 255];
  }

  if (color.length === 7 || color.length === 9) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    const a = color.length === 9 ? parseInt(color.slice(7, 9), 16) : 255;
    return [r, g, b, a];
  }

  return null;
}

let parseCanvas: HTMLCanvasElement | null = null;
let parseCtx: CanvasRenderingContext2D | null = null;

function parseCssColorWithCanvas(color: string): Rgba {
  if (typeof document === 'undefined') return [0, 0, 0, 255];

  if (!parseCanvas) {
    parseCanvas = document.createElement('canvas');
    parseCanvas.width = 1;
    parseCanvas.height = 1;
    parseCtx = parseCanvas.getContext('2d', { willReadFrequently: true });
  }

  if (!parseCtx) return [0, 0, 0, 255];
  parseCtx.clearRect(0, 0, 1, 1);
  parseCtx.fillStyle = '#000000';
  parseCtx.fillStyle = color;
  parseCtx.fillRect(0, 0, 1, 1);
  const data = parseCtx.getImageData(0, 0, 1, 1).data;
  return [data[0], data[1], data[2], data[3]];
}

export function parseCssColor(color: string, cache: Map<string, Rgba>): Rgba {
  const cached = cache.get(color);
  if (cached) return cached;

  const parsed = parseHexColor(color) ?? parseCssColorWithCanvas(color);
  cache.set(color, parsed);
  return parsed;
}

export function renderGridToCanvas(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  grid: PixelGrid,
  gridSize: number,
  colorCache: Map<string, Rgba>,
  tint?: string,
): void {
  if (canvas.width !== gridSize) canvas.width = gridSize;
  if (canvas.height !== gridSize) canvas.height = gridSize;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const imageData = ctx.createImageData(gridSize, gridSize);
  const data = imageData.data;
  const tintRgba = tint ? parseCssColor(tint, colorCache) : null;

  for (let y = 0; y < gridSize; y++) {
    const row = grid[y];
    if (!row) continue;
    let offset = y * gridSize * 4;
    for (let x = 0; x < gridSize; x++) {
      const color = row[x];
      if (!color) {
        offset += 4;
        continue;
      }

      const rgba = tintRgba ?? parseCssColor(color, colorCache);
      data[offset] = rgba[0];
      data[offset + 1] = rgba[1];
      data[offset + 2] = rgba[2];
      data[offset + 3] = rgba[3];
      offset += 4;
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

