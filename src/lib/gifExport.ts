/**
 * Minimal GIF89a encoder - zero dependencies.
 * Supports per-frame delay, looping, and automatic palette quantization.
 */

import type { Frame, PixelGrid } from '../types';
import { renderGridToCanvas, type Rgba } from './pixelGridRender';

type Rgb = readonly [number, number, number];
type RenderCanvas = HTMLCanvasElement | OffscreenCanvas;

interface PaletteInfo {
  palette: Rgb[];
  exactMap?: Map<number, number>;
  bucketToIndex?: Int16Array;
}

// ---- LZW Encoder ----

function lzwEncode(indexStream: ArrayLike<number>, minCodeSize: number): number[] {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;

  let codeSize = minCodeSize + 1;
  let nextCode = eoiCode + 1;
  const maxCode = 4096;

  const table = new Map<string, number>();
  for (let i = 0; i < clearCode; i++) {
    table.set(String(i), i);
  }

  const output: number[] = [];
  let bits = 0;
  let bitCount = 0;

  const writeBits = (code: number, size: number) => {
    bits |= code << bitCount;
    bitCount += size;
    while (bitCount >= 8) {
      output.push(bits & 0xff);
      bits >>= 8;
      bitCount -= 8;
    }
  };

  writeBits(clearCode, codeSize);

  let current = String(indexStream[0]);

  for (let i = 1; i < indexStream.length; i++) {
    const next = String(indexStream[i]);
    const combined = current + ',' + next;

    if (table.has(combined)) {
      current = combined;
    } else {
      writeBits(table.get(current)!, codeSize);
      if (nextCode < maxCode) {
        table.set(combined, nextCode++);
        if (nextCode > (1 << codeSize) && codeSize < 12) {
          codeSize++;
        }
      } else {
        writeBits(clearCode, codeSize);
        table.clear();
        for (let j = 0; j < clearCode; j++) {
          table.set(String(j), j);
        }
        codeSize = minCodeSize + 1;
        nextCode = eoiCode + 1;
      }
      current = next;
    }
  }

  writeBits(table.get(current)!, codeSize);
  writeBits(eoiCode, codeSize);

  if (bitCount > 0) {
    output.push(bits & 0xff);
  }

  return output;
}

function subBlocks(data: number[]): number[] {
  const out: number[] = [];
  let i = 0;
  while (i < data.length) {
    const size = Math.min(255, data.length - i);
    out.push(size);
    for (let j = 0; j < size; j++) {
      out.push(data[i + j]);
    }
    i += size;
  }
  out.push(0);
  return out;
}

// ---- Canvas rendering ----

function createCanvas(width: number, height: number): RenderCanvas {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function getGridCanvas(
  grid: PixelGrid,
  gridSize: number,
  gridHeight: number,
  cache: WeakMap<PixelGrid, RenderCanvas>,
  colorCache: Map<string, Rgba>,
): RenderCanvas {
  const cached = cache.get(grid);
  if (cached) return cached;

  const canvas = createCanvas(gridSize, gridHeight);
  renderGridToCanvas(canvas, grid, gridSize, gridHeight, colorCache);
  cache.set(grid, canvas);
  return canvas;
}

function renderFrameToRgbStream(
  frame: Frame,
  gridSize: number,
  gridHeight: number,
  scale: number,
  gridCanvasCache: WeakMap<PixelGrid, RenderCanvas>,
  colorCache: Map<string, Rgba>,
): Uint32Array {
  const width = gridSize * scale;
  const height = gridHeight * scale;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not render GIF frame.');

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  for (const layer of frame.layers) {
    if (!layer.visible) continue;

    ctx.save();
    ctx.translate(layer.transform.x * scale, layer.transform.y * scale);

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
    const layerCanvas = getGridCanvas(layer.grid, gridSize, gridHeight, gridCanvasCache, colorCache);
    ctx.drawImage(layerCanvas, 0, 0, gridSize, gridHeight, 0, 0, width, height);
    ctx.restore();
  }

  const { data } = ctx.getImageData(0, 0, width, height);
  const stream = new Uint32Array(width * height);
  for (let i = 0; i < stream.length; i++) {
    const offset = i * 4;
    stream[i] = (data[offset] << 16) | (data[offset + 1] << 8) | data[offset + 2];
  }

  return stream;
}

// ---- Palette helpers ----

function rgbToTuple(rgb: number): Rgb {
  return [(rgb >> 16) & 0xff, (rgb >> 8) & 0xff, rgb & 0xff];
}

function rgb332Bucket(rgb: number): number {
  const r = (rgb >> 21) & 0x07;
  const g = (rgb >> 13) & 0x07;
  const b = (rgb >> 6) & 0x03;
  return (r << 5) | (g << 2) | b;
}

function buildPalette(histogram: Map<number, number>): PaletteInfo {
  const colors = Array.from(histogram.keys());
  if (colors.length <= 256) {
    const exactMap = new Map<number, number>();
    const palette = colors.map((rgb, index) => {
      exactMap.set(rgb, index);
      return rgbToTuple(rgb);
    });
    return { palette, exactMap };
  }

  const sumR = new Float64Array(256);
  const sumG = new Float64Array(256);
  const sumB = new Float64Array(256);
  const counts = new Float64Array(256);

  for (const [rgb, count] of histogram) {
    const bucket = rgb332Bucket(rgb);
    sumR[bucket] += ((rgb >> 16) & 0xff) * count;
    sumG[bucket] += ((rgb >> 8) & 0xff) * count;
    sumB[bucket] += (rgb & 0xff) * count;
    counts[bucket] += count;
  }

  const bucketToIndex = new Int16Array(256);
  bucketToIndex.fill(-1);
  const palette: Rgb[] = [];

  for (let bucket = 0; bucket < 256; bucket++) {
    if (counts[bucket] === 0) continue;
    bucketToIndex[bucket] = palette.length;
    palette.push([
      Math.round(sumR[bucket] / counts[bucket]),
      Math.round(sumG[bucket] / counts[bucket]),
      Math.round(sumB[bucket] / counts[bucket]),
    ]);
  }

  return { palette, bucketToIndex };
}

function getPaletteIndex(rgb: number, paletteInfo: PaletteInfo): number {
  if (paletteInfo.exactMap) {
    return paletteInfo.exactMap.get(rgb) ?? 0;
  }

  const bucket = rgb332Bucket(rgb);
  return paletteInfo.bucketToIndex?.[bucket] ?? 0;
}

function paddedPalette(palette: Rgb[]): { palette: Rgb[]; palBits: number } {
  let palBits = 1;
  while ((1 << palBits) < palette.length) palBits++;
  if (palBits < 2) palBits = 2;

  const palSize = 1 << palBits;
  const padded = [...palette];
  while (padded.length < palSize) {
    padded.push([0, 0, 0]);
  }

  return { palette: padded, palBits };
}

function rgbStreamToIndices(stream: Uint32Array, paletteInfo: PaletteInfo): Uint8Array {
  const indices = new Uint8Array(stream.length);
  for (let i = 0; i < stream.length; i++) {
    indices[i] = getPaletteIndex(stream[i], paletteInfo);
  }
  return indices;
}

function collectHistogram(stream: Uint32Array, histogram: Map<number, number>): void {
  for (let i = 0; i < stream.length; i++) {
    const rgb = stream[i];
    histogram.set(rgb, (histogram.get(rgb) ?? 0) + 1);
  }
}

function yieldToBrowser(): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, 0));
}

