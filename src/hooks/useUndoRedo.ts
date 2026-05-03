/**
 * Generic undo/redo stack for AnimationState snapshots.
 * Keeps the last 50 states. Zero behavior change from App.tsx logic.
 */
import { useState, useCallback } from 'react';
import type { AnimationState } from '../types';
import { cloneFrame } from '../lib/frameHelpers';

function cloneAnimationState(state: AnimationState): AnimationState {
  return {
    frames: state.frames.map(frame => cloneFrame(frame)),
    activeFrameIndex: state.activeFrameIndex,
    activeLayerId: state.activeLayerId,
    selectedLayerIds: [...state.selectedLayerIds],
  };
}

const MAX_HISTORY = 50;

export function useUndoRedo(animState: AnimationState, setAnimState: React.Dispatch<React.SetStateAction<AnimationState>>) {
  const [undoStack, setUndoStack] = useState<AnimationState[]>([]);
  const [redoStack, setRedoStack] = useState<AnimationState[]>([]);

  const pushUndoSnapshot = useCallback((state: AnimationState) => {
    const snapshot = cloneAnimationState(state);
    setUndoStack(prev => {
      const next = [...prev, snapshot];
      if (next.length > MAX_HISTORY) next.shift();
      return next;
    });
    setRedoStack([]);
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack(prev => [...prev, cloneAnimationState(animState)]);
    setUndoStack(prev => prev.slice(0, -1));
    setAnimState(cloneAnimationState(previous));
  }, [animState, undoStack, setAnimState]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(prev => {
      const updated = [...prev, cloneAnimationState(animState)];
      if (updated.length > MAX_HISTORY) updated.shift();
      return updated;
    });
    setRedoStack(prev => prev.slice(0, -1));
    setAnimState(cloneAnimationState(next));
  }, [animState, redoStack, setAnimState]);

  const resetHistory = useCallback(() => {
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  return {
    undoStack,
    redoStack,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    pushUndoSnapshot,
    handleUndo,
    handleRedo,
    resetHistory,
    setUndoStack,
    setRedoStack,
  };
}
