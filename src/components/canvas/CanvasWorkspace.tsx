import { memo } from 'react';
import { Copy, Scissors, ClipboardPaste, FlipHorizontal, FlipVertical, Trash, Stamp } from 'lucide-react';
import Canvas, { type CanvasHandle } from './Canvas';
import PreviewCanvas, { type PreviewCanvasHandle } from './PreviewCanvas';
import type { SelectionState } from '../../types';
import { getFrameToolTitle, getFrameToolHint, type FrameTransformTool } from '../../lib/transformHelpers';

interface TransformHudData {
  tool: string;
  origin: { x: number; y: number };
  pointer: { x: number; y: number };
  title: string;
  value: string;
  meta: string;
  hint: string;
}

interface TransformGuideLayer {
  id: string;
  visible: boolean;
  transform: { x: number; y: number; rotation: number; scale: number };
}

interface CanvasWorkspaceProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  canvasRef: React.RefObject<CanvasHandle | null>;
  previewCanvasRef: React.RefObject<PreviewCanvasHandle | null>;
  transformContainerRef: React.RefObject<HTMLDivElement | null>;
  hoverOverlayRef: React.RefObject<HTMLDivElement | null>;
  hoverCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  gridSize: number;
  gridHeight: number;
  pixelSize: number;
  showGrid: boolean;
  brushSize: number;
  canvasCursor: string;
  frameTransformTool: FrameTransformTool | null;
  visibleTransformHud: TransformHudData | null;
  selection: SelectionState | null;
  currentTool: string;
  transformGuideWidth: number;
  transformGuideHeight: number;
  getForwardCssTransform: () => string;
  showTransformGuides: boolean;
  transformGuideLayers: TransformGuideLayer[];
  activeLayerId: string;
  selectionCopy: () => void;
  selectionPaste: () => void;
  selectionCut: () => void;
  selectionNewBrush: () => void;
  selectionFlipH: () => void;
  selectionFlipV: () => void;
  selectionDelete: () => void;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerLeave: (e: React.PointerEvent<HTMLDivElement>) => void;
  onLostPointerCapture: (e: React.PointerEvent<HTMLDivElement>) => void;
}

