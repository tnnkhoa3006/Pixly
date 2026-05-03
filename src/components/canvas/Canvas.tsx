import { forwardRef, useEffect, useRef, useImperativeHandle } from 'react';
import type { Frame, Layer, LayerTransform } from '../../types';

interface CanvasProps {
  gridSize: number;
  pixelSize: number;
  showGrid: boolean;
}

export interface CanvasHandle {
  /** Render a single frame with optional onion skin frames */
  renderFrame: (
    frame: Frame,
    onionFrames?: { frame: Frame; tint: 'prev' | 'next'; opacity: number }[] | null,
  ) => void;
}

const Canvas = forwardRef<CanvasHandle, CanvasProps>(({ gridSize, pixelSize, showGrid }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  // Keep latest props accessible to imperative methods
  const propsRef = useRef({ gridSize, pixelSize, showGrid });
  propsRef.current = { gridSize, pixelSize, showGrid };

  // ---------- internal helpers ----------

  const setupCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctxRef.current = ctx;

    const { gridSize: gs, pixelSize: ps } = propsRef.current;
    const logicalW = gs * ps;
    const logicalH = gs * ps;
    const ratio = window.devicePixelRatio || 1;

    canvas.width = Math.round(logicalW * ratio);
    canvas.height = Math.round(logicalH * ratio);
    canvas.style.width = `${logicalW}px`;
    canvas.style.height = `${logicalH}px`;

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.imageSmoothingEnabled = false;

    // Apply a clean CSS checkerboard background to eliminate "seams" between pixels
    const bgSize = ps * 2;
    canvas.style.backgroundImage = `
      linear-gradient(45deg, #e5e5e5 25%, transparent 25%),
      linear-gradient(-45deg, #e5e5e5 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #e5e5e5 75%),
      linear-gradient(-45deg, transparent 75%, #e5e5e5 75%)
    `;
    canvas.style.backgroundSize = `${bgSize}px ${bgSize}px`;
    canvas.style.backgroundPosition = `0 0, 0 ${ps}px, ${ps}px -${ps}px, -${ps}px 0px`;
    canvas.style.backgroundColor = 'white';
  };

  const drawGrid = (ctx: CanvasRenderingContext2D) => {
    const { gridSize: gs, pixelSize: ps } = propsRef.current;
    if (ps < 12) return; // Only show grid when zoomed in enough

    const logicalW = gs * ps;
    const logicalH = gs * ps;
    const ratio = window.devicePixelRatio || 1;

    // Very subtle solid lines
    ctx.strokeStyle = `rgba(0, 0, 0, 0.1)`;
    ctx.lineWidth = 1 / ratio;
    ctx.setLineDash([]); 

    ctx.beginPath();
    for (let i = 0; i <= gs; i++) {
      const pos = i * ps;
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, logicalH);
      ctx.moveTo(0, pos);
      ctx.lineTo(logicalW, pos);
    }
    ctx.stroke();
  };

  const applyTransform = (ctx: CanvasRenderingContext2D, transform: LayerTransform, gs: number, ps: number) => {
    // Translate (in pixel-space)
    ctx.translate(transform.x * ps, transform.y * ps);

    const cx = (gs * ps) / 2;
    const cy = (gs * ps) / 2;

    // Rotate around center
    if (transform.rotation !== 0) {
      ctx.translate(cx, cy);
      ctx.rotate((transform.rotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }

    // Scale around center
    if (transform.scale !== 1) {
      ctx.translate(cx, cy);
      ctx.scale(transform.scale, transform.scale);
      ctx.translate(-cx, -cy);
    }
  };

  const renderLayers = (
    ctx: CanvasRenderingContext2D,
    layers: Layer[],
    gs: number,
    ps: number,
    tint?: 'prev' | 'next',
  ) => {
    // Create an offscreen buffer at 1:1 scale to avoid seams between pixels
    const buffer = document.createElement('canvas');
    buffer.width = gs;
    buffer.height = gs;
    const bCtx = buffer.getContext('2d');
    if (!bCtx) return;

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      if (!layer.visible) continue;

      ctx.save();
      // Apply transform in screen-space
      applyTransform(ctx, layer.transform, gs, ps);
      ctx.globalAlpha = layer.opacity;

      // Draw pixels to the 1:1 buffer
      bCtx.clearRect(0, 0, gs, gs);
      for (let y = 0; y < gs; y++) {
        for (let x = 0; x < gs; x++) {
          const color = layer.grid[y]?.[x];
          if (color) {
            if (tint) {
              // Convert pixel to tinted color: prev = red-orange, next = blue-green
              bCtx.fillStyle = tint === 'prev' ? '#ff6b35' : '#35a7ff';
            } else {
              bCtx.fillStyle = color;
            }
            bCtx.fillRect(x, y, 1, 1);
          }
        }
      }

      // Draw the buffer to the main canvas scaled up
      ctx.drawImage(buffer, 0, 0, gs, gs, 0, 0, gs * ps, gs * ps);
      
      ctx.restore();
    }
  };

  const doRender = (
    frame: Frame,
    onionFrames?: { frame: Frame; tint: 'prev' | 'next'; opacity: number }[] | null,
  ) => {
    const ctx = ctxRef.current;
    if (!ctx) return;

    const { gridSize: gs, pixelSize: ps, showGrid: sg } = propsRef.current;
    const logicalW = gs * ps;
    const logicalH = gs * ps;

    // 1. Clear (checkerboard is now handled by CSS background)
    ctx.clearRect(0, 0, logicalW, logicalH);

    // 2. Onion skin frames (prev = red-orange tint, next = blue tint)
    if (onionFrames) {
      for (const { frame: oFrame, tint, opacity } of onionFrames) {
        ctx.save();
        ctx.globalAlpha = opacity;
        renderLayers(ctx, oFrame.layers, gs, ps, tint);
        ctx.restore();
      }
    }

    // 3. Current frame
    renderLayers(ctx, frame.layers, gs, ps);

    // 4. Grid overlay (un-transformed)
    if (sg && ps >= 8) {
      drawGrid(ctx);
    }
  };

  // ---------- lifecycle ----------

  useEffect(() => {
    setupCanvas();
  }, [gridSize, pixelSize, showGrid]);

  // ---------- imperative API ----------

  useImperativeHandle(ref, () => ({
    renderFrame: (
      frame: Frame,
      onionFrames?: { frame: Frame; tint: 'prev' | 'next'; opacity: number }[] | null,
    ) => {
      doRender(frame, onionFrames);
    },
  }));

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        touchAction: 'none',
      }}
    />
  );
});

export default Canvas;
