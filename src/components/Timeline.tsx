import { useRef, useEffect, useCallback, memo, useState } from 'react';
import {
  Plus, Copy, Trash2, Play, Square,
  ChevronLeft, ChevronRight, Layers as OnionIcon,
  GripHorizontal, Minimize2, X, PanelBottomOpen
} from 'lucide-react';
import type { Frame } from '../types';

interface TimelineProps {
  frames: Frame[];
  activeFrameIndex: number;
  gridSize: number;
  isPlaying: boolean;
  onionSkinEnabled: boolean;

  onSelectFrame: (index: number) => void;
  onAddFrame: () => void;
  onDuplicateFrame: () => void;
  onDeleteFrame: () => void;
  onTogglePlay: () => void;
  onToggleOnionSkin: () => void;
  onSetDuration: (index: number, duration: number) => void;
  onSetDurationAll: (duration: number) => void;
  onReorderFrame: (oldIndex: number, newIndex: number) => void;
  /** Called when user drops the floating panel onto the tab bar */
  onPinToTab?: () => void;
}

// ---------- Thumbnail renderer ----------

const THUMB_SIZE = 64;

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
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, THUMB_SIZE, THUMB_SIZE);

  const ps = THUMB_SIZE / gridSize;

  for (let i = 0; i < frame.layers.length; i++) {
    const layer = frame.layers[i];
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

// ---------- Single frame thumb ----------

const FrameThumb = memo(({
  frame, index, isActive, gridSize, isDragging, dropTarget, draggable,
  onClick, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd
}: {
  frame: Frame;
  index: number;
  isActive: boolean;
  gridSize: number;
  isDragging: boolean;
  dropTarget: 'left' | 'right' | null;
  draggable: boolean;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) renderThumbnail(canvasRef.current, frame, gridSize);
  }, [frame, gridSize]);

  return (
    <div
      className={`frame-thumb ${isActive ? 'active' : ''} ${isDragging ? 'dragging' : ''} ${dropTarget === 'left' ? 'drop-target-left' : ''} ${dropTarget === 'right' ? 'drop-target-right' : ''}`}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <canvas ref={canvasRef} />
      <div className="frame-thumb-label">{index + 1}</div>
      <div className="frame-thumb-duration">{frame.duration}ms</div>
    </div>
  );
});

// ---------- Timeline ----------

