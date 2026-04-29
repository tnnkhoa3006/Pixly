import { useRef, useEffect, useCallback, memo, useState } from 'react';
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
  onSetDurationAll: (duration: number) => void;
  onReorderFrame: (oldIndex: number, newIndex: number) => void;
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
  frame, index, isActive, gridSize, isDragging, dropTarget, draggable, onClick, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd
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
    if (canvasRef.current) {
      renderThumbnail(canvasRef.current, frame, gridSize);
    }
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
}: TimelineProps) {
  const [height, setHeight] = useState(110);
  const isResizing = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<'left' | 'right' | null>(null);

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (isResizing.current) {
        // Timeline is at bottom above 40px bottom-bar
        const newHeight = window.innerHeight - e.clientY - 40;
        setHeight(Math.max(80, Math.min(newHeight, 500)));
      }
    };
    const handleUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
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
    <div className="timeline" style={{ height: `${height}px`, position: 'relative' }}>
      <div 
        className="timeline-resizer" 
        onPointerDown={(e) => { e.preventDefault(); isResizing.current = true; document.body.style.cursor = 'row-resize'; }}
      />
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
            title="Apply this duration to all frames"
          >
            Apply to All
          </button>
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
            isDragging={draggedIndex === i}
            dropTarget={dropTargetIndex === i ? dropPosition : null}
            draggable={!isPlaying && frames.length > 1}
            onClick={() => !isPlaying && onSelectFrame(i)}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move';
              setDraggedIndex(i);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (draggedIndex === null || draggedIndex === i) return;
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const isLeft = e.clientX < rect.left + rect.width / 2;
              setDropTargetIndex(i);
              setDropPosition(isLeft ? 'left' : 'right');
            }}
            onDragLeave={() => {
              setDropTargetIndex(null);
              setDropPosition(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (draggedIndex !== null && dropTargetIndex !== null) {
                let newIndex = dropTargetIndex;
                if (draggedIndex < dropTargetIndex && dropPosition === 'left') {
                  newIndex -= 1;
                } else if (draggedIndex > dropTargetIndex && dropPosition === 'right') {
                  newIndex += 1;
                }
                onReorderFrame(draggedIndex, newIndex);
              }
              setDraggedIndex(null);
              setDropTargetIndex(null);
              setDropPosition(null);
            }}
            onDragEnd={() => {
              setDraggedIndex(null);
              setDropTargetIndex(null);
              setDropPosition(null);
            }}
          />
        ))}
      </div>
    </div>
  );
}
