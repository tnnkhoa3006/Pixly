import { useRef, useEffect, useCallback, memo } from 'react';
import {
  Plus, Copy, Trash2, Play, Square,
  ChevronLeft, ChevronRight, Layers as OnionIcon
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
}

// ---------- Thumbnail renderer ----------

const THUMB_SIZE = 64;

function renderThumbnail(
  canvas: HTMLCanvasElement,
  frame: Frame,
  gridSize: number,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(THUMB_SIZE * ratio);
  canvas.height = Math.round(THUMB_SIZE * ratio);
  canvas.style.width = `${THUMB_SIZE}px`;
  canvas.style.height = `${THUMB_SIZE}px`;

  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.imageSmoothingEnabled = false;

  // background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, THUMB_SIZE, THUMB_SIZE);

  const ps = THUMB_SIZE / gridSize; // pixel size in thumb space

  // Render layers
  for (let i = 0; i < frame.layers.length; i++) {
    const layer = frame.layers[i];
    if (!layer.visible) continue;

    ctx.save();
    
    // Apply layer transform
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
  frame, index, isActive, gridSize, onClick,
}: {
  frame: Frame;
  index: number;
  isActive: boolean;
  gridSize: number;
  onClick: () => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      renderThumbnail(canvasRef.current, frame, gridSize);
    }
  }, [frame, gridSize]);

  return (
    <div
      className={`frame-thumb ${isActive ? 'active' : ''}`}
      onClick={onClick}
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
}: TimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // scroll active frame into view
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const thumb = el.children[activeFrameIndex] as HTMLElement | undefined;
    if (thumb) {
      thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeFrameIndex]);

  const goPrev = useCallback(() => {
    if (activeFrameIndex > 0) onSelectFrame(activeFrameIndex - 1);
  }, [activeFrameIndex, onSelectFrame]);

  const goNext = useCallback(() => {
    if (activeFrameIndex < frames.length - 1) onSelectFrame(activeFrameIndex + 1);
  }, [activeFrameIndex, frames.length, onSelectFrame]);

  return (
    <div className="timeline">
      {/* Controls */}
      <div className="timeline-controls">
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

        <button className="tl-btn" onClick={onAddFrame} title="Add Frame (clone)" disabled={isPlaying}>
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

        {/* Per-frame duration control */}
        <div className="tl-duration-control">
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
        </div>
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
            onClick={() => !isPlaying && onSelectFrame(i)}
          />
        ))}
      </div>
    </div>
  );
}
