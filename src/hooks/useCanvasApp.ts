import { useState, useRef, useEffect, useCallback } from 'react';
import type { CanvasHandle } from '../components/canvas/Canvas';
import type { PreviewTool, PreviewCanvasHandle } from '../components/canvas/PreviewCanvas';
import { usePlayback } from './usePlayback';
import { exportGif } from '../lib/gifExport';
import { exportFrameAsImage, getFormatOption } from '../lib/imageExport';
import { rasterizeGeometry, rasterizeLine, type GeometryTool, type Point } from '../lib/drawing';
import { generateId, createDefaultFrame, createDefaultTransform, bakeLayerTransform, resizePixels } from '../lib/frameHelpers';
import { createNewTab, tabFromProjectData } from '../lib/tabHelpers';
import { saveProjectAs, saveProjectToPath, openProjectFile, deserializeProject } from '../lib/projectFile';
import { openImageFile, imageBlobToGrid } from '../lib/imageImport';
import { autoSaveProject, addRecentFile } from '../lib/autoSave';
import { splitLayer as splitLayerIntoParts, type LayerSplitPayload } from '../lib/layerSplit';
import type { AnimationState, ToolType, CutMode, GridSizeType, Layer, LayerTransform, ProjectData, TabState, Frame } from '../types';
import type { MenuConfig, ActionMap } from '../components/menu/MenuBar/types';
import { useAppUpdater } from './useAppUpdater';
import { useSidebarResize } from './useSidebarResize';
import { APP_DISPLAY_VERSION, APP_NAME } from '../constants/appInfo';
import { useStore } from '../store';
import { cloneAnimationState } from '../store/slices/undoRedoSlice';
import {
  isFrameTransformTool, buildTransformHud, clampScale, snapScale, wrapDegrees,
  type FrameTransformTool, type TransformSession, type TransformMetrics,
} from '../lib/transformHelpers';
import { hexToHsl, hslToHex } from '../lib/colorHelpers';
import { PIXEL_FONT } from '../lib/pixelFont';

