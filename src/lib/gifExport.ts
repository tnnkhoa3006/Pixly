/**
 * Minimal GIF89a encoder — zero dependencies.
 * Supports per-frame delay and looping.
 */

import type { Frame } from '../types';

// ---- LZW Encoder ----

function lzwEncode(indexStream: number[], minCodeSize: number): number[] {
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
  out.push(0); // block terminator
  return out;
}

// ---- Palette helpers ----

function buildPalette(colors: string[]): { palette: number[][]; colorMap: Map<string, number> } {
  // GIF needs power-of-2 palette
  let palBits = 1;
  while ((1 << palBits) < colors.length) palBits++;
  if (palBits < 2) palBits = 2;
  const palSize = 1 << palBits;

  const palette: number[][] = [];
  const colorMap = new Map<string, number>();

  for (let i = 0; i < palSize; i++) {
    if (i < colors.length) {
      const hex = colors[i];
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      palette.push([r, g, b]);
      colorMap.set(hex, i);
    } else {
      palette.push([0, 0, 0]);
    }
  }

  return { palette, colorMap };
}

// ---- Frame rendering to index stream ----

function renderFrameToHexStream(
  frame: Frame,
  gridSize: number,
  scale: number,
): string[] {
  const size = gridSize * scale;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  for (const layer of frame.layers) {
    if (!layer.visible) continue;
    
    // Apply layer transform
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

  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  const colors: string[] = new Array(size * size);

  for (let i = 0; i < size * size; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    colors[i] = '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  return colors;
}

function renderHexStreamToIndices(
  colors: string[],
  colorMap: Map<string, number>,
  bgIndex: number,
): number[] {
  const indices: number[] = new Array(colors.length);
  for (let i = 0; i < colors.length; i++) {
    indices[i] = colorMap.get(colors[i]) ?? bgIndex;
  }
  return indices;
}

// ---- Main export ----

export async function exportGif(
  frames: Frame[],
  gridSize: number,
  scale: number = 4,
): Promise<Blob> {
  const size = gridSize * scale;
  const renderedFrames = frames.map(frame => renderFrameToHexStream(frame, gridSize, scale));
  const colorSet = new Set<string>(['#ffffff']);

  for (const renderedFrame of renderedFrames) {
    for (const color of renderedFrame) {
      colorSet.add(color);
      if (colorSet.size > 256) {
        throw new Error('GIF export supports up to 256 rendered colors. Reduce colors or opacity variations and try again.');
      }
    }
  }

  const { palette, colorMap } = buildPalette(Array.from(colorSet));
  const bgIndex = colorMap.get('#ffffff') ?? 0;

  const palBits = Math.ceil(Math.log2(palette.length));
  const minCodeSize = Math.max(2, palBits);

  // ---- Header ----
  const bytes: number[] = [];
  const w = (s: string) => { for (let i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i)); };
  const w16 = (v: number) => { bytes.push(v & 0xff); bytes.push((v >> 8) & 0xff); };

  w('GIF89a');
  w16(size);  // width
  w16(size);  // height

  // Global color table flag
  const gctFlag = 0x80 | ((palBits - 1) & 7) | (((palBits - 1) & 7) << 4);
  bytes.push(gctFlag);
  bytes.push(bgIndex);  // bg color index
  bytes.push(0);  // pixel aspect ratio

  // Global color table
  for (const [r, g, b] of palette) {
    bytes.push(r, g, b);
  }

  // Netscape looping extension
  bytes.push(0x21, 0xff, 0x0b);
  w('NETSCAPE2.0');
  bytes.push(0x03, 0x01);
  w16(0); // loop forever
  bytes.push(0x00);

  // ---- Frames ----
  for (let fi = 0; fi < frames.length; fi++) {
    const frame = frames[fi];
    const delay = Math.round(frame.duration / 10); // GIF delay is in centiseconds

    // Graphic control extension
    bytes.push(0x21, 0xf9, 0x04);
    bytes.push(0x00); // no transparency
    w16(delay);
    bytes.push(0x00); // transparent color index
    bytes.push(0x00);

    // Image descriptor
    bytes.push(0x2c);
    w16(0); // left
    w16(0); // top
    w16(size);
    w16(size);
    bytes.push(0x00); // no local color table

    // LZW minimum code size
    bytes.push(minCodeSize);

    const indices = renderHexStreamToIndices(renderedFrames[fi], colorMap, bgIndex);
    const compressed = lzwEncode(indices, minCodeSize);
    const blocks = subBlocks(compressed);
    for (const b of blocks) bytes.push(b);
  }

  // Trailer
  bytes.push(0x3b);

  return new Blob([new Uint8Array(bytes)], { type: 'image/gif' });
}
