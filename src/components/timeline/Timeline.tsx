import { useRef, useEffect, useCallback, memo, useState } from 'react';
import {
  Plus, Copy, Trash2, Play, Square, SkipBack,
  ChevronLeft, ChevronRight, Layers as OnionIcon,
  GripHorizontal, Minimize2, X, PanelBottomOpen, Clock
} from 'lucide-react';
import type { Frame } from '../../types';
import { useStore } from '../../store';

interface TimelineProps {
  gridSize: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  /** Called when user drops the floating panel onto the tab bar */
  onPinToTab?: () => void;
}

// ---------- Thumbnail renderer ----------

const THUMB_SIZE = 40;

function renderThumbnail(canvas: HTMLCanvasElement, frame: Frame, gridSize: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(THUMB_SIZE * ratio);
  canvas.height = Math.round(THUMB_SIZE * ratio);
  canvas.style.width = `${THUMB_SIZE}px`;
  canvas.style.height = `${THUMB_SIZE}px`;

  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.imageSmoothingEnabled = false;

  // Dark checkerboard bg
  const sq = Math.max(2, Math.round(THUMB_SIZE / gridSize / 2));
  for (let row = 0; row < Math.ceil(THUMB_SIZE / sq); row++) {
    for (let col = 0; col < Math.ceil(THUMB_SIZE / sq); col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? '#2a2a3e' : '#22223a';
      ctx.fillRect(col * sq, row * sq, sq, sq);
    }
  }

  const ps = THUMB_SIZE / gridSize;

  for (const layer of frame.layers) {
    if (!layer.visible) continue;
    ctx.save();
    ctx.translate(layer.transform.x * ps, layer.transform.y * ps);
    if (layer.transform.rotation !== 0) {
      const c = THUMB_SIZE / 2;
      ctx.translate(c, c);
      ctx.rotate((layer.transform.rotation * Math.PI) / 180);
      ctx.translate(-c, -c);
    }
    if (layer.transform.scale !== 1) {
      const c = THUMB_SIZE / 2;
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
          ctx.fillRect(x * ps, y * ps, Math.ceil(ps), Math.ceil(ps));
        }
      }
    }
    ctx.restore();
  }
}

// ---------- Keyframe marker ----------

const KeyframeMarker = memo(({
  frame, index, isActive, gridSize, isDragging, dropTarget, draggable, compact,
  onClick, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd
}: {
  frame: Frame;
  index: number;
  isActive: boolean;
  gridSize: number;
  isDragging: boolean;
  dropTarget: 'left' | 'right' | null;
  draggable: boolean;
  compact: boolean;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!compact && canvasRef.current) renderThumbnail(canvasRef.current, frame, gridSize);
  }, [frame, gridSize, compact]);

  return (
    <div
      className={`tl-keyframe ${isActive ? 'active' : ''} ${isDragging ? 'dragging' : ''} ${compact ? 'compact' : ''} ${dropTarget === 'left' ? 'drop-target-left' : ''} ${dropTarget === 'right' ? 'drop-target-right' : ''}`}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {!compact && <canvas ref={canvasRef} className="tl-keyframe-thumb" />}
      <span className="tl-keyframe-label">{index + 1}</span>
    </div>
  );
});

// ---------- Timeline ----------

