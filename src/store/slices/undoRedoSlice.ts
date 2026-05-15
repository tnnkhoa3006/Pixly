import type { StateCreator } from 'zustand';
import type {
  AnimationState,
  Frame,
  HistoryContext,
  HistoryEntry,
  Layer,
  LayerHistoryPatch,
  PixelRun,
} from '../../types';
import type { StoreState } from '../index';

const MAX_HISTORY = 80;
const MAX_HISTORY_CELLS = 600_000;

const makeHistoryId = () => `hist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const getContext = (state: AnimationState): HistoryContext => ({
  activeFrameIndex: state.activeFrameIndex,
  activeLayerId: state.activeLayerId,
  selectedLayerIds: [...state.selectedLayerIds],
});

const sameFrameOrder = (before: Frame[], after: Frame[]) =>
  before.length === after.length && before.every((frame, index) => frame.id === after[index]?.id);

const sameLayerOrder = (before: Frame, after: Frame) =>
  before.layers.length === after.layers.length &&
  before.layers.every((layer, index) => layer.id === after.layers[index]?.id);

function buildPixelRuns(before: Layer, after: Layer): { runs: PixelRun[]; changedCells: number } {
  if (before.grid === after.grid) return { runs: [], changedCells: 0 };

  const runs: PixelRun[] = [];
  let changedCells = 0;
  const rowCount = Math.max(before.grid.length, after.grid.length);

  for (let y = 0; y < rowCount; y++) {
    const beforeRow = before.grid[y] ?? [];
    const afterRow = after.grid[y] ?? [];
    if (beforeRow === afterRow) continue;

    const colCount = Math.max(beforeRow.length, afterRow.length);
    let x = 0;
    while (x < colCount) {
      if ((beforeRow[x] ?? null) === (afterRow[x] ?? null)) {
        x++;
        continue;
      }

      const startX = x;
      const beforePixels: (string | null)[] = [];
      const afterPixels: (string | null)[] = [];
      while (x < colCount && (beforeRow[x] ?? null) !== (afterRow[x] ?? null)) {
        beforePixels.push(beforeRow[x] ?? null);
        afterPixels.push(afterRow[x] ?? null);
        x++;
      }

      runs.push({ y, x: startX, before: beforePixels, after: afterPixels });
      changedCells += beforePixels.length;
    }
  }

  return { runs, changedCells };
}

function buildHistoryEntry(before: AnimationState, after: AnimationState): HistoryEntry | null {
  if (!sameFrameOrder(before.frames, after.frames)) return null;

  const layerPatches: LayerHistoryPatch[] = [];
  let changedCells = 0;

  for (let frameIndex = 0; frameIndex < before.frames.length; frameIndex++) {
    const beforeFrame = before.frames[frameIndex];
    const afterFrame = after.frames[frameIndex];
    if (!afterFrame || !sameLayerOrder(beforeFrame, afterFrame)) return null;
    if (beforeFrame === afterFrame) continue;

    for (let layerIndex = 0; layerIndex < beforeFrame.layers.length; layerIndex++) {
      const beforeLayer = beforeFrame.layers[layerIndex];
      const afterLayer = afterFrame.layers[layerIndex];
      if (!afterLayer) return null;

      const { runs, changedCells: layerChangedCells } = buildPixelRuns(beforeLayer, afterLayer);
      const patch: LayerHistoryPatch = {
        frameId: beforeFrame.id,
        layerId: beforeLayer.id,
        runs,
      };

      if (patch.runs.length > 0) {
        layerPatches.push(patch);
        changedCells += layerChangedCells;
      }
    }
  }

  const beforeContext = getContext(before);
  const afterContext = getContext(after);

  if (layerPatches.length === 0) return null;

  return {
    id: makeHistoryId(),
    before: beforeContext,
    after: afterContext,
    layerPatches,
    changedCells,
  };
}

function trimHistory(stack: HistoryEntry[]): HistoryEntry[] {
  let totalCells = 0;
  const kept: HistoryEntry[] = [];

  for (let i = stack.length - 1; i >= 0 && kept.length < MAX_HISTORY; i--) {
    const entry = stack[i];
    const entryCells = Math.max(1, entry.changedCells);
    if (kept.length > 0 && totalCells + entryCells > MAX_HISTORY_CELLS) break;
    kept.push(entry);
    totalCells += entryCells;
  }

  kept.reverse();
  return kept;
}

function applyLayerPatch(layer: Layer, patch: LayerHistoryPatch, direction: 'undo' | 'redo'): Layer {
  const nextLayer: Layer = {
    ...layer,
    transform: { ...layer.transform },
  };

  if (patch.runs.length > 0) {
    const grid = layer.grid.map(row => [...row]);
    for (const run of patch.runs) {
      const source = direction === 'undo' ? run.before : run.after;
      if (!grid[run.y]) continue;
      for (let offset = 0; offset < source.length; offset++) {
        const x = run.x + offset;
        if (x >= 0 && x < grid[run.y].length) grid[run.y][x] = source[offset];
      }
    }
    nextLayer.grid = grid;
  }

  return nextLayer;
}

function applyHistoryEntry(state: AnimationState, entry: HistoryEntry, direction: 'undo' | 'redo'): AnimationState {
  const layerPatchesByFrame = new Map<string, LayerHistoryPatch[]>();

  for (const patch of entry.layerPatches) {
    const patches = layerPatchesByFrame.get(patch.frameId) ?? [];
    patches.push(patch);
    layerPatchesByFrame.set(patch.frameId, patches);
  }

  const frames = state.frames.map(frame => {
    const layerPatches = layerPatchesByFrame.get(frame.id);
    if (!layerPatches) return frame;

    const patchByLayerId = new Map((layerPatches ?? []).map(patch => [patch.layerId, patch]));
    const layers = frame.layers.map(layer => {
      const patch = patchByLayerId.get(layer.id);
      return patch ? applyLayerPatch(layer, patch, direction) : layer;
    });

    return {
      ...frame,
      layers,
    };
  });

  const context = direction === 'undo' ? entry.before : entry.after;
  const activeFrameIndex = Math.min(context.activeFrameIndex, Math.max(0, frames.length - 1));
  const activeLayers = frames[activeFrameIndex]?.layers ?? [];
  const activeLayerId = activeLayers.some(layer => layer.id === context.activeLayerId)
    ? context.activeLayerId
    : activeLayers[0]?.id ?? context.activeLayerId;
  const selectedLayerIds = context.selectedLayerIds.filter(id => activeLayers.some(layer => layer.id === id));

  return {
    frames,
    activeFrameIndex,
    activeLayerId,
    selectedLayerIds: selectedLayerIds.length > 0 ? selectedLayerIds : (activeLayerId ? [activeLayerId] : []),
  };
}

export interface UndoRedoSlice {
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  setUndoStack: (stack: HistoryEntry[] | ((prev: HistoryEntry[]) => HistoryEntry[])) => void;
  setRedoStack: (stack: HistoryEntry[] | ((prev: HistoryEntry[]) => HistoryEntry[])) => void;
  pushUndoSnapshot: (state: AnimationState) => void;
  commitUndoSnapshot: () => void;
  handleUndo: () => void;
  handleRedo: () => void;
  resetHistory: () => void;
}

export const createUndoRedoSlice: StateCreator<UndoRedoSlice, [], [], UndoRedoSlice> = (set, get) => {
  let pendingBefore: AnimationState | null = null;

  const commitPending = () => {
    if (!pendingBefore) return;
    const store = get() as unknown as StoreState;
    const entry = buildHistoryEntry(pendingBefore, store.animState);
    pendingBefore = null;
    if (!entry) return;

    set(prev => ({
      undoStack: trimHistory([...prev.undoStack, entry]),
      redoStack: [],
    }));
  };

  return {
    undoStack: [],
    redoStack: [],
    setUndoStack: (stack) => set(prev => ({
      undoStack: typeof stack === 'function' ? trimHistory(stack(prev.undoStack)) : trimHistory(stack),
    })),
    setRedoStack: (stack) => set(prev => ({
      redoStack: typeof stack === 'function' ? trimHistory(stack(prev.redoStack)) : trimHistory(stack),
    })),

    pushUndoSnapshot: (state) => {
      commitPending();
      pendingBefore = state;
    },

    commitUndoSnapshot: commitPending,

    handleUndo: () => {
      commitPending();
      const { undoStack } = get();
      if (undoStack.length === 0) return;
      const store = get() as unknown as StoreState;
      const entry = undoStack[undoStack.length - 1];
      set(prev => ({
        undoStack: prev.undoStack.slice(0, -1),
        redoStack: trimHistory([...prev.redoStack, entry]),
      }));
      store.setAnimState(applyHistoryEntry(store.animState, entry, 'undo'));
    },

    handleRedo: () => {
      commitPending();
      const { redoStack } = get();
      if (redoStack.length === 0) return;
      const store = get() as unknown as StoreState;
      const entry = redoStack[redoStack.length - 1];
      set(prev => ({
        undoStack: trimHistory([...prev.undoStack, entry]),
        redoStack: prev.redoStack.slice(0, -1),
      }));
      store.setAnimState(applyHistoryEntry(store.animState, entry, 'redo'));
    },

    resetHistory: () => {
      pendingBefore = null;
      set({ undoStack: [], redoStack: [] });
    },
  };
};