export default function Timeline({
  frames,
  activeFrameIndex,
  gridSize,
  isPlaying,
  onionSkinEnabled,
  onSelectFrame,
  onAddFrame,
  onDuplicateFrame,
  onDeleteFrame,
  onTogglePlay,
  onToggleOnionSkin,
  onSetDuration,
  onSetDurationAll,
  onReorderFrame,
  onPinToTab,
}: TimelineProps) {
  // Docked height (when not floating)
  const [dockedHeight, setDockedHeight] = useState(130);
  const isResizingDocked = useRef(false);

  // Floating state
  const [isFloating, setIsFloating] = useState(false);
  const [floatPos, setFloatPos] = useState({ x: 80, y: 120 });
  const [floatSize, setFloatSize] = useState({ w: 680, h: 220 });

  // Drag-to-float: track pointer on the grip handle
  const isDraggingFloat = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Resize floating panel
  const isResizingFloat = useRef(false);
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

  // Tab-drop hint
  const [isNearTabBar, setIsNearTabBar] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Frame drag-and-drop
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<'left' | 'right' | null>(null);

  // ── Docked resize ──────────────────────────────────────────
  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (isResizingDocked.current) {
        const newH = window.innerHeight - e.clientY - 36; // 36 = bottom-bar height
        setDockedHeight(Math.max(80, Math.min(newH, 500)));
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

        // Detect if near the tab bar (top ~70px of window)
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
        // If dropped near tab bar → pin to tab
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
    const thumb = el.children[activeFrameIndex] as HTMLElement | undefined;
    if (thumb) thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeFrameIndex]);

  const goPrev = useCallback(() => {
    if (activeFrameIndex > 0) onSelectFrame(activeFrameIndex - 1);
  }, [activeFrameIndex, onSelectFrame]);

  const goNext = useCallback(() => {
    if (activeFrameIndex < frames.length - 1) onSelectFrame(activeFrameIndex + 1);
  }, [activeFrameIndex, frames.length, onSelectFrame]);

  // ── Shared inner content ───────────────────────────────────
  const innerContent = (
    <>
      {/* Controls bar */}
      <div className="timeline-controls">
        {/* Grip handle — always visible, drag to float */}
        <div
          className="tl-grip"
          onPointerDown={handleGripPointerDown}
          title="Drag to detach as floating panel"
        >
          <GripHorizontal size={14} />
        </div>

        <div className="tl-sep" />

        <button
          className={`tl-btn ${isPlaying ? 'playing' : ''}`}
          onClick={onTogglePlay}
          title={isPlaying ? 'Stop' : 'Play'}
          disabled={frames.length <= 1}
        >
          {isPlaying ? <Square size={14} /> : <Play size={14} />}
        </button>

        <div className="tl-sep" />

        <button className="tl-btn" onClick={goPrev} title="Previous Frame" disabled={isPlaying}>
          <ChevronLeft size={14} />
        </button>
        <button className="tl-btn" onClick={goNext} title="Next Frame" disabled={isPlaying}>
          <ChevronRight size={14} />
        </button>

        <div className="tl-sep" />

        <button className="tl-btn" onClick={onAddFrame} title="Add Frame" disabled={isPlaying}>
          <Plus size={14} />
        </button>
        <button className="tl-btn" onClick={onDuplicateFrame} title="Duplicate Frame" disabled={isPlaying}>
          <Copy size={14} />
        </button>
        <button
          className="tl-btn"
          onClick={onDeleteFrame}
          title="Delete Frame"
          disabled={isPlaying || frames.length <= 1}
        >
          <Trash2 size={14} />
        </button>

        <div className="tl-sep" />

        <button
          className={`tl-btn ${onionSkinEnabled ? 'active' : ''}`}
          onClick={onToggleOnionSkin}
          title="Onion Skin"
        >
          <OnionIcon size={14} />
        </button>

        <div className="tl-info">
          <span className="tl-frame-count">{activeFrameIndex + 1}/{frames.length}</span>
        </div>

        {/* Duration control */}
        <div className="tl-duration-control" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <label title="Frame duration (ms)">
            <span>⏱</span>
            <input
              type="number"
              min={16}
              max={2000}
              step={10}
              value={frames[activeFrameIndex]?.duration ?? 100}
              onChange={(e) => onSetDuration(activeFrameIndex, Math.max(16, Number(e.target.value)))}
              disabled={isPlaying}
              className="tl-duration-input"
            />
            <span style={{ opacity: 0.5 }}>ms</span>
          </label>
          <button
            className="tl-btn"
            style={{ width: 'auto', padding: '0 8px', fontSize: '11px', whiteSpace: 'nowrap' }}
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

      {/* Frame strip */}
      <div className="timeline-scroll" ref={scrollRef}>
        {frames.map((frame, i) => (
          <FrameThumb
            key={frame.id}
            frame={frame}
            index={i}
            isActive={i === activeFrameIndex}
            gridSize={gridSize}
            isDragging={draggedIndex === i}
            dropTarget={dropTargetIndex === i ? dropPosition : null}
            draggable={!isPlaying && frames.length > 1}
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
      </div>
    </>
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
          {/* Pin to tab button */}
          {onPinToTab && (
            <button
              className="tl-btn"
              style={{ marginLeft: 8, width: 22, height: 22, flexShrink: 0 }}
              onClick={() => { onPinToTab(); setIsFloating(false); }}
              title="Pin as tab"
            >
              <PanelBottomOpen size={12} />
            </button>
          )}
          <button
            className="tl-btn"
            style={{ marginLeft: 'auto', width: 20, height: 20 }}
            onClick={handleDock}
            title="Dock to bottom"
          >
            <Minimize2 size={12} />
          </button>
          <button
            className="tl-btn"
            style={{ width: 20, height: 20 }}
            onClick={handleDock}
            title="Close floating panel"
          >
            <X size={12} />
          </button>
        </div>

        {/* Drop-to-tab hint overlay */}
        {isNearTabBar && (
          <div className="timeline-float-pin-hint">
            ↑ Release to pin as tab
          </div>
        )}

        {/* Content */}
        <div className="timeline-float-body">
          {innerContent}
        </div>

        {/* Resize handle — bottom-right corner */}
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
      {/* Vertical resize handle */}
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