export default function Timeline({
  gridSize,
  isPlaying,
  onTogglePlay,
  onPinToTab,
}: TimelineProps) {
  // Read from Zustand store
  const frames = useStore(s => s.animState.frames);
  const activeFrameIndex = useStore(s => s.animState.activeFrameIndex);
  const onionSkinEnabled = useStore(s => s.onionSkinEnabled);
  const onSelectFrame = useStore(s => s.handleFrameChange);
  const onAddFrame = useStore(s => s.handleAddFrame);
  const onDuplicateFrame = useStore(s => s.handleDuplicateFrame);
  const onDeleteFrame = useStore(s => s.handleDeleteFrame);
  const onToggleOnionSkin = () => useStore.getState().setOnionSkinEnabled(!useStore.getState().onionSkinEnabled);
  const onSetDuration = useStore(s => s.handleSetDuration);
  const onSetDurationAll = useStore(s => s.handleSetDurationAll);
  const onReorderFrame = useStore(s => s.handleReorderFrame);
  // Docked height (when not floating)
  const [dockedHeight, setDockedHeight] = useState(200);
  const isResizingDocked = useRef(false);

  // Floating state
  const [isFloating, setIsFloating] = useState(false);
  const [floatPos, setFloatPos] = useState({ x: 80, y: 120 });
  const [floatSize, setFloatSize] = useState({ w: 700, h: 280 });

  // Drag-to-float: track pointer on the grip handle
  const isDraggingFloat = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Resize floating panel
  const isResizingFloat = useRef(false);
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

  // Tab-drop hint
  const [isNearTabBar, setIsNearTabBar] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);

  // Zoom level for keyframe markers (1.0 = default, range 0.5 – 2.5)
  const [zoomLevel, setZoomLevel] = useState(1.0);

  // Frame drag-and-drop
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<'left' | 'right' | null>(null);

  // Cumulative times for ruler positioning
  const frameTimes = frames.reduce<number[]>((acc, _, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + frames[i - 1].duration);
    return acc;
  }, []);
  const totalDuration = frameTimes.length > 0
    ? frameTimes[frameTimes.length - 1] + frames[frames.length - 1].duration
    : 0;

  // ── Docked resize ──────────────────────────────────────────
  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (isResizingDocked.current) {
        const newH = window.innerHeight - e.clientY - 36;
        setDockedHeight(Math.max(120, Math.min(newH, 500)));
      }
    };
    const handleUp = () => {
      if (isResizingDocked.current) {
        isResizingDocked.current = false;
        document.body.style.cursor = '';
      }
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, []);

  // ── Floating panel drag + resize ──────────────────────────
  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (isDraggingFloat.current) {
        const newX = Math.max(0, e.clientX - dragOffset.current.x);
        const newY = Math.max(0, e.clientY - dragOffset.current.y);
        setFloatPos({ x: newX, y: newY });
        setIsNearTabBar(e.clientY < 80);
      }
      if (isResizingFloat.current) {
        const dw = e.clientX - resizeStart.current.x;
        const dh = e.clientY - resizeStart.current.y;
        setFloatSize({
          w: Math.max(400, resizeStart.current.w + dw),
          h: Math.max(140, resizeStart.current.h + dh),
        });
      }
    };
    const handleUp = (e: PointerEvent) => {
      if (isDraggingFloat.current) {
        if (e.clientY < 80 && onPinToTab) {
          onPinToTab();
          setIsFloating(false);
        }
        setIsNearTabBar(false);
      }
      if (isDraggingFloat.current || isResizingFloat.current) {
        isDraggingFloat.current = false;
        isResizingFloat.current = false;
        document.body.style.cursor = '';
      }
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [onPinToTab]);

  // ── Detach: drag the grip handle out of the docked position ──
  const handleGripPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    let detached = false;

    const onMove = (ev: PointerEvent) => {
      if (!detached && (Math.abs(ev.clientX - startX) > 8 || Math.abs(ev.clientY - startY) > 8)) {
        detached = true;
        setFloatPos({ x: Math.max(0, ev.clientX - 200), y: Math.max(0, ev.clientY - 16) });
        setIsFloating(true);
        dragOffset.current = { x: 200, y: 16 };
        isDraggingFloat.current = true;
        document.body.style.cursor = 'grabbing';
      } else if (detached) {
        const newX = Math.max(0, ev.clientX - dragOffset.current.x);
        const newY = Math.max(0, ev.clientY - dragOffset.current.y);
        setFloatPos({ x: newX, y: newY });
        setIsNearTabBar(ev.clientY < 80);
      }
    };
    const onUp = (ev: PointerEvent) => {
      if (detached && ev.clientY < 80 && onPinToTab) {
        onPinToTab();
        setIsFloating(false);
      }
      setIsNearTabBar(false);
      isDraggingFloat.current = false;
      document.body.style.cursor = '';
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // ── Dock back ──────────────────────────────────────────────
  const handleDock = () => setIsFloating(false);

  // ── Scroll active frame into view ─────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const marker = el.querySelector('.tl-keyframe.active') as HTMLElement | undefined;
    if (marker) marker.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeFrameIndex]);

  const goPrev = useCallback(() => {
    if (activeFrameIndex > 0) onSelectFrame(activeFrameIndex - 1);
  }, [activeFrameIndex, onSelectFrame]);

  const goNext = useCallback(() => {
    if (activeFrameIndex < frames.length - 1) onSelectFrame(activeFrameIndex + 1);
  }, [activeFrameIndex, frames.length, onSelectFrame]);

  // ── Ruler click to seek ─────────────────────────────────
  const handleRulerClick = useCallback((e: React.MouseEvent) => {
    const ruler = rulerRef.current;
    if (!ruler || totalDuration === 0) return;
    const rect = ruler.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const clickTime = ratio * totalDuration;
    // Find the closest frame
    let closest = 0;
    let minDist = Infinity;
    for (let i = 0; i < frameTimes.length; i++) {
      const dist = Math.abs(frameTimes[i] - clickTime);
      if (dist < minDist) { minDist = dist; closest = i; }
    }
    onSelectFrame(closest);
  }, [totalDuration, frameTimes, onSelectFrame]);

  // ── Ruler marks ─────────────────────────────────────────
  const RULER_STEP = totalDuration > 10000 ? 2000 : totalDuration > 5000 ? 1000 : totalDuration > 2000 ? 500 : totalDuration > 500 ? 250 : 100;
  const RULER_MINOR = totalDuration > 5000 ? 500 : totalDuration > 2000 ? 250 : 100;
  const rulerMarkCount = Math.ceil(totalDuration / RULER_MINOR);

  // ── Wheel handler: navigate frames / Ctrl+wheel to zoom ──
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Zoom: Ctrl + wheel
      setZoomLevel(prev => Math.max(0.5, Math.min(2.5, prev + (e.deltaY < 0 ? 0.15 : -0.15))));
    } else {
      // Navigate frames: wheel left/right or up/down
      if (e.deltaY > 0 || e.deltaX > 0) goNext();
      else if (e.deltaY < 0 || e.deltaX < 0) goPrev();
    }
  }, [goNext, goPrev]);

  // ── Shared inner content ───────────────────────────────────
  const innerContent = (
    <div className="tl-inner" onWheel={handleWheel}>
      {/* Top toolbar */}
      <div className="tl-toolbar">
        <div
          className="tl-grip"
          onPointerDown={handleGripPointerDown}
          title="Drag to detach as floating panel"
        >
          <GripHorizontal size={14} />
        </div>

        <div className="tl-sep" />

        {/* Playback controls */}
        <button className="tl-btn" onClick={() => onSelectFrame(0)} title="First Frame" disabled={isPlaying}>
          <SkipBack size={13} />
        </button>
        <button className="tl-btn" onClick={goPrev} title="Previous Frame" disabled={isPlaying}>
          <ChevronLeft size={14} />
        </button>
        <button
          className={`tl-btn ${isPlaying ? 'playing' : ''}`}
          onClick={onTogglePlay}
          title={isPlaying ? 'Stop' : frames.length <= 1 ? 'Need at least 2 frames' : 'Play'}
          disabled={frames.length <= 1}
        >
          {isPlaying ? <Square size={14} /> : <Play size={14} />}
        </button>
        <button className="tl-btn" onClick={goNext} title="Next Frame" disabled={isPlaying}>
          <ChevronRight size={14} />
        </button>

        <div className="tl-sep" />

        {/* Frame info */}
        <div className="tl-info">
          <span className="tl-frame-count">{activeFrameIndex + 1} / {frames.length}</span>
        </div>

        <div className="tl-sep" />

        {/* Actions */}
        <button className="tl-btn" onClick={onAddFrame} title="Add Frame" disabled={isPlaying}>
          <Plus size={14} />
        </button>
        <button className="tl-btn" onClick={onDuplicateFrame} title="Duplicate Frame" disabled={isPlaying}>
          <Copy size={14} />
        </button>
        <button className="tl-btn" onClick={onDeleteFrame} title="Delete Frame" disabled={isPlaying || frames.length <= 1}>
          <Trash2 size={14} />
        </button>

        <div className="tl-sep" />

        <button className={`tl-btn ${onionSkinEnabled ? 'active' : ''}`} onClick={onToggleOnionSkin} title="Onion Skin">
          <OnionIcon size={14} />
        </button>

        {/* Duration control */}
        <div className="tl-duration-control">
          <Clock size={11} style={{ opacity: 0.5 }} />
          <input
            type="number"
            min={16}
            max={2000}
            step={10}
            value={frames[activeFrameIndex]?.duration ?? 100}
            onChange={(e) => onSetDuration(activeFrameIndex, Math.max(16, Number(e.target.value)))}
            disabled={isPlaying}
            className="tl-duration-input"
            title="Frame duration (ms)"
          />
          <span className="tl-duration-unit">ms</span>
          <button
            className="tl-btn tl-apply-all-btn"
            onClick={() => onSetDurationAll(frames[activeFrameIndex]?.duration ?? 100)}
            disabled={isPlaying}
            title="Apply to all frames"
          >
            All
          </button>
        </div>

        {/* Dock button — only in floating mode */}
        {isFloating && (
          <>
            <div className="tl-sep" />
            <button className="tl-btn" onClick={handleDock} title="Dock back to bottom">
              <Minimize2 size={14} />
            </button>
          </>
        )}
      </div>

      {/* Time ruler */}
      <div className="tl-ruler" ref={rulerRef} onClick={handleRulerClick}>
        {/* Playback head */}
        <div
          className="tl-playback-head"
          style={{
            left: totalDuration > 0
              ? `${((frameTimes[activeFrameIndex] ?? 0) / totalDuration) * 100}%`
              : '0%',
          }}
        />
        {/* Ruler marks */}
        {Array.from({ length: rulerMarkCount + 1 }, (_, i) => {
          const timeMs = i * RULER_MINOR;
          if (timeMs > totalDuration) return null;
          const isMajor = timeMs % RULER_STEP === 0;
          return (
            <div
              key={i}
              className={`tl-ruler-mark ${isMajor ? 'major' : ''}`}
              style={{ left: `${(timeMs / Math.max(totalDuration, 1)) * 100}%` }}
            >
              {isMajor && <span>{timeMs >= 1000 ? `${(timeMs / 1000).toFixed(1)}s` : `${timeMs}ms`}</span>}
            </div>
          );
        })}
      </div>

      {/* Keyframe track */}
      <div className="tl-track" ref={scrollRef} style={{ '--tl-zoom': zoomLevel } as React.CSSProperties}>
        {frames.map((frame, i) => (
          <KeyframeMarker
            key={frame.id}
            frame={frame}
            index={i}
            isActive={i === activeFrameIndex}
            gridSize={gridSize}
            isDragging={draggedIndex === i}
            dropTarget={dropTargetIndex === i ? dropPosition : null}
            draggable={!isPlaying && frames.length > 1}
            compact={zoomLevel < 0.7}
            onClick={() => !isPlaying && onSelectFrame(i)}
            onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDraggedIndex(i); }}
            onDragOver={(e) => {
              e.preventDefault();
              if (draggedIndex === null || draggedIndex === i) return;
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const isLeft = e.clientX < rect.left + rect.width / 2;
              setDropTargetIndex(i);
              setDropPosition(isLeft ? 'left' : 'right');
            }}
            onDragLeave={() => { setDropTargetIndex(null); setDropPosition(null); }}
            onDrop={(e) => {
              e.preventDefault();
              if (draggedIndex !== null && dropTargetIndex !== null) {
                let newIndex = dropTargetIndex;
                if (draggedIndex < dropTargetIndex && dropPosition === 'left') newIndex -= 1;
                else if (draggedIndex > dropTargetIndex && dropPosition === 'right') newIndex += 1;
                onReorderFrame(draggedIndex, newIndex);
              }
              setDraggedIndex(null);
              setDropTargetIndex(null);
              setDropPosition(null);
            }}
            onDragEnd={() => { setDraggedIndex(null); setDropTargetIndex(null); setDropPosition(null); }}
          />
        ))}
        {/* Add frame button at end */}
        <button className="tl-add-frame-btn" onClick={onAddFrame} disabled={isPlaying} title="Add frame">
          <Plus size={14} />
        </button>
      </div>
    </div>
  );

  // ── Floating panel ─────────────────────────────────────────
  if (isFloating) {
    return (
      <div
        className={`timeline-float ${isNearTabBar ? 'timeline-float-snap' : ''}`}
        style={{
          left: floatPos.x,
          top: floatPos.y,
          width: floatSize.w,
          height: floatSize.h,
        }}
      >
        {/* Floating title bar */}
        <div
          className="timeline-float-titlebar"
          onPointerDown={(e) => {
            e.preventDefault();
            const rect = (e.currentTarget as HTMLElement).closest('.timeline-float')!.getBoundingClientRect();
            dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            isDraggingFloat.current = true;
            document.body.style.cursor = 'grabbing';
          }}
        >
          <GripHorizontal size={12} style={{ opacity: 0.5 }} />
          <span>Animation</span>
          {onPinToTab && (
            <button
              className="tl-btn tl-pin-btn"
              onClick={() => { onPinToTab(); setIsFloating(false); }}
              title="Pin as tab"
            >
              <PanelBottomOpen size={12} />
            </button>
          )}
          <button className="tl-btn tl-dock-btn" onClick={handleDock} title="Dock to bottom">
            <Minimize2 size={12} />
          </button>
          <button className="tl-btn" onClick={handleDock} title="Close floating panel">
            <X size={12} />
          </button>
        </div>

        {isNearTabBar && (
          <div className="timeline-float-pin-hint">
            ↑ Release to pin as tab
          </div>
        )}

        <div className="timeline-float-body">
          {innerContent}
        </div>

        <div
          className="timeline-float-resize"
          onPointerDown={(e) => {
            e.preventDefault();
            isResizingFloat.current = true;
            resizeStart.current = { x: e.clientX, y: e.clientY, w: floatSize.w, h: floatSize.h };
            document.body.style.cursor = 'nwse-resize';
          }}
        />
      </div>
    );
  }

  // ── Docked panel ───────────────────────────────────────────
  return (
    <div className="timeline" style={{ height: `${dockedHeight}px`, position: 'relative' }}>
      <div
        className="timeline-resizer"
        onPointerDown={(e) => {
          e.preventDefault();
          isResizingDocked.current = true;
          document.body.style.cursor = 'row-resize';
        }}
      />
      {innerContent}
    </div>
  );
}