export default memo(function CanvasWorkspace({
  containerRef, canvasRef, previewCanvasRef, transformContainerRef,
  hoverOverlayRef, hoverCanvasRef,
  gridSize, gridHeight, pixelSize, showGrid, brushSize, canvasCursor,
  frameTransformTool, visibleTransformHud, selection, currentTool,
  transformGuideWidth, transformGuideHeight, getForwardCssTransform, showTransformGuides, transformGuideLayers, activeLayerId,
  selectionCopy, selectionPaste, selectionCut, selectionNewBrush, selectionFlipH, selectionFlipV, selectionDelete,
  onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onPointerLeave, onLostPointerCapture,
}: CanvasWorkspaceProps) {
  return (
    <div className="main">
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', position: 'relative', cursor: canvasCursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerLeave}
        onLostPointerCapture={onLostPointerCapture}
        onContextMenu={e => e.preventDefault()}
      >
        {frameTransformTool && (
          <div className="transform-mode-hint">
            <strong>{getFrameToolTitle(frameTransformTool)}</strong>
            <span>{getFrameToolHint(frameTransformTool)}</span>
          </div>
        )}

        {visibleTransformHud && visibleTransformHud.tool !== 'frame-move' && (
          <svg className="transform-pointer-overlay" aria-hidden="true">
            <line
              x1={visibleTransformHud.origin.x}
              y1={visibleTransformHud.origin.y}
              x2={visibleTransformHud.pointer.x}
              y2={visibleTransformHud.pointer.y}
            />
            <circle cx={visibleTransformHud.origin.x} cy={visibleTransformHud.origin.y} r="5" />
            <circle cx={visibleTransformHud.pointer.x} cy={visibleTransformHud.pointer.y} r="4" />
          </svg>
        )}

        {visibleTransformHud && (
          <div
            className="transform-hud"
            style={{
              left: visibleTransformHud.pointer.x,
              top: visibleTransformHud.pointer.y,
            }}
          >
            <div className="transform-hud-title">{visibleTransformHud.title}</div>
            <div className="transform-hud-value">{visibleTransformHud.value}</div>
            <div className="transform-hud-meta">{visibleTransformHud.meta}</div>
            <div className="transform-hud-hint">{visibleTransformHud.hint}</div>
          </div>
        )}

        <div ref={transformContainerRef} style={{ position: 'absolute', top: 0, left: 0, transformOrigin: '0 0', overflow: 'visible' }}>
          <Canvas ref={canvasRef} gridSize={gridSize} gridHeight={gridHeight} pixelSize={pixelSize} showGrid={showGrid} />
          <div style={{
            position: 'absolute', top: 0, left: 0,
            width: `${transformGuideWidth}px`,
            height: `${transformGuideHeight}px`,
            transformOrigin: 'center',
            transform: getForwardCssTransform(),
            pointerEvents: 'none'
          }}>
            <PreviewCanvas ref={previewCanvasRef} gridSize={gridSize} gridHeight={gridHeight} pixelSize={pixelSize} brushSize={brushSize} />
            <div ref={hoverOverlayRef} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', display: 'none', boxSizing: 'border-box' }}>
              <canvas ref={hoverCanvasRef} style={{ width: '100%', height: '100%', imageRendering: 'pixelated', opacity: 0.6, display: 'none' }} />
            </div>
            {selection && currentTool === 'select' && (() => {
              const sx = (selection.x + selection.offsetX) * pixelSize;
              const sy = (selection.y + selection.offsetY) * pixelSize;
              const sw = selection.width * pixelSize;
              const sh = selection.height * pixelSize;
              const handlePositions = [
                { name: 'nw', left: -4, top: -4 },
                { name: 'n', left: sw / 2 - 4, top: -4 },
                { name: 'ne', left: sw - 4, top: -4 },
                { name: 'w', left: -4, top: sh / 2 - 4 },
                { name: 'e', left: sw - 4, top: sh / 2 - 4 },
                { name: 'sw', left: -4, top: sh - 4 },
                { name: 's', left: sw / 2 - 4, top: sh - 4 },
                { name: 'se', left: sw - 4, top: sh - 4 },
              ];
              const handleCursors: Record<string, string> = { nw: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', se: 'nwse-resize', n: 'ns-resize', s: 'ns-resize', w: 'ew-resize', e: 'ew-resize' };
              return (
                <div className="selection-overlay" style={{ position: 'absolute', left: sx, top: sy, width: sw, height: sh, pointerEvents: 'none', zIndex: 50 }}>
                  <canvas
                    ref={(canvas) => {
                      if (!canvas) return;
                      const ctx = canvas.getContext('2d');
                      if (!ctx) return;
                      canvas.width = selection.width;
                      canvas.height = selection.height;
                      ctx.clearRect(0, 0, selection.width, selection.height);
                      for (let row = 0; row < selection.height; row++) {
                        for (let col = 0; col < selection.width; col++) {
                          const px = selection.pixels[row]?.[col];
                          if (px) { ctx.fillStyle = px; ctx.fillRect(col, row, 1, 1); }
                        }
                      }
                    }}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', imageRendering: 'pixelated', pointerEvents: 'none' }}
                  />
                  <div className="selection-border" />
                  {handlePositions.map(h => (
                    <div key={h.name} className="selection-handle" style={{ left: h.left, top: h.top, cursor: handleCursors[h.name], pointerEvents: 'auto' }} />
                  ))}
                  <div className="selection-toolbar" style={{ pointerEvents: 'auto' }} onPointerDown={(e) => e.stopPropagation()}>
                    <button onClick={selectionCopy} title="Copy (Ctrl+C)"><Copy size={14} /></button>
                    <button onClick={selectionPaste} title="Paste (Ctrl+V)"><ClipboardPaste size={14} /></button>
                    <button onClick={selectionCut} title="Cut (Ctrl+X)"><Scissors size={14} /></button>
                    <button onClick={selectionNewBrush} title="New Brush"><Stamp size={14} /></button>
                    <button onClick={selectionFlipH} title="Flip Horizontal"><FlipHorizontal size={14} /></button>
                    <button onClick={selectionFlipV} title="Flip Vertical"><FlipVertical size={14} /></button>
                    <button onClick={selectionDelete} title="Delete (Del)"><Trash size={14} /></button>
                  </div>
                </div>
              );
            })()}
          </div>
          {showTransformGuides && (
            <div
              className="transform-guide-overlay"
              style={{ width: `${transformGuideWidth}px`, height: `${transformGuideHeight}px` }}
            >
              {transformGuideLayers.map(layer => {
                const isActiveGuide = layer.id === activeLayerId;
                const showRotateOrbit = frameTransformTool === 'frame-rotate' && isActiveGuide;
                const showScaleHandles = frameTransformTool === 'frame-scale';

                return (
                  <div
                    key={layer.id}
                    className={`transform-guide ${isActiveGuide ? 'active' : ''} ${layer.visible ? '' : 'hidden-layer'}`}
                    style={{
                      width: `${transformGuideWidth}px`,
                      height: `${transformGuideHeight}px`,
                      transformOrigin: 'center',
                      transform: `translate(${layer.transform.x * pixelSize}px, ${layer.transform.y * pixelSize}px) rotate(${layer.transform.rotation}deg) scale(${layer.transform.scale})`,
                    }}
                  >
                    <div className="transform-guide-box" />
                    <div className="transform-guide-center">
                      <span className="transform-guide-center-dot" />
                    </div>
                    {showRotateOrbit && <div className="transform-guide-orbit" />}
                    {showScaleHandles && (
                      <>
                        <span className="transform-guide-corner top-left" />
                        <span className="transform-guide-corner top-right" />
                        <span className="transform-guide-corner bottom-left" />
                        <span className="transform-guide-corner bottom-right" />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
