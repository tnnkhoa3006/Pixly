import type { GridSizeType, TabState, ProjectData } from '../types';
import { createDefaultFrame, resolveGridSize } from './frameHelpers';

export function makeTabId() {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createNewTab(size: GridSizeType = 32, name = 'Untitled'): TabState {
  const { width, height } = resolveGridSize(size);
  const defaultFrame = createDefaultFrame({ width, height });
  return {
    id: makeTabId(),
    name,
    filePath: null,
    isDirty: false,
    gridSize: width,
    gridHeight: height,
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
  const width = data.canvas.width;
  const height = data.canvas.height ?? data.canvas.width;
  return {
    id: makeTabId(),
    name,
    filePath,
    isDirty: false,
    gridSize: width,
    gridHeight: height,
    animState: data.animState,
    currentColor: data.currentColor,
    currentTool: data.currentTool,
    undoStack: [],
    redoStack: [],
    pan: { x: 0, y: 0 },
    pixelSize: 32,
  };
}
