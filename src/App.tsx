import { useState, useRef, useEffect, useCallback } from 'react';
import Canvas, { type CanvasHandle } from './components/Canvas';
import PreviewCanvas, { type PreviewTool, type PreviewCanvasHandle } from './components/PreviewCanvas';
import Timeline from './components/Timeline';
import WelcomeScreen from './components/WelcomeScreen';
import { usePlayback } from './hooks/usePlayback';
import { exportGif } from './utils/gifExport';
import { rasterizeGeometry, rasterizeLine, type GeometryTool, type Point } from './utils/drawing';
import { generateId, createEmptyGrid, cloneFrame, shallowCloneFrame, createDefaultFrame, createDefaultTransform, bakeLayerTransform } from './utils';
import { saveProjectAs, saveProjectToPath, openProjectFile } from './utils/projectFile';
import { autoSaveProject, addRecentFile } from './utils/autoSave';
import type { AnimationState, ToolType, GridSizeType, Layer, LayerTransform, ProjectData } from './types';
import { MenuBar, type MenuConfig, type ActionMap } from './components/MenuBar';

import {
  Brush, Eraser, PaintBucket, Pipette, Minus, Square, Circle,
  Move, Undo, Redo, Eye, EyeOff, Plus, Trash2, Grid3X3,
  CheckSquare, Sun, CloudRain, Type, SprayCan
} from 'lucide-react';

