import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { rasterizeGeometry } from '../../lib/drawing';

export type PreviewTool = 'line' | 'rect' | 'circle' | 'select' | null;

interface PreviewCanvasProps {
  gridSize: number;
  pixelSize: number;
  brushSize: number;
}

export interface PreviewCanvasHandle {
  drawPreview: (tool: PreviewTool, startX: number, startY: number, endX: number, endY: number, color: string | null) => void;
  drawPath: (points: { x: number; y: number }[], color: string, closed?: boolean) => void;
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

      if (tool === 'line' || tool === 'rect' || tool === 'circle') {
        const points = rasterizeGeometry(tool, startX, startY, endX, endY);
        for (const point of points) {
          if (tool === 'line') {
            drawPoint(point.x, point.y, true);
          } else {
            drawPoint(point.x, point.y);
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
    drawPath: (points: { x: number; y: number }[], color: string, closed: boolean = false) => {
      const ctx = ctxRef.current;
      if (!ctx) return;

      const logicalWidth = gridSize * pixelSize;
      const logicalHeight = gridSize * pixelSize;
      ctx.clearRect(0, 0, logicalWidth, logicalHeight);
      if (points.length === 0) return;

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, Math.min(3, pixelSize * 0.18));
      ctx.setLineDash([Math.max(4, pixelSize * 0.65), Math.max(3, pixelSize * 0.45)]);
      ctx.beginPath();
      ctx.moveTo((points[0].x + 0.5) * pixelSize, (points[0].y + 0.5) * pixelSize);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo((points[i].x + 0.5) * pixelSize, (points[i].y + 0.5) * pixelSize);
      }
      if (closed && points.length > 2) ctx.closePath();
      ctx.stroke();

      if (closed && points.length > 2) {
        ctx.fillStyle = `${color}22`;
        ctx.fill();
      }
      ctx.restore();
      ctx.setLineDash([]);
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
