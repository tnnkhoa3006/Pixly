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
  scale: number,
): OffscreenCanvas {
  const size = gridSize * scale;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  for (const layer of frame.layers) {
    if (!layer.visible) continue;

    ctx.save();
    const ps = scale;
    ctx.translate(layer.transform.x * ps, layer.transform.y * ps);

    if (layer.transform.rotation !== 0) {
      const c = size / 2;
      ctx.translate(c, c);
      ctx.rotate((layer.transform.rotation * Math.PI) / 180);
      ctx.translate(-c, -c);
    }
    if (layer.transform.scale !== 1) {
      const c = size / 2;
      ctx.translate(c, c);
      ctx.scale(layer.transform.scale, layer.transform.scale);
      ctx.translate(-c, -c);
    }

    ctx.globalAlpha = layer.opacity;
    for (let y = 0; y < gridSize; y++) {
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
  scale: number,
  format: string,
): Promise<Blob> {
  const fmt = getFormatOption(format);
  const canvas = renderFrameToCanvas(frame, gridSize, scale);
  return canvas.convertToBlob({ type: fmt.mime, quality: 0.92 });
}