// ---- Main export ----

export async function exportGif(
  frames: Frame[],
  gridSize: number,
  scale: number = 4,
  gridHeight: number = gridSize,
): Promise<Blob> {
  if (frames.length === 0) {
    throw new Error('No frames to export.');
  }

  const width = gridSize * scale;
  const height = gridHeight * scale;
  const histogram = new Map<number, number>();
  const gridCanvasCache = new WeakMap<PixelGrid, RenderCanvas>();
  const colorCache = new Map<string, Rgba>();

  for (const frame of frames) {
    collectHistogram(renderFrameToRgbStream(frame, gridSize, gridHeight, scale, gridCanvasCache, colorCache), histogram);
    await yieldToBrowser();
  }

  const paletteInfo = buildPalette(histogram);
  const table = paddedPalette(paletteInfo.palette);
  const bgIndex = getPaletteIndex(0xffffff, paletteInfo);
  const minCodeSize = Math.max(2, table.palBits);

  // ---- Header ----
  const bytes: number[] = [];
  const w = (s: string) => { for (let i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i)); };
  const w16 = (v: number) => { bytes.push(v & 0xff); bytes.push((v >> 8) & 0xff); };

  w('GIF89a');
  w16(width);
  w16(height);

  const gctFlag = 0x80 | ((table.palBits - 1) & 7) | (((table.palBits - 1) & 7) << 4);
  bytes.push(gctFlag);
  bytes.push(bgIndex);
  bytes.push(0);

  for (const [r, g, b] of table.palette) {
    bytes.push(r, g, b);
  }

  // Netscape looping extension
  bytes.push(0x21, 0xff, 0x0b);
  w('NETSCAPE2.0');
  bytes.push(0x03, 0x01);
  w16(0);
  bytes.push(0x00);

  // ---- Frames ----
  for (const frame of frames) {
    const delay = Math.max(1, Math.round(frame.duration / 10));

    bytes.push(0x21, 0xf9, 0x04);
    bytes.push(0x00);
    w16(delay);
    bytes.push(0x00);
    bytes.push(0x00);

    bytes.push(0x2c);
    w16(0);
    w16(0);
    w16(width);
    w16(height);
    bytes.push(0x00);

    bytes.push(minCodeSize);

    const stream = renderFrameToRgbStream(frame, gridSize, gridHeight, scale, gridCanvasCache, colorCache);
    const indices = rgbStreamToIndices(stream, paletteInfo);
    const compressed = lzwEncode(indices, minCodeSize);
    const blocks = subBlocks(compressed);
    for (const b of blocks) bytes.push(b);
    await yieldToBrowser();
  }

  bytes.push(0x3b);

  return new Blob([new Uint8Array(bytes)], { type: 'image/gif' });
}
