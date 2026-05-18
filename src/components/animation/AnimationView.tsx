import { useRef, useEffect, memo, useState, useCallback } from 'react';
import {
  Play, Square, SkipBack, SkipForward, ChevronLeft, ChevronRight,
  Plus, Copy, Trash2, Eye, EyeOff, RefreshCw, RotateCcw, Maximize2, Minimize2
} from 'lucide-react';
import type { Frame } from '../../types';
import { useStore } from '../../store';

type FrameDropPosition = 'left' | 'right';
type FrameDropTarget = {
  index: number;
  position: FrameDropPosition;
};
type FramePointerDrag = {
  pointerId: number;
  startX: number;
  startY: number;
  index: number;
  isDragging: boolean;
};

// ─── Thumbnail size for the preview strip ───────────────────
const THUMB_W = 64;
const PREVIEW_SIZE = 180; // preview canvas logical size

function renderToCanvas(
  canvas: HTMLCanvasElement,
  frame: Frame | undefined,
  gridSize: number,
  gridHeight: number,
  size: number,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const maxSide = Math.max(gridSize, gridHeight);
  const drawW = (gridSize / maxSide) * size;
  const drawH = (gridHeight / maxSide) * size;
  const offsetX = (size - drawW) / 2;
  const offsetY = (size - drawH) / 2;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(size * ratio);
  canvas.height = Math.round(size * ratio);
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, size, size);

  if (!frame) return;

  // checkerboard bg (dark theme friendly)
  const sq = Math.max(4, Math.round(size / maxSide / 2));
  for (let row = 0; row < Math.ceil(size / sq); row++) {
    for (let col = 0; col < Math.ceil(size / sq); col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? '#2a2a3e' : '#22223a';
      ctx.fillRect(col * sq, row * sq, sq, sq);
    }
  }

  const ps = size / maxSide;
  for (const layer of frame.layers) {
    if (!layer.visible) continue;
    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.translate(offsetX, offsetY);
    ctx.translate(layer.transform.x * ps, layer.transform.y * ps);
    if (layer.transform.rotation !== 0) {
      const cx = drawW / 2;
      const cy = drawH / 2;
      ctx.translate(cx, cy);
      ctx.rotate((layer.transform.rotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }
    if (layer.transform.scale !== 1) {
      const cx = drawW / 2;
      const cy = drawH / 2;
      ctx.translate(cx, cy);
      ctx.scale(layer.transform.scale, layer.transform.scale);
      ctx.translate(-cx, -cy);
    }
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridSize; x++) {
        const color = layer.grid[y]?.[x];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(x * ps, y * ps, Math.ceil(ps), Math.ceil(ps));
        }
      }
    }
    ctx.restore();
  }
}

// ─── Frame thumbnail ─────────────────────────────────────────
const FrameThumb = memo(({
  frame, index, isActive, gridSize, gridHeight = gridSize, isDragging, dropTarget, draggable, compact,
  onClick, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, setFrameRef,
}: {
  frame: Frame; index: number; isActive: boolean; gridSize: number; gridHeight?: number;
  isDragging: boolean; dropTarget: 'left' | 'right' | null; draggable: boolean;
  compact: boolean;
  onClick: () => void;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => void;
  setFrameRef: (node: HTMLDivElement | null) => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!compact && canvasRef.current) renderToCanvas(canvasRef.current, frame, gridSize, gridHeight, THUMB_W);
  }, [frame, gridSize, gridHeight, compact]);

  return (
    <div
      ref={setFrameRef}
      className={`av-frame-thumb ${isActive ? 'active' : ''} ${isDragging ? 'dragging' : ''} ${compact ? 'compact' : ''} ${dropTarget === 'left' ? 'drop-target-left' : ''} ${dropTarget === 'right' ? 'drop-target-right' : ''}`}
      onClick={onClick}
      draggable={false}
      onPointerDown={draggable ? onPointerDown : undefined}
      onPointerMove={draggable ? onPointerMove : undefined}
      onPointerUp={draggable ? onPointerUp : undefined}
      onPointerCancel={draggable ? onPointerCancel : undefined}
    >
      <div className="av-frame-num">{index + 1}</div>
      {!compact && <canvas ref={canvasRef} className="av-frame-canvas" />}
      {!compact && <div className="av-frame-dur">{frame.duration}ms</div>}
    </div>
  );
});

