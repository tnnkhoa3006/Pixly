import { useRef, useEffect, memo, useState, useCallback } from 'react';
import {
  Play, Square, SkipBack, SkipForward, ChevronLeft, ChevronRight,
  Plus, Copy, Trash2, Eye, EyeOff, RefreshCw, RotateCcw
} from 'lucide-react';
import type { Frame, AnimationState } from '../types';

// ─── Thumbnail size for the preview strip ───────────────────
const THUMB_W = 64;
const PREVIEW_SIZE = 180; // preview canvas logical size

function renderToCanvas(
  canvas: HTMLCanvasElement,
  frame: Frame,
  gridSize: number,
  size: number,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(size * ratio);
  canvas.height = Math.round(size * ratio);
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, size, size);

  // checkerboard bg
  const sq = Math.max(4, Math.round(size / gridSize / 2));
  for (let row = 0; row < Math.ceil(size / sq); row++) {
    for (let col = 0; col < Math.ceil(size / sq); col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? '#e5e5e5' : '#ffffff';
      ctx.fillRect(col * sq, row * sq, sq, sq);
    }
  }

  const ps = size / gridSize;
  for (const layer of frame.layers) {
    if (!layer.visible) continue;
    ctx.save();
    ctx.globalAlpha = layer.opacity;
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

// ─── Frame thumbnail ─────────────────────────────────────────
const FrameThumb = memo(({
  frame, index, isActive, gridSize, isDragging, dropTarget, draggable,
  onClick, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
}: {
  frame: Frame; index: number; isActive: boolean; gridSize: number;
  isDragging: boolean; dropTarget: 'left' | 'right' | null; draggable: boolean;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvasRef.current) renderToCanvas(canvasRef.current, frame, gridSize, THUMB_W);
  }, [frame, gridSize]);

  return (
    <div
      className={`av-frame-thumb ${isActive ? 'active' : ''} ${isDragging ? 'dragging' : ''} ${dropTarget === 'left' ? 'drop-target-left' : ''} ${dropTarget === 'right' ? 'drop-target-right' : ''}`}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <div className="av-frame-num">{index + 1}</div>
      <canvas ref={canvasRef} className="av-frame-canvas" />
      <div className="av-frame-dur">{frame.duration}ms</div>
    </div>
  );
});

// ─── Preview canvas ──────────────────────────────────────────
const PreviewPanel = memo(({ frame, gridSize }: { frame: Frame; gridSize: number }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvasRef.current) renderToCanvas(canvasRef.current, frame, gridSize, PREVIEW_SIZE);
  }, [frame, gridSize]);
  return (
    <div className="av-preview-wrap">
      <canvas ref={canvasRef} className="av-preview-canvas" />
    </div>
  );
});

// ─── Main AnimationView ──────────────────────────────────────
interface AnimationViewProps {
  animState: AnimationState;
  gridSize: number;
  isPlaying: boolean;
  onionSkinEnabled: boolean;
  onSelectFrame: (i: number) => void;
  onAddFrame: () => void;
  onDuplicateFrame: () => void;
  onDeleteFrame: () => void;
  onTogglePlay: () => void;
  onToggleOnionSkin: () => void;
  onSetDuration: (index: number, duration: number) => void;
  onSetDurationAll: (duration: number) => void;
  onReorderFrame: (oldIndex: number, newIndex: number) => void;
  onToggleLayerVisibility: (id: string) => void;
}

export default function AnimationView({
  animState,
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
  onToggleLayerVisibility,
}: AnimationViewProps) {
  const { frames, activeFrameIndex } = animState;
  const activeFrame = frames[activeFrameIndex];
  const layers = activeFrame?.layers ?? [];

  // Loop mode state (UI only — actual loop logic is in usePlayback)
  const [loopMode, setLoopMode] = useState<'forever' | 'once' | 'ping-pong'>('forever');

  // Frame drag-and-drop
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<'left' | 'right' | null>(null);

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

  // Timeline ruler: total duration
  const totalDuration = frames.reduce((s, f) => s + f.duration, 0);
  const rulerMarks = Math.max(1, Math.ceil(totalDuration / 100));

  // Cumulative time per frame for ruler indicator
  const frameTimes = frames.reduce<number[]>((acc, f, i) => {
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

          <div className="av-field" style={{ marginTop: 'auto' }}>
            <label className="av-label">Onion Skin</label>
            <button
              className={`av-toggle-btn ${onionSkinEnabled ? 'active' : ''}`}
              onClick={onToggleOnionSkin}
            >
              {onionSkinEnabled ? 'On' : 'Off'}
            </button>
          </div>
        </div>

        {/* Preview + playback */}
        <div className="av-preview-col">
          <PreviewPanel frame={activeFrame} gridSize={gridSize} />

          {/* Playback controls */}
          <div className="av-playback">
            <button className="av-pb-btn" onClick={() => onSelectFrame(0)} title="First frame" disabled={isPlaying && false}>
              <SkipBack size={16} />
            </button>
            <button className="av-pb-btn" onClick={goPrev} title="Previous frame">
              <ChevronLeft size={16} />
            </button>
            <button
              className={`av-pb-btn av-pb-play ${isPlaying ? 'playing' : ''}`}
              onClick={onTogglePlay}
              title={isPlaying ? 'Stop' : 'Play'}
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
          </div>
        </div>
      </div>

      {/* ── TIMELINE SECTION ── */}
      <div className="av-timeline-section">
        <div className="av-section-header">
          <span className="av-section-title">Timeline</span>
          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
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
        <div className="av-frame-strip" ref={scrollRef}>
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
                setDropTargetIndex(i);
                setDropPosition(e.clientX < rect.left + rect.width / 2 ? 'left' : 'right');
              }}
              onDragLeave={() => { setDropTargetIndex(null); setDropPosition(null); }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedIndex !== null && dropTargetIndex !== null) {
                  let ni = dropTargetIndex;
                  if (draggedIndex < dropTargetIndex && dropPosition === 'left') ni--;
                  else if (draggedIndex > dropTargetIndex && dropPosition === 'right') ni++;
                  onReorderFrame(draggedIndex, ni);
                }
                setDraggedIndex(null); setDropTargetIndex(null); setDropPosition(null);
              }}
              onDragEnd={() => { setDraggedIndex(null); setDropTargetIndex(null); setDropPosition(null); }}
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
          {Array.from({ length: rulerMarks + 1 }, (_, i) => (
            <div key={i} className="av-ruler-mark" style={{ left: `${(i * 100) / Math.max(rulerMarks, 1)}%` }}>
              <span>{i * 100}ms</span>
            </div>
          ))}
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

    </div>
  );
}
