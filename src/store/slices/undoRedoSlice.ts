import type { StateCreator } from 'zustand';
import type { AnimationState } from '../../types';
import { cloneFrame } from '../../lib/frameHelpers';
import type { StoreState } from '../index';

const MAX_HISTORY = 50;

export function cloneAnimationState(state: AnimationState): AnimationState {
  return {
    frames: state.frames.map(frame => cloneFrame(frame)),
    activeFrameIndex: state.activeFrameIndex,
    activeLayerId: state.activeLayerId,
    selectedLayerIds: [...state.selectedLayerIds],
  };
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
      const next = [...prev.undoStack, snapshot];
      if (next.length > MAX_HISTORY) next.shift();
      return { undoStack: next, redoStack: [] };
    });
  },

  handleUndo: () => {
    const { undoStack } = get();
    if (undoStack.length === 0) return;
    const store = get() as unknown as StoreState;
    const previous = undoStack[undoStack.length - 1];
    set(prev => ({
      redoStack: [...prev.redoStack, cloneAnimationState(store.animState)],
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
      undoStack: [...prev.undoStack, cloneAnimationState(store.animState)],
      redoStack: prev.redoStack.slice(0, -1),
    }));
    store.setAnimState(cloneAnimationState(next));
  },

  resetHistory: () => set({ undoStack: [], redoStack: [] }),
});
