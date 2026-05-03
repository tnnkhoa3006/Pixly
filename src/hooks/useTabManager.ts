/**
 * Manages the tab lifecycle: create, open, switch, close.
 * Extracted from App.tsx with zero behavior change.
 */
import { useState, useCallback, useRef } from 'react';
import type { TabState, GridSizeType, ProjectData } from '../types';
import { createDefaultFrame } from '../lib/frameHelpers';
import { openProjectFile, deserializeProject } from '../lib/projectFile';
import { addRecentFile } from '../lib/autoSave';

function makeTabId() {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function createNewTab(size: GridSizeType = 32, name = 'Untitled'): TabState {
  const defaultFrame = createDefaultFrame(size);
  return {
    id: makeTabId(),
    name,
    filePath: null,
    isDirty: false,
    gridSize: size,
    animState: {
      frames: [defaultFrame],
      activeFrameIndex: 0,
      activeLayerId: defaultFrame.layers[0].id,
      selectedLayerIds: [defaultFrame.layers[0].id],
    },
    currentColor: '#000000',
    currentTool: 'brush',
    undoStack: [],
    redoStack: [],
    pan: { x: 0, y: 0 },
    pixelSize: 32,
  };
}

function tabFromProjectData(data: ProjectData, filePath: string): TabState {
  const name = filePath.split(/[/\\]/).pop() ?? 'Untitled';
  return {
    id: makeTabId(),
    name,
    filePath,
    isDirty: false,
    gridSize: data.canvas.width,
    animState: data.animState,
    currentColor: data.currentColor,
    currentTool: data.currentTool,
    undoStack: [],
    redoStack: [],
    pan: { x: 0, y: 0 },
    pixelSize: 32,
  };
}

interface TabManagerCallbacks {
  /** Called when the active tab's live state needs to be loaded */
  onLoadTabState: (tab: TabState) => void;
  /** Called when all tabs are closed */
  onAllTabsClosed: () => void;
  /** Ref to current pan position (for flushing before switch) */
  panRef: React.MutableRefObject<{ x: number; y: number }>;
  /** Ref to current pixelSize (for flushing before switch) */
  pixelSizeRef: React.MutableRefObject<number>;
  /** Ref to the transform container DOM element */
  transformContainerRef: React.MutableRefObject<HTMLDivElement | null>;
  /** Ref to hasCentered flag */
  hasCenteredRef: React.MutableRefObject<boolean>;
}

export function useTabManager(callbacks: TabManagerCallbacks) {
  const [tabs, setTabs] = useState<TabState[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;

  const {
    onLoadTabState,
    onAllTabsClosed,
    panRef,
    pixelSizeRef,
    transformContainerRef,
    hasCenteredRef,
  } = callbacks;

  const flushCurrentTab = useCallback((prevTabs: TabState[]) => {
    return prevTabs.map(t => {
      if (t.id !== activeTabIdRef.current) return t;
      return {
        ...t,
        pan: { ...panRef.current },
        pixelSize: pixelSizeRef.current,
      };
    });
  }, [panRef, pixelSizeRef]);

  const loadTab = useCallback((target: TabState) => {
    panRef.current = { ...target.pan };
    hasCenteredRef.current = target.pan.x !== 0 || target.pan.y !== 0;
    if (transformContainerRef.current) {
      transformContainerRef.current.style.transform =
        `translate(${target.pan.x}px, ${target.pan.y}px)`;
    }
    onLoadTabState(target);
  }, [panRef, hasCenteredRef, transformContainerRef, onLoadTabState]);

  const switchToTab = useCallback((tabId: string) => {
    if (tabId === activeTabIdRef.current) return;

    setTabs(prev => {
      const flushed = flushCurrentTab(prev);
      const target = flushed.find(t => t.id === tabId);
      if (!target) return prev;
      loadTab(target);
      return flushed;
    });
    setActiveTabId(tabId);
  }, [flushCurrentTab, loadTab]);

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
          setActiveTabId(existing.id);
          return prev;
        }
        const newTab = tabFromProjectData(data, resolvedPath);
        addRecentFile(resolvedPath, data.canvas.width);
        const flushed = flushCurrentTab(prev);
        panRef.current = { x: 0, y: 0 };
        hasCenteredRef.current = false;
        loadTab(newTab);
        setActiveTabId(newTab.id);
        return [...flushed, newTab];
      });
    } catch (err) {
      alert(`Open failed: ${(err as Error).message}`);
    }
  }, [flushCurrentTab, loadTab, panRef, hasCenteredRef]);

  const addNewTab = useCallback((size: GridSizeType = 32, name = 'Untitled') => {
    const newTab = createNewTab(size, name);
    setTabs(prev => {
      const flushed = flushCurrentTab(prev);
      return [...flushed, newTab];
    });
    panRef.current = { x: 0, y: 0 };
    hasCenteredRef.current = false;
    loadTab(newTab);
    setActiveTabId(newTab.id);
  }, [flushCurrentTab, loadTab, panRef, hasCenteredRef]);

  const closeTab = useCallback((tabId: string) => {
    setTabs(prev => {
      const tab = prev.find(t => t.id === tabId);
      if (tab?.isDirty && !window.confirm(`"${tab.name}" has unsaved changes. Close anyway?`)) {
        return prev;
      }
      const next = prev.filter(t => t.id !== tabId);
      if (next.length === 0) {
        onAllTabsClosed();
        return next;
      }
      if (tabId === activeTabIdRef.current) {
        const idx = prev.findIndex(t => t.id === tabId);
        const target = next[Math.min(idx, next.length - 1)];
        loadTab(target);
        setActiveTabId(target.id);
      }
      return next;
    });
  }, [loadTab, onAllTabsClosed]);

  const updateActiveTab = useCallback((updater: (tab: TabState) => Partial<TabState>) => {
    setTabs(prev => prev.map(t => {
      if (t.id !== activeTabIdRef.current) return t;
      return { ...t, ...updater(t) };
    }));
  }, []);

  return {
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    switchToTab,
    openFileAsTab,
    addNewTab,
    closeTab,
    updateActiveTab,
  };
}
