import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

export type PreviewTool = 'line' | 'rect' | 'circle' | 'select' | null;

interface PreviewCanvasProps {
  gridSize: number;
  pixelSize: number;
  brushSize: number;
}

export interface PreviewCanvasHandle {
  drawPreview: (tool: PreviewTool, startX: number, startY: number, endX: number, endY: number, color: string | null) => void;
  clear: () => void;
}

const PreviewCanvas = forwardRef<PreviewCanvasHandle, PreviewCanvasProps>(({ gridSize, pixelSize, brushSize }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const logicalWidth = gridSize * pixelSize;
    const logicalHeight = gridSize * pixelSize;
    const ratio = window.devicePixelRatio || 1;
    
    canvas.width = Math.round(logicalWidth * ratio);
    canvas.height = Math.round(logicalHeight * ratio);
    canvas.style.width = `${logicalWidth}px`;
    canvas.style.height = `${logicalHeight}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctxRef.current = ctx;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(ratio, ratio);
    ctx.imageSmoothingEnabled = false;
    (ctx as any).imageSmoothingQuality = 'low';
    
  }, [gridSize, pixelSize]);

  useImperativeHandle(ref, () => ({
    drawPreview: (tool: PreviewTool, startX: number, startY: number, endX: number, endY: number, color: string | null) => {
      const ctx = ctxRef.current;
      if (!ctx) return;

      const logicalWidth = gridSize * pixelSize;
      const logicalHeight = gridSize * pixelSize;
      ctx.clearRect(0, 0, logicalWidth, logicalHeight);

      if (!tool || !color) return;

      ctx.fillStyle = color;

      const drawPoint = (x: number, y: number, applyBrush: boolean = false) => {
        if (applyBrush) {
          const startOffset = -Math.floor(brushSize / 2);
          const endOffset = Math.floor((brushSize - 1) / 2);
          for (let dy = startOffset; dy <= endOffset; dy++) {
            for (let dx = startOffset; dx <= endOffset; dx++) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
                ctx.fillRect(nx * pixelSize, ny * pixelSize, pixelSize, pixelSize);
              }
            }
          }
        } else {
          if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) return;
          ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
        }
      };

      if (tool === 'line') {
        let x0 = startX;
        let y0 = startY;
        const x1 = endX;
        const y1 = endY;
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = (x0 < x1) ? 1 : -1;
        const sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;

        while (true) {
          drawPoint(x0, y0, true);
          if (x0 === x1 && y0 === y1) break;
          const e2 = 2 * err;
          if (e2 > -dy) { err -= dy; x0 += sx; }
          if (e2 < dx) { err += dx; y0 += sy; }
        }
      } else if (tool === 'rect') {
        const minX = Math.min(startX, endX);
        const maxX = Math.max(startX, endX);
        const minY = Math.min(startY, endY);
        const maxY = Math.max(startY, endY);
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            drawPoint(x, y);
          }
        }
      } else if (tool === 'circle') {
        // Midpoint circle algorithm (filled)
        // A simple approach is to calculate the radius and fill points inside
        const radius = Math.floor(Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2)));
        for (let y = startY - radius; y <= startY + radius; y++) {
          for (let x = startX - radius; x <= startX + radius; x++) {
            if (Math.pow(x - startX, 2) + Math.pow(y - startY, 2) <= radius * radius) {
              drawPoint(x, y);
            }
          }
        }
      } else if (tool === 'select') {
        const minX = Math.max(0, Math.min(startX, endX));
        const maxX = Math.min(gridSize - 1, Math.max(startX, endX));
        const minY = Math.max(0, Math.min(startY, endY));
        const maxY = Math.min(gridSize - 1, Math.max(startY, endY));
        
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        
        ctx.strokeRect(minX * pixelSize, minY * pixelSize, (maxX - minX + 1) * pixelSize, (maxY - minY + 1) * pixelSize);
        
        // inner white dash for visibility on dark backgrounds
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineDashOffset = 4;
        ctx.strokeRect(minX * pixelSize, minY * pixelSize, (maxX - minX + 1) * pixelSize, (maxY - minY + 1) * pixelSize);
        ctx.setLineDash([]);
      }
    },
    clear: () => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      const logicalWidth = gridSize * pixelSize;
      const logicalHeight = gridSize * pixelSize;
      ctx.clearRect(0, 0, logicalWidth, logicalHeight);
    }
  }));

  return (
    <canvas 
      ref={canvasRef} 
      style={{ 
        display: 'block',
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
      }}
    />
  );
});

export default PreviewCanvas;
