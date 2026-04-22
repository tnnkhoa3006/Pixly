import { forwardRef, useEffect, useRef, useImperativeHandle } from 'react';
import type { Frame, Layer, LayerTransform } from '../types';

interface CanvasProps {
  gridSize: number;
  pixelSize: number;
  showGrid: boolean;
}

export interface CanvasHandle {
  /** Render a single frame: layers + transform */
  renderFrame: (frame: Frame, onionFrame?: Frame | null) => void;
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
  };

  const drawGrid = (ctx: CanvasRenderingContext2D) => {
    const { gridSize: gs, pixelSize: ps } = propsRef.current;
    const logicalW = gs * ps;
    const logicalH = gs * ps;
    const ratio = window.devicePixelRatio || 1;

    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1 / ratio;
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

  const renderLayers = (ctx: CanvasRenderingContext2D, layers: Layer[], gs: number, ps: number) => {
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      if (!layer.visible) continue;

      ctx.save();
      applyTransform(ctx, layer.transform, gs, ps);
      ctx.globalAlpha = layer.opacity;
      for (let y = 0; y < gs; y++) {
        for (let x = 0; x < gs; x++) {
          const color = layer.grid[y]?.[x];
          if (color) {
            ctx.fillStyle = color;
            ctx.fillRect(x * ps, y * ps, ps, ps);
          }
        }
      }
      ctx.restore();
    }
  };

  const doRender = (frame: Frame, onionFrame?: Frame | null) => {
    const ctx = ctxRef.current;
    if (!ctx) return;

    const { gridSize: gs, pixelSize: ps, showGrid: sg } = propsRef.current;
    const logicalW = gs * ps;
    const logicalH = gs * ps;

    // 1. Clear
    ctx.clearRect(0, 0, logicalW, logicalH);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, logicalW, logicalH);

    // 2. Onion skin (previous frame at low opacity)
    if (onionFrame) {
      ctx.save();
      ctx.globalAlpha = 0.2;
      renderLayers(ctx, onionFrame.layers, gs, ps);
      ctx.restore();
    }

    // 3. Current frame with transform
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
    renderFrame: (frame: Frame, onionFrame?: Frame | null) => {
      doRender(frame, onionFrame);
    },
  }));

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        backgroundColor: '#ffffff',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        touchAction: 'none',
      }}
    />
  );
});

export default Canvas;
