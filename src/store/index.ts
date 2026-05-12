import { create } from 'zustand';
import { createUiSlice, type UiSlice } from './slices/uiSlice';
import { createCanvasSlice, type CanvasSlice } from './slices/canvasSlice';
import { createUndoRedoSlice, type UndoRedoSlice } from './slices/undoRedoSlice';
import { createAnimationSlice, type AnimationSlice } from './slices/animationSlice';
import { createDrawingSlice, type DrawingSlice } from './slices/drawingSlice';
import { createSelectionSlice, type SelectionSlice } from './slices/selectionSlice';
import { createFileSlice, type FileSlice } from './slices/fileSlice';
import { createTabSlice, type TabSlice } from './slices/tabSlice';
import { createMotionSlice, type MotionSlice } from './slices/motionSlice';

export type StoreState = UiSlice & CanvasSlice & UndoRedoSlice & AnimationSlice &
  DrawingSlice & SelectionSlice & FileSlice & TabSlice & MotionSlice;

export const useStore = create<StoreState>()((...a) => ({
  ...createUiSlice(...a),
  ...createCanvasSlice(...a),
  ...createUndoRedoSlice(...a),
  ...createAnimationSlice(...a),
  ...createDrawingSlice(...a),
  ...createSelectionSlice(...a),
  ...createFileSlice(...a),
  ...createTabSlice(...a),
  ...createMotionSlice(...a),
}));
