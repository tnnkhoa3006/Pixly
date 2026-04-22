import { useState, useRef, useEffect, useCallback } from 'react';
import Canvas, { type CanvasHandle } from './components/Canvas';
import PreviewCanvas, { type PreviewTool, type PreviewCanvasHandle } from './components/PreviewCanvas';
import Timeline from './components/Timeline';
import { usePlayback } from './hooks/usePlayback';
import { exportGif } from './utils/gifExport';
import { generateId, createEmptyGrid, cloneFrame, shallowCloneFrame, createDefaultFrame, createDefaultTransform } from './utils';
import type { AnimationState, ToolType, GridSizeType } from './types';

import { 
  Brush, Eraser, PaintBucket, Pipette, Minus, Square, Circle, 
  Move, Undo, Redo, Eye, EyeOff, Plus, Trash2, Video, Film, Grid3X3,
  CheckSquare
} from 'lucide-react';

const MIN_PIXEL_SIZE = 6;
const DEFAULT_PALETTE = ['#000000', '#ffffff', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'];

export default function App() {
  const [gridSize, setGridSize] = useState<GridSizeType>(16);
  const [pixelSize, setPixelSize] = useState(32);
  const [showGrid, setShowGrid] = useState(true);
  const [brushSize, setBrushSize] = useState<number>(1);
  const [onionSkinEnabled, setOnionSkinEnabled] = useState(false);
  const [animationMode, setAnimationMode] = useState(false);

  // --- SINGLE SOURCE OF TRUTH ---
  const [animState, setAnimState] = useState<AnimationState>(() => {
    const defaultFrame = createDefaultFrame(16);
    return {
      frames: [defaultFrame],
      activeFrameIndex: 0,
      activeLayerId: defaultFrame.layers[0].id,
      selectedLayerIds: [defaultFrame.layers[0].id]
    };
  });

  const { frames, activeFrameIndex, activeLayerId, selectedLayerIds = [activeLayerId] } = animState;
  const activeFrame = frames[activeFrameIndex];
  const layers = activeFrame.layers;

  const [currentTool, setCurrentTool] = useState<ToolType>('brush');
  const [currentColor, setCurrentColor] = useState<string>('#000000');
  
  const canvasRef = useRef<CanvasHandle>(null);
  const previewCanvasRef = useRef<PreviewCanvasHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const transformContainerRef = useRef<HTMLDivElement>(null);
  const hoverOverlayRef = useRef<HTMLDivElement>(null);
  const coordsDisplayRef = useRef<HTMLSpanElement>(null);

  const panRef = useRef({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const lastPanPoint = useRef<{ x: number, y: number } | null>(null);
  const isSpaceDown = useRef(false);

  const isDrawing = useRef(false);
  const strokeStart = useRef<{ x: number, y: number } | null>(null);
  const lastDrawn = useRef<{ x: number, y: number } | null>(null);

  const historyRef = useRef<AnimationState[]>([]);
  const redoRef = useRef<AnimationState[]>([]);
  const [, forceRender] = useState({});

  // --- Playback Controller ---
  const handleFrameChange = useCallback((index: number) => {
    setAnimState(prev => ({ ...prev, activeFrameIndex: index }));
  }, []);

  const { isPlaying, toggle: togglePlay } = usePlayback({
    frames,
    onFrameChange: handleFrameChange
  });

  // Render on state change
  useEffect(() => {
    if (canvasRef.current && frames[activeFrameIndex]) {
      const onionFrame = (onionSkinEnabled && activeFrameIndex > 0 && !isPlaying) 
        ? frames[activeFrameIndex - 1] 
        : null;
      // Use requestAnimationFrame to ensure Canvas.tsx's internal resize effect runs first
      requestAnimationFrame(() => {
        canvasRef.current?.renderFrame(frames[activeFrameIndex], onionFrame);
      });
    }
  }, [frames, activeFrameIndex, onionSkinEnabled, isPlaying, pixelSize, showGrid]);

  // Init history
  useEffect(() => {
    if (historyRef.current.length === 0) {
      historyRef.current.push({
        frames: frames.map(f => cloneFrame(f)),
        activeFrameIndex,
        activeLayerId,
        selectedLayerIds: [...selectedLayerIds]
      });
    }
  }, []);

  const saveHistory = (newState: AnimationState) => {
    historyRef.current.push({
      frames: newState.frames.map(f => cloneFrame(f)),
      activeFrameIndex: newState.activeFrameIndex,
      activeLayerId: newState.activeLayerId,
      selectedLayerIds: [...newState.selectedLayerIds]
    });
    if (historyRef.current.length > 50) historyRef.current.shift();
    redoRef.current = [];
  };

  const handleUndo = () => {
    if (historyRef.current.length > 1) {
      const current = historyRef.current.pop()!;
      redoRef.current.push(current);
      const previous = historyRef.current[historyRef.current.length - 1];
      const cloned = {
        frames: previous.frames.map(f => cloneFrame(f)),
        activeFrameIndex: previous.activeFrameIndex,
        activeLayerId: previous.activeLayerId,
        selectedLayerIds: [...previous.selectedLayerIds]
      };
      setAnimState(cloned);
    }
  };

  const handleRedo = () => {
    if (redoRef.current.length > 0) {
      const next = redoRef.current.pop()!;
      historyRef.current.push(next);
      const cloned = {
        frames: next.frames.map(f => cloneFrame(f)),
        activeFrameIndex: next.activeFrameIndex,
        activeLayerId: next.activeLayerId,
        selectedLayerIds: [...next.selectedLayerIds]
      };
      setAnimState(cloned);
    }
  };

  // --- Frame Operations ---
  const handleAddFrame = () => {
    setAnimState(prev => {
      const newFrame = cloneFrame(prev.frames[prev.activeFrameIndex]);
      const nextFrames = [...prev.frames, newFrame];
      const nextState = { ...prev, frames: nextFrames, activeFrameIndex: nextFrames.length - 1 };
      saveHistory(nextState);
      return nextState;
    });
  };

  const handleDuplicateFrame = () => {
    setAnimState(prev => {
      const newFrame = shallowCloneFrame(prev.frames[prev.activeFrameIndex]);
      const nextFrames = [...prev.frames, newFrame];
      const nextState = { ...prev, frames: nextFrames, activeFrameIndex: nextFrames.length - 1 };
      saveHistory(nextState);
      return nextState;
    });
  };

  const handleDeleteFrame = () => {
    if (frames.length <= 1) return;
    setAnimState(prev => {
      const nextFrames = prev.frames.filter((_, i) => i !== prev.activeFrameIndex);
      const nextIndex = Math.min(prev.activeFrameIndex, nextFrames.length - 1);
      const nextState = { ...prev, frames: nextFrames, activeFrameIndex: nextIndex };
      saveHistory(nextState);
      return nextState;
    });
  };

  const handleSetDuration = (index: number, duration: number) => {
    setAnimState(prev => {
      const nextFrames = [...prev.frames];
      nextFrames[index] = { ...nextFrames[index], duration };
      const nextState = { ...prev, frames: nextFrames };
      saveHistory(nextState);
      return nextState;
    });
  };

  const handleGridSizeChange = (newSize: GridSizeType) => {
    if (window.confirm(`Changing grid size to ${newSize}x${newSize} will clear your current canvas. Continue?`)) {
      setGridSize(newSize);
      const defaultFrame = createDefaultFrame(newSize);
      setAnimState({
        frames: [defaultFrame],
        activeFrameIndex: 0,
        activeLayerId: defaultFrame.layers[0].id,
        selectedLayerIds: [defaultFrame.layers[0].id]
      });
      historyRef.current = [];
      redoRef.current = [];
      panRef.current = { x: 0, y: 0 };
      if (transformContainerRef.current) {
        transformContainerRef.current.style.transform = `translate(0px, 0px)`;
      }
    }
  };

  // --- Zoom / Pan ---
  const handleZoomCenter = (newPixelSize: number, mouseX: number, mouseY: number) => {
    setPixelSize(oldPixelSize => {
      const scale = newPixelSize / oldPixelSize;
      const panX = panRef.current.x;
      const panY = panRef.current.y;
      panRef.current.x = Math.round(mouseX - (mouseX - panX) * scale);
      panRef.current.y = Math.round(mouseY - (mouseY - panY) * scale);
      if (transformContainerRef.current) {
        transformContainerRef.current.style.transform = `translate(${panRef.current.x}px, ${panRef.current.y}px)`;
      }
      return newPixelSize;
    });
  };

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      let newSize = pixelSize;
      if (e.deltaY < 0) {
        newSize = Math.min(Math.round(pixelSize + 4), 64);
      } else {
        newSize = Math.max(Math.round(pixelSize - 4), MIN_PIXEL_SIZE);
      }
      if (newSize !== pixelSize) {
        handleZoomCenter(newSize, mouseX, mouseY);
      }
    };
    const div = containerRef.current;
    div?.addEventListener('wheel', handleWheel, { passive: false });
    return () => div?.removeEventListener('wheel', handleWheel);
  }, [pixelSize]);

  // --- Keyboard ---
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        isSpaceDown.current = true;
        forceRender({});
      }
      
      const key = e.key.toLowerCase();
      if (!isPlaying) {
        if (key === 'b') setCurrentTool('brush');
        if (key === 'e') setCurrentTool('eraser');
        if (key === 'g') setCurrentTool('fill');
        if (key === 'i') setCurrentTool('picker');
        if (key === 'l') setCurrentTool('line');
        if (key === 'r') setCurrentTool('rect');
        if (key === 'c') setCurrentTool('circle');
        if (key === 's') setCurrentTool('select');
        if (key === 'm') setCurrentTool('move');
      }

      if ((e.ctrlKey || e.metaKey) && key === 'z') { e.preventDefault(); handleUndo(); }
      if ((e.ctrlKey || e.metaKey) && key === 'y') { e.preventDefault(); handleRedo(); }
      if (key === '+' || key === '=') setPixelSize(p => Math.min(Math.round(p + 4), 64));
      if (key === '-' || key === '_') setPixelSize(p => Math.max(Math.round(p - 4), MIN_PIXEL_SIZE));
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        isSpaceDown.current = false;
        forceRender({});
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [isPlaying]);

  // --- Drawing logic ---
  const getPointerCoords = (e: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    let cx = mouseX - panRef.current.x;
    let cy = mouseY - panRef.current.y;

    const frame = frames[activeFrameIndex];
    if (frame) {
      const activeLayer = frame.layers.find(l => l.id === activeLayerId);
      if (activeLayer) {
        const { x: tx, y: ty, rotation, scale } = activeLayer.transform;
      const logicalW = gridSize * pixelSize;
      const logicalH = gridSize * pixelSize;
      const centerX = logicalW / 2;
      const centerY = logicalH / 2;

      cx -= centerX;
      cy -= centerY;

      cx -= tx * pixelSize;
      cy -= ty * pixelSize;

      if (rotation !== 0) {
        const rad = (-rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const rx = cx * cos - cy * sin;
        const ry = cx * sin + cy * cos;
        cx = rx;
        cy = ry;
      }

      if (scale !== 1) {
        cx /= scale;
        cy /= scale;
      }

      cx += centerX;
      cy += centerY;
      }
    }

    const gridX = Math.floor(cx / pixelSize);
    const gridY = Math.floor(cy / pixelSize);
    return { gridX, gridY, mouseX, mouseY };
  };

  const getForwardCssTransform = () => {
    const frame = frames[activeFrameIndex];
    if (!frame) return 'none';
    const activeLayer = frame.layers.find(l => l.id === activeLayerId);
    if (!activeLayer) return 'none';
    const { x: tx, y: ty, rotation, scale } = activeLayer.transform;
    return `translate(${tx * pixelSize}px, ${ty * pixelSize}px) rotate(${rotation}deg) scale(${scale})`;
  };

  const getActiveTool = () => {
    if (!animationMode && ['frame-move', 'frame-rotate', 'frame-scale'].includes(currentTool)) {
      return 'brush';
    }
    return currentTool;
  };

  const updateHover = (gridX: number, gridY: number, isActive: boolean) => {
    if (coordsDisplayRef.current) coordsDisplayRef.current.innerText = `X: ${gridX}, Y: ${gridY}`;
    if (!hoverOverlayRef.current) return;
    
    const tool = getActiveTool();
    const isGeometryTool = ['line', 'rect', 'circle', 'select'].includes(tool);
    if (pixelSize < 8 || !isActive || gridX < 0 || gridX >= gridSize || gridY < 0 || gridY >= gridSize || (isDrawing.current && isGeometryTool)) {
      hoverOverlayRef.current.style.display = 'none';
      return;
    }
    const isBrushSized = ['brush', 'eraser', 'line'].includes(tool);
    const currentBrushSize = isBrushSized ? brushSize : 1;
    const startOffset = -Math.floor(currentBrushSize / 2);
    hoverOverlayRef.current.style.display = 'block';
    hoverOverlayRef.current.style.width = `${currentBrushSize * pixelSize}px`;
    hoverOverlayRef.current.style.height = `${currentBrushSize * pixelSize}px`;
    hoverOverlayRef.current.style.transform = `translate(${(gridX + startOffset) * pixelSize}px, ${(gridY + startOffset) * pixelSize}px)`;
    hoverOverlayRef.current.style.background = tool === 'eraser' ? 'rgba(255,0,0,0.15)' : 'rgba(0,0,0,0.1)';
  };

  const applyTool = (x: number, y: number, isRightClick: boolean) => {
    const tool = getActiveTool();
    const targetColor = (tool === 'eraser' || isRightClick) ? null : currentColor;
    const startOffset = -Math.floor(brushSize / 2);
    const endOffset = Math.floor((brushSize - 1) / 2);

    setAnimState(prev => {
      const activeIdx = prev.activeFrameIndex;
      const frame = { ...prev.frames[activeIdx] };
      const newLayers = [...frame.layers];
      const layerIdx = newLayers.findIndex(l => l.id === prev.activeLayerId);
      if (layerIdx === -1 || !newLayers[layerIdx].visible) return prev;

      const activeLayer = { ...newLayers[layerIdx] };
      const newGrid = [...activeLayer.grid];
      let clonedRows = new Set<number>();
      let changed = false;

      // Handle untransformed space for pixel tools
      // For now, pixel tools operate directly on the grid. 
      // If the frame is transformed, pixel tools act on the original grid coordinates.
      for (let dy = startOffset; dy <= endOffset; dy++) {
        for (let dx = startOffset; dx <= endOffset; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) continue;
          if (newGrid[ny][nx] !== targetColor) {
            if (!clonedRows.has(ny)) {
              newGrid[ny] = [...newGrid[ny]];
              clonedRows.add(ny);
            }
            newGrid[ny][nx] = targetColor;
            changed = true;
          }
        }
      }
      if (!changed) return prev;
      activeLayer.grid = newGrid;
      newLayers[layerIdx] = activeLayer;
      frame.layers = newLayers;
      const nextFrames = [...prev.frames];
      nextFrames[activeIdx] = frame;
      return { ...prev, frames: nextFrames };
    });
  };

  const handleFill = (startX: number, startY: number, isRightClick: boolean) => {
    setAnimState(prev => {
      const activeIdx = prev.activeFrameIndex;
      const frame = { ...prev.frames[activeIdx] };
      const newLayers = [...frame.layers];
      const layerIdx = newLayers.findIndex(l => l.id === prev.activeLayerId);
      if (layerIdx === -1 || !newLayers[layerIdx].visible) return prev;

      const activeLayer = { ...newLayers[layerIdx] };
      const newGrid = activeLayer.grid.map(row => [...row]);

      const tool = getActiveTool();
      const targetColor = newGrid[startY]?.[startX];
      const newColor = (tool === 'eraser' || isRightClick) ? null : currentColor;

      if (targetColor === newColor) return prev;

      const stack = [{ x: startX, y: startY }];
      const visited = new Set<string>();

      while (stack.length > 0) {
        const { x, y } = stack.pop()!;
        if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) continue;

        const key = `${x},${y}`;
        if (visited.has(key)) continue;
        visited.add(key);

        if (newGrid[y][x] === targetColor) {
          newGrid[y][x] = newColor;
          stack.push({ x: x + 1, y });
          stack.push({ x: x - 1, y });
          stack.push({ x, y: y + 1 });
          stack.push({ x, y: y - 1 });
        }
      }

      activeLayer.grid = newGrid;
      newLayers[layerIdx] = activeLayer;
      frame.layers = newLayers;
      const nextFrames = [...prev.frames];
      nextFrames[activeIdx] = frame;
      return { ...prev, frames: nextFrames };
    });
  };

  const commitGeometry = (tool: ToolType, x0: number, y0: number, x1: number, y1: number, isRightClick: boolean) => {
    if (tool === 'select') return;

    setAnimState(prev => {
      const activeIdx = prev.activeFrameIndex;
      const frame = { ...prev.frames[activeIdx] };
      const newLayers = [...frame.layers];
      const layerIdx = newLayers.findIndex(l => l.id === prev.activeLayerId);
      if (layerIdx === -1 || !newLayers[layerIdx].visible) return prev;

      const activeLayer = { ...newLayers[layerIdx] };
      const newGrid = activeLayer.grid.map(row => [...row]);
      let changed = false;
      const color = isRightClick ? null : currentColor;

      const setPixel = (x: number, y: number, applyBrush: boolean = false) => {
        if (applyBrush) {
          const startOffset = -Math.floor(brushSize / 2);
          const endOffset = Math.floor((brushSize - 1) / 2);
          for (let dy = startOffset; dy <= endOffset; dy++) {
            for (let dx = startOffset; dx <= endOffset; dx++) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
                if (newGrid[ny][nx] !== color) {
                  newGrid[ny][nx] = color;
                  changed = true;
                }
              }
            }
          }
        } else {
          if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
            if (newGrid[y][x] !== color) {
              newGrid[y][x] = color;
              changed = true;
            }
          }
        }
      };

      if (tool === 'line') {
        let currX = x0;
        let currY = y0;
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = (x0 < x1) ? 1 : -1;
        const sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;

        while (true) {
          setPixel(currX, currY, true);
          if (currX === x1 && currY === y1) break;
          const e2 = 2 * err;
          if (e2 > -dy) { err -= dy; currX += sx; }
          if (e2 < dx) { err += dx; currY += sy; }
        }
      } else if (tool === 'rect') {
        const minX = Math.min(x0, x1);
        const maxX = Math.max(x0, x1);
        const minY = Math.min(y0, y1);
        const maxY = Math.max(y0, y1);
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            setPixel(x, y);
          }
        }
      } else if (tool === 'circle') {
        const radius = Math.floor(Math.sqrt(Math.pow(x1 - x0, 2) + Math.pow(y1 - y0, 2)));
        for (let y = y0 - radius; y <= y0 + radius; y++) {
          for (let x = x0 - radius; x <= x0 + radius; x++) {
            if (Math.pow(x - x0, 2) + Math.pow(y - y0, 2) <= radius * radius) {
              setPixel(x, y);
            }
          }
        }
      }

      if (!changed) return prev;
      activeLayer.grid = newGrid;
      newLayers[layerIdx] = activeLayer;
      frame.layers = newLayers;
      const nextFrames = [...prev.frames];
      nextFrames[activeIdx] = frame;
      return { ...prev, frames: nextFrames };
    });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isPlaying) return;
    const tool = getActiveTool();
    if (e.button === 2 || (isSpaceDown.current && e.button === 0) || tool === 'move') {
      isPanning.current = true;
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
      return;
    }
    const coords = getPointerCoords(e);
    if (!coords) return;

    if (tool === 'frame-move' || tool === 'frame-rotate' || tool === 'frame-scale') {
      isDrawing.current = true;
      strokeStart.current = { x: e.clientX, y: e.clientY };
      saveHistory(animState); // pre-save
      return;
    }

    if (coords.gridX >= 0 && coords.gridX < gridSize && coords.gridY >= 0 && coords.gridY < gridSize) {
      if (currentTool === 'picker') {
        let picked = null;
        for (let i = layers.length - 1; i >= 0; i--) {
          if (layers[i].visible && layers[i].grid[coords.gridY][coords.gridX]) {
            picked = layers[i].grid[coords.gridY][coords.gridX];
            break;
          }
        }
        if (picked) setCurrentColor(picked);
        setCurrentTool('brush');
        return;
      }

      isDrawing.current = true;
      strokeStart.current = { x: coords.gridX, y: coords.gridY };
      lastDrawn.current = { x: coords.gridX, y: coords.gridY };

      if (['brush', 'eraser', 'line', 'rect', 'circle', 'fill'].includes(tool)) {
        saveHistory(animState);
      }

      if (['line', 'rect', 'circle', 'select'].includes(tool)) {
        previewCanvasRef.current?.drawPreview(tool as PreviewTool, coords.gridX, coords.gridY, coords.gridX, coords.gridY, e.button === 2 ? null : currentColor);
      } else if (tool === 'fill') {
        isDrawing.current = false;
        handleFill(coords.gridX, coords.gridY, e.button === 2);
      } else {
        applyTool(coords.gridX, coords.gridY, e.button === 2);
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isPanning.current && lastPanPoint.current) {
      const dx = e.clientX - lastPanPoint.current.x;
      const dy = e.clientY - lastPanPoint.current.y;
      panRef.current.x = Math.round(panRef.current.x + dx);
      panRef.current.y = Math.round(panRef.current.y + dy);
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
      if (transformContainerRef.current) {
        transformContainerRef.current.style.transform = `translate(${panRef.current.x}px, ${panRef.current.y}px)`;
      }
      return;
    }

    const coords = getPointerCoords(e);
    if (!coords) return;
    updateHover(coords.gridX, coords.gridY, true);

    const tool = getActiveTool();

    if (isDrawing.current && strokeStart.current) {
      if (tool === 'frame-move') {
        const dx = (e.clientX - strokeStart.current.x) / pixelSize;
        const dy = (e.clientY - strokeStart.current.y) / pixelSize;
        strokeStart.current = { x: e.clientX, y: e.clientY };
        setAnimState(prev => {
          const frame = { ...prev.frames[prev.activeFrameIndex] };
          const newLayers = [...frame.layers];
          
          prev.selectedLayerIds.forEach(id => {
            const layerIdx = newLayers.findIndex(l => l.id === id);
            if (layerIdx !== -1) {
              const layer = { ...newLayers[layerIdx] };
              layer.transform = { 
                ...layer.transform, 
                x: layer.transform.x + dx, 
                y: layer.transform.y + dy 
              };
              newLayers[layerIdx] = layer;
            }
          });

          frame.layers = newLayers;
          const nextFrames = [...prev.frames];
          nextFrames[prev.activeFrameIndex] = frame;
          return { ...prev, frames: nextFrames };
        });
      } else if (tool === 'frame-rotate') {
        // Simplified rotation based on X drag
        const dx = e.clientX - strokeStart.current.x;
        strokeStart.current = { x: e.clientX, y: e.clientY };
        setAnimState(prev => {
          const frame = { ...prev.frames[prev.activeFrameIndex] };
          const newLayers = [...frame.layers];
          
          prev.selectedLayerIds.forEach(id => {
            const layerIdx = newLayers.findIndex(l => l.id === id);
            if (layerIdx !== -1) {
              const layer = { ...newLayers[layerIdx] };
              layer.transform = { 
                ...layer.transform, 
                rotation: (layer.transform.rotation + dx) % 360 
              };
              newLayers[layerIdx] = layer;
            }
          });

          frame.layers = newLayers;
          const nextFrames = [...prev.frames];
          nextFrames[prev.activeFrameIndex] = frame;
          return { ...prev, frames: nextFrames };
        });
      } else if (tool === 'frame-scale') {
        // Simplified scale based on Y drag
        const dy = (strokeStart.current.y - e.clientY) / 100;
        strokeStart.current = { x: e.clientX, y: e.clientY };
        setAnimState(prev => {
          const frame = { ...prev.frames[prev.activeFrameIndex] };
          const newLayers = [...frame.layers];
          
          prev.selectedLayerIds.forEach(id => {
            const layerIdx = newLayers.findIndex(l => l.id === id);
            if (layerIdx !== -1) {
              const layer = { ...newLayers[layerIdx] };
              layer.transform = { 
                ...layer.transform, 
                scale: Math.max(0.1, Math.min(5.0, layer.transform.scale + dy)) 
              };
              newLayers[layerIdx] = layer;
            }
          });

          frame.layers = newLayers;
          const nextFrames = [...prev.frames];
          nextFrames[prev.activeFrameIndex] = frame;
          return { ...prev, frames: nextFrames };
        });
      } else if (['line', 'rect', 'circle', 'select'].includes(tool)) {
        previewCanvasRef.current?.drawPreview(tool as PreviewTool, strokeStart.current.x, strokeStart.current.y, coords.gridX, coords.gridY, e.buttons === 2 ? null : currentColor);
      } else if (tool !== 'fill') {
        if (lastDrawn.current?.x === coords.gridX && lastDrawn.current?.y === coords.gridY) return;
        applyTool(coords.gridX, coords.gridY, e.buttons === 2);
        lastDrawn.current = { x: coords.gridX, y: coords.gridY };
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isPanning.current) {
      isPanning.current = false;
      lastPanPoint.current = null;
      return;
    }
    const tool = getActiveTool();
    if (isDrawing.current) {
      if (['line', 'rect', 'circle'].includes(tool) && strokeStart.current && lastDrawn.current) {
        commitGeometry(tool, strokeStart.current.x, strokeStart.current.y, lastDrawn.current.x, lastDrawn.current.y, e.button === 2);
        previewCanvasRef.current?.clear();
      }
    }
    isDrawing.current = false;
    lastDrawn.current = null;
  };

  // --- Layer Management ---
  const addLayer = () => {
    setAnimState(prev => {
      const nextLayers = [...prev.frames[prev.activeFrameIndex].layers, {
        id: generateId(),
        name: `Layer ${layers.length + 1}`,
        visible: true,
        opacity: 1,
        grid: createEmptyGrid(gridSize),
        transform: createDefaultTransform()
      }];
      const frame = { ...prev.frames[prev.activeFrameIndex], layers: nextLayers };
      const nextFrames = [...prev.frames];
      nextFrames[prev.activeFrameIndex] = frame;
      const nextState = { 
        ...prev, 
        frames: nextFrames, 
        activeLayerId: nextLayers[nextLayers.length - 1].id,
        selectedLayerIds: [nextLayers[nextLayers.length - 1].id]
      };
      saveHistory(nextState);
      return nextState;
    });
  };

  const deleteLayer = (id: string) => {
    if (layers.length <= 1) return;
    setAnimState(prev => {
      const nextLayers = prev.frames[prev.activeFrameIndex].layers.filter(l => l.id !== id);
      const frame = { ...prev.frames[prev.activeFrameIndex], layers: nextLayers };
      const nextFrames = [...prev.frames];
      nextFrames[prev.activeFrameIndex] = frame;
      let nextLayerId = prev.activeLayerId;
      if (nextLayerId === id) nextLayerId = nextLayers[nextLayers.length - 1].id;
      
      const nextSelected = (prev.selectedLayerIds || [prev.activeLayerId]).filter(lid => lid !== id);
      if (nextSelected.length === 0) nextSelected.push(nextLayerId);

      const nextState = { 
        ...prev, 
        frames: nextFrames, 
        activeLayerId: nextLayerId,
        selectedLayerIds: nextSelected
      };
      saveHistory(nextState);
      return nextState;
    });
  };

  const toggleLayerVisibility = (id: string) => {
    setAnimState(prev => {
      const nextLayers = prev.frames[prev.activeFrameIndex].layers.map(l => l.id === id ? { ...l, visible: !l.visible } : l);
      const frame = { ...prev.frames[prev.activeFrameIndex], layers: nextLayers };
      const nextFrames = [...prev.frames];
      nextFrames[prev.activeFrameIndex] = frame;
      const nextState = { ...prev, frames: nextFrames };
      saveHistory(nextState);
      return nextState;
    });
  };

  const toggleLayerSelection = (id: string) => {
    setAnimState(prev => {
      const isSelected = prev.selectedLayerIds.includes(id);
      let nextSelected: string[];
      if (isSelected) {
        // Don't deselect if it's the last one
        if (prev.selectedLayerIds.length <= 1) return prev;
        nextSelected = prev.selectedLayerIds.filter(lid => lid !== id);
      } else {
        nextSelected = [...prev.selectedLayerIds, id];
      }
      
      // If we deselected the active layer, pick a new active layer from selection
      let nextActive = prev.activeLayerId;
      if (id === prev.activeLayerId && isSelected) {
        nextActive = nextSelected[0];
      }

      return { ...prev, selectedLayerIds: nextSelected, activeLayerId: nextActive };
    });
  };

  const handleLayerClick = (id: string, e: React.MouseEvent) => {
    const isMulti = e.ctrlKey || e.metaKey;
    setAnimState(prev => {
      if (isMulti) {
        const isSelected = prev.selectedLayerIds.includes(id);
        const nextSelected = isSelected 
          ? (prev.selectedLayerIds.length > 1 ? prev.selectedLayerIds.filter(lid => lid !== id) : prev.selectedLayerIds)
          : [...prev.selectedLayerIds, id];
        
        let nextActive = prev.activeLayerId;
        if (!isSelected) nextActive = id;
        else if (id === prev.activeLayerId && nextSelected.length > 0) nextActive = nextSelected[0];
        
        return { ...prev, selectedLayerIds: nextSelected, activeLayerId: nextActive };
      } else {
        return { ...prev, activeLayerId: id, selectedLayerIds: [id] };
      }
    });
  };

  const handleExportGif = async () => {
    const blob = await exportGif(frames, gridSize, 8);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'animation.gif';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="layout">
      {isPlaying && <div className="playback-badge">PLAYING</div>}
      <div className="workspace">
        <div className="sidebar">
          <div className="app-logo">Pixly</div>
          <div className="tool-separator" />
          <button className={`tool-icon-btn ${currentTool === 'brush' ? 'active' : ''}`} onClick={() => setCurrentTool('brush')} title="Brush (B)"><Brush size={20} /></button>
          <button className={`tool-icon-btn ${currentTool === 'eraser' ? 'active' : ''}`} onClick={() => setCurrentTool('eraser')} title="Eraser (E)"><Eraser size={20} /></button>
          <button className={`tool-icon-btn ${currentTool === 'fill' ? 'active' : ''}`} onClick={() => setCurrentTool('fill')} title="Fill (G)"><PaintBucket size={20} /></button>
          <button className={`tool-icon-btn ${currentTool === 'picker' ? 'active' : ''}`} onClick={() => setCurrentTool('picker')} title="Eyedropper (I)"><Pipette size={20} /></button>
          <button className={`tool-icon-btn ${currentTool === 'line' ? 'active' : ''}`} onClick={() => setCurrentTool('line')} title="Line (L)"><Minus size={20} /></button>
          <button className={`tool-icon-btn ${currentTool === 'rect' ? 'active' : ''}`} onClick={() => setCurrentTool('rect')} title="Rectangle (R)"><Square size={20} /></button>
          <button className={`tool-icon-btn ${currentTool === 'circle' ? 'active' : ''}`} onClick={() => setCurrentTool('circle')} title="Circle (C)"><Circle size={20} /></button>
          
          <div className="tool-separator" />
          
          {/* Frame motion tools */}
          <button className={`tool-icon-btn frame-tool ${currentTool === 'frame-move' ? 'active' : ''}`} onClick={() => setCurrentTool('frame-move')} disabled={!animationMode} title="Move Frame"><Move size={20} /></button>
          <button className={`tool-icon-btn frame-tool ${currentTool === 'frame-rotate' ? 'active' : ''}`} onClick={() => setCurrentTool('frame-rotate')} disabled={!animationMode} title="Rotate Frame (drag X)"><RefreshCwIcon size={20} /></button>
          <button className={`tool-icon-btn frame-tool ${currentTool === 'frame-scale' ? 'active' : ''}`} onClick={() => setCurrentTool('frame-scale')} disabled={!animationMode} title="Scale Frame (drag Y)"><MaximizeIcon size={20} /></button>

          <div className="tool-separator" />
          
          <button className={`tool-icon-btn ${animationMode ? 'active' : ''}`} onClick={() => {
            const nextMode = !animationMode;
            setAnimationMode(nextMode);
            if (!nextMode && ['frame-move', 'frame-rotate', 'frame-scale'].includes(currentTool)) {
              setCurrentTool('brush');
            }
          }} title="Toggle Animation Mode"><Film size={20} /></button>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
            {[1, 2, 3, 4, 5].map(size => (
              <button key={size} className={`tool-icon-btn ${brushSize === size ? 'active' : ''}`} style={{ width: 28, height: 28, fontSize: 12, minHeight: 28 }} onClick={() => setBrushSize(size)}>{size}</button>
            ))}
          </div>

          <div style={{ flex: 1 }} />
          
          <button className="tool-icon-btn" onClick={handleUndo} disabled={historyRef.current.length <= 1}><Undo size={20} /></button>
          <button className="tool-icon-btn" onClick={handleRedo} disabled={redoRef.current.length === 0}><Redo size={20} /></button>
          <button className="tool-icon-btn" style={{ color: animationMode ? '#10b981' : undefined }} disabled={!animationMode} onClick={handleExportGif} title="Export GIF"><Video size={20} /></button>
        </div>

        <div className="main">
          <div 
            ref={containerRef}
            style={{ width: '100%', height: '100%', position: 'relative', cursor: isSpaceDown.current ? 'grab' : 'crosshair' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onContextMenu={e => e.preventDefault()}
          >
            <div ref={transformContainerRef} style={{ position: 'absolute', top: 0, left: 0, transformOrigin: '0 0' }}>
              <Canvas ref={canvasRef} gridSize={gridSize} pixelSize={pixelSize} showGrid={showGrid} />
              <div style={{
                position: 'absolute', top: 0, left: 0,
                width: `${gridSize * pixelSize}px`,
                height: `${gridSize * pixelSize}px`,
                transformOrigin: 'center',
                transform: getForwardCssTransform(),
                pointerEvents: 'none'
              }}>
                <PreviewCanvas ref={previewCanvasRef} gridSize={gridSize} pixelSize={pixelSize} brushSize={brushSize} />
                <div ref={hoverOverlayRef} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', display: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
          </div>
        </div>

        <div className="right-sidebar">
          <div className="right-sidebar-header">
            <span>Layers</span>
            <button className="tool-icon-btn" style={{ width: 28, height: 28 }} onClick={addLayer}><Plus size={16}/></button>
          </div>
          <div className="layer-list">
            {[...layers].reverse().map(layer => {
              const isSelected = selectedLayerIds.includes(layer.id);
              const isActive = activeLayerId === layer.id;
              return (
                <div 
                  key={layer.id} 
                  className={`layer-item ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}`} 
                  onClick={(e) => handleLayerClick(layer.id, e)}
                >
                  <div className="layer-item-top">
                    <button 
                      className={`layer-btn ${layer.visible ? 'eye-active' : ''}`} 
                      onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(layer.id); }}
                      title="Toggle Visibility"
                    >
                      {layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                    
                    <button 
                      className={`layer-btn ${isSelected ? 'select-active' : ''}`} 
                      onClick={(e) => { e.stopPropagation(); toggleLayerSelection(layer.id); }}
                      title="Toggle Selection for Transform"
                    >
                      {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                    </button>

                    <span className="layer-name">{layer.name}</span>
                    
                    <button className="layer-btn" onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id); }} disabled={layers.length <= 1}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {animationMode && (
        <Timeline 
          frames={frames} 
          activeFrameIndex={activeFrameIndex} 
          gridSize={gridSize}
          isPlaying={isPlaying}
          onionSkinEnabled={onionSkinEnabled}
          onSelectFrame={handleFrameChange}
          onAddFrame={handleAddFrame}
          onDuplicateFrame={handleDuplicateFrame}
          onDeleteFrame={handleDeleteFrame}
          onTogglePlay={() => togglePlay()}
          onToggleOnionSkin={() => setOnionSkinEnabled(!onionSkinEnabled)}
          onSetDuration={handleSetDuration}
        />
      )}

      <div className="bottom-bar">
        <div className="bottom-bar-section">
          <input type="color" value={currentColor} onChange={e => { setCurrentColor(e.target.value); setCurrentTool('brush'); }} className="color-picker-input" />
          <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
            {DEFAULT_PALETTE.map(color => (
              <div key={color} className="palette-swatch" style={{ backgroundColor: color }} onClick={() => { setCurrentColor(color); setCurrentTool('brush'); }} />
            ))}
          </div>
        </div>
        <div className="bottom-bar-divider" />
        <div className="bottom-bar-section" style={{ minWidth: '100px' }}>
          <span ref={coordsDisplayRef}>X: -, Y: -</span>
        </div>
        <div className="bottom-bar-divider" />
        <div className="bottom-bar-section">
          <button onClick={() => setShowGrid(!showGrid)} style={{ background: 'none', border: 'none', color: showGrid ? '#4f46e5' : '#aaa', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Toggle Grid">
            <Grid3X3 size={16} />
          </button>
          <select 
            value={gridSize} 
            onChange={(e) => handleGridSizeChange(Number(e.target.value) as GridSizeType)}
            style={{ background: '#333', color: 'white', border: '1px solid #555', borderRadius: '4px', padding: '2px 4px' }}
          >
            <option value={16}>16x16</option>
            <option value={32}>32x32</option>
            <option value={64}>64x64</option>
            <option value={128}>128x128</option>
          </select>
        </div>
        <div className="bottom-bar-divider" />
        <div className="bottom-bar-section">
          <span>Zoom: {Math.round((pixelSize / 32) * 100)}%</span>
        </div>
      </div>
    </div>
  );
}

const RefreshCwIcon = ({ size }: { size: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
);
const MaximizeIcon = ({ size }: { size: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
);