export function useCanvasApp() {
  // UI state from Zustand store
  const showWelcome = useStore(s => s.showWelcome);
  const setShowWelcome = useStore(s => s.setShowWelcome);
  const showOnboarding = useStore(s => s.showOnboarding);
  const setShowOnboarding = useStore(s => s.setShowOnboarding);
  const showLoading = useStore(s => s.showLoading);
  const setShowLoading = useStore(s => s.setShowLoading);
  const showGrid = useStore(s => s.showGrid);
  const setShowGrid = useStore(s => s.setShowGrid);
  const brushSize = useStore(s => s.brushSize);
  const setBrushSize = useStore(s => s.setBrushSize);
  const onionSkinEnabled = useStore(s => s.onionSkinEnabled);
  const setOnionSkinEnabled = useStore(s => s.setOnionSkinEnabled);
  const animationMode = useStore(s => s.animationMode);
  const setAnimationMode = useStore(s => s.setAnimationMode);
  const animationTabPinned = useStore(s => s.animationTabPinned);
  const setAnimationTabPinned = useStore(s => s.setAnimationTabPinned);
  const activeView = useStore(s => s.activeView);
  const setActiveView = useStore(s => s.setActiveView);
  const showNewProjectDialog = useStore(s => s.showNewProjectDialog);
  const setShowNewProjectDialog = useStore(s => s.setShowNewProjectDialog);
  const showBrushPopup = useStore(s => s.showBrushPopup);
  const setShowBrushPopup = useStore(s => s.setShowBrushPopup);
  const showCutPopup = useStore(s => s.showCutPopup);
  const setShowCutPopup = useStore(s => s.setShowCutPopup);
  const showLeftSidebar = useStore(s => s.showLeftSidebar);
  const setShowLeftSidebar = useStore(s => s.setShowLeftSidebar);
  const showRightSidebar = useStore(s => s.showRightSidebar);
  const setShowRightSidebar = useStore(s => s.setShowRightSidebar);
  const leftSidebarWidth = useStore(s => s.leftSidebarWidth);
  const rightSidebarWidth = useStore(s => s.rightSidebarWidth);
  const isSpacePressed = useStore(s => s.isSpacePressed);
  const setIsSpacePressed = useStore(s => s.setIsSpacePressed);
  const pickerHoverColor = useStore(s => s.pickerHoverColor);
  const setPickerHoverColor = useStore(s => s.setPickerHoverColor);

  // Motion Assist state
  const showMotionAssistDialog = useStore(s => s.showMotionAssistDialog);
  const setShowMotionAssistDialog = useStore(s => s.setShowMotionAssistDialog);
  const suggestions = useStore(s => s.suggestions);
  const isShowingSuggestions = useStore(s => s.isShowingSuggestions);
  const showMotionSuggestions = useStore(s => s.showMotionSuggestions);
  const acceptSuggestions = useStore(s => s.acceptSuggestions);
  const rejectSuggestions = useStore(s => s.rejectSuggestions);

  const pixelSize = useStore(s => s.pixelSize);
  const setPixelSize = useStore(s => s.setPixelSize);

  const [gridSize, setGridSize] = useState(16);
  const [gridHeight, setGridHeight] = useState(16);
  const [showExportFrameDialog, setShowExportFrameDialog] = useState(false);
  const [isExportingGif, setIsExportingGif] = useState(false);

  const getGifExportScale = (width: number, height: number = width) => Math.max(1, Math.min(8, Math.floor(1200 / Math.max(1, width, height))));

  const saveConfirmTabId = useStore(s => s.saveConfirmTabId);
  const setSaveConfirmTabId = useStore(s => s.setSaveConfirmTabId);
  const undoStack = useStore(s => s.undoStack);
  const redoStack = useStore(s => s.redoStack);
  const setUndoStack = useStore(s => s.setUndoStack);
  const setRedoStack = useStore(s => s.setRedoStack);
  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  const currentFilePath = useStore(s => s.currentFilePath);
  const setCurrentFilePath = useStore(s => s.setCurrentFilePath);
  const isDirty = useStore(s => s.isDirty);
  const setIsDirty = useStore(s => s.setIsDirty);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selection = useStore(s => s.selection);
  const setSelection = useStore(s => s.setSelection);
  const clipboard = useStore(s => s.clipboard);
  const customBrush = useStore(s => s.customBrush);
  const setCustomBrush = useStore(s => s.setCustomBrush);
  const savedBrushes = useStore(s => s.savedBrushes);
  const setSavedBrushes = useStore(s => s.setSavedBrushes);

  const animState = useStore(s => s.animState);
  const setAnimState = useStore(s => s.setAnimState);
  const animStateRef = useRef(animState);
  animStateRef.current = animState;

  const { frames, activeFrameIndex, activeLayerId, selectedLayerIds = [activeLayerId] } = animState;
  const currentTool = useStore(s => s.currentTool);
  const setCurrentTool = useStore(s => s.setCurrentTool);
  const currentColor = useStore(s => s.currentColor);
  const setCurrentColor = useStore(s => s.setCurrentColor);
  const cutMode = useStore(s => s.cutMode);
  const setCutMode = useStore(s => s.setCutMode);
  const transformHud = useStore(s => s.transformHud);
  const setTransformHud = useStore(s => s.setTransformHud);

  const canvasRef = useRef<CanvasHandle>(null);
  const previewCanvasRef = useRef<PreviewCanvasHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const transformContainerRef = useRef<HTMLDivElement>(null);
  const hoverOverlayRef = useRef<HTMLDivElement>(null);
  const hoverCanvasRef = useRef<HTMLCanvasElement>(null);
  const coordsDisplayRef = useRef<HTMLSpanElement>(null);
  const handleImportImageRef = useRef<(() => void) | null>(null);
  const renderRafRef = useRef<number | null>(null);

  const panRef = useRef({ x: 0, y: 0 });
  const pixelSizeRef = useRef(pixelSize);
  pixelSizeRef.current = pixelSize;
  const hasCentered = useRef(false);
  const pendingTransition = useRef<(() => void) | null>(null);
  const isPanning = useRef(false);
  const lastPanPoint = useRef<{ x: number, y: number } | null>(null);
  const isSpaceDown = useRef(false);
  const activePointerId = useRef<number | null>(null);
  const lastNonPickerToolRef = useRef<ToolType>('brush');
  const pickerHoverColorRef = useRef<string | null>(null);

  const isDrawing = useRef(false);
  const strokeStart = useRef<{ x: number, y: number } | null>(null);
  const dragCurrent = useRef<{ x: number, y: number } | null>(null);
  const cutPathRef = useRef<{ x: number; y: number }[]>([]);
  const lassoPanPointRef = useRef<{ x: number; y: number } | null>(null);
  const lastBrushPoint = useRef<{ x: number, y: number } | null>(null);
  const transformSessionRef = useRef<TransformSession | null>(null);
  const ldOriginalGrid = useRef<(string | null)[][] | null>(null);
  const selectionDragRef = useRef<{ startGridX: number; startGridY: number; origOffsetX: number; origOffsetY: number } | null>(null);
  const selectionResizeRef = useRef<{ handle: string; origX: number; origY: number; origW: number; origH: number; origOffX: number; origOffY: number; startGridX: number; startGridY: number; origPixels: (string | null)[][] } | null>(null);

  // Tab management
  const tabs = useStore(s => s.tabs);
  const setTabs = useStore(s => s.setTabs);
  const activeTabId = useStore(s => s.activeTabId);
  const setActiveTabId = useStore(s => s.setActiveTabId);
  const suppressDirtyForAnimStateRef = useRef<AnimationState | null>(null);

  const snapshotWorkspaceTab = useCallback((tab: TabState): TabState => {
    return {
      ...tab,
      gridSize,
      gridHeight,
      animState,
      currentColor,
      currentTool,
      undoStack,
      redoStack,
      filePath: currentFilePath,
      isDirty: isDirty || tab.isDirty || tab.animState !== animState,
      pan: { ...panRef.current },
      pixelSize: pixelSizeRef.current,
    };
  }, [gridSize, gridHeight, animState, currentColor, currentTool, undoStack, redoStack, currentFilePath, isDirty]);

  const restoreWorkspaceFromTab = useCallback((tab: TabState) => {
    suppressDirtyForAnimStateRef.current = tab.animState;
    setGridSize(tab.gridSize);
    setGridHeight(tab.gridHeight ?? tab.gridSize);
    setPixelSize(tab.pixelSize);
    setAnimState(tab.animState);
    setCurrentColor(tab.currentColor);
    setCurrentTool(tab.currentTool);
    setUndoStack(tab.undoStack);
    setRedoStack(tab.redoStack);
    setCurrentFilePath(tab.filePath);
    setIsDirty(tab.isDirty);
    panRef.current = { ...tab.pan };
    hasCentered.current = tab.pan.x !== 0 || tab.pan.y !== 0;
    if (transformContainerRef.current) {
      transformContainerRef.current.style.transform = `translate(${tab.pan.x}px, ${tab.pan.y}px)`;
    }
  }, [setPixelSize, setAnimState, setCurrentColor, setCurrentTool, setUndoStack, setRedoStack, setCurrentFilePath, setIsDirty]);

  const switchToTab = useCallback((tabId: string) => {
    if (tabId === activeTabId) return;
    setTabs(prev => prev.map(t => t.id === activeTabId ? snapshotWorkspaceTab(t) : t));
    setTabs(prev => {
      const target = prev.find(t => t.id === tabId);
      if (!target) return prev;
      restoreWorkspaceFromTab(target);
      return prev;
    });
    setActiveTabId(tabId);
    setSelection(null);
  }, [activeTabId, restoreWorkspaceFromTab, setActiveTabId, setSelection, setTabs, snapshotWorkspaceTab]);

  const openFileAsTab = useCallback(async (filePath?: string) => {
    try {
      let data: ProjectData;
      let resolvedPath: string;
      if (filePath) {
        const { readTextFile } = await import('@tauri-apps/plugin-fs');
        const content = await readTextFile(filePath);
        data = deserializeProject(content);
        resolvedPath = filePath;
      } else {
        const result = await openProjectFile();
        if (!result) return;
        data = result.data;
        resolvedPath = result.filePath;
      }
      setTabs(prev => {
        const existing = prev.find(t => t.filePath === resolvedPath);
        if (existing) {
          const next = prev.map(t => t.id === activeTabId ? snapshotWorkspaceTab(t) : t);
          if (existing.id !== activeTabId) {
            const target = next.find(t => t.id === existing.id) ?? existing;
            restoreWorkspaceFromTab(target);
            setActiveTabId(existing.id);
            setSelection(null);
          }
          return next;
        }
        const newTab = tabFromProjectData(data, resolvedPath);
        addRecentFile(resolvedPath, data.canvas.width, data.canvas.height ?? data.canvas.width);
        restoreWorkspaceFromTab(newTab);
        panRef.current = { x: 0, y: 0 };
        hasCentered.current = false;
        setActiveTabId(newTab.id);
        const flushed = prev.map(t => t.id === activeTabId ? snapshotWorkspaceTab(t) : t);
        return [...flushed, newTab];
      });
    } catch (err) {
      alert(`Open failed: ${(err as Error).message}`);
    }
  }, [activeTabId, restoreWorkspaceFromTab, setActiveTabId, setSelection, setTabs, snapshotWorkspaceTab]);

  const addNewTab = useCallback((size: GridSizeType = 32, name = 'Untitled') => {
    const newTab = createNewTab(size, name);
    setTabs(prev => {
      const flushed = prev.map(t => t.id === activeTabId ? snapshotWorkspaceTab(t) : t);
      return [...flushed, newTab];
    });
    restoreWorkspaceFromTab(newTab);
    panRef.current = { x: 0, y: 0 };
    hasCentered.current = false;
    setActiveTabId(newTab.id);
    setSelection(null);
  }, [activeTabId, restoreWorkspaceFromTab, setActiveTabId, setSelection, setTabs, snapshotWorkspaceTab]);

  const performCloseTab = useCallback((tabId: string) => {
    setTabs(prev => {
      const next = prev.filter(t => t.id !== tabId);
      if (next.length === 0) { setShowWelcome(true); return next; }
      if (tabId === activeTabId) {
        const idx = prev.findIndex(t => t.id === tabId);
        const target = next[Math.min(idx, next.length - 1)];
        restoreWorkspaceFromTab(target);
        setActiveTabId(target.id);
        setSelection(null);
      }
      return next;
    });
  }, [activeTabId, restoreWorkspaceFromTab, setActiveTabId, setSelection, setShowWelcome, setTabs]);

  const closeTab = useCallback((tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab?.isDirty) { setSaveConfirmTabId(tabId); }
    else { performCloseTab(tabId); }
  }, [tabs, performCloseTab, setSaveConfirmTabId]);

  const { updateAvailable, isUpdating, updateError, checkForUpdate, installUpdate } = useAppUpdater();

  const isResizingLeft = useRef(false);
  const isResizingRight = useRef(false);

  const activeFrame = frames[activeFrameIndex];
  const layers = activeFrame.layers;
  const activeLayer = layers.find(layer => layer.id === activeLayerId) ?? layers[0] ?? null;
  const selectedTransformLayers = layers.filter(layer => selectedLayerIds.includes(layer.id));
  const frameTransformTool = isFrameTransformTool(currentTool) ? currentTool : null;
  const transformGuideWidth = gridSize * pixelSize;
  const transformGuideHeight = gridHeight * pixelSize;

  const updatePickerHoverColor = useCallback((nextColor: string | null) => {
    if (pickerHoverColorRef.current === nextColor) return;
    pickerHoverColorRef.current = nextColor;
    setPickerHoverColor(nextColor);
  }, []);

  const activateTool = useCallback((nextTool: ToolType) => {
    setCurrentTool(prevTool => {
      if (nextTool === 'picker') {
        if (prevTool !== 'picker') lastNonPickerToolRef.current = prevTool;
        return nextTool;
      }
      lastNonPickerToolRef.current = nextTool;
      return nextTool;
    });
    if (nextTool !== 'picker') updatePickerHoverColor(null);
    if (nextTool !== 'select') {
      setSelection(prev => {
        if (!prev) return prev;
        setTimeout(() => commitSelection(), 0);
        return prev;
      });
    }
  }, [updatePickerHoverColor]);

  const handleFrameChange = useStore(s => s.handleFrameChange);
  const { isPlaying, toggle: togglePlay } = usePlayback({ frames, onFrameChange: handleFrameChange });

  // Render custom brush to hover canvas
  useEffect(() => {
    if (!hoverCanvasRef.current) return;
    const canvas = hoverCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (customBrush) {
      canvas.width = customBrush.width;
      canvas.height = customBrush.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let y = 0; y < customBrush.height; y++) {
        for (let x = 0; x < customBrush.width; x++) {
          const px = customBrush.pixels[y]?.[x];
          if (px) {
            ctx.fillStyle = px === 'CURRENT' ? currentColor : px;
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [customBrush, currentColor]);

  // Render on state change
  useEffect(() => {
    if (canvasRef.current && frames[activeFrameIndex]) {
      let onionFrames: { frame: Frame; tint: 'prev' | 'next'; opacity: number }[] | null = null;
      if (onionSkinEnabled && !isPlaying && frames.length > 1) {
        onionFrames = [];
        const prevOpacities = [0.40, 0.22, 0.10];
        const nextOpacities = [0.30, 0.16, 0.07];
        for (let d = 3; d >= 1; d--) {
          const idx = activeFrameIndex - d;
          if (idx >= 0) onionFrames.push({ frame: frames[idx], tint: 'prev', opacity: prevOpacities[d - 1] });
        }
        for (let d = 3; d >= 1; d--) {
          const idx = activeFrameIndex + d;
          if (idx < frames.length) onionFrames.push({ frame: frames[idx], tint: 'next', opacity: nextOpacities[d - 1] });
        }
        if (onionFrames.length === 0) onionFrames = null;
      }
      // Build suggestion frames for overlay
      const suggestionFrames = isShowingSuggestions && suggestions.length > 0
        ? suggestions.map(s => ({ grid: s.grid, opacity: s.opacity, tint: s.tint }))
        : null;

      if (renderRafRef.current !== null) cancelAnimationFrame(renderRafRef.current);
      renderRafRef.current = requestAnimationFrame(() => {
        renderRafRef.current = null;
        canvasRef.current?.renderFrame(frames[activeFrameIndex], onionFrames, suggestionFrames);
      });
    }
    return () => {
      if (renderRafRef.current !== null) {
        cancelAnimationFrame(renderRafRef.current);
        renderRafRef.current = null;
      }
    };
  }, [frames, activeFrameIndex, onionSkinEnabled, isPlaying, pixelSize, gridHeight, showGrid, isShowingSuggestions, suggestions]);

  const pushUndoSnapshot = useStore(s => s.pushUndoSnapshot);

  const getTransformAnchorLayer = useCallback(() => {
    if (selectedTransformLayers.length > 0) return selectedTransformLayers.find(layer => layer.id === activeLayerId) ?? selectedTransformLayers[0];
    return activeLayer;
  }, [activeLayer, activeLayerId, selectedTransformLayers]);

  const getLayerCenterInContainer = useCallback((transform: LayerTransform) => ({
    x: panRef.current.x + (gridSize * pixelSize) / 2 + transform.x * pixelSize,
    y: panRef.current.y + (gridHeight * pixelSize) / 2 + transform.y * pixelSize,
  }), [gridSize, gridHeight, pixelSize]);

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
    return { deltaGridX, deltaGridY, deltaAngle, scaleFactor };
  }, [pixelSize]);

  const getNextTransform = useCallback((tool: FrameTransformTool, transform: LayerTransform, metrics: TransformMetrics): LayerTransform => {
    if (tool === 'frame-move') return { ...transform, x: Math.round(transform.x + metrics.deltaGridX), y: Math.round(transform.y + metrics.deltaGridY) };
    if (tool === 'frame-rotate') return { ...transform, rotation: animationMode ? wrapDegrees(transform.rotation + metrics.deltaAngle) : wrapDegrees(Math.round((transform.rotation + metrics.deltaAngle) / 90) * 90) };
    return { ...transform, scale: animationMode ? clampScale(transform.scale * metrics.scaleFactor) : snapScale(transform.scale * metrics.scaleFactor) };
  }, [animationMode]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((prev: AnimationState[]) => [...prev, cloneAnimationState(animState)]);
    setUndoStack((prev: AnimationState[]) => prev.slice(0, -1));
    setAnimState(cloneAnimationState(previous));
  }, [animState, cloneAnimationState, undoStack, setRedoStack, setUndoStack]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((prev: AnimationState[]) => {
      const updated = [...prev, cloneAnimationState(animState)];
      if (updated.length > 50) updated.shift();
      return updated;
    });
    setRedoStack((prev: AnimationState[]) => prev.slice(0, -1));
    setAnimState(cloneAnimationState(next));
  }, [animState, cloneAnimationState, redoStack, setUndoStack, setRedoStack]);

  const handleAddFrame = useStore(s => s.handleAddFrame);
  const handleDuplicateFrame = useStore(s => s.handleDuplicateFrame);
  const handleDeleteFrame = useStore(s => s.handleDeleteFrame);

  const redrawCutPreview = useCallback(() => {
    if (currentTool !== 'cut') return;
    if (cutMode === 'lasso') {
      if (cutPathRef.current.length > 0) previewCanvasRef.current?.drawPath(cutPathRef.current, '#f97316');
      return;
    }
    if (cutMode === 'marquee' && strokeStart.current && dragCurrent.current) {
      previewCanvasRef.current?.drawPreview(
        'select',
        strokeStart.current.x,
        strokeStart.current.y,
        dragCurrent.current.x,
        dragCurrent.current.y,
        '#f97316',
      );
    }
  }, [currentTool, cutMode]);

  useEffect(() => {
    if (currentTool !== 'cut') return;
    if (cutPathRef.current.length === 0 && !strokeStart.current) return;

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(redrawCutPreview);
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [currentTool, cutMode, gridSize, gridHeight, pixelSize, redrawCutPreview]);

  const applyViewportPanDelta = useCallback((dx: number, dy: number) => {
    panRef.current = {
      x: Math.round(panRef.current.x + dx),
      y: Math.round(panRef.current.y + dy),
    };
    if (transformContainerRef.current) {
      transformContainerRef.current.style.transform = `translate(${panRef.current.x}px, ${panRef.current.y}px)`;
    }
  }, []);

  const handleZoom = useCallback((delta: number, mouseX: number, mouseY: number) => {
    const oldPixelSize = pixelSizeRef.current;
    let newPixelSize = oldPixelSize;
    if (delta > 0) { newPixelSize = oldPixelSize < 8 ? oldPixelSize + 1 : oldPixelSize + 4; newPixelSize = Math.min(newPixelSize, 128); }
    else if (delta < 0) { newPixelSize = oldPixelSize <= 8 ? oldPixelSize - 1 : oldPixelSize - 4; newPixelSize = Math.max(newPixelSize, 1); }
    if (newPixelSize === oldPixelSize) return;
    const scale = newPixelSize / oldPixelSize;
    const panX = panRef.current.x;
    const panY = panRef.current.y;
    const logicalW = gridSize * oldPixelSize;
    const logicalH = gridHeight * oldPixelSize;
    const targetX = Math.max(panX, Math.min(mouseX, panX + logicalW));
    const targetY = Math.max(panY, Math.min(mouseY, panY + logicalH));
    panRef.current.x = targetX - (targetX - panX) * scale;
    panRef.current.y = targetY - (targetY - panY) * scale;
    pixelSizeRef.current = newPixelSize;
    if (transformContainerRef.current) transformContainerRef.current.style.transform = `translate(${panRef.current.x}px, ${panRef.current.y}px)`;
    setPixelSize(newPixelSize);
  }, [gridSize, gridHeight, setPixelSize]);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      handleZoom(e.deltaY < 0 ? 1 : -1, e.clientX - rect.left, e.clientY - rect.top);
    };
    const div = containerRef.current;
    div?.addEventListener('wheel', handleWheel, { passive: false });
    return () => div?.removeEventListener('wheel', handleWheel);
  }, [handleZoom, showWelcome]);

  useEffect(() => {
    if (!showWelcome && !hasCentered.current && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const logicalW = gridSize * pixelSize;
      const logicalH = gridHeight * pixelSize;
      panRef.current = { x: Math.round((rect.width - logicalW) / 2), y: Math.round((rect.height - logicalH) / 2) };
      if (transformContainerRef.current) transformContainerRef.current.style.transform = `translate(${panRef.current.x}px, ${panRef.current.y}px)`;
      hasCentered.current = true;
    }
  }, [showWelcome, gridSize, gridHeight, pixelSize]);

  useSidebarResize(isResizingLeft, isResizingRight);

  const handleSaveAs = useCallback(async () => {
    try {
      const path = await saveProjectAs(gridSize, gridHeight, animState, currentColor, currentTool);
      if (path && path !== 'web-download') {
        const name = path.split(/[/\\]/).pop() ?? 'Untitled';
        setCurrentFilePath(path);
        setIsDirty(false);
        addRecentFile(path, gridSize, gridHeight);
        setTabs(prev => prev.map(t => t.id === activeTabId ? { ...snapshotWorkspaceTab(t), filePath: path, name, isDirty: false } : t));
      }
    } catch (err) { alert(`Save failed: ${(err as Error).message}`); }
  }, [gridSize, gridHeight, animState, currentColor, currentTool, activeTabId, setCurrentFilePath, setIsDirty, setTabs, snapshotWorkspaceTab]);

  const handleSave = useCallback(async () => {
    if (currentFilePath) {
      try {
        await saveProjectToPath(currentFilePath, gridSize, gridHeight, animState, currentColor, currentTool);
        setIsDirty(false);
        addRecentFile(currentFilePath, gridSize, gridHeight);
        setTabs(prev => prev.map(t => t.id === activeTabId ? { ...snapshotWorkspaceTab(t), isDirty: false } : t));
      } catch (err) { alert(`Save failed: ${(err as Error).message}`); }
    } else { handleSaveAs(); }
  }, [currentFilePath, gridSize, gridHeight, animState, currentColor, currentTool, activeTabId, handleSaveAs, setIsDirty, setTabs, snapshotWorkspaceTab]);

  const handleOpenFile = useCallback(async () => { openFileAsTab(); }, [openFileAsTab]);

  const loadProjectData = (data: ProjectData, filePath: string) => {
    const newTab = tabFromProjectData(data, filePath);
    setTabs(prev => {
      const existing = prev.find(t => t.filePath === filePath);
      if (existing) {
        const next = prev.map(t => t.id === activeTabId ? snapshotWorkspaceTab(t) : t);
        if (existing.id !== activeTabId) {
          const target = next.find(t => t.id === existing.id) ?? existing;
          setActiveTabId(existing.id);
          restoreWorkspaceFromTab(target);
          setSelection(null);
        }
        return next;
      }
      const flushed = prev.map(t => t.id === activeTabId ? snapshotWorkspaceTab(t) : t);
      restoreWorkspaceFromTab(newTab);
      panRef.current = { x: 0, y: 0 }; hasCentered.current = false;
      setActiveTabId(newTab.id);
      return [...flushed, newTab];
    });
    setShowWelcome(false);
    addRecentFile(filePath, data.canvas.width, data.canvas.height ?? data.canvas.width);
  };

  useEffect(() => {
    if (showWelcome) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => { autoSaveProject(gridSize, gridHeight, animState, currentColor, currentTool).catch(console.error); }, 5000);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [animState, gridSize, gridHeight, currentColor, currentTool, showWelcome]);

  useEffect(() => {
    if (showWelcome || !activeTabId) return;
    setTabs(prev => prev.map(tab => {
      if (tab.id !== activeTabId) return tab;
      const nextDirty = isDirty || tab.isDirty || tab.animState !== animState;
      if (
        tab.gridSize === gridSize &&
        tab.gridHeight === gridHeight &&
        tab.animState === animState &&
        tab.currentColor === currentColor &&
        tab.currentTool === currentTool &&
        tab.undoStack === undoStack &&
        tab.redoStack === redoStack &&
        tab.filePath === currentFilePath &&
        tab.isDirty === nextDirty &&
        tab.pixelSize === pixelSize
      ) {
        return tab;
      }
      return {
        ...tab,
        gridSize,
        gridHeight,
        animState,
        currentColor,
        currentTool,
        undoStack,
        redoStack,
        filePath: currentFilePath,
        isDirty: nextDirty,
        pan: { ...panRef.current },
        pixelSize,
      };
    }));
  }, [showWelcome, activeTabId, gridSize, gridHeight, animState, currentColor, currentTool, undoStack, redoStack, currentFilePath, isDirty, pixelSize, setTabs]);

  useEffect(() => {
    if (!showWelcome) {
      if (suppressDirtyForAnimStateRef.current === animState) {
        suppressDirtyForAnimStateRef.current = null;
        return;
      }
      setIsDirty(true);
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, isDirty: true } : t));
    }
  }, [showWelcome, animState, activeTabId, setIsDirty, setTabs]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (isDirty) e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.code === 'Space' && !e.repeat) { e.preventDefault(); isSpaceDown.current = true; setIsSpacePressed(true); }
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === 's') { e.preventDefault(); if (e.shiftKey) handleSaveAs(); else handleSave(); return; }
      if ((e.ctrlKey || e.metaKey) && key === 'o') { e.preventDefault(); handleOpenFile(); return; }
      if ((e.ctrlKey || e.metaKey) && key === 'i') { e.preventDefault(); handleImportImageRef.current?.(); return; }
      if (!isPlaying) {
        if (key === 'b') activateTool('brush');
        if (key === 'e') activateTool('eraser');
        if (key === 'g') activateTool('fill');
        if (key === 'i') activateTool('picker');
        if (key === 'l') activateTool('line');
        if (key === 'r') activateTool('rect');
        if (key === 'c') activateTool('circle');
        if (key === 's' && !(e.ctrlKey || e.metaKey)) activateTool('select');
        if (key === 'x' && !(e.ctrlKey || e.metaKey)) activateTool('cut');
        if (key === 'm') activateTool('move');
        if (key === 'd' && e.shiftKey) activateTool('darken');
        else if (key === 'd') activateTool('lighten');
        if (key === 'a') activateTool('spray');
        if (key === 't') activateTool('text');
      }
      if ((e.ctrlKey || e.metaKey) && key === 'c' && selection) { e.preventDefault(); selectionCopy(); return; }
      if ((e.ctrlKey || e.metaKey) && key === 'x' && selection) { e.preventDefault(); selectionCut(); return; }
      if ((e.ctrlKey || e.metaKey) && key === 'v' && clipboard) { e.preventDefault(); selectionPaste(); return; }
      if (key === 'delete' && selection) { e.preventDefault(); selectionDelete(); return; }
      if (key === 'escape') { if (selection) { commitSelection(); return; } if (customBrush) { clearCustomBrush(); return; } }
      if ((e.ctrlKey || e.metaKey) && key === 'z') { e.preventDefault(); handleUndo(); }
      if ((e.ctrlKey || e.metaKey) && key === 'y') { e.preventDefault(); handleRedo(); }
      if (key === '+' || key === '=') { const rect = containerRef.current?.getBoundingClientRect(); if (rect) handleZoom(1, rect.width / 2, rect.height / 2); }
      if (key === '-' || key === '_') { const rect = containerRef.current?.getBoundingClientRect(); if (rect) handleZoom(-1, rect.width / 2, rect.height / 2); }
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); isSpaceDown.current = false; lassoPanPointRef.current = null; setIsSpacePressed(false); } };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, [activateTool, handleRedo, handleUndo, handleSave, handleSaveAs, handleOpenFile, handleImportImageRef, isPlaying]);

  // Drawing logic
  const getPointerPosition = (e: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { mouseX: e.clientX - rect.left, mouseY: e.clientY - rect.top };
  };

  const screenToLayerGrid = (layer: Layer, mouseX: number, mouseY: number) => {
    let cx = mouseX - panRef.current.x;
    let cy = mouseY - panRef.current.y;
    const logicalW = gridSize * pixelSize;
    const logicalH = gridHeight * pixelSize;
    const centerX = logicalW / 2;
    const centerY = logicalH / 2;
    const { x: tx, y: ty, rotation, scale } = layer.transform;
    cx -= centerX; cy -= centerY;
    cx -= tx * pixelSize; cy -= ty * pixelSize;
    if (rotation !== 0) {
      const rad = (-rotation * Math.PI) / 180;
      const cos = Math.cos(rad), sin = Math.sin(rad);
      const rx = cx * cos - cy * sin, ry = cx * sin + cy * cos;
      cx = rx; cy = ry;
    }
    if (scale !== 1) { cx /= scale; cy /= scale; }
    cx += centerX; cy += centerY;
    return { gridX: Math.floor(cx / pixelSize), gridY: Math.floor(cy / pixelSize), canvasX: cx, canvasY: cy };
  };

  const screenToActiveLayerGrid = (mouseX: number, mouseY: number) => {
    const frame = frames[activeFrameIndex];
    if (!frame) return null;
    const al = frame.layers.find(layer => layer.id === activeLayerId);
    if (!al) return null;
    return screenToLayerGrid(al, mouseX, mouseY);
  };

  const getPointerCoords = (e: React.PointerEvent) => {
    const pointer = getPointerPosition(e);
    if (!pointer) return null;
    const activeCoords = screenToActiveLayerGrid(pointer.mouseX, pointer.mouseY);
    if (!activeCoords) return null;
    return { ...pointer, ...activeCoords };
  };

  const isGridCoordInBounds = (x: number, y: number) => x >= 0 && x < gridSize && y >= 0 && y < gridHeight;

  const pickTopmostVisibleLayerAt = (mouseX: number, mouseY: number) => {
    const currentLayers = animStateRef.current.frames[animStateRef.current.activeFrameIndex]?.layers ?? layers;
    for (let i = currentLayers.length - 1; i >= 0; i--) {
      const layer = currentLayers[i];
      if (!layer.visible) continue;
      const { gridX, gridY } = screenToLayerGrid(layer, mouseX, mouseY);
      if (!isGridCoordInBounds(gridX, gridY)) continue;
      const color = layer.grid[gridY]?.[gridX];
      if (color) return color;
    }
    return null;
  };

  const stampBrushPoint = (grid: (string | null)[][], x: number, y: number, color: string | null, size: number, clonedRows: Set<number>) => {
    let changed = false;
    const startOffset = -Math.floor(size / 2);
    const endOffset = Math.floor((size - 1) / 2);
    for (let dy = startOffset; dy <= endOffset; dy++) {
      for (let dx = startOffset; dx <= endOffset; dx++) {
        const nx = x + dx, ny = y + dy;
        if (!isGridCoordInBounds(nx, ny)) continue;
        if (grid[ny][nx] === color) continue;
        if (!clonedRows.has(ny)) { grid[ny] = [...grid[ny]]; clonedRows.add(ny); }
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

  const getActiveTool = () => currentTool;

  const hideHoverOverlay = () => { if (hoverOverlayRef.current) hoverOverlayRef.current.style.display = 'none'; };
  const resetCanvasHover = () => { if (coordsDisplayRef.current) coordsDisplayRef.current.innerText = 'X: -, Y: -'; hideHoverOverlay(); };

  const updateHover = (gridX: number, gridY: number, isActive: boolean) => {
    if (coordsDisplayRef.current) coordsDisplayRef.current.innerText = `X: ${gridX}, Y: ${gridY}`;
    if (!hoverOverlayRef.current) return;
    const tool = getActiveTool();
    if (isFrameTransformTool(tool)) { hideHoverOverlay(); return; }
    const isGeometryTool = ['line', 'rect', 'circle', 'select'].includes(tool);
    if (!isActive || !isGridCoordInBounds(gridX, gridY) || (isDrawing.current && isGeometryTool)) { hideHoverOverlay(); return; }
    const isPickerTool = tool === 'picker';
    const isBrushSized = ['brush', 'eraser', 'line', 'lighten', 'darken', 'spray'].includes(tool);
    let w = pixelSize, h = pixelSize, ox = 0, oy = 0;
    if (customBrush && tool === 'brush') {
      w = customBrush.width * pixelSize; h = customBrush.height * pixelSize;
      ox = -Math.floor(customBrush.width / 2); oy = -Math.floor(customBrush.height / 2);
      if (hoverCanvasRef.current) hoverCanvasRef.current.style.display = 'block';
    } else {
      const currentBrushSize = (isBrushSized && !isPickerTool) ? brushSize : 1;
      w = currentBrushSize * pixelSize; h = currentBrushSize * pixelSize;
      ox = -Math.floor(currentBrushSize / 2); oy = -Math.floor(currentBrushSize / 2);
      if (hoverCanvasRef.current) hoverCanvasRef.current.style.display = 'none';
    }
    hoverOverlayRef.current.style.display = 'block';
    hoverOverlayRef.current.style.width = `${w}px`;
    hoverOverlayRef.current.style.height = `${h}px`;
    hoverOverlayRef.current.style.transform = `translate(${(gridX + ox) * pixelSize}px, ${(gridY + oy) * pixelSize}px)`;
    hoverOverlayRef.current.style.borderRadius = isPickerTool ? '4px' : '0';
    hoverOverlayRef.current.style.border = (customBrush && tool === 'brush') ? 'none' : isPickerTool ? `2px solid ${pickerHoverColorRef.current ?? 'rgba(255,255,255,0.65)'}` : tool === 'eraser' ? '1px solid rgba(255, 99, 99, 0.5)' : '1px solid rgba(255,255,255,0.16)';
    hoverOverlayRef.current.style.boxShadow = isPickerTool ? '0 0 0 1px rgba(0,0,0,0.35) inset' : 'none';
    hoverOverlayRef.current.style.background = (customBrush && tool === 'brush') ? 'transparent' : isPickerTool ? (pickerHoverColorRef.current ? `${pickerHoverColorRef.current}33` : 'rgba(255,255,255,0.08)') : tool === 'eraser' ? 'rgba(255,0,0,0.15)' : 'rgba(0,0,0,0.1)';
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
      const al = { ...newLayers[layerIdx] };
      const newGrid = [...al.grid];
      const clonedRows = new Set<number>();
      let changed = false;
      if (customBrush && tool === 'brush' && !isRightClick) {
        const bw = customBrush.width, bh = customBrush.height;
        const bxo = -Math.floor(bw / 2), byo = -Math.floor(bh / 2);
        for (const point of points) {
          for (let by = 0; by < bh; by++) {
            for (let bx = 0; bx < bw; bx++) {
              const px = customBrush.pixels[by]?.[bx];
              const finalColor = px === 'CURRENT' ? targetColor : px;
              if (finalColor === null) continue;
              const gx = point.x + bxo + bx, gy = point.y + byo + by;
              if (!isGridCoordInBounds(gx, gy)) continue;
              if (newGrid[gy][gx] === finalColor) continue;
              if (!clonedRows.has(gy)) { newGrid[gy] = [...newGrid[gy]]; clonedRows.add(gy); }
              newGrid[gy][gx] = finalColor;
              changed = true;
            }
          }
        }
      } else {
        for (const point of points) changed = stampBrushPoint(newGrid, point.x, point.y, targetColor, brushSize, clonedRows) || changed;
      }
      if (!changed) return prev;
      al.grid = newGrid; newLayers[layerIdx] = al; frame.layers = newLayers;
      const nextFrames = [...prev.frames]; nextFrames[activeIdx] = frame;
      return { ...prev, frames: nextFrames };
    });
  };

  const applyTool = (x: number, y: number, isRightClick: boolean) => { applyBrushPoints([{ x, y }], isRightClick); };

  const applyLayerSplit = (action: CutMode, payload: LayerSplitPayload = {}) => {
    const state = animStateRef.current;
    const activeIdx = state.activeFrameIndex;
    const frame = state.frames[activeIdx];
    const layerIdx = frame?.layers.findIndex(l => l.id === state.activeLayerId) ?? -1;
    if (!frame || layerIdx === -1) return false;

    const result = splitLayerIntoParts(frame.layers[layerIdx], gridSize, gridHeight, action, payload);
    if (!result) {
      return false;
    }

    pushUndoSnapshot(state);
    setAnimState(prev => {
      const nextFrames = [...prev.frames];
      const currentFrame = nextFrames[prev.activeFrameIndex];
      const currentLayerIdx = currentFrame.layers.findIndex(l => l.id === prev.activeLayerId);
      if (currentLayerIdx === -1) return prev;

      const nextLayers = [...currentFrame.layers];
      nextLayers.splice(currentLayerIdx, 1, ...result.layers);
      nextFrames[prev.activeFrameIndex] = { ...currentFrame, layers: nextLayers };

      return {
        ...prev,
        frames: nextFrames,
        activeLayerId: result.activeLayerId,
        selectedLayerIds: [result.activeLayerId],
      };
    });
    return true;
  };

  const applyStrokeSegment = (start: { x: number; y: number }, end: { x: number; y: number }, isRightClick: boolean) => {
    if (start.x === end.x && start.y === end.y) return;
    applyBrushPoints(rasterizeLine(start.x, start.y, end.x, end.y), isRightClick);
  };

  const applyLightenDarken = (points: { x: number, y: number }[], mode: 'lighten' | 'darken') => {
    const amount = mode === 'lighten' ? 10 : -10;
    setAnimState(prev => {
      const activeIdx = prev.activeFrameIndex;
      const frame = { ...prev.frames[activeIdx] };
      const newLayers = [...frame.layers];
      const layerIdx = newLayers.findIndex(l => l.id === prev.activeLayerId);
      if (layerIdx === -1 || !newLayers[layerIdx].visible) return prev;
      if (!ldOriginalGrid.current) ldOriginalGrid.current = newLayers[layerIdx].grid.map(row => [...row]);
      const al = { ...newLayers[layerIdx] };
      const newGrid = al.grid.map(row => [...row]);
      let changed = false;
      const startOffset = -Math.floor(brushSize / 2);
      const endOffset = Math.floor((brushSize - 1) / 2);
      for (const { x, y } of points) {
        for (let dy = startOffset; dy <= endOffset; dy++) {
          for (let dx = startOffset; dx <= endOffset; dx++) {
            const nx = x + dx, ny = y + dy;
            if (!isGridCoordInBounds(nx, ny)) continue;
            const originalPixel = ldOriginalGrid.current[ny][nx];
            if (!originalPixel) continue;
            const [h, s, l] = hexToHsl(originalPixel);
            const newL = Math.max(0, Math.min(100, l + amount));
            const newColor = hslToHex(h, s, newL);
            if (newGrid[ny][nx] !== newColor) { newGrid[ny][nx] = newColor; changed = true; }
          }
        }
      }
      if (!changed) return prev;
      al.grid = newGrid; newLayers[layerIdx] = al; frame.layers = newLayers;
      const nextFrames = [...prev.frames]; nextFrames[activeIdx] = frame;
      return { ...prev, frames: nextFrames };
    });
  };

  const applySpray = (x: number, y: number) => {
    setAnimState(prev => {
      const activeIdx = prev.activeFrameIndex;
      const frame = { ...prev.frames[activeIdx] };
      const newLayers = [...frame.layers];
      const layerIdx = newLayers.findIndex(l => l.id === prev.activeLayerId);
      if (layerIdx === -1 || !newLayers[layerIdx].visible) return prev;
      const al = { ...newLayers[layerIdx] };
      const newGrid = al.grid.map(row => [...row]);
      let changed = false;
      const radius = Math.max(brushSize, 3);
      const count = Math.ceil(radius * radius * 0.2);
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * radius;
        const nx = x + Math.round(Math.cos(angle) * dist);
        const ny = y + Math.round(Math.sin(angle) * dist);
        if (!isGridCoordInBounds(nx, ny)) continue;
        if (newGrid[ny][nx] !== currentColor) { newGrid[ny][nx] = currentColor; changed = true; }
      }
      if (!changed) return prev;
      al.grid = newGrid; newLayers[layerIdx] = al; frame.layers = newLayers;
      const nextFrames = [...prev.frames]; nextFrames[activeIdx] = frame;
      return { ...prev, frames: nextFrames };
    });
  };

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
      const al = { ...newLayers[layerIdx] };
      const newGrid = al.grid.map(row => [...row]);
      let cursorX = x;
      for (const char of text.toUpperCase()) {
        const glyph = PIXEL_FONT[char];
        if (!glyph) { cursorX += 4; continue; }
        for (let row = 0; row < 5; row++) {
          for (let col = 0; col < 5; col++) {
            if (glyph[row] & (1 << (4 - col))) {
              const px = cursorX + col, py = y + row;
              if (isGridCoordInBounds(px, py)) newGrid[py][px] = currentColor;
            }
          }
        }
        cursorX += 6;
      }
      al.grid = newGrid; newLayers[layerIdx] = al; frame.layers = newLayers;
      const nextFrames = [...prev.frames]; nextFrames[activeIdx] = frame;
      return { ...prev, frames: nextFrames };
    });
  };

  const storeCommitSelection = useStore(s => s.commitSelection);
  const selectionCopy = useStore(s => s.selectionCopy);
  const selectionDelete = useStore(s => s.selectionDelete);
  const selectionFlipH = useStore(s => s.selectionFlipH);
  const selectionFlipV = useStore(s => s.selectionFlipV);

  const commitSelection = () => { storeCommitSelection(); selectionDragRef.current = null; selectionResizeRef.current = null; };

  const confirmSelection = (x0: number, y0: number, x1: number, y1: number) => {
    const minX = Math.max(0, Math.min(x0, x1));
    const maxX = Math.min(gridSize - 1, Math.max(x0, x1));
    const minY = Math.max(0, Math.min(y0, y1));
    const maxY = Math.min(gridHeight - 1, Math.max(y0, y1));
    const w = maxX - minX + 1, h = maxY - minY + 1;
    if (w <= 0 || h <= 0) return;
    pushUndoSnapshot(animState);
    const layer = activeLayer;
    if (!layer) return;
    const extractedPixels: (string | null)[][] = [];
    for (let y = 0; y < h; y++) {
      const row: (string | null)[] = [];
      for (let x = 0; x < w; x++) row.push(layer.grid[minY + y]?.[minX + x] ?? null);
      extractedPixels.push(row);
    }
    setAnimState(prev => {
      const activeIdx = prev.activeFrameIndex;
      const frame = { ...prev.frames[activeIdx] };
      const newLayers = [...frame.layers];
      const layerIdx = newLayers.findIndex(l => l.id === prev.activeLayerId);
      if (layerIdx === -1) return prev;
      const al = { ...newLayers[layerIdx] };
      const newGrid = al.grid.map(row => [...row]);
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) newGrid[y][x] = null;
      al.grid = newGrid; newLayers[layerIdx] = al; frame.layers = newLayers;
      const nextFrames = [...prev.frames]; nextFrames[activeIdx] = frame;
      return { ...prev, frames: nextFrames };
    });
    setSelection({ x: minX, y: minY, width: w, height: h, pixels: extractedPixels, offsetX: 0, offsetY: 0 });
  };

  const selectionCut = () => { if (!selection) return; selectionCopy(); setSelection(null); selectionDragRef.current = null; selectionResizeRef.current = null; };
  const selectionPaste = () => { if (!clipboard) return; if (selection) commitSelection(); pushUndoSnapshot(animState); setSelection({ x: 0, y: 0, width: clipboard.width, height: clipboard.height, pixels: clipboard.pixels.map(r => [...r]), offsetX: 0, offsetY: 0 }); if (currentTool !== 'select') activateTool('select'); };
  const selectionNewBrush = () => { if (!selection) return; const newBrush = { pixels: selection.pixels.map(r => [...r]), width: selection.width, height: selection.height }; setSavedBrushes(prev => [...prev, newBrush]); setCustomBrush(newBrush); commitSelection(); activateTool('brush'); };
  const clearCustomBrush = () => setCustomBrush(null);

  const handleFill = (startX: number, startY: number, isRightClick: boolean) => {
    setAnimState(prev => {
      const activeIdx = prev.activeFrameIndex;
      const frame = { ...prev.frames[activeIdx] };
      const newLayers = [...frame.layers];
      const layerIdx = newLayers.findIndex(l => l.id === prev.activeLayerId);
      if (layerIdx === -1 || !newLayers[layerIdx].visible) return prev;
      const al = { ...newLayers[layerIdx] };
      const newGrid = al.grid.map(row => [...row]);
      const targetColor = newGrid[startY]?.[startX];
      const newColor = (getActiveTool() === 'eraser' || isRightClick) ? null : currentColor;
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
          stack.push({ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 });
        }
      }
      al.grid = newGrid; newLayers[layerIdx] = al; frame.layers = newLayers;
      const nextFrames = [...prev.frames]; nextFrames[activeIdx] = frame;
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
      const al = { ...newLayers[layerIdx] };
      const newGrid = al.grid.map(row => [...row]);
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
              const nx = point.x + dx, ny = point.y + dy;
              if (isGridCoordInBounds(nx, ny) && newGrid[ny][nx] !== color) { newGrid[ny][nx] = color; changed = true; }
            }
          }
        } else if (isGridCoordInBounds(point.x, point.y) && newGrid[point.y][point.x] !== color) { newGrid[point.y][point.x] = color; changed = true; }
      }
      if (!changed) return prev;
      al.grid = newGrid; newLayers[layerIdx] = al; frame.layers = newLayers;
      const nextFrames = [...prev.frames]; nextFrames[activeIdx] = frame;
      return { ...prev, frames: nextFrames };
    });
  };

  const capturePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointerId.current = e.pointerId;
    try { if (!e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.setPointerCapture(e.pointerId); }
    catch { activePointerId.current = e.pointerId; }
  };

  const resetInteractionState = () => {
    isPanning.current = false; lastPanPoint.current = null;
    isDrawing.current = false; strokeStart.current = null;
    dragCurrent.current = null; cutPathRef.current = []; lassoPanPointRef.current = null; lastBrushPoint.current = null;
    activePointerId.current = null; transformSessionRef.current = null;
    ldOriginalGrid.current = null; setTransformHud(null);
  };

  const finishInteraction = (button: number) => {
    if (isPanning.current) { resetInteractionState(); return; }
    const tool = getActiveTool();
    if (isDrawing.current) {
      if (tool === 'cut' && strokeStart.current && dragCurrent.current) {
        if (cutMode === 'lasso') {
          applyLayerSplit('lasso', { points: cutPathRef.current });
        } else if (cutMode === 'marquee') {
          applyLayerSplit('marquee', {
            x0: strokeStart.current.x,
            y0: strokeStart.current.y,
            x1: dragCurrent.current.x,
            y1: dragCurrent.current.y,
          });
        }
        previewCanvasRef.current?.clear();
        cutPathRef.current = [];
      }
      if (['line', 'rect', 'circle'].includes(tool) && strokeStart.current && dragCurrent.current) commitGeometry(tool, strokeStart.current.x, strokeStart.current.y, dragCurrent.current.x, dragCurrent.current.y, button === 2);
      if (tool === 'select' && strokeStart.current && dragCurrent.current && !selection) confirmSelection(strokeStart.current.x, strokeStart.current.y, dragCurrent.current.x, dragCurrent.current.y);
      if (['line', 'rect', 'circle', 'select'].includes(tool)) previewCanvasRef.current?.clear();
    }
    selectionDragRef.current = null; selectionResizeRef.current = null;
    if (isDrawing.current && isFrameTransformTool(tool)) {
      const shouldBake = tool === 'frame-move' || !animationMode;
      if (shouldBake) {
        setAnimState(prev => {
          const activeIdx = prev.activeFrameIndex;
          const frame = { ...prev.frames[activeIdx] };
          const newLayers = [...frame.layers];
          let changed = false;
          newLayers.forEach((layer, idx) => {
            if (layer.transform.x !== 0 || layer.transform.y !== 0 || layer.transform.rotation !== 0 || layer.transform.scale !== 1) { newLayers[idx] = bakeLayerTransform(layer, gridSize, gridHeight); changed = true; }
          });
          if (!changed) return prev;
          frame.layers = newLayers;
          const nextFrames = [...prev.frames]; nextFrames[activeIdx] = frame;
          return { ...prev, frames: nextFrames };
        });
      }
    }
    resetInteractionState();
  };

  const handlePointerLeave = () => { if (isDrawing.current || isPanning.current) return; resetCanvasHover(); updatePickerHoverColor(null); };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPlaying) return;
    if (activePointerId.current !== null) return;
    const tool = getActiveTool();
    const shouldPan = (isSpaceDown.current && e.button === 0) || e.button === 1 || tool === 'move';
    if (shouldPan) { isPanning.current = true; lastPanPoint.current = { x: e.clientX, y: e.clientY }; capturePointer(e); return; }
    if (isFrameTransformTool(tool)) {
      const pointer = getPointerPosition(e);
      const anchorLayer = getTransformAnchorLayer();
      const layersToTransform = selectedTransformLayers.length > 0 ? selectedTransformLayers : (anchorLayer ? [anchorLayer] : []);
      if (!pointer || !anchorLayer || layersToTransform.length === 0) return;
      const origin = getLayerCenterInContainer(anchorLayer.transform);
      const initialTransforms = Object.fromEntries(layersToTransform.map(layer => [layer.id, { ...layer.transform }]));
      const startAngle = (Math.atan2(pointer.mouseY - origin.y, pointer.mouseX - origin.x) * 180) / Math.PI;
      const startDistance = Math.max(Math.hypot(pointer.mouseX - origin.x, pointer.mouseY - origin.y), 1);
      const session: TransformSession = { tool, anchorLayerId: anchorLayer.id, startPointer: { x: pointer.mouseX, y: pointer.mouseY }, origin, startAngle, startDistance, initialTransforms };
      isDrawing.current = true; transformSessionRef.current = session;
      pushUndoSnapshot(animState);
      setTransformHud(buildTransformHud(tool, anchorLayer.transform, { deltaGridX: 0, deltaGridY: 0, deltaAngle: 0, scaleFactor: 1 }, { x: pointer.mouseX, y: pointer.mouseY }, origin, layersToTransform.length));
      capturePointer(e); return;
    }
    const coords = getPointerCoords(e);
    if (!coords) return;
    if (selection && tool === 'select') {
      const selScreenX = (selection.x + selection.offsetX) * pixelSize;
      const selScreenY = (selection.y + selection.offsetY) * pixelSize;
      const selScreenW = selection.width * pixelSize;
      const selScreenH = selection.height * pixelSize;
      const localX = coords.mouseX - panRef.current.x;
      const localY = coords.mouseY - panRef.current.y;
      const handleSize = 8;
      const handles = [
        { name: 'nw', hx: selScreenX, hy: selScreenY }, { name: 'n', hx: selScreenX + selScreenW / 2, hy: selScreenY },
        { name: 'ne', hx: selScreenX + selScreenW, hy: selScreenY }, { name: 'w', hx: selScreenX, hy: selScreenY + selScreenH / 2 },
        { name: 'e', hx: selScreenX + selScreenW, hy: selScreenY + selScreenH / 2 }, { name: 'sw', hx: selScreenX, hy: selScreenY + selScreenH },
        { name: 's', hx: selScreenX + selScreenW / 2, hy: selScreenY + selScreenH }, { name: 'se', hx: selScreenX + selScreenW, hy: selScreenY + selScreenH },
      ];
      let hitHandle: string | null = null;
      for (const h of handles) { if (Math.abs(localX - h.hx) <= handleSize && Math.abs(localY - h.hy) <= handleSize) { hitHandle = h.name; break; } }
      if (hitHandle) {
        selectionResizeRef.current = { handle: hitHandle, origX: selection.x + selection.offsetX, origY: selection.y + selection.offsetY, origW: selection.width, origH: selection.height, origOffX: selection.offsetX, origOffY: selection.offsetY, startGridX: coords.gridX, startGridY: coords.gridY, origPixels: selection.pixels.map(r => [...r]) };
        isDrawing.current = true; capturePointer(e); return;
      }
      const sx = selection.x + selection.offsetX, sy = selection.y + selection.offsetY;
      if (coords.gridX >= sx && coords.gridX < sx + selection.width && coords.gridY >= sy && coords.gridY < sy + selection.height) {
        selectionDragRef.current = { startGridX: coords.gridX, startGridY: coords.gridY, origOffsetX: selection.offsetX, origOffsetY: selection.offsetY };
        isDrawing.current = true; capturePointer(e); return;
      }
      commitSelection();
    }
    if (!isGridCoordInBounds(coords.gridX, coords.gridY)) return;
    if (tool === 'picker') {
      const picked = pickTopmostVisibleLayerAt(coords.mouseX, coords.mouseY);
      if (picked) { setCurrentColor(picked); activateTool(lastNonPickerToolRef.current !== 'picker' ? lastNonPickerToolRef.current : 'brush'); }
      return;
    }
    if (tool === 'cut') {
      isDrawing.current = true;
      strokeStart.current = { x: coords.gridX, y: coords.gridY };
      dragCurrent.current = { x: coords.gridX, y: coords.gridY };
      cutPathRef.current = [{ x: coords.gridX, y: coords.gridY }];
      capturePointer(e);
      if (cutMode === 'lasso') {
        previewCanvasRef.current?.drawPath(cutPathRef.current, '#f97316');
      } else if (cutMode === 'marquee') {
        previewCanvasRef.current?.drawPreview('select', coords.gridX, coords.gridY, coords.gridX, coords.gridY, '#f97316');
      }
      return;
    }
    isDrawing.current = true; strokeStart.current = { x: coords.gridX, y: coords.gridY };
    dragCurrent.current = { x: coords.gridX, y: coords.gridY }; lastBrushPoint.current = { x: coords.gridX, y: coords.gridY };
    capturePointer(e);
    if (['brush', 'eraser', 'line', 'rect', 'circle', 'fill', 'lighten', 'darken', 'spray'].includes(tool)) pushUndoSnapshot(animState);
    if (['line', 'rect', 'circle', 'select'].includes(tool)) previewCanvasRef.current?.drawPreview(tool as PreviewTool, coords.gridX, coords.gridY, coords.gridX, coords.gridY, e.button === 2 ? null : currentColor);
    else if (tool === 'fill') { isDrawing.current = false; handleFill(coords.gridX, coords.gridY, e.button === 2); }
    else if (tool === 'text') { isDrawing.current = false; applyText(coords.gridX, coords.gridY); }
    else if (tool === 'lighten' || tool === 'darken') applyLightenDarken([{ x: coords.gridX, y: coords.gridY }], tool);
    else if (tool === 'spray') applySpray(coords.gridX, coords.gridY);
    else applyTool(coords.gridX, coords.gridY, e.button === 2);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== null && e.pointerId !== activePointerId.current) return;
    if (isPanning.current && lastPanPoint.current) {
      const dx = e.clientX - lastPanPoint.current.x, dy = e.clientY - lastPanPoint.current.y;
      applyViewportPanDelta(dx, dy);
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
      return;
    }
    const tool = getActiveTool();
    if (isDrawing.current && tool === 'cut' && cutMode === 'lasso') {
      if (isSpaceDown.current) {
        const last = lassoPanPointRef.current;
        if (last) applyViewportPanDelta(e.clientX - last.x, e.clientY - last.y);
        lassoPanPointRef.current = { x: e.clientX, y: e.clientY };
        return;
      }
      lassoPanPointRef.current = null;
    }
    const coords = getPointerCoords(e);
    if (!coords) return;
    if (tool === 'picker' && isGridCoordInBounds(coords.gridX, coords.gridY)) updatePickerHoverColor(pickTopmostVisibleLayerAt(coords.mouseX, coords.mouseY));
    else updatePickerHoverColor(null);
    updateHover(coords.gridX, coords.gridY, true);
    if (!isDrawing.current) return;
    if (selectionDragRef.current && selection) {
      const dx = coords.gridX - selectionDragRef.current.startGridX, dy = coords.gridY - selectionDragRef.current.startGridY;
      setSelection(prev => prev ? { ...prev, offsetX: selectionDragRef.current!.origOffsetX + dx, offsetY: selectionDragRef.current!.origOffsetY + dy } : prev);
      return;
    }
    if (selectionResizeRef.current && selection) {
      const r = selectionResizeRef.current;
      const dx = coords.gridX - r.startGridX, dy = coords.gridY - r.startGridY;
      let newX = r.origX, newY = r.origY, newW = r.origW, newH = r.origH;
      if (r.handle.includes('e')) newW = Math.max(1, r.origW + dx);
      if (r.handle.includes('s')) newH = Math.max(1, r.origH + dy);
      if (r.handle.includes('w')) { newW = Math.max(1, r.origW - dx); newX = r.origX + (r.origW - newW); }
      if (r.handle.includes('n')) { newH = Math.max(1, r.origH - dy); newY = r.origY + (r.origH - newH); }
      const resized = resizePixels(r.origPixels, r.origW, r.origH, newW, newH);
      setSelection({ x: newX, y: newY, width: newW, height: newH, pixels: resized, offsetX: newX - selection.x, offsetY: newY - selection.y });
      return;
    }
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
          if (layerIdx !== -1) { const layer = { ...newLayers[layerIdx] }; layer.transform = getNextTransform(session.tool, initialTransform, metrics); newLayers[layerIdx] = layer; }
        });
        frame.layers = newLayers;
        const nextFrames = [...prev.frames]; nextFrames[prev.activeFrameIndex] = frame;
        return { ...prev, frames: nextFrames };
      });
      const anchorNextTransform = getNextTransform(session.tool, anchorInitialTransform, metrics);
      setTransformHud(buildTransformHud(session.tool, anchorNextTransform, metrics, { x: coords.mouseX, y: coords.mouseY }, session.origin, Object.keys(session.initialTransforms).length));
      return;
    }
    if (strokeStart.current) {
      if (tool === 'cut') {
        if (!isGridCoordInBounds(coords.gridX, coords.gridY)) return;
        dragCurrent.current = { x: coords.gridX, y: coords.gridY };
        if (cutMode === 'lasso') {
          const last = cutPathRef.current[cutPathRef.current.length - 1];
          if (!last || last.x !== coords.gridX || last.y !== coords.gridY) {
            cutPathRef.current = [...cutPathRef.current, { x: coords.gridX, y: coords.gridY }];
          }
          previewCanvasRef.current?.drawPath(cutPathRef.current, '#f97316');
        } else if (cutMode === 'marquee') {
          previewCanvasRef.current?.drawPreview('select', strokeStart.current.x, strokeStart.current.y, coords.gridX, coords.gridY, '#f97316');
        }
        return;
      }
      if (['line', 'rect', 'circle', 'select'].includes(tool)) {
        if (!isGridCoordInBounds(coords.gridX, coords.gridY)) return;
        dragCurrent.current = { x: coords.gridX, y: coords.gridY };
        previewCanvasRef.current?.drawPreview(tool as PreviewTool, strokeStart.current.x, strokeStart.current.y, coords.gridX, coords.gridY, (e.buttons & 2) === 2 ? null : currentColor);
      } else if (tool === 'lighten' || tool === 'darken') {
        if (!isGridCoordInBounds(coords.gridX, coords.gridY)) return;
        if (lastBrushPoint.current) applyLightenDarken(rasterizeLine(lastBrushPoint.current.x, lastBrushPoint.current.y, coords.gridX, coords.gridY), tool);
        else applyLightenDarken([{ x: coords.gridX, y: coords.gridY }], tool);
        lastBrushPoint.current = { x: coords.gridX, y: coords.gridY };
      } else if (tool === 'spray') {
        if (!isGridCoordInBounds(coords.gridX, coords.gridY)) return;
        applySpray(coords.gridX, coords.gridY);
        lastBrushPoint.current = { x: coords.gridX, y: coords.gridY };
      } else if (tool !== 'fill' && tool !== 'text') {
        if (!isGridCoordInBounds(coords.gridX, coords.gridY)) return;
        if (lastBrushPoint.current?.x === coords.gridX && lastBrushPoint.current?.y === coords.gridY) return;
        if (lastBrushPoint.current) applyStrokeSegment(lastBrushPoint.current, { x: coords.gridX, y: coords.gridY }, (e.buttons & 2) === 2);
        lastBrushPoint.current = { x: coords.gridX, y: coords.gridY };
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => { if (activePointerId.current !== null && e.pointerId !== activePointerId.current) return; finishInteraction(e.button); };
  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => { if (activePointerId.current !== null && e.pointerId !== activePointerId.current) return; finishInteraction(0); };
  const handleLostPointerCapture = () => { if (activePointerId.current === null) return; finishInteraction(0); };

  const addLayer = useStore(s => s.addLayer);
  const deleteLayer = useStore(s => s.deleteLayer);
  const renameLayer = useStore(s => s.renameLayer);
  const toggleLayerSelection = useStore(s => s.toggleLayerSelection);
  const handleLayerClick = useStore(s => s.handleLayerClick);
  const handleReorderLayer = useStore(s => s.handleReorderLayer);

  const handleImportImage = async () => {
    const result = await openImageFile();
    if (!result) return;
    try {
      const grid = await imageBlobToGrid(result.blob, gridSize, gridHeight);
      const layerName = result.name.replace(/\.[^.]+$/, '') || 'Imported';
      pushUndoSnapshot(animState);
      setAnimState(prev => {
        const nextLayers = [...prev.frames[prev.activeFrameIndex].layers, { id: generateId(), name: layerName, visible: true, opacity: 1, grid, transform: createDefaultTransform() }];
        const frame = { ...prev.frames[prev.activeFrameIndex], layers: nextLayers };
        const nextFrames = [...prev.frames]; nextFrames[prev.activeFrameIndex] = frame;
        return { ...prev, frames: nextFrames, activeLayerId: nextLayers[nextLayers.length - 1].id, selectedLayerIds: [nextLayers[nextLayers.length - 1].id] };
      });
    } catch (err) { alert(`Failed to import image: ${(err as Error).message}`); }
  };
  handleImportImageRef.current = handleImportImage;

  const handleExportGif = async () => {
    setIsExportingGif(true);
    await new Promise(r => setTimeout(r, 0)); // yield to let loading overlay render
    try {
      const blob = await exportGif(frames, gridSize, getGifExportScale(gridSize, gridHeight), gridHeight);
      if ('__TAURI_INTERNALS__' in window) {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const { writeFile } = await import('@tauri-apps/plugin-fs');
        const filePath = await save({
          title: 'Export GIF',
          filters: [{ name: 'GIF Image', extensions: ['gif'] }],
          defaultPath: 'animation.gif',
        });
        if (!filePath) { setIsExportingGif(false); return; }
        const bytes = new Uint8Array(await blob.arrayBuffer());
        await writeFile(filePath, bytes);
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'animation.gif'; a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) { window.alert(error instanceof Error ? error.message : 'Failed to export GIF.'); }
    setIsExportingGif(false);
  };

  const handleExportFrameConfirm = async (frameIndices: number[], format: string) => {
    setShowExportFrameDialog(false);
    await new Promise(r => setTimeout(r, 0)); // yield before heavy work
    const fmt = getFormatOption(format);
    const isTauri = '__TAURI_INTERNALS__' in window;

    try {
      if (frameIndices.length === 1) {
        const frame = frames[frameIndices[0]];
        if (!frame) return;
        const blob = await exportFrameAsImage(frame, gridSize, gridHeight, 8, format);
        if (isTauri) {
          const { save } = await import('@tauri-apps/plugin-dialog');
          const { writeFile } = await import('@tauri-apps/plugin-fs');
          const filePath = await save({
            title: 'Export Frame as Image',
            filters: [{ name: fmt.label, extensions: [fmt.ext] }],
            defaultPath: `frame-${frameIndices[0] + 1}.${fmt.ext}`,
          });
          if (!filePath) return;
          const bytes = new Uint8Array(await blob.arrayBuffer());
          await writeFile(filePath, bytes);
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = `frame-${frameIndices[0] + 1}.${fmt.ext}`; a.click();
          URL.revokeObjectURL(url);
        }
      } else {
        if (isTauri) {
          const { open: openDir } = await import('@tauri-apps/plugin-dialog');
          const { writeFile } = await import('@tauri-apps/plugin-fs');
          const dirPath = await openDir({ directory: true, title: 'Select Folder to Export Frames' });
          if (!dirPath) return;
          for (const i of frameIndices) {
            const blob = await exportFrameAsImage(frames[i], gridSize, gridHeight, 8, format);
            const bytes = new Uint8Array(await blob.arrayBuffer());
            await writeFile(`${dirPath}/frame-${i + 1}.${fmt.ext}`, bytes);
          }
          window.alert(`Exported ${frameIndices.length} frames successfully.`);
        } else {
          for (const i of frameIndices) {
            const blob = await exportFrameAsImage(frames[i], gridSize, gridHeight, 8, format);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `frame-${i + 1}.${fmt.ext}`; a.click();
            URL.revokeObjectURL(url);
          }
        }
      }
    } catch (error) { window.alert(error instanceof Error ? error.message : 'Failed to export frame.'); }
  };

  const transformGuideLayers = selectedTransformLayers.length > 0 ? selectedTransformLayers : (activeLayer ? [activeLayer] : []);
  const showTransformGuides = Boolean(frameTransformTool && transformGuideLayers.length > 0);
  const visibleTransformHud = frameTransformTool ? transformHud : null;
  const canvasCursor = (() => {
    if (isSpacePressed || currentTool === 'move') return 'grab';
    if (currentTool === 'picker') return 'copy';
    if (frameTransformTool === 'frame-move') return visibleTransformHud ? 'grabbing' : 'grab';
    if (frameTransformTool === 'frame-scale') return 'nwse-resize';
    return 'crosshair';
  })();
  const pickerStatusText = currentTool === 'picker' ? (pickerHoverColor ? `Pick: ${pickerHoverColor.toUpperCase()}` : 'Pick: empty pixel') : null;

  const menuConfig: MenuConfig = [
    { label: 'File', items: [
      { label: 'New Project', shortcut: 'Ctrl+N', action: 'newFile' },
      { label: 'Open…', shortcut: 'Ctrl+O', action: 'openFile' },
      { label: 'Import Image…', shortcut: 'Ctrl+I', action: 'importImage' },
      { type: 'separator' },
      { label: 'Save', shortcut: 'Ctrl+S', action: 'save' },
      { label: 'Save As…', shortcut: 'Ctrl+Shift+S', action: 'saveAs' },
      { type: 'separator' },
      { label: 'Export GIF', shortcut: 'Ctrl+E', action: 'exportGif' },
      { label: 'Export Frame as Image...', shortcut: 'Ctrl+Shift+E', action: 'exportFrame' }
    ]},
    { label: 'Edit', items: [
      { label: 'Undo', shortcut: 'Ctrl+Z', action: 'undo', disabled: !canUndo },
      { label: 'Redo', shortcut: 'Ctrl+Y', action: 'redo', disabled: !canRedo },
      { type: 'separator' },
      { label: 'Clear Canvas', action: 'clearCanvas' }
    ]},
    { label: 'View', items: [
      { label: showLeftSidebar ? 'Hide Left Toolbar' : 'Show Left Toolbar', action: 'toggleLeftSidebar' },
      { label: showRightSidebar ? 'Hide Right Toolbar' : 'Show Right Toolbar', action: 'toggleRightSidebar' },
      { type: 'separator' },
      { label: showGrid ? 'Hide Grid' : 'Show Grid', action: 'toggleGrid' },
      { label: onionSkinEnabled ? 'Disable Onion Skin' : 'Enable Onion Skin', action: 'toggleOnionSkin' },
    ]},
    { label: 'Animation', items: [
      { label: animationMode ? 'Disable Animation Mode' : 'Enable Animation Mode', action: 'toggleAnimationMode' },
      { type: 'separator' },
      { label: 'Play/Pause', shortcut: 'Space', action: 'togglePlay' },
      { type: 'separator' },
      { label: 'Add Frame', action: 'addFrame' },
      { label: 'Duplicate Frame', action: 'duplicateFrame' },
      { label: 'Delete Frame', action: 'deleteFrame', disabled: frames.length <= 1 },
      { type: 'separator' },
      { label: 'Motion Assist...', action: 'motionAssist' },
      ...(isShowingSuggestions ? [
        { label: 'Accept Suggestions', action: 'acceptMotionSuggestions' },
        { label: 'Reject Suggestions', action: 'rejectMotionSuggestions' },
      ] : []),
    ]},
    { label: 'Help', items: [
      { label: 'Check for Updates...', action: 'checkUpdates' },
      { type: 'separator' },
      { label: 'About', action: 'about' }
    ]}
  ];

  const fileName = currentFilePath ? currentFilePath.split(/[/\\]/).pop() || 'Untitled' : 'Untitled';
  const titleSuffix = isDirty ? '• ' : '';

  const actions: ActionMap = {
    newFile: () => setShowNewProjectDialog(true),
    openFile: () => handleOpenFile(),
    importImage: () => handleImportImage(),
    save: () => handleSave(),
    saveAs: () => handleSaveAs(),
    exportGif: handleExportGif,
    exportFrame: () => setShowExportFrameDialog(true),
    undo: handleUndo,
    redo: handleRedo,
    clearCanvas: () => {
      if (window.confirm('Clear the entire canvas? This cannot be undone.')) {
        pushUndoSnapshot(animState);
        const defaultFrame = createDefaultFrame({ width: gridSize, height: gridHeight });
        setAnimState({ frames: [defaultFrame], activeFrameIndex: 0, activeLayerId: defaultFrame.layers[0].id, selectedLayerIds: [defaultFrame.layers[0].id] });
      }
    },
    toggleGrid: () => setShowGrid(!showGrid),
    toggleOnionSkin: () => setOnionSkinEnabled(!onionSkinEnabled),
    toggleLeftSidebar: () => setShowLeftSidebar(!showLeftSidebar),
    toggleRightSidebar: () => setShowRightSidebar(!showRightSidebar),
    toggleAnimationMode: () => { setAnimationMode(!animationMode); },
    // @ts-ignore
    togglePlay: () => togglePlay(activeFrameIndex),
    addFrame: handleAddFrame,
    duplicateFrame: handleDuplicateFrame,
    deleteFrame: handleDeleteFrame,
    motionAssist: () => {
      if (gridSize !== gridHeight) {
        window.alert('Motion Assist currently supports square canvases only.');
        return;
      }
      setShowMotionAssistDialog(true);
    },
    acceptMotionSuggestions: () => acceptSuggestions('Motion', animState.frames[animState.activeFrameIndex]?.duration ?? 100),
    rejectMotionSuggestions: () => rejectSuggestions(),
    checkUpdates: async () => {
      if (!('__TAURI_INTERNALS__' in window)) { window.alert('Updates are only supported in the desktop app.'); return; }
      try {
        const update = updateAvailable ?? await checkForUpdate();
        if (update) { await update.downloadAndInstall(); const { relaunch } = await import('@tauri-apps/plugin-process'); await relaunch(); }
        else window.alert('You are on the latest version!');
      } catch (error) { window.alert(error instanceof Error ? error.message : String(error)); }
    },
    about: () => window.alert(`${APP_NAME} - Professional Pixel Art Editor\n${APP_DISPLAY_VERSION} · Built with React & Tauri`)
  };

  // Welcome screen handlers
  const handleTransition = (action: () => void) => {
    pendingTransition.current = action;
    setShowWelcome(false);
    setShowLoading(true);
  };

  const welcomeHandlers = {
    onNewProject: (size: GridSizeType) => handleTransition(() => addNewTab(size)),
    onNewAnimation: (size: GridSizeType) => handleTransition(() => { addNewTab(size); setAnimationTabPinned(true); setActiveView('animation'); setAnimationMode(true); }),
    onLoadProject: (data: ProjectData, filePath: string) => handleTransition(() => loadProjectData(data, filePath)),
    onContinue: (data: any) => handleTransition(() => {
      const newTab = createNewTab({ width: data.canvas.width, height: data.canvas.height ?? data.canvas.width }, 'Autosave');
      const loaded: TabState = { ...newTab, animState: data.animState, currentColor: data.currentColor, currentTool: data.currentTool };
      setTabs([loaded]); setActiveTabId(loaded.id);
      restoreWorkspaceFromTab(loaded);
      panRef.current = { x: 0, y: 0 };
      hasCentered.current = false;
    }),
  };

  // Sidebar resizer handlers
  const onLeftResizerPointerDown = useCallback((e: React.PointerEvent) => { e.preventDefault(); isResizingLeft.current = true; document.body.style.cursor = 'col-resize'; }, []);
  const onRightResizerPointerDown = useCallback((e: React.PointerEvent) => { e.preventDefault(); isResizingRight.current = true; document.body.style.cursor = 'col-resize'; }, []);

  return {
    showWelcome,
    welcomeHandlers,
    layout: { menuConfig, actions, titleSuffix, fileName, isPlaying, showLeftSidebar, showRightSidebar, animationTabPinned, activeView, leftSidebarWidth, rightSidebarWidth },
    tabBar: { tabs, activeTabId, onSelectTab: switchToTab, onCloseTab: closeTab, onNewTab: () => setShowNewProjectDialog(true), animationTabPinned, activeView, onSelectView: setActiveView, onUnpinAnimationTab: () => { setAnimationTabPinned(false); setActiveView('canvas'); }, onDropFile: async (file: File) => { try { const text = await file.text(); const data = deserializeProject(text); loadProjectData(data, file.name); } catch { alert(`Could not open: ${file.name}`); } } },
    canvas: {
      containerRef, canvasRef, previewCanvasRef, transformContainerRef, hoverOverlayRef, hoverCanvasRef,
      gridSize, gridHeight, pixelSize, showGrid, brushSize, canvasCursor,
      frameTransformTool, visibleTransformHud, selection, currentTool,
      transformGuideWidth, transformGuideHeight, getForwardCssTransform, showTransformGuides, transformGuideLayers, activeLayerId,
      selectionCopy, selectionPaste: () => selectionPaste(), selectionCut: () => selectionCut(), selectionNewBrush: () => selectionNewBrush(), selectionFlipH, selectionFlipV, selectionDelete,
      onPointerDown: handlePointerDown, onPointerMove: handlePointerMove, onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel, onPointerLeave: handlePointerLeave, onLostPointerCapture: handleLostPointerCapture,
    },
    leftSidebar: {
      width: leftSidebarWidth, currentTool, cutMode, customBrush, brushSize, canUndo, canRedo,
      onActivateTool: activateTool, onBrushSizeChange: setBrushSize, onUndo: handleUndo, onRedo: handleRedo,
      onOpenBrushPopup: () => setShowBrushPopup(true), onOpenCutPopup: () => setShowCutPopup(true), onResizerPointerDown: onLeftResizerPointerDown,
    },
    rightSidebar: {
      width: rightSidebarWidth, layers, activeLayerId, selectedLayerIds,
      onAddLayer: () => addLayer(layers.length, gridSize, gridHeight), onDeleteLayer: deleteLayer, onRenameLayer: renameLayer,
      onLayerClick: handleLayerClick, onToggleLayerSelection: toggleLayerSelection,
      onReorderLayer: handleReorderLayer,
      onResizerPointerDown: onRightResizerPointerDown,
    },
    bottomBar: {
      currentColor, gridSize, gridHeight, pixelSize, showGrid, pickerStatusText,
      onColorChange: setCurrentColor, onActivateBrush: () => activateTool('brush'),
      onToggleGrid: () => setShowGrid(!showGrid), coordsRef: coordsDisplayRef,
    },
    brushPopup: {
      customBrush, savedBrushes, currentColor,
      onSelectDefault: () => { setCustomBrush(null); setShowBrushPopup(false); activateTool('brush'); },
      onSelectBrush: (brush: any) => { setCustomBrush(brush); setShowBrushPopup(false); activateTool('brush'); },
      onDeleteBrush: (idx: number) => { setSavedBrushes(prev => prev.filter((_, i) => i !== idx)); if (customBrush === savedBrushes[idx]) setCustomBrush(null); },
      onClose: () => setShowBrushPopup(false),
    },
    cutPopup: {
      cutMode,
      onSelectMode: (mode: typeof cutMode) => { setCutMode(mode); activateTool('cut'); },
      onClose: () => setShowCutPopup(false),
    },
    dialogs: {
      showNewProjectDialog, setShowNewProjectDialog,
      saveConfirmTabId, setSaveConfirmTabId,
      addNewTab, performCloseTab, handleSave,
      showExportFrameDialog, setShowExportFrameDialog,
      onExportFrameConfirm: handleExportFrameConfirm,
      exportFrameFrames: frames, exportFrameActiveIndex: activeFrameIndex,
      showMotionAssistDialog, setShowMotionAssistDialog,
      currentFrame: frames[activeFrameIndex],
      allFrames: frames,
      activeFrameIndex,
      gridSize,
      gridHeight,
      onMotionSuggestionsApply: (motionSuggestions: import('../lib/motion/types').SuggestionFrame[], useKeyframeInterpolation: boolean) => {
        showMotionSuggestions(motionSuggestions, animState.activeFrameIndex, useKeyframeInterpolation);
      },
    },
    overlays: {
      updateAvailable, isUpdating, updateError, installUpdate,
      showOnboarding, setShowOnboarding,
      showLoading, setShowLoading,
      onLoadingComplete: () => { setShowLoading(false); pendingTransition.current?.(); pendingTransition.current = null; },
      isExportingGif,
    },
    animation: {
      animationMode, gridSize, gridHeight, isPlaying, activeFrameIndex,
      onTogglePlay: () => togglePlay(activeFrameIndex),
      onPinToTab: () => { setAnimationTabPinned(true); setActiveView('animation'); },
    },
    timeline: {
      gridSize, gridHeight, isPlaying,
      onTogglePlay: () => togglePlay(activeFrameIndex),
      onPinToTab: () => { setAnimationTabPinned(true); setActiveView('animation'); },
    },
    tabs: { showBrushPopup, showCutPopup },
  };
}
