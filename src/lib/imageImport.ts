/**
 * Image import utility — converts a raster image (PNG/JPG/BMP/GIF) into a PixelGrid.
 * Uses Tauri native APIs when available, falls back to web APIs for dev mode.
 */
import type { PixelGrid } from '../types';

const IMAGE_FILTER = { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'gif'] };

const isTauri = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/**
 * Opens a file dialog for image selection.
 * Returns the file name and raw Blob, or null if cancelled.
 */
export async function openImageFile(): Promise<{ name: string; blob: Blob } | null> {
  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const { readFile } = await import('@tauri-apps/plugin-fs');
    const selected = await open({
      title: 'Import Image',
      multiple: false,
      filters: [IMAGE_FILTER],
    });
    if (!selected) return null;
    const filePath = typeof selected === 'string' ? selected : selected as unknown as string;
    const name = filePath.split(/[/\\]/).pop() ?? 'image';
    const bytes = await readFile(filePath);
    const blob = new Blob([bytes]);
    return { name, blob };
  } else {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.png,.jpg,.jpeg,.bmp,.gif';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) { resolve(null); return; }
        resolve({ name: file.name, blob: file });
      };
      input.click();
    });
  }
}

/**
 * Converts an image Blob into a PixelGrid sized to fit the given canvas dimensions.
 * Preserves aspect ratio — non-square images are centered with transparent padding.
 * Uses nearest-neighbor (imageSmoothingEnabled = false) for crisp pixel art.
 * Pixels with alpha < 128 are treated as transparent (null).
 */
export async function imageBlobToGrid(blob: Blob, gridSize: number, gridHeight: number = gridSize): Promise<PixelGrid> {
  const bitmap = await createImageBitmap(blob);

  // Calculate aspect-ratio-preserving dimensions
  const { width: srcW, height: srcH } = bitmap;
  const scale = Math.min(gridSize / srcW, gridHeight / srcH);
  const drawW = Math.round(srcW * scale);
  const drawH = Math.round(srcH * scale);
  const offsetX = Math.floor((gridSize - drawW) / 2);
  const offsetY = Math.floor((gridHeight - drawH) / 2);

  // Draw to offscreen canvas at 1:1 grid resolution
  const canvas = document.createElement('canvas');
  canvas.width = gridSize;
  canvas.height = gridHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, gridSize, gridHeight);
  ctx.drawImage(bitmap, 0, 0, srcW, srcH, offsetX, offsetY, drawW, drawH);
  bitmap.close();

  // Read pixel data and convert to PixelGrid
  const imageData = ctx.getImageData(0, 0, gridSize, gridHeight);
  const { data } = imageData;
  const grid: PixelGrid = [];

  for (let y = 0; y < gridHeight; y++) {
    const row: (string | null)[] = [];
    for (let x = 0; x < gridSize; x++) {
      const idx = (y * gridSize + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      if (a < 128) {
        row.push(null);
      } else {
        row.push(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`);
      }
    }
    grid.push(row);
  }

  return grid;
}
