import type { CutMode, Layer, PixelGrid } from '../types';
import { createEmptyGrid, generateId } from './frameHelpers';

export interface LayerSplitPayload {
  x0?: number;
  y0?: number;
  x1?: number;
  y1?: number;
  points?: { x: number; y: number }[];
}

export interface LayerSplitResult {
  layers: Layer[];
  activeLayerId: string;
}

export function splitLayer(
  layer: Layer,
  gridSize: number,
  action: CutMode,
  payload: LayerSplitPayload = {},
): LayerSplitResult | null {
  if (action === 'marquee') return splitRect(layer, gridSize, payload);
  return splitLasso(layer, gridSize, payload.points);
}

function splitRect(layer: Layer, gridSize: number, payload: LayerSplitPayload): LayerSplitResult | null {
  if (
    payload.x0 === undefined ||
    payload.y0 === undefined ||
    payload.x1 === undefined ||
    payload.y1 === undefined
  ) {
    return null;
  }

  const minX = clamp(Math.min(payload.x0, payload.x1), 0, gridSize - 1);
  const maxX = clamp(Math.max(payload.x0, payload.x1), 0, gridSize - 1);
  const minY = clamp(Math.min(payload.y0, payload.y1), 0, gridSize - 1);
  const maxY = clamp(Math.max(payload.y0, payload.y1), 0, gridSize - 1);
  const mask = new Uint8Array(gridSize * gridSize);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (layer.grid[y]?.[x]) mask[y * gridSize + x] = 1;
    }
  }

  return splitByMask(layer, gridSize, mask, `${layer.name} Selection`);
}

function splitLasso(
  layer: Layer,
  gridSize: number,
  points?: { x: number; y: number }[],
): LayerSplitResult | null {
  if (!points || points.length < 3) return null;
  const compact = compactPath(points);
  if (compact.length < 3) return null;

  const mask = new Uint8Array(gridSize * gridSize);
  const bounds = getPathBounds(compact, gridSize);

  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      if (!layer.grid[y]?.[x]) continue;
      if (pointInPolygon(x + 0.5, y + 0.5, compact)) {
        mask[y * gridSize + x] = 1;
      }
    }
  }

  return splitByMask(layer, gridSize, mask, `${layer.name} Lasso`);
}

function splitByMask(layer: Layer, gridSize: number, mask: Uint8Array, name: string): LayerSplitResult | null {
  const remaining = createEmptyGrid(gridSize);
  const extracted = createEmptyGrid(gridSize);
  let extractedCount = 0;
  let remainingCount = 0;

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const color = layer.grid[y]?.[x];
      if (!color) continue;
      if (mask[y * gridSize + x]) {
        extracted[y][x] = color;
        extractedCount++;
      } else {
        remaining[y][x] = color;
        remainingCount++;
      }
    }
  }

  if (extractedCount === 0) return null;

  const cutLayer = createSplitLayer(layer, name, extracted);
  const layers = remainingCount > 0
    ? [{ ...layer, grid: remaining, transform: { ...layer.transform } }, cutLayer]
    : [cutLayer];

  return { layers, activeLayerId: cutLayer.id };
}

function createSplitLayer(sourceLayer: Layer, name: string, grid: PixelGrid): Layer {
  return {
    id: generateId(),
    name,
    visible: sourceLayer.visible,
    opacity: sourceLayer.opacity,
    grid,
    transform: { ...sourceLayer.transform },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function compactPath(points: { x: number; y: number }[]): { x: number; y: number }[] {
  const compact: { x: number; y: number }[] = [];
  for (const point of points) {
    const last = compact[compact.length - 1];
    if (!last || last.x !== point.x || last.y !== point.y) {
      compact.push({ x: point.x, y: point.y });
    }
  }
  return compact;
}

function getPathBounds(points: { x: number; y: number }[], gridSize: number) {
  let minX = gridSize - 1;
  let minY = gridSize - 1;
  let maxX = 0;
  let maxY = 0;

  for (const point of points) {
    minX = Math.min(minX, clamp(point.x, 0, gridSize - 1));
    minY = Math.min(minY, clamp(point.y, 0, gridSize - 1));
    maxX = Math.max(maxX, clamp(point.x, 0, gridSize - 1));
    maxY = Math.max(maxY, clamp(point.y, 0, gridSize - 1));
  }

  return { minX, minY, maxX, maxY };
}

function pointInPolygon(px: number, py: number, polygon: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x + 0.5;
    const yi = polygon[i].y + 0.5;
    const xj = polygon[j].x + 0.5;
    const yj = polygon[j].y + 0.5;
    const intersects = ((yi > py) !== (yj > py)) &&
      (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}