// ─── Preview canvas ──────────────────────────────────────────
const PreviewPanel = memo(({ frame, gridSize, gridHeight = gridSize }: { frame: Frame | undefined; gridSize: number; gridHeight?: number }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvasRef.current) renderToCanvas(canvasRef.current, frame, gridSize, gridHeight, PREVIEW_SIZE);
  }, [frame, gridSize, gridHeight]);
  return (
    <div className="av-preview-wrap">
      <canvas ref={canvasRef} className="av-preview-canvas" />
    </div>
  );
});

// ─── Fullscreen Preview Popup ─────────────────────────────────
const FullscreenPreview = memo(({ frames, gridSize, gridHeight = gridSize, onClose }: {
  frames: Frame[]; gridSize: number; gridHeight?: number; onClose: () => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const timerRef = useRef<number | null>(null);
  const safeCurrentFrame = Math.min(currentFrame, Math.max(0, frames.length - 1));

  // Render current frame
  useEffect(() => {
    if (canvasRef.current) renderToCanvas(canvasRef.current, frames[safeCurrentFrame], gridSize, gridHeight, 400);
  }, [safeCurrentFrame, frames, gridSize, gridHeight]);

  // Auto-play
  useEffect(() => {
    if (!isPlaying || frames.length <= 1) return;
    const duration = frames[safeCurrentFrame]?.duration ?? 100;
    timerRef.current = window.setTimeout(() => {
      setCurrentFrame(prev => (prev + 1) % frames.length);
    }, duration);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isPlaying, safeCurrentFrame, frames]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === ' ') { e.preventDefault(); setIsPlaying(p => !p); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="av-fullscreen-overlay" onClick={onClose}>
      <div className="av-fullscreen-content" onClick={e => e.stopPropagation()}>
        <canvas ref={canvasRef} className="av-fullscreen-canvas" />
        <div className="av-fullscreen-controls">
          <button className="av-pb-btn" onClick={() => setCurrentFrame(p => Math.max(0, p - 1))} title="Previous frame">
            <ChevronLeft size={16} />
          </button>
          <button
            className={`av-pb-btn av-pb-play ${isPlaying ? 'playing' : ''}`}
            onClick={() => setIsPlaying(p => !p)}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Square size={18} /> : <Play size={18} />}
          </button>
          <button className="av-pb-btn" onClick={() => setCurrentFrame(p => Math.min(frames.length - 1, p + 1))} title="Next frame">
            <ChevronRight size={16} />
          </button>
          <span className="av-fullscreen-frame-info">{safeCurrentFrame + 1} / {frames.length}</span>
          <button className="av-pb-btn av-fullscreen-close" onClick={onClose} title="Close (Esc)">
            <Minimize2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
});

// ─── Main AnimationView ──────────────────────────────────────
interface AnimationViewProps {
  gridSize: number;
  gridHeight?: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
}

export default function AnimationView({
  gridSize,
  gridHeight = gridSize,
  isPlaying,
  onTogglePlay,
}: AnimationViewProps) {
  // Read from Zustand store
  const animState = useStore(s => s.animState);
  const onionSkinEnabled = useStore(s => s.onionSkinEnabled);
  const onSelectFrame = useStore(s => s.handleFrameChange);
  const onAddFrame = useStore(s => s.handleAddFrame);
  const onDuplicateFrame = useStore(s => s.handleDuplicateFrame);
  const onDeleteFrame = useStore(s => s.handleDeleteFrame);
  const onToggleOnionSkin = () => useStore.getState().setOnionSkinEnabled(!useStore.getState().onionSkinEnabled);
  const onSetDuration = useStore(s => s.handleSetDuration);
  const onSetDurationAll = useStore(s => s.handleSetDurationAll);
  const onReorderFrame = useStore(s => s.handleReorderFrame);
  const onToggleLayerVisibility = useStore(s => s.toggleLayerVisibility);

  const { frames, activeFrameIndex } = animState;
  const activeFrame = frames[activeFrameIndex];
  const layers = activeFrame?.layers ?? [];

  // Loop mode state (UI only — actual loop logic is in usePlayback)
  const [loopMode, setLoopMode] = useState<'forever' | 'once' | 'ping-pong'>('forever');

  // Fullscreen preview state
  const [showFullscreen, setShowFullscreen] = useState(false);

  // Frame drag-and-drop
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<FrameDropPosition | null>(null);
  const dropTargetIndexRef = useRef<number | null>(null);
  const dropPositionRef = useRef<FrameDropPosition | null>(null);
  const frameItemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const pointerFrameDragRef = useRef<FramePointerDrag | null>(null);
  const suppressFrameClickRef = useRef(false);

  // Timeline zoom
  const [zoomLevel, setZoomLevel] = useState(1.0);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll active frame into view
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const thumb = el.children[activeFrameIndex] as HTMLElement | undefined;
    if (thumb) thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [activeFrameIndex]);

  const goPrev = useCallback(() => {
    if (activeFrameIndex > 0) onSelectFrame(activeFrameIndex - 1);
  }, [activeFrameIndex, onSelectFrame]);

  const goNext = useCallback(() => {
    if (activeFrameIndex < frames.length - 1) onSelectFrame(activeFrameIndex + 1);
  }, [activeFrameIndex, frames.length, onSelectFrame]);

  // Mouse wheel: scroll = navigate frames, Ctrl+scroll = zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      setZoomLevel(prev => Math.max(0.5, Math.min(2.5, prev + (e.deltaY < 0 ? 0.15 : -0.15))));
    } else {
      if (e.deltaY > 0 || e.deltaX > 0) goNext();
      else if (e.deltaY < 0 || e.deltaX < 0) goPrev();
    }
  }, [goNext, goPrev]);

  const resetFrameDragState = () => {
    pointerFrameDragRef.current = null;
    dropTargetIndexRef.current = null;
    dropPositionRef.current = null;
    setDraggedIndex(null);
    setDropTargetIndex(null);
    setDropPosition(null);
    document.body.style.cursor = '';
  };

  const setFrameItemRef = (id: string) => (node: HTMLDivElement | null) => {
    if (node) frameItemRefs.current.set(id, node);
    else frameItemRefs.current.delete(id);
  };

  const setFrameDropTarget = (target: FrameDropTarget | null) => {
    dropTargetIndexRef.current = target?.index ?? null;
    dropPositionRef.current = target?.position ?? null;
    setDropTargetIndex(target?.index ?? null);
    setDropPosition(target?.position ?? null);
  };

  const getFrameDropTargetFromPoint = (clientX: number, sourceIndex: number): FrameDropTarget | null => {
    const candidates = frames
      .map((frame, index) => ({
        index,
        element: frameItemRefs.current.get(frame.id),
      }))
      .filter((item): item is { index: number; element: HTMLDivElement } => Boolean(item.element));

    if (candidates.length === 0) return null;

    for (const item of candidates) {
      const rect = item.element.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right) {
        if (item.index === sourceIndex) return null;
        return { index: item.index, position: clientX < rect.left + rect.width / 2 ? 'left' : 'right' };
      }
      if (clientX < rect.left) {
        if (item.index === sourceIndex) return null;
        return { index: item.index, position: 'left' };
      }
    }

    const last = candidates[candidates.length - 1];
    if (last.index === sourceIndex) return null;
    return { index: last.index, position: 'right' };
  };

  const reorderFrameByDropTarget = (sourceIndex: number, target: FrameDropTarget) => {
    let nextIndex = target.position === 'left' ? target.index : target.index + 1;
    if (sourceIndex < nextIndex) nextIndex--;
    nextIndex = Math.max(0, Math.min(frames.length - 1, nextIndex));
    if (sourceIndex !== nextIndex) onReorderFrame(sourceIndex, nextIndex);
  };

  const handleFramePointerDown = (e: React.PointerEvent<HTMLDivElement>, index: number) => {
    if (e.button !== 0 || isPlaying || frames.length <= 1) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerFrameDragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      index,
      isDragging: false,
    };
  };

  const handleFramePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = pointerFrameDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.isDragging && Math.hypot(dx, dy) < 4) return;

    if (!drag.isDragging) {
      drag.isDragging = true;
      suppressFrameClickRef.current = true;
      setDraggedIndex(drag.index);
      document.body.style.cursor = 'grabbing';
    }

    setFrameDropTarget(getFrameDropTargetFromPoint(e.clientX, drag.index));
    e.preventDefault();
  };

  const handleFramePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = pointerFrameDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    if (drag.isDragging) {
      const target = dropTargetIndexRef.current !== null && dropPositionRef.current
        ? { index: dropTargetIndexRef.current, position: dropPositionRef.current }
        : getFrameDropTargetFromPoint(e.clientX, drag.index);

      if (target) reorderFrameByDropTarget(drag.index, target);
      e.preventDefault();
      e.stopPropagation();
    }

    resetFrameDragState();
  };

  // Timeline ruler: total duration with adaptive step
  const totalDuration = frames.reduce((s, f) => s + f.duration, 0);
  const majorStep = totalDuration > 10000 ? 2000 : totalDuration > 5000 ? 1000 : totalDuration > 2000 ? 500 : totalDuration > 500 ? 250 : 100;
  const minorStep = totalDuration > 5000 ? 500 : totalDuration > 2000 ? 250 : 100;

  // Cumulative time per frame for ruler indicator
  const frameTimes = frames.reduce<number[]>((acc, _, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + frames[i - 1].duration);
    return acc;
  }, []);
  const activeStartMs = frameTimes[activeFrameIndex] ?? 0;

  return (
    <div className="av-root">

      {/* ── TOP ROW: Frame Settings + Preview ── */}
      <div className="av-top">

        {/* Frame Settings panel */}
        <div className="av-settings">
          <div className="av-settings-title">Frame Settings</div>

          <div className="av-field">
            <label className="av-label">Duration</label>
            <div className="av-duration-row">
              <input
                type="number"
                className="av-input"
                min={16}
                max={2000}
                step={10}
                value={activeFrame?.duration ?? 100}
                onChange={(e) => onSetDuration(activeFrameIndex, Math.max(16, Number(e.target.value)))}
                disabled={isPlaying}
              />
              <button
                className="av-icon-btn"
                onClick={() => onSetDurationAll(activeFrame?.duration ?? 100)}
                title="Apply to all frames"
                disabled={isPlaying}
              >
                <RefreshCw size={12} />
              </button>
              <span className="av-unit">ms</span>
            </div>
          </div>

          <div className="av-field">
            <label className="av-label">Loop</label>
            <select
              className="av-select"
              value={loopMode}
              onChange={(e) => setLoopMode(e.target.value as typeof loopMode)}
            >
              <option value="forever">Forever</option>
              <option value="once">Once</option>
              <option value="ping-pong">Ping-Pong</option>
            </select>
          </div>

        </div>

        {/* Preview + playback */}
        <div className="av-preview-col">
          <PreviewPanel frame={activeFrame} gridSize={gridSize} gridHeight={gridHeight} />

          {/* Playback controls */}
          <div className="av-playback">
            <button className="av-pb-btn" onClick={() => onSelectFrame(0)} title="First frame">
              <SkipBack size={16} />
            </button>
            <button className="av-pb-btn" onClick={goPrev} title="Previous frame">
              <ChevronLeft size={16} />
            </button>
            <button
              className={`av-pb-btn av-pb-play ${isPlaying ? 'playing' : ''}`}
              onClick={onTogglePlay}
              title={isPlaying ? 'Stop' : frames.length <= 1 ? 'Need at least 2 frames' : 'Play'}
              disabled={frames.length <= 1}
            >
              {isPlaying ? <Square size={18} /> : <Play size={18} />}
            </button>
            <button className="av-pb-btn" onClick={goNext} title="Next frame">
              <ChevronRight size={16} />
            </button>
            <button className="av-pb-btn" onClick={() => onSelectFrame(frames.length - 1)} title="Last frame">
              <SkipForward size={16} />
            </button>
            <button
              className={`av-pb-btn ${onionSkinEnabled ? 'active' : ''}`}
              onClick={onToggleOnionSkin}
              title="Onion skin"
            >
              <RotateCcw size={14} />
            </button>
            <div className="av-pb-sep" />
            <button
              className="av-pb-btn"
              onClick={() => setShowFullscreen(true)}
              title="Fullscreen preview"
            >
              <Maximize2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── TIMELINE SECTION ── */}
      <div className="av-timeline-section">
        <div className="av-section-header">
          <span className="av-section-title">Timeline</span>
          <div className="av-section-actions">
            <button className="av-icon-btn" onClick={onAddFrame} title="Add frame" disabled={isPlaying}>
              <Plus size={13} />
            </button>
            <button className="av-icon-btn" onClick={onDuplicateFrame} title="Duplicate frame" disabled={isPlaying}>
              <Copy size={13} />
            </button>
            <button className="av-icon-btn" onClick={onDeleteFrame} title="Delete frame" disabled={isPlaying || frames.length <= 1}>
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Frame strip */}
        <div className="av-frame-strip" ref={scrollRef} onWheel={handleWheel} style={{ '--av-zoom': zoomLevel } as React.CSSProperties}>
          {frames.map((frame, i) => (
            <FrameThumb
              key={frame.id}
              frame={frame}
              index={i}
              isActive={i === activeFrameIndex}
              gridSize={gridSize}
              gridHeight={gridHeight}
              isDragging={draggedIndex === i}
              dropTarget={dropTargetIndex === i ? dropPosition : null}
              draggable={!isPlaying && frames.length > 1}
              compact={zoomLevel < 0.7}
              setFrameRef={setFrameItemRef(frame.id)}
              onClick={() => {
                if (suppressFrameClickRef.current) {
                  suppressFrameClickRef.current = false;
                  return;
                }
                if (!isPlaying) onSelectFrame(i);
              }}
              onPointerDown={(e) => handleFramePointerDown(e, i)}
              onPointerMove={handleFramePointerMove}
              onPointerUp={handleFramePointerUp}
              onPointerCancel={resetFrameDragState}
            />
          ))}
          {/* Add frame button at end */}
          <button className="av-add-frame-btn" onClick={onAddFrame} disabled={isPlaying} title="Add frame">
            <Plus size={16} />
          </button>
        </div>

        {/* Ruler */}
        <div className="av-ruler">
          {/* Active frame indicator */}
          <div
            className="av-ruler-indicator"
            style={{
              left: `${(activeStartMs / Math.max(totalDuration, 1)) * 100}%`,
            }}
          />
          {Array.from({ length: Math.ceil(totalDuration / minorStep) + 1 }, (_, i) => {
            const timeMs = i * minorStep;
            if (timeMs > totalDuration) return null;
            const isMajor = timeMs % majorStep === 0;
            return (
              <div
                key={i}
                className={`av-ruler-mark ${isMajor ? 'major' : ''}`}
                style={{ left: `${(timeMs / Math.max(totalDuration, 1)) * 100}%` }}
              >
                {isMajor && <span>{timeMs >= 1000 ? `${(timeMs / 1000).toFixed(1)}s` : `${timeMs}ms`}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── ANIMATION LAYERS SECTION ── */}
      <div className="av-layers-section">
        <div className="av-section-header">
          <span className="av-section-title">Animation Layers</span>
          {/* Frame number headers */}
          <div className="av-layer-frame-headers">
            {frames.map((_, i) => (
              <div
                key={i}
                className={`av-layer-frame-header ${i === activeFrameIndex ? 'active' : ''}`}
                onClick={() => onSelectFrame(i)}
              >
                {i + 1}
              </div>
            ))}
          </div>
        </div>

        <div className="av-layer-rows">
          {[...layers].reverse().map((layer) => (
            <div key={layer.id} className="av-layer-row">
              {/* Layer info */}
              <div className="av-layer-info">
                <button
                  className={`av-eye-btn ${layer.visible ? 'visible' : ''}`}
                  onClick={() => onToggleLayerVisibility(layer.id)}
                  title="Toggle visibility"
                >
                  {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                </button>
                <div
                  className="av-layer-swatch"
                  style={{ background: layer.grid.flat().find(c => c) ?? 'transparent' }}
                />
                <span className="av-layer-name">{layer.name}</span>
              </div>

              {/* Dots per frame */}
              <div className="av-layer-dots">
                {frames.map((frame, fi) => {
                  const hasContent = frame.layers
                    .find(l => l.id === layer.id)
                    ?.grid.some(row => row.some(c => c !== null));
                  return (
                    <div
                      key={fi}
                      className={`av-layer-dot-cell ${fi === activeFrameIndex ? 'active-col' : ''}`}
                      onClick={() => onSelectFrame(fi)}
                    >
                      {hasContent && <span className="av-dot" />}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Fullscreen Preview Popup ── */}
      {showFullscreen && (
        <FullscreenPreview
          frames={frames}
          gridSize={gridSize}
          gridHeight={gridHeight}
          onClose={() => setShowFullscreen(false)}
        />
      )}
    </div>
  );
}
