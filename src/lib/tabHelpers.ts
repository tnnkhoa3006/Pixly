import type { GridSizeType, TabState, ProjectData } from '../types';
import { createDefaultFrame } from './frameHelpers';

export function makeTabId() {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createNewTab(size: GridSizeType = 32, name = 'Untitled'): TabState {
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

export function tabFromProjectData(data: ProjectData, filePath: string): TabState {
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
