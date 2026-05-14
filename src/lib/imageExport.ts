/**
 * Export a single frame as an image file (PNG, JPG, BMP, WebP).
 * Reuses the OffscreenCanvas rendering pattern from gifExport.ts.
 */

import type { Frame } from '../types';

export interface FormatOption {
  value: string;
  label: string;
  ext: string;
  mime: string;
}

export const FORMAT_OPTIONS: FormatOption[] = [
  { value: 'png', label: 'PNG', ext: 'png', mime: 'image/png' },
  { value: 'jpg', label: 'JPG', ext: 'jpg', mime: 'image/jpeg' },
  { value: 'bmp', label: 'BMP', ext: 'bmp', mime: 'image/bmp' },
  { value: 'webp', label: 'WebP', ext: 'webp', mime: 'image/webp' },
];

export function getFormatOption(value: string): FormatOption {
  return FORMAT_OPTIONS.find(f => f.value === value) ?? FORMAT_OPTIONS[0];
}

function renderFrameToCanvas(
  frame: Frame,
  gridSize: number,
  gridHeight: number,
  scale: number,
  backgroundColor: string | null = null,
): OffscreenCanvas {
  const width = gridSize * scale;
  const height = gridHeight * scale;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  ctx.clearRect(0, 0, width, height);
  if (backgroundColor) {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
  }

  for (const layer of frame.layers) {
    if (!layer.visible) continue;

    ctx.save();
    const ps = scale;
    ctx.translate(layer.transform.x * ps, layer.transform.y * ps);

    if (layer.transform.rotation !== 0) {
      const cx = width / 2;
      const cy = height / 2;
      ctx.translate(cx, cy);
      ctx.rotate((layer.transform.rotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }
    if (layer.transform.scale !== 1) {
      const cx = width / 2;
      const cy = height / 2;
      ctx.translate(cx, cy);
      ctx.scale(layer.transform.scale, layer.transform.scale);
      ctx.translate(-cx, -cy);
    }

    ctx.globalAlpha = layer.opacity;
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridSize; x++) {
        const color = layer.grid[y]?.[x];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(x * ps, y * ps, ps, ps);
        }
      }
    }
    ctx.restore();
  }

  return canvas;
}

export async function exportFrameAsImage(
  frame: Frame,
  gridSize: number,
  gridHeight: number,
  scale: number,
  format: string,
): Promise<Blob> {
  const fmt = getFormatOption(format);
  const backgroundColor = fmt.value === 'jpg' ? '#ffffff' : null;
  const canvas = renderFrameToCanvas(frame, gridSize, gridHeight, scale, backgroundColor);
  return canvas.convertToBlob({ type: fmt.mime, quality: 0.92 });
}