const MIN_PIXEL_SIZE = 1;
const DEFAULT_PALETTE = ['#000000', '#ffffff', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'];
const FRAME_TRANSFORM_TOOLS = ['frame-move', 'frame-rotate', 'frame-scale'] as const;

type FrameTransformTool = (typeof FRAME_TRANSFORM_TOOLS)[number];

type TransformSession = {
  tool: FrameTransformTool;
  anchorLayerId: string;
  startPointer: { x: number; y: number };
  origin: { x: number; y: number };
  startAngle: number;
  startDistance: number;
  initialTransforms: Record<string, LayerTransform>;
};

type TransformMetrics = {
  deltaGridX: number;
  deltaGridY: number;
  deltaAngle: number;
  scaleFactor: number;
};

type TransformHud = {
  tool: FrameTransformTool;
  title: string;
  value: string;
  meta: string;
  hint: string;
  pointer: { x: number; y: number };
  origin: { x: number; y: number };
};

const isFrameTransformTool = (tool: ToolType): tool is FrameTransformTool =>
  FRAME_TRANSFORM_TOOLS.includes(tool as FrameTransformTool);

const roundTo = (value: number, decimals = 2) => Number(value.toFixed(decimals));

const clampScale = (value: number) => Math.max(0.1, Math.min(5, roundTo(value, 3)));

const snapScale = (value: number) => {
  if (value >= 1) return Math.min(5, Math.round(value));
  if (value >= 0.75) return 1;
  if (value >= 0.35) return 0.5;
  if (value >= 0.15) return 0.25;
  return 0.1;
};

const wrapDegrees = (value: number) => {
  let wrapped = value % 360;
  if (wrapped > 180) wrapped -= 360;
  if (wrapped <= -180) wrapped += 360;
  return roundTo(wrapped, 1);
};

const formatSigned = (value: number, decimals = 1) => `${value >= 0 ? '+' : ''}${roundTo(value, decimals)}`;
const formatPlain = (value: number, decimals = 1) => `${roundTo(value, decimals)}`;

const getFrameToolTitle = (tool: FrameTransformTool) => {
  if (tool === 'frame-move') return 'Move';
  if (tool === 'frame-rotate') return 'Rotate';
  return 'Scale';
};

const getFrameToolHint = (tool: FrameTransformTool) => {
  if (tool === 'frame-move') return 'Drag to move selected layers';
  if (tool === 'frame-rotate') return 'Drag around the center pivot';
  return 'Drag away from or toward the center pivot';
};

const buildTransformHud = (
  tool: FrameTransformTool,
  transform: LayerTransform,
  metrics: TransformMetrics,
  pointer: { x: number; y: number },
  origin: { x: number; y: number },
  selectedCount: number,
): TransformHud => {
  const countLabel = `${selectedCount} layer${selectedCount === 1 ? '' : 's'}`;

  if (tool === 'frame-move') {
    return {
      tool,
      title: getFrameToolTitle(tool),
      value: `X ${formatSigned(metrics.deltaGridX)}  Y ${formatSigned(metrics.deltaGridY)}`,
      meta: `Pos ${formatPlain(transform.x)}, ${formatPlain(transform.y)} | ${countLabel}`,
      hint: getFrameToolHint(tool),
      pointer,
      origin,
    };
  }

  if (tool === 'frame-rotate') {
    return {
      tool,
      title: getFrameToolTitle(tool),
      value: `${formatPlain(transform.rotation)} deg`,
      meta: `Delta ${formatSigned(metrics.deltaAngle)} deg | ${countLabel}`,
      hint: getFrameToolHint(tool),
      pointer,
      origin,
    };
  }

  return {
    tool,
    title: getFrameToolTitle(tool),
    value: `${Math.round(transform.scale * 100)}%`,
    meta: `${formatPlain(transform.scale, 2)}x | ${countLabel}`,
    hint: getFrameToolHint(tool),
    pointer,
    origin,
  };
};

export default function App() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [gridSize, setGridSize] = useState<GridSizeType>(16);
  const [pixelSize, setPixelSize] = useState(32);
  const [showGrid, setShowGrid] = useState(false);
  const [brushSize, setBrushSize] = useState<number>(1);
  const [onionSkinEnabled, setOnionSkinEnabled] = useState(false);
  const [animationMode, setAnimationMode] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [undoStack, setUndoStack] = useState<AnimationState[]>([]);
  const [redoStack, setRedoStack] = useState<AnimationState[]>([]);
  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  // --- UI State ---
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(64);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(240);
  const isResizingLeft = useRef(false);
  const isResizingRight = useRef(false);
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);

  // --- File state ---
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const [currentTool, setCurrentTool] = useState<ToolType>('brush');
  const [currentColor, setCurrentColor] = useState<string>('#000000');
  const [pickerHoverColor, setPickerHoverColor] = useState<string | null>(null);
  const [transformHud, setTransformHud] = useState<TransformHud | null>(null);
  const activeFrame = frames[activeFrameIndex];
  const layers = activeFrame.layers;
  const activeLayer = layers.find(layer => layer.id === activeLayerId) ?? layers[0] ?? null;
  const selectedTransformLayers = layers.filter(layer => selectedLayerIds.includes(layer.id));
  const frameTransformTool = isFrameTransformTool(currentTool) ? currentTool : null;
  const transformGuideSize = gridSize * pixelSize;

  const canvasRef = useRef<CanvasHandle>(null);
  const previewCanvasRef = useRef<PreviewCanvasHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const transformContainerRef = useRef<HTMLDivElement>(null);
  const hoverOverlayRef = useRef<HTMLDivElement>(null);
  const coordsDisplayRef = useRef<HTMLSpanElement>(null);

  const panRef = useRef({ x: 0, y: 0 });
  const pixelSizeRef = useRef(pixelSize);
  pixelSizeRef.current = pixelSize; // Keep in sync every render
  const hasCentered = useRef(false);
  const isPanning = useRef(false);
  const lastPanPoint = useRef<{ x: number, y: number } | null>(null);
  const isSpaceDown = useRef(false);
  const activePointerId = useRef<number | null>(null);
  const lastNonPickerToolRef = useRef<ToolType>('brush');
  const pickerHoverColorRef = useRef<string | null>(null);

  const isDrawing = useRef(false);
  const strokeStart = useRef<{ x: number, y: number } | null>(null);
  const dragCurrent = useRef<{ x: number, y: number } | null>(null);
  const lastBrushPoint = useRef<{ x: number, y: number } | null>(null);
  const transformSessionRef = useRef<TransformSession | null>(null);
  const ldOriginalGrid = useRef<(string | null)[][] | null>(null);

  const updatePickerHoverColor = useCallback((nextColor: string | null) => {
    if (pickerHoverColorRef.current === nextColor) return;
    pickerHoverColorRef.current = nextColor;
    setPickerHoverColor(nextColor);
  }, []);

  const activateTool = useCallback((nextTool: ToolType) => {
    setCurrentTool(prevTool => {
      if (nextTool === 'picker') {
        if (prevTool !== 'picker') {
          lastNonPickerToolRef.current = prevTool;
        }
        return nextTool;
      }

      lastNonPickerToolRef.current = nextTool;
      return nextTool;
    });

    if (nextTool !== 'picker') {
      updatePickerHoverColor(null);
    }
  }, [updatePickerHoverColor]);

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

  const cloneAnimationState = useCallback((state: AnimationState): AnimationState => ({
    frames: state.frames.map(frame => cloneFrame(frame)),
    activeFrameIndex: state.activeFrameIndex,
    activeLayerId: state.activeLayerId,
    selectedLayerIds: [...state.selectedLayerIds],
  }), []);

  const pushUndoSnapshot = useCallback((state: AnimationState) => {
    const snapshot = cloneAnimationState(state);
    setUndoStack(prev => {
      const next = [...prev, snapshot];
      if (next.length > 50) next.shift();
      return next;
    });
    setRedoStack([]);
  }, [cloneAnimationState]);

  const getTransformAnchorLayer = useCallback(() => {
    if (selectedTransformLayers.length > 0) {
      return selectedTransformLayers.find(layer => layer.id === activeLayerId) ?? selectedTransformLayers[0];
    }
    return activeLayer;
  }, [activeLayer, activeLayerId, selectedTransformLayers]);

  const getLayerCenterInContainer = useCallback((transform: LayerTransform) => ({
    x: panRef.current.x + (gridSize * pixelSize) / 2 + transform.x * pixelSize,
    y: panRef.current.y + (gridSize * pixelSize) / 2 + transform.y * pixelSize,
  }), [gridSize, pixelSize]);

  const getTransformMetrics = useCallback((session: TransformSession, mouseX: number, mouseY: number): TransformMetrics => {
    const deltaGridX = (mouseX - session.startPointer.x) / pixelSize;
    const deltaGridY = (mouseY - session.startPointer.y) / pixelSize;

    const currentAngle = (Math.atan2(mouseY - session.origin.y, mouseX - session.origin.x) * 180) / Math.PI;
    let deltaAngle = currentAngle - session.startAngle;
    if (deltaAngle > 180) deltaAngle -= 360;
    if (deltaAngle < -180) deltaAngle += 360;

    const currentDistance = Math.hypot(mouseX - session.origin.x, mouseY - session.origin.y);
    const distanceDelta = currentDistance - session.startDistance;
    const scaleFactor = Math.max(0.05, 1 + distanceDelta / Math.max(session.startDistance, 80));

    return {
      deltaGridX,
      deltaGridY,
      deltaAngle,
      scaleFactor,
    };
  }, [pixelSize]);

  const getNextTransform = useCallback((tool: FrameTransformTool, transform: LayerTransform, metrics: TransformMetrics): LayerTransform => {
    if (tool === 'frame-move') {
      return {
        ...transform,
        x: Math.round(transform.x + metrics.deltaGridX),
        y: Math.round(transform.y + metrics.deltaGridY),
      };
    }

    if (tool === 'frame-rotate') {
      return {
        ...transform,
        rotation: animationMode
          ? wrapDegrees(transform.rotation + metrics.deltaAngle)
          : wrapDegrees(Math.round((transform.rotation + metrics.deltaAngle) / 90) * 90),
      };
    }

    return {
      ...transform,
      scale: animationMode
        ? clampScale(transform.scale * metrics.scaleFactor)
        : snapScale(transform.scale * metrics.scaleFactor),
    };
  }, [animationMode]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack(prev => [...prev, cloneAnimationState(animState)]);
    setUndoStack(prev => prev.slice(0, -1));
    setAnimState(cloneAnimationState(previous));
  }, [animState, cloneAnimationState, undoStack]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(prev => {
      const updated = [...prev, cloneAnimationState(animState)];
      if (updated.length > 50) updated.shift();
      return updated;
    });
    setRedoStack(prev => prev.slice(0, -1));
    setAnimState(cloneAnimationState(next));
  }, [animState, cloneAnimationState, redoStack]);

  // --- Frame Operations ---
  const handleAddFrame = () => {
    pushUndoSnapshot(animState);
    setAnimState(prev => {
      const newFrame = cloneFrame(prev.frames[prev.activeFrameIndex]);
      const nextFrames = [...prev.frames, newFrame];
      return { ...prev, frames: nextFrames, activeFrameIndex: nextFrames.length - 1 };
    });
  };

  const handleDuplicateFrame = () => {
    pushUndoSnapshot(animState);
    setAnimState(prev => {
      const newFrame = shallowCloneFrame(prev.frames[prev.activeFrameIndex]);
      const nextFrames = [...prev.frames, newFrame];
      return { ...prev, frames: nextFrames, activeFrameIndex: nextFrames.length - 1 };
    });
  };

  const handleDeleteFrame = () => {
    if (frames.length <= 1) return;
    pushUndoSnapshot(animState);
    setAnimState(prev => {
      const nextFrames = prev.frames.filter((_, i) => i !== prev.activeFrameIndex);
      const nextIndex = Math.min(prev.activeFrameIndex, nextFrames.length - 1);
      return { ...prev, frames: nextFrames, activeFrameIndex: nextIndex };
    });
  };

  const handleSetDuration = (index: number, duration: number) => {
    pushUndoSnapshot(animState);
    setAnimState(prev => {
      const nextFrames = [...prev.frames];
      nextFrames[index] = { ...nextFrames[index], duration };
      return { ...prev, frames: nextFrames };
    });
  };

  const handleSetDurationAll = (duration: number) => {
    pushUndoSnapshot(animState);
    setAnimState(prev => {
      const nextFrames = prev.frames.map(f => ({ ...f, duration }));
      return { ...prev, frames: nextFrames };
    });
  };

  const handleReorderFrame = useCallback((oldIndex: number, newIndex: number) => {
    if (oldIndex === newIndex) return;
    pushUndoSnapshot(animState);
    setAnimState(prev => {
      const nextFrames = [...prev.frames];
      const [movedFrame] = nextFrames.splice(oldIndex, 1);
      nextFrames.splice(newIndex, 0, movedFrame);

      let nextActiveIndex = prev.activeFrameIndex;
      if (prev.activeFrameIndex === oldIndex) {
        nextActiveIndex = newIndex;
      } else if (prev.activeFrameIndex > oldIndex && prev.activeFrameIndex <= newIndex) {
        nextActiveIndex--;
      } else if (prev.activeFrameIndex < oldIndex && prev.activeFrameIndex >= newIndex) {
        nextActiveIndex++;
      }
      return { ...prev, frames: nextFrames, activeFrameIndex: nextActiveIndex };
    });
  }, [animState]);

  // --- Zoom / Pan ---
  const handleZoom = useCallback((delta: number, mouseX: number, mouseY: number) => {
    const oldPixelSize = pixelSizeRef.current;
    let newPixelSize = oldPixelSize;
    if (delta > 0) {
      newPixelSize = oldPixelSize < 8 ? oldPixelSize + 1 : oldPixelSize + 4;
      newPixelSize = Math.min(newPixelSize, 128);
    } else if (delta < 0) {
      newPixelSize = oldPixelSize <= 8 ? oldPixelSize - 1 : oldPixelSize - 4;
      newPixelSize = Math.max(newPixelSize, MIN_PIXEL_SIZE);
    }

    if (newPixelSize === oldPixelSize) return;

    const scale = newPixelSize / oldPixelSize;
    const panX = panRef.current.x;
    const panY = panRef.current.y;

    const logicalW = gridSize * oldPixelSize;
    const logicalH = gridSize * oldPixelSize;

    // Clamp target to grid bounds to prevent canvas from flying away when zooming from the void
    const targetX = Math.max(panX, Math.min(mouseX, panX + logicalW));
    const targetY = Math.max(panY, Math.min(mouseY, panY + logicalH));

    panRef.current.x = targetX - (targetX - panX) * scale;
    panRef.current.y = targetY - (targetY - panY) * scale;
    pixelSizeRef.current = newPixelSize; // Update synchronously to prevent rapid scroll jitter

    if (transformContainerRef.current) {
      transformContainerRef.current.style.transform = `translate(${panRef.current.x}px, ${panRef.current.y}px)`;
    }
    setPixelSize(newPixelSize);
  }, [gridSize]);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const delta = e.deltaY < 0 ? 1 : -1;
      handleZoom(delta, mouseX, mouseY);
    };
    const div = containerRef.current;
    div?.addEventListener('wheel', handleWheel, { passive: false });
    return () => div?.removeEventListener('wheel', handleWheel);
  }, [handleZoom, showWelcome]);

  // --- Center canvas on load ---
  useEffect(() => {
    if (!showWelcome && !hasCentered.current && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const logicalW = gridSize * pixelSize;
      const logicalH = gridSize * pixelSize;
      panRef.current = {
        x: Math.round((rect.width - logicalW) / 2),
        y: Math.round((rect.height - logicalH) / 2)
      };
      if (transformContainerRef.current) {
        transformContainerRef.current.style.transform = `translate(${panRef.current.x}px, ${panRef.current.y}px)`;
      }
      hasCentered.current = true;
    }
  }, [showWelcome, gridSize, pixelSize]);

  // --- Sidebar Resize Logic ---
  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (isResizingLeft.current) {
        setLeftSidebarWidth(Math.max(64, Math.min(e.clientX, 400)));
      }
      if (isResizingRight.current) {
        setRightSidebarWidth(Math.max(150, Math.min(window.innerWidth - e.clientX, 600)));
      }
    };
    const handleUp = () => {
      if (isResizingLeft.current || isResizingRight.current) {
        isResizingLeft.current = false;
        isResizingRight.current = false;
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

  // --- File Operations ---
  const handleSave = useCallback(async () => {
    if (currentFilePath) {
      try {
        await saveProjectToPath(currentFilePath, gridSize, animState, currentColor, currentTool);
        setIsDirty(false);
        addRecentFile(currentFilePath, gridSize);
      } catch (err) {
        alert(`Save failed: ${(err as Error).message}`);
      }
    } else {
      handleSaveAs();
    }
  }, [currentFilePath, gridSize, animState, currentColor, currentTool]);

  const handleSaveAs = useCallback(async () => {
    try {
      const path = await saveProjectAs(gridSize, animState, currentColor, currentTool);
      if (path && path !== 'web-download') {
        setCurrentFilePath(path);
        setIsDirty(false);
        addRecentFile(path, gridSize);
      }
    } catch (err) {
      alert(`Save failed: ${(err as Error).message}`);
    }
  }, [gridSize, animState, currentColor, currentTool]);

  const handleOpenFile = useCallback(async () => {
    if (isDirty && !window.confirm('You have unsaved changes. Continue?')) return;
    try {
      const result = await openProjectFile();
      if (result) {
        loadProjectData(result.data, result.filePath);
      }
    } catch (err) {
      alert(`Open failed: ${(err as Error).message}`);
    }
  }, [isDirty]);

  const loadProjectData = (data: ProjectData, filePath: string) => {
    setGridSize(data.canvas.width);
    setAnimState(data.animState);
    setCurrentColor(data.currentColor);
    setCurrentTool(data.currentTool);
    setCurrentFilePath(filePath);
    setIsDirty(false);
    setUndoStack([]);
    setRedoStack([]);
    setShowWelcome(false);
    hasCentered.current = false;
    addRecentFile(filePath, data.canvas.width);
  };

  // --- Auto-save (debounce 5s) ---
  useEffect(() => {
    if (showWelcome) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveProject(gridSize, animState, currentColor, currentTool).catch(console.error);
    }, 5000);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [animState, gridSize, currentColor, currentTool, showWelcome]);

  // --- Mark dirty on edits ---
  useEffect(() => {
    if (!showWelcome) setIsDirty(true);
  }, [animState]);

  // --- Prompt before close ---
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // --- Keyboard ---
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        isSpaceDown.current = true;
        setIsSpacePressed(true);
      }

      const key = e.key.toLowerCase();

      // File shortcuts
      if ((e.ctrlKey || e.metaKey) && key === 's') {
        e.preventDefault();
        if (e.shiftKey) { handleSaveAs(); } else { handleSave(); }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && key === 'o') {
        e.preventDefault();
        handleOpenFile();
        return;
      }

      if (!isPlaying) {
        if (key === 'b') activateTool('brush');
        if (key === 'e') activateTool('eraser');
        if (key === 'g') activateTool('fill');
        if (key === 'i') activateTool('picker');
        if (key === 'l') activateTool('line');
        if (key === 'r') activateTool('rect');
        if (key === 'c') activateTool('circle');
        if (key === 's' && !(e.ctrlKey || e.metaKey)) activateTool('select');
        if (key === 'm') activateTool('move');
        if (key === 'd' && e.shiftKey) activateTool('darken');
        else if (key === 'd') activateTool('lighten');
        if (key === 'a') activateTool('spray');
        if (key === 't') activateTool('text');
      }

      if ((e.ctrlKey || e.metaKey) && key === 'z') { e.preventDefault(); handleUndo(); }
      if ((e.ctrlKey || e.metaKey) && key === 'y') { e.preventDefault(); handleRedo(); }
      if (key === '+' || key === '=') {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) handleZoom(1, rect.width / 2, rect.height / 2);
      }
      if (key === '-' || key === '_') {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) handleZoom(-1, rect.width / 2, rect.height / 2);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        isSpaceDown.current = false;
        setIsSpacePressed(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [activateTool, handleRedo, handleUndo, handleSave, handleSaveAs, handleOpenFile, isPlaying]);

  // --- Drawing logic ---
  const getPointerPosition = (e: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    return { mouseX, mouseY };
  };

  const screenToLayerGrid = (layer: Layer, mouseX: number, mouseY: number) => {
    let cx = mouseX - panRef.current.x;
    let cy = mouseY - panRef.current.y;

    const logicalW = gridSize * pixelSize;
    const logicalH = gridSize * pixelSize;
    const centerX = logicalW / 2;
    const centerY = logicalH / 2;
    const { x: tx, y: ty, rotation, scale } = layer.transform;

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

    return {
      gridX: Math.floor(cx / pixelSize),
      gridY: Math.floor(cy / pixelSize),
      canvasX: cx,
      canvasY: cy,
    };
  };

  const screenToActiveLayerGrid = (mouseX: number, mouseY: number) => {
    const frame = frames[activeFrameIndex];
    if (!frame) return null;
    const activeLayer = frame.layers.find(layer => layer.id === activeLayerId);
    if (!activeLayer) return null;
    return screenToLayerGrid(activeLayer, mouseX, mouseY);
  };

  const getPointerCoords = (e: React.PointerEvent) => {
    const pointer = getPointerPosition(e);
    if (!pointer) return null;
    const activeCoords = screenToActiveLayerGrid(pointer.mouseX, pointer.mouseY);
    if (!activeCoords) return null;
    return { ...pointer, ...activeCoords };
  };

  const isGridCoordInBounds = (x: number, y: number) =>
    x >= 0 && x < gridSize && y >= 0 && y < gridSize;

  const pickTopmostVisibleLayerAt = (mouseX: number, mouseY: number) => {
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i];
      if (!layer.visible) continue;
      const { gridX, gridY } = screenToLayerGrid(layer, mouseX, mouseY);
      if (!isGridCoordInBounds(gridX, gridY)) continue;
      const color = layer.grid[gridY]?.[gridX];
      if (color) return color;
    }
    return null;
  };

  const stampBrushPoint = (
    grid: (string | null)[][],
    x: number,
    y: number,
    color: string | null,
    size: number,
    clonedRows: Set<number>,
  ) => {
    let changed = false;
    const startOffset = -Math.floor(size / 2);
    const endOffset = Math.floor((size - 1) / 2);

    for (let dy = startOffset; dy <= endOffset; dy++) {
      for (let dx = startOffset; dx <= endOffset; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (!isGridCoordInBounds(nx, ny)) continue;
        if (grid[ny][nx] === color) continue;
        if (!clonedRows.has(ny)) {
          grid[ny] = [...grid[ny]];
          clonedRows.add(ny);
        }
        grid[ny][nx] = color;
        changed = true;
      }
    }

    return changed;
  };

  const getForwardCssTransform = () => {
    if (!activeLayer) return 'none';
    const { x: tx, y: ty, rotation, scale } = activeLayer.transform;
    return `translate(${tx * pixelSize}px, ${ty * pixelSize}px) rotate(${rotation}deg) scale(${scale})`;
  };

  const getActiveTool = () => {
    return currentTool;
  };

  const hideHoverOverlay = () => {
    if (!hoverOverlayRef.current) return;
    hoverOverlayRef.current.style.display = 'none';
  };

  const resetCanvasHover = () => {
    if (coordsDisplayRef.current) coordsDisplayRef.current.innerText = 'X: -, Y: -';
    hideHoverOverlay();
  };

  const updateHover = (gridX: number, gridY: number, isActive: boolean) => {
    if (coordsDisplayRef.current) coordsDisplayRef.current.innerText = `X: ${gridX}, Y: ${gridY}`;
    if (!hoverOverlayRef.current) return;

    const tool = getActiveTool();
    if (isFrameTransformTool(tool)) {
      hideHoverOverlay();
      return;
    }
    const isGeometryTool = ['line', 'rect', 'circle', 'select'].includes(tool);
    if (!isActive || !isGridCoordInBounds(gridX, gridY) || (isDrawing.current && isGeometryTool)) {
      hideHoverOverlay();
      return;
    }
    const isPickerTool = tool === 'picker';
    const isBrushSized = ['brush', 'eraser', 'line', 'lighten', 'darken', 'spray'].includes(tool);
    const currentBrushSize = (isBrushSized && !isPickerTool) ? brushSize : 1;
    const startOffset = -Math.floor(currentBrushSize / 2);
    hoverOverlayRef.current.style.display = 'block';
    hoverOverlayRef.current.style.width = `${currentBrushSize * pixelSize}px`;
    hoverOverlayRef.current.style.height = `${currentBrushSize * pixelSize}px`;
    hoverOverlayRef.current.style.transform = `translate(${(gridX + startOffset) * pixelSize}px, ${(gridY + startOffset) * pixelSize}px)`;
    hoverOverlayRef.current.style.borderRadius = isPickerTool ? '4px' : '0';
    hoverOverlayRef.current.style.border = isPickerTool
      ? `2px solid ${pickerHoverColorRef.current ?? 'rgba(255,255,255,0.65)'}`
      : tool === 'eraser'
        ? '1px solid rgba(255, 99, 99, 0.5)'
        : '1px solid rgba(255,255,255,0.16)';
    hoverOverlayRef.current.style.boxShadow = isPickerTool
      ? '0 0 0 1px rgba(0,0,0,0.35) inset'
      : 'none';
    hoverOverlayRef.current.style.background = isPickerTool
      ? (pickerHoverColorRef.current ? `${pickerHoverColorRef.current}33` : 'rgba(255,255,255,0.08)')
      : tool === 'eraser'
        ? 'rgba(255,0,0,0.15)'
        : 'rgba(0,0,0,0.1)';
  };

  const applyBrushPoints = (points: Point[], isRightClick: boolean) => {
    const tool = getActiveTool();
    const targetColor = (tool === 'eraser' || isRightClick) ? null : currentColor;

    setAnimState(prev => {
      const activeIdx = prev.activeFrameIndex;
      const frame = { ...prev.frames[activeIdx] };
      const newLayers = [...frame.layers];
      const layerIdx = newLayers.findIndex(l => l.id === prev.activeLayerId);
      if (layerIdx === -1 || !newLayers[layerIdx].visible) return prev;

      const activeLayer = { ...newLayers[layerIdx] };
      const newGrid = [...activeLayer.grid];
      const clonedRows = new Set<number>();
      let changed = false;

      for (const point of points) {
        changed = stampBrushPoint(newGrid, point.x, point.y, targetColor, brushSize, clonedRows) || changed;
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

  const applyTool = (x: number, y: number, isRightClick: boolean) => {
    applyBrushPoints([{ x, y }], isRightClick);
  };

  const applyStrokeSegment = (
    start: { x: number; y: number },
    end: { x: number; y: number },
    isRightClick: boolean,
  ) => {
    if (start.x === end.x && start.y === end.y) return;
    applyBrushPoints(rasterizeLine(start.x, start.y, end.x, end.y), isRightClick);
  };

  // --- Color manipulation helpers ---
  const hexToHsl = (hex: string): [number, number, number] => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    return [h * 360, s * 100, l * 100];
  };

  const hslToHex = (h: number, s: number, l: number): string => {
    h /= 360; s /= 100; l /= 100;
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    let r: number, g: number, b: number;
    if (s === 0) { r = g = b = l; }
    else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    const toHex = (c: number) => Math.round(Math.min(255, Math.max(0, c * 255))).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  // --- Lighten / Darken tool ---
  const applyLightenDarken = (points: {x: number, y: number}[], mode: 'lighten' | 'darken') => {
    const amount = mode === 'lighten' ? 10 : -10;
    setAnimState(prev => {
      const activeIdx = prev.activeFrameIndex;
      const frame = { ...prev.frames[activeIdx] };
      const newLayers = [...frame.layers];
      const layerIdx = newLayers.findIndex(l => l.id === prev.activeLayerId);
      if (layerIdx === -1 || !newLayers[layerIdx].visible) return prev;

      // Snapshot original grid on first call of this stroke
      if (!ldOriginalGrid.current) {
        ldOriginalGrid.current = newLayers[layerIdx].grid.map(row => [...row]);
      }

      const activeLayer = { ...newLayers[layerIdx] };
      const newGrid = activeLayer.grid.map(row => [...row]);
      let changed = false;
      const startOffset = -Math.floor(brushSize / 2);
      const endOffset = Math.floor((brushSize - 1) / 2);

      for (const { x, y } of points) {
        for (let dy = startOffset; dy <= endOffset; dy++) {
          for (let dx = startOffset; dx <= endOffset; dx++) {
            const nx = x + dx, ny = y + dy;
            if (!isGridCoordInBounds(nx, ny)) continue;

            // Always compute from the ORIGINAL snapshot — prevents stacking naturally
            const originalPixel = ldOriginalGrid.current[ny][nx];
            if (!originalPixel) continue;
            const [h, s, l] = hexToHsl(originalPixel);
            const newL = Math.max(0, Math.min(100, l + amount));
            const newColor = hslToHex(h, s, newL);
            if (newGrid[ny][nx] !== newColor) {
              newGrid[ny][nx] = newColor;
              changed = true;
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

  // --- Spray paint tool ---
  const applySpray = (x: number, y: number) => {
    setAnimState(prev => {
      const activeIdx = prev.activeFrameIndex;
      const frame = { ...prev.frames[activeIdx] };
      const newLayers = [...frame.layers];
      const layerIdx = newLayers.findIndex(l => l.id === prev.activeLayerId);
      if (layerIdx === -1 || !newLayers[layerIdx].visible) return prev;

      const activeLayer = { ...newLayers[layerIdx] };
      const newGrid = activeLayer.grid.map(row => [...row]);
      let changed = false;
      const radius = Math.max(brushSize, 3);
      const count = Math.ceil(radius * radius * 0.2);

      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * radius;
        const nx = x + Math.round(Math.cos(angle) * dist);
        const ny = y + Math.round(Math.sin(angle) * dist);
        if (!isGridCoordInBounds(nx, ny)) continue;
        if (newGrid[ny][nx] !== currentColor) {
          newGrid[ny][nx] = currentColor;
          changed = true;
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

  // --- Text tool ---
  const applyText = (x: number, y: number) => {
    const text = window.prompt('Enter text:');
    if (!text) return;

    pushUndoSnapshot(animState);
    setAnimState(prev => {
      const activeIdx = prev.activeFrameIndex;
      const frame = { ...prev.frames[activeIdx] };
      const newLayers = [...frame.layers];
      const layerIdx = newLayers.findIndex(l => l.id === prev.activeLayerId);
      if (layerIdx === -1 || !newLayers[layerIdx].visible) return prev;

      const activeLayer = { ...newLayers[layerIdx] };
      const newGrid = activeLayer.grid.map(row => [...row]);

      // Simple 5x5 pixel font for basic ASCII
      const PIXEL_FONT: Record<string, number[]> = {
        'A': [0b01110, 0b10001, 0b11111, 0b10001, 0b10001],
        'B': [0b11110, 0b10001, 0b11110, 0b10001, 0b11110],
        'C': [0b01111, 0b10000, 0b10000, 0b10000, 0b01111],
        'D': [0b11110, 0b10001, 0b10001, 0b10001, 0b11110],
        'E': [0b11111, 0b10000, 0b11110, 0b10000, 0b11111],
        'F': [0b11111, 0b10000, 0b11110, 0b10000, 0b10000],
        'G': [0b01111, 0b10000, 0b10011, 0b10001, 0b01110],
        'H': [0b10001, 0b10001, 0b11111, 0b10001, 0b10001],
        'I': [0b11111, 0b00100, 0b00100, 0b00100, 0b11111],
        'J': [0b00111, 0b00010, 0b00010, 0b10010, 0b01100],
        'K': [0b10001, 0b10010, 0b11100, 0b10010, 0b10001],
        'L': [0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
        'M': [0b10001, 0b11011, 0b10101, 0b10001, 0b10001],
        'N': [0b10001, 0b11001, 0b10101, 0b10011, 0b10001],
        'O': [0b01110, 0b10001, 0b10001, 0b10001, 0b01110],
        'P': [0b11110, 0b10001, 0b11110, 0b10000, 0b10000],
        'Q': [0b01110, 0b10001, 0b10101, 0b10010, 0b01101],
        'R': [0b11110, 0b10001, 0b11110, 0b10010, 0b10001],
        'S': [0b01111, 0b10000, 0b01110, 0b00001, 0b11110],
        'T': [0b11111, 0b00100, 0b00100, 0b00100, 0b00100],
        'U': [0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
        'V': [0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
        'W': [0b10001, 0b10001, 0b10101, 0b11011, 0b10001],
        'X': [0b10001, 0b01010, 0b00100, 0b01010, 0b10001],
        'Y': [0b10001, 0b01010, 0b00100, 0b00100, 0b00100],
        'Z': [0b11111, 0b00010, 0b00100, 0b01000, 0b11111],
        '0': [0b01110, 0b10011, 0b10101, 0b11001, 0b01110],
        '1': [0b00100, 0b01100, 0b00100, 0b00100, 0b01110],
        '2': [0b01110, 0b10001, 0b00110, 0b01000, 0b11111],
        '3': [0b11110, 0b00001, 0b01110, 0b00001, 0b11110],
        '4': [0b10001, 0b10001, 0b11111, 0b00001, 0b00001],
        '5': [0b11111, 0b10000, 0b11110, 0b00001, 0b11110],
        '6': [0b01110, 0b10000, 0b11110, 0b10001, 0b01110],
        '7': [0b11111, 0b00001, 0b00010, 0b00100, 0b00100],
        '8': [0b01110, 0b10001, 0b01110, 0b10001, 0b01110],
        '9': [0b01110, 0b10001, 0b01111, 0b00001, 0b01110],
        ' ': [0b00000, 0b00000, 0b00000, 0b00000, 0b00000],
        '.': [0b00000, 0b00000, 0b00000, 0b00000, 0b00100],
        '!': [0b00100, 0b00100, 0b00100, 0b00000, 0b00100],
        '?': [0b01110, 0b10001, 0b00110, 0b00000, 0b00100],
        '-': [0b00000, 0b00000, 0b11111, 0b00000, 0b00000],
        ':': [0b00000, 0b00100, 0b00000, 0b00100, 0b00000],
      };

      let cursorX = x;
      for (const char of text.toUpperCase()) {
        const glyph = PIXEL_FONT[char];
        if (!glyph) { cursorX += 4; continue; }
        for (let row = 0; row < 5; row++) {
          for (let col = 0; col < 5; col++) {
            if (glyph[row] & (1 << (4 - col))) {
              const px = cursorX + col;
              const py = y + row;
              if (isGridCoordInBounds(px, py)) {
                newGrid[py][px] = currentColor;
              }
            }
          }
        }
        cursorX += 6; // 5px wide + 1px gap
      }

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
        if (!isGridCoordInBounds(x, y)) continue;

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
      const geometryTool = tool as GeometryTool;
      const points = rasterizeGeometry(geometryTool, x0, y0, x1, y1);

      for (const point of points) {
        if (geometryTool === 'line') {
          const startOffset = -Math.floor(brushSize / 2);
          const endOffset = Math.floor((brushSize - 1) / 2);
          for (let dy = startOffset; dy <= endOffset; dy++) {
            for (let dx = startOffset; dx <= endOffset; dx++) {
              const nx = point.x + dx;
              const ny = point.y + dy;
              if (isGridCoordInBounds(nx, ny) && newGrid[ny][nx] !== color) {
                newGrid[ny][nx] = color;
                changed = true;
              }
            }
          }
        } else if (isGridCoordInBounds(point.x, point.y) && newGrid[point.y][point.x] !== color) {
          newGrid[point.y][point.x] = color;
          changed = true;
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

  const capturePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointerId.current = e.pointerId;
    try {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.setPointerCapture(e.pointerId);
      }
    } catch {
      activePointerId.current = e.pointerId;
    }
  };

  const resetInteractionState = () => {
    isPanning.current = false;
    lastPanPoint.current = null;
    isDrawing.current = false;
    strokeStart.current = null;
    dragCurrent.current = null;
    lastBrushPoint.current = null;
    activePointerId.current = null;
    transformSessionRef.current = null;
    ldOriginalGrid.current = null;
    setTransformHud(null);
  };

  const finishInteraction = (button: number) => {
    if (isPanning.current) {
      resetInteractionState();
      return;
    }

    const tool = getActiveTool();
    if (isDrawing.current) {
      if (['line', 'rect', 'circle'].includes(tool) && strokeStart.current && dragCurrent.current) {
        commitGeometry(tool, strokeStart.current.x, strokeStart.current.y, dragCurrent.current.x, dragCurrent.current.y, button === 2);
      }
      if (['line', 'rect', 'circle', 'select'].includes(tool)) {
        previewCanvasRef.current?.clear();
      }
    }

    if (isDrawing.current && isFrameTransformTool(tool)) {
      const shouldBake = tool === 'frame-move' || !animationMode;

      if (shouldBake) {
        setAnimState(prev => {
          const activeIdx = prev.activeFrameIndex;
          const frame = { ...prev.frames[activeIdx] };
          const newLayers = [...frame.layers];
          let changed = false;

          newLayers.forEach((layer, idx) => {
            if (layer.transform.x !== 0 || layer.transform.y !== 0 || layer.transform.rotation !== 0 || layer.transform.scale !== 1) {
              newLayers[idx] = bakeLayerTransform(layer, gridSize);
              changed = true;
            }
          });

          if (!changed) return prev;
          frame.layers = newLayers;
          const nextFrames = [...prev.frames];
          nextFrames[activeIdx] = frame;
          return { ...prev, frames: nextFrames };
        });
      }
    }

    resetInteractionState();
  };

  const handlePointerLeave = () => {
    if (isDrawing.current || isPanning.current) return;
    resetCanvasHover();
    updatePickerHoverColor(null);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPlaying) return;
    if (activePointerId.current !== null) return;

    const tool = getActiveTool();
    const shouldPan = (isSpaceDown.current && e.button === 0) || e.button === 1 || tool === 'move';
    if (shouldPan) {
      isPanning.current = true;
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
      capturePointer(e);
      return;
    }

    if (isFrameTransformTool(tool)) {
      const pointer = getPointerPosition(e);
      const anchorLayer = getTransformAnchorLayer();
      const layersToTransform = selectedTransformLayers.length > 0 ? selectedTransformLayers : (anchorLayer ? [anchorLayer] : []);
      if (!pointer || !anchorLayer || layersToTransform.length === 0) return;

      const origin = getLayerCenterInContainer(anchorLayer.transform);
      const initialTransforms = Object.fromEntries(
        layersToTransform.map(layer => [layer.id, { ...layer.transform }]),
      );
      const startAngle = (Math.atan2(pointer.mouseY - origin.y, pointer.mouseX - origin.x) * 180) / Math.PI;
      const startDistance = Math.max(Math.hypot(pointer.mouseX - origin.x, pointer.mouseY - origin.y), 1);
      const session: TransformSession = {
        tool,
        anchorLayerId: anchorLayer.id,
        startPointer: { x: pointer.mouseX, y: pointer.mouseY },
        origin,
        startAngle,
        startDistance,
        initialTransforms,
      };

      isDrawing.current = true;
      transformSessionRef.current = session;
      pushUndoSnapshot(animState);
      setTransformHud(buildTransformHud(
        tool,
        anchorLayer.transform,
        { deltaGridX: 0, deltaGridY: 0, deltaAngle: 0, scaleFactor: 1 },
        { x: pointer.mouseX, y: pointer.mouseY },
        origin,
        layersToTransform.length,
      ));
      capturePointer(e);
      return;
    }

    const coords = getPointerCoords(e);
    if (!coords) return;

    if (!isGridCoordInBounds(coords.gridX, coords.gridY)) return;

    if (tool === 'picker') {
      const picked = pickTopmostVisibleLayerAt(coords.mouseX, coords.mouseY);
      if (picked) {
        setCurrentColor(picked);
        const restoreTool = lastNonPickerToolRef.current !== 'picker'
          ? lastNonPickerToolRef.current
          : 'brush';
        activateTool(restoreTool);
      }
      return;
    }

    isDrawing.current = true;
    strokeStart.current = { x: coords.gridX, y: coords.gridY };
    dragCurrent.current = { x: coords.gridX, y: coords.gridY };
    lastBrushPoint.current = { x: coords.gridX, y: coords.gridY };
    capturePointer(e);

    if (['brush', 'eraser', 'line', 'rect', 'circle', 'fill', 'lighten', 'darken', 'spray'].includes(tool)) {
      pushUndoSnapshot(animState);
    }

    if (['line', 'rect', 'circle', 'select'].includes(tool)) {
      previewCanvasRef.current?.drawPreview(tool as PreviewTool, coords.gridX, coords.gridY, coords.gridX, coords.gridY, e.button === 2 ? null : currentColor);
    } else if (tool === 'fill') {
      isDrawing.current = false;
      handleFill(coords.gridX, coords.gridY, e.button === 2);
    } else if (tool === 'text') {
      isDrawing.current = false;
      applyText(coords.gridX, coords.gridY);
    } else if (tool === 'lighten' || tool === 'darken') {
      applyLightenDarken([{x: coords.gridX, y: coords.gridY}], tool);
    } else if (tool === 'spray') {
      applySpray(coords.gridX, coords.gridY);
    } else {
      applyTool(coords.gridX, coords.gridY, e.button === 2);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== null && e.pointerId !== activePointerId.current) return;

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
    const tool = getActiveTool();
    if (tool === 'picker' && isGridCoordInBounds(coords.gridX, coords.gridY)) {
      updatePickerHoverColor(pickTopmostVisibleLayerAt(coords.mouseX, coords.mouseY));
    } else {
      updatePickerHoverColor(null);
    }
    updateHover(coords.gridX, coords.gridY, true);

    if (!isDrawing.current) return;

    if (isFrameTransformTool(tool)) {
      const session = transformSessionRef.current;
      if (!session) return;

      const metrics = getTransformMetrics(session, coords.mouseX, coords.mouseY);
      const anchorInitialTransform = session.initialTransforms[session.anchorLayerId];
      if (!anchorInitialTransform) return;

      setAnimState(prev => {
        const frame = { ...prev.frames[prev.activeFrameIndex] };
        const newLayers = [...frame.layers];

        Object.entries(session.initialTransforms).forEach(([id, initialTransform]) => {
          const layerIdx = newLayers.findIndex(l => l.id === id);
          if (layerIdx !== -1) {
            const layer = { ...newLayers[layerIdx] };
            layer.transform = getNextTransform(session.tool, initialTransform, metrics);
            newLayers[layerIdx] = layer;
          }
        });

        frame.layers = newLayers;
        const nextFrames = [...prev.frames];
        nextFrames[prev.activeFrameIndex] = frame;
        return { ...prev, frames: nextFrames };
      });

      const anchorNextTransform = getNextTransform(session.tool, anchorInitialTransform, metrics);
      setTransformHud(buildTransformHud(
        session.tool,
        anchorNextTransform,
        metrics,
        { x: coords.mouseX, y: coords.mouseY },
        session.origin,
        Object.keys(session.initialTransforms).length,
      ));
      return;
    }

    if (strokeStart.current) {
      if (['line', 'rect', 'circle', 'select'].includes(tool)) {
        if (!isGridCoordInBounds(coords.gridX, coords.gridY)) return;
        dragCurrent.current = { x: coords.gridX, y: coords.gridY };
        previewCanvasRef.current?.drawPreview(tool as PreviewTool, strokeStart.current.x, strokeStart.current.y, coords.gridX, coords.gridY, (e.buttons & 2) === 2 ? null : currentColor);
      } else if (tool === 'lighten' || tool === 'darken') {
        if (!isGridCoordInBounds(coords.gridX, coords.gridY)) return;
        if (lastBrushPoint.current) {
          const linePoints = rasterizeLine(lastBrushPoint.current.x, lastBrushPoint.current.y, coords.gridX, coords.gridY);
          applyLightenDarken(linePoints, tool);
        } else {
          applyLightenDarken([{x: coords.gridX, y: coords.gridY}], tool);
        }
        lastBrushPoint.current = { x: coords.gridX, y: coords.gridY };
      } else if (tool === 'spray') {
        if (!isGridCoordInBounds(coords.gridX, coords.gridY)) return;
        applySpray(coords.gridX, coords.gridY);
        lastBrushPoint.current = { x: coords.gridX, y: coords.gridY };
      } else if (tool !== 'fill' && tool !== 'text') {
        if (!isGridCoordInBounds(coords.gridX, coords.gridY)) return;
        if (lastBrushPoint.current?.x === coords.gridX && lastBrushPoint.current?.y === coords.gridY) return;
        if (lastBrushPoint.current) {
          applyStrokeSegment(lastBrushPoint.current, { x: coords.gridX, y: coords.gridY }, (e.buttons & 2) === 2);
        }
        lastBrushPoint.current = { x: coords.gridX, y: coords.gridY };
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== null && e.pointerId !== activePointerId.current) {
      return;
    }
    finishInteraction(e.button);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== null && e.pointerId !== activePointerId.current) {
      return;
    }
    finishInteraction(0);
  };

  const handleLostPointerCapture = () => {
    if (activePointerId.current === null) return;
    finishInteraction(0);
  };

  // --- Layer Management ---
  const addLayer = () => {
    pushUndoSnapshot(animState);
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
      return nextState;
    });
  };

  const deleteLayer = (id: string) => {
    if (layers.length <= 1) return;
    pushUndoSnapshot(animState);
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
      return nextState;
    });
  };

  const toggleLayerVisibility = (id: string) => {
    pushUndoSnapshot(animState);
    setAnimState(prev => {
      const nextLayers = prev.frames[prev.activeFrameIndex].layers.map(l => l.id === id ? { ...l, visible: !l.visible } : l);
      const frame = { ...prev.frames[prev.activeFrameIndex], layers: nextLayers };
      const nextFrames = [...prev.frames];
      nextFrames[prev.activeFrameIndex] = frame;
      return { ...prev, frames: nextFrames };
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
    try {
      const blob = await exportGif(frames, gridSize, 8);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'animation.gif';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to export GIF.';
      window.alert(message);
    }
  };

  const transformGuideLayers = selectedTransformLayers.length > 0
    ? selectedTransformLayers
    : (activeLayer ? [activeLayer] : []);
  const showTransformGuides = Boolean(frameTransformTool && transformGuideLayers.length > 0);
  const visibleTransformHud = frameTransformTool ? transformHud : null;
  const canvasCursor = (() => {
    if (isSpacePressed || currentTool === 'move') return 'grab';
    if (currentTool === 'picker') return 'copy';
    if (frameTransformTool === 'frame-move') return visibleTransformHud ? 'grabbing' : 'grab';
    if (frameTransformTool === 'frame-scale') return 'nwse-resize';
    return 'crosshair';
  })();
  const pickerStatusText = currentTool === 'picker'
    ? (pickerHoverColor ? `Pick: ${pickerHoverColor.toUpperCase()}` : 'Pick: empty pixel')
    : null;

  const menuConfig: MenuConfig = [
    {
      label: 'File',
      items: [
        { label: 'New Project', shortcut: 'Ctrl+N', action: 'newFile' },
        { label: 'Open…', shortcut: 'Ctrl+O', action: 'openFile' },
        { type: 'separator' },
        { label: 'Save', shortcut: 'Ctrl+S', action: 'save' },
        { label: 'Save As…', shortcut: 'Ctrl+Shift+S', action: 'saveAs' },
        { type: 'separator' },
        { label: 'Export GIF', shortcut: 'Ctrl+E', action: 'exportGif' }
      ]
    },
    {
      label: 'Edit',
      items: [
        { label: 'Undo', shortcut: 'Ctrl+Z', action: 'undo', disabled: !canUndo },
        { label: 'Redo', shortcut: 'Ctrl+Y', action: 'redo', disabled: !canRedo },
        { type: 'separator' },
        { label: 'Clear Canvas', action: 'clearCanvas' }
      ]
    },
    {
      label: 'View',
      items: [
        { label: showLeftSidebar ? 'Hide Left Toolbar' : 'Show Left Toolbar', action: 'toggleLeftSidebar' },
        { label: showRightSidebar ? 'Hide Right Toolbar' : 'Show Right Toolbar', action: 'toggleRightSidebar' },
        { type: 'separator' },
        { label: showGrid ? 'Hide Grid' : 'Show Grid', action: 'toggleGrid' },
        { label: onionSkinEnabled ? 'Disable Onion Skin' : 'Enable Onion Skin', action: 'toggleOnionSkin' },
      ]
    },
    {
      label: 'Animation',
      items: [
        { label: animationMode ? 'Disable Animation Mode' : 'Enable Animation Mode', action: 'toggleAnimationMode' },
        { type: 'separator' },
        { label: 'Play/Pause', shortcut: 'Space', action: 'togglePlay' },
        { type: 'separator' },
        { label: 'Add Frame', action: 'addFrame' },
        { label: 'Duplicate Frame', action: 'duplicateFrame' },
        { label: 'Delete Frame', action: 'deleteFrame', disabled: frames.length <= 1 }
      ]
    },
    {
      label: 'Help',
      items: [
        { label: 'About', action: 'about' }
      ]
    }
  ];

  const fileName = currentFilePath
    ? currentFilePath.split(/[/\\]/).pop() || 'Untitled'
    : 'Untitled';
  const titleSuffix = isDirty ? '• ' : '';

  const actions: ActionMap = {
    newFile: () => setShowWelcome(true),
    openFile: () => handleOpenFile(),
    save: () => handleSave(),
    saveAs: () => handleSaveAs(),
    exportGif: handleExportGif,
    undo: handleUndo,
    redo: handleRedo,
    clearCanvas: () => {
      if (window.confirm('Clear the entire canvas? This cannot be undone.')) {
        pushUndoSnapshot(animState);
        const defaultFrame = createDefaultFrame(gridSize);
        setAnimState({
          frames: [defaultFrame],
          activeFrameIndex: 0,
          activeLayerId: defaultFrame.layers[0].id,
          selectedLayerIds: [defaultFrame.layers[0].id]
        });
      }
    },
    toggleGrid: () => setShowGrid(!showGrid),
    toggleOnionSkin: () => setOnionSkinEnabled(!onionSkinEnabled),
    toggleLeftSidebar: () => setShowLeftSidebar(!showLeftSidebar),
    toggleRightSidebar: () => setShowRightSidebar(!showRightSidebar),
    toggleAnimationMode: () => {
      const nextMode = !animationMode;
      setAnimationMode(nextMode);
    },
    // @ts-ignore
    togglePlay: () => togglePlay(activeFrameIndex),
    addFrame: handleAddFrame,
    duplicateFrame: handleDuplicateFrame,
    deleteFrame: handleDeleteFrame,
    about: () => window.alert('Pixly - Professional Pixel Art Editor\nv0.1.0 · Built with React & Tauri')
  };

  // --- Welcome Screen ---
  if (showWelcome) {
    return (
      <WelcomeScreen
        onNewProject={(size) => {
          setGridSize(size);
          const defaultFrame = createDefaultFrame(size);
          setAnimState({
            frames: [defaultFrame],
            activeFrameIndex: 0,
            activeLayerId: defaultFrame.layers[0].id,
            selectedLayerIds: [defaultFrame.layers[0].id]
          });
          setCurrentFilePath(null);
          setIsDirty(false);
          setUndoStack([]);
          setRedoStack([]);
          setShowWelcome(false);
          hasCentered.current = false;
        }}
        onLoadProject={(data, filePath) => loadProjectData(data, filePath)}
        onContinue={(data) => {
          setGridSize(data.canvas.width);
          setAnimState(data.animState);
          setCurrentColor(data.currentColor);
          setCurrentTool(data.currentTool);
          setCurrentFilePath(null);
          setIsDirty(false);
          setUndoStack([]);
          setRedoStack([]);
          setShowWelcome(false);
          hasCentered.current = false;
        }}
      />
    );
  }

  return (
    <div className="layout">
      <MenuBar config={menuConfig} actions={actions} title="Pixly" subtitle={`${titleSuffix}${fileName}`} />
      {isPlaying && <div className="playback-badge">PLAYING</div>}
      <div className="workspace">
        {showLeftSidebar && (
          <div className="sidebar" style={{ width: leftSidebarWidth }}>
            <div
              className="sidebar-resizer"
              onPointerDown={(e) => { e.preventDefault(); isResizingLeft.current = true; document.body.style.cursor = 'col-resize'; }}
            />

            <div className="sidebar-tools">
              <button className={`tool-icon-btn ${currentTool === 'brush' ? 'active' : ''}`} onClick={() => activateTool('brush')} title="Brush (B)"><Brush size={20} /></button>
              <button className={`tool-icon-btn ${currentTool === 'eraser' ? 'active' : ''}`} onClick={() => activateTool('eraser')} title="Eraser (E)"><Eraser size={20} /></button>
              <button className={`tool-icon-btn ${currentTool === 'fill' ? 'active' : ''}`} onClick={() => activateTool('fill')} title="Fill (G)"><PaintBucket size={20} /></button>
              <button className={`tool-icon-btn ${currentTool === 'picker' ? 'active' : ''}`} onClick={() => activateTool('picker')} title="Eyedropper (I)"><Pipette size={20} /></button>
              <button className={`tool-icon-btn ${currentTool === 'line' ? 'active' : ''}`} onClick={() => activateTool('line')} title="Line (L)"><Minus size={20} /></button>
              <button className={`tool-icon-btn ${currentTool === 'rect' ? 'active' : ''}`} onClick={() => activateTool('rect')} title="Rectangle Outline (R)"><Square size={20} /></button>
              <button className={`tool-icon-btn ${currentTool === 'circle' ? 'active' : ''}`} onClick={() => activateTool('circle')} title="Circle Outline (C)"><Circle size={20} /></button>
              <button className={`tool-icon-btn ${currentTool === 'lighten' ? 'active' : ''}`} onClick={() => activateTool('lighten')} title="Lighten (D)"><Sun size={20} /></button>
              <button className={`tool-icon-btn ${currentTool === 'darken' ? 'active' : ''}`} onClick={() => activateTool('darken')} title="Darken (Shift+D)"><CloudRain size={20} /></button>
              <button className={`tool-icon-btn ${currentTool === 'spray' ? 'active' : ''}`} onClick={() => activateTool('spray')} title="Spray Paint (A)"><SprayCan size={20} /></button>
              <button className={`tool-icon-btn ${currentTool === 'text' ? 'active' : ''}`} onClick={() => activateTool('text')} title="Text (T)"><Type size={20} /></button>
            </div>

            <div className="tool-separator" />

            {/* Frame motion tools */}
            <div className="sidebar-tools">
              <button className={`tool-icon-btn frame-tool ${currentTool === 'frame-move' ? 'active' : ''}`} onClick={() => activateTool('frame-move')} title="Move Selection"><Move size={20} /></button>
              <button className={`tool-icon-btn frame-tool ${currentTool === 'frame-rotate' ? 'active' : ''}`} onClick={() => activateTool('frame-rotate')} title="Rotate Selection (drag around center)"><RefreshCwIcon size={20} /></button>
              <button className={`tool-icon-btn frame-tool ${currentTool === 'frame-scale' ? 'active' : ''}`} onClick={() => activateTool('frame-scale')} title="Scale Selection (drag toward or away from center)"><MaximizeIcon size={20} /></button>
            </div>

            <div className="tool-separator" />

            <div className="brush-size-container" style={{ width: '100%', padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '6px', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#aaa', userSelect: 'none' }}>
                <span>Size</span>
                <span>{brushSize}px</span>
              </div>
              <input
                type="range"
                min="1"
                max="24"
                value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
                style={{ width: '100%', cursor: 'pointer', accentColor: '#4f46e5' }}
              />
            </div>

            <div style={{ flex: 1 }} />

            <div className="sidebar-tools bottom">
              <button className="tool-icon-btn" onClick={handleUndo} disabled={!canUndo}><Undo size={20} /></button>
              <button className="tool-icon-btn" onClick={handleRedo} disabled={!canRedo}><Redo size={20} /></button>
            </div>
          </div>
        )}

        <div className="main">
          <div
            ref={containerRef}
            style={{ width: '100%', height: '100%', position: 'relative', cursor: canvasCursor }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onPointerLeave={handlePointerLeave}
            onLostPointerCapture={handleLostPointerCapture}
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
              <Canvas ref={canvasRef} gridSize={gridSize} pixelSize={pixelSize} showGrid={showGrid} />
              <div style={{
                position: 'absolute', top: 0, left: 0,
                width: `${transformGuideSize}px`,
                height: `${transformGuideSize}px`,
                transformOrigin: 'center',
                transform: getForwardCssTransform(),
                pointerEvents: 'none'
              }}>
                <PreviewCanvas ref={previewCanvasRef} gridSize={gridSize} pixelSize={pixelSize} brushSize={brushSize} />
                <div ref={hoverOverlayRef} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', display: 'none', boxSizing: 'border-box' }} />
              </div>
              {showTransformGuides && (
                <div
                  className="transform-guide-overlay"
                  style={{ width: `${transformGuideSize}px`, height: `${transformGuideSize}px` }}
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
                          width: `${transformGuideSize}px`,
                          height: `${transformGuideSize}px`,
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

        {showRightSidebar && (
          <div className="right-sidebar" style={{ width: rightSidebarWidth }}>
            <div
              className="sidebar-resizer right"
              onPointerDown={(e) => { e.preventDefault(); isResizingRight.current = true; document.body.style.cursor = 'col-resize'; }}
            />
            <div className="right-sidebar-header">
              <span>Layers</span>
              <button className="tool-icon-btn" style={{ width: 28, height: 28 }} onClick={addLayer}><Plus size={16} /></button>
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
        )}
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
          onTogglePlay={() => togglePlay(activeFrameIndex)}
          onToggleOnionSkin={() => setOnionSkinEnabled(!onionSkinEnabled)}
          onSetDuration={handleSetDuration}
          onSetDurationAll={handleSetDurationAll}
          onReorderFrame={handleReorderFrame}
        />
      )}

      <div className="bottom-bar">
        <div className="bottom-bar-section">
          <input type="color" value={currentColor} onChange={e => { setCurrentColor(e.target.value); activateTool('brush'); }} className="color-picker-input" />
          <div className="current-color-readout">
            <span className="current-color-chip" style={{ backgroundColor: currentColor }} />
            <span className="current-color-code">{currentColor.toUpperCase()}</span>
            {pickerStatusText && <span className="current-color-status">{pickerStatusText}</span>}
          </div>
          <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
            {DEFAULT_PALETTE.map(color => (
              <div key={color} className="palette-swatch" style={{ backgroundColor: color }} onClick={() => { setCurrentColor(color); activateTool('brush'); }} />
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
          <span style={{ color: '#999', fontSize: '12px' }}>{gridSize}×{gridSize}</span>
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
