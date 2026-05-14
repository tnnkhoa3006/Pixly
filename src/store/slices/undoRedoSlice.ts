import type { StateCreator } from 'zustand';
import type { AnimationState, Frame } from '../../types';
import type { StoreState } from '../index';

const MAX_HISTORY = 30;
const MAX_HISTORY_CELLS = 4_000_000;

function cloneFrameForHistory(frame: Frame): Frame {
  return {
    id: frame.id,
    layers: frame.layers.map(layer => ({
      ...layer,
      grid: layer.grid.map(row => [...row]),
      transform: { ...layer.transform },
    })),
    duration: frame.duration,
  };
}

export function cloneAnimationState(state: AnimationState): AnimationState {
  return {
    frames: state.frames.map(frame => cloneFrameForHistory(frame)),
    activeFrameIndex: state.activeFrameIndex,
    activeLayerId: state.activeLayerId,
    selectedLayerIds: [...state.selectedLayerIds],
  };
}

function estimateAnimationCells(state: AnimationState): number {
  return state.frames.reduce((frameTotal, frame) => {
    return frameTotal + frame.layers.reduce((layerTotal, layer) => {
      return layerTotal + layer.grid.reduce((rowTotal, row) => rowTotal + row.length, 0);
    }, 0);
  }, 0);
}

function trimHistory(stack: AnimationState[]): AnimationState[] {
  let totalCells = 0;
  const kept: AnimationState[] = [];

  for (let i = stack.length - 1; i >= 0 && kept.length < MAX_HISTORY; i--) {
    const snapshot = stack[i];
    const cells = estimateAnimationCells(snapshot);
    if (kept.length > 0 && totalCells + cells > MAX_HISTORY_CELLS) break;
    kept.push(snapshot);
    totalCells += cells;
  }

  kept.reverse();
  return kept;
}

export interface UndoRedoSlice {
  undoStack: AnimationState[];
  redoStack: AnimationState[];
  setUndoStack: (stack: AnimationState[] | ((prev: AnimationState[]) => AnimationState[])) => void;
  setRedoStack: (stack: AnimationState[] | ((prev: AnimationState[]) => AnimationState[])) => void;
  pushUndoSnapshot: (state: AnimationState) => void;
  handleUndo: () => void;
  handleRedo: () => void;
  resetHistory: () => void;
}

export const createUndoRedoSlice: StateCreator<UndoRedoSlice, [], [], UndoRedoSlice> = (set, get) => ({
  undoStack: [],
  redoStack: [],
  setUndoStack: (stack) => set(prev => ({
    undoStack: typeof stack === 'function' ? stack(prev.undoStack) : stack,
  })),
  setRedoStack: (stack) => set(prev => ({
    redoStack: typeof stack === 'function' ? stack(prev.redoStack) : stack,
  })),

  pushUndoSnapshot: (state) => {
    const snapshot = cloneAnimationState(state);
    set(prev => {
      const next = trimHistory([...prev.undoStack, snapshot]);
      return { undoStack: next, redoStack: [] };
    });
  },

  handleUndo: () => {
    const { undoStack } = get();
    if (undoStack.length === 0) return;
    const store = get() as unknown as StoreState;
    const previous = undoStack[undoStack.length - 1];
    set(prev => ({
      redoStack: trimHistory([...prev.redoStack, cloneAnimationState(store.animState)]),
      undoStack: prev.undoStack.slice(0, -1),
    }));
    store.setAnimState(cloneAnimationState(previous));
  },

  handleRedo: () => {
    const { redoStack } = get();
    if (redoStack.length === 0) return;
    const store = get() as unknown as StoreState;
    const next = redoStack[redoStack.length - 1];
    set(prev => ({
      undoStack: trimHistory([...prev.undoStack, cloneAnimationState(store.animState)]),
      redoStack: prev.redoStack.slice(0, -1),
    }));
    store.setAnimState(cloneAnimationState(next));
  },

  resetHistory: () => set({ undoStack: [], redoStack: [] }),
});
