import type { StateCreator } from 'zustand';
import type { StoreState } from '../index';
import type { PixelGrid } from '../../types';
import type {
  SuggestionFrame,
  MotionConfig,
  InterpolationConfig,
  EditableSuggestion,
  TemplateScore,
} from '../../lib/motion/types';
import { generateSuggestions, suggestionsToFrames } from '../../lib/motion/engine';
import { interpolateKeyframes } from '../../lib/motion/interpolate';
import { suggestTemplates } from '../../lib/motion/templateMatch';
import { getDefaultConstraints } from '../../lib/motion/constraints';

export interface MotionSlice {
  suggestions: SuggestionFrame[];
  editableSuggestions: EditableSuggestion[];
  suggestionStartIndex: number;
  isShowingSuggestions: boolean;
  showMotionAssistDialog: boolean;
  templateScores: TemplateScore[];
  useKeyframeInterpolation: boolean;

  setShowMotionAssistDialog: (show: boolean) => void;
  generateMotionAssist: (templateId: string, config: MotionConfig, gridSize: number) => void;
  generateKeyframeInterpolation: (endFrameIndex: number, config: Partial<InterpolationConfig>, gridSize: number) => void;
  refreshTemplateScores: (gridSize: number) => void;
  acceptSuggestions: (layerName: string, duration: number) => void;
  rejectSuggestions: () => void;
  clearSuggestions: () => void;

  // Editable suggestion actions
  makeSuggestionsEditable: () => void;
  editSuggestionPixel: (frameIndex: number, x: number, y: number, color: string | null) => void;
  undoSuggestionEdit: (frameIndex: number) => void;
  getSuggestionGrid: (frameIndex: number) => PixelGrid | null;
}

export const createMotionSlice: StateCreator<MotionSlice, [], [], MotionSlice> = (set, get) => ({
  suggestions: [],
  editableSuggestions: [],
  suggestionStartIndex: 0,
  isShowingSuggestions: false,
  showMotionAssistDialog: false,
  templateScores: [],
  useKeyframeInterpolation: false,

  setShowMotionAssistDialog: (show) => {
    set({ showMotionAssistDialog: show });
    if (show) {
      // Auto-refresh template scores when opening dialog
      const store = get() as unknown as StoreState;
      const gridSize = store.gridSize;
      if (gridSize) {
        setTimeout(() => get().refreshTemplateScores(gridSize), 0);
      }
    }
  },

  generateMotionAssist: (templateId, config, gridSize) => {
    const store = get() as unknown as StoreState;
    const activeFrame = store.animState.frames[store.animState.activeFrameIndex];
    if (!activeFrame) return;

    const suggestions = generateSuggestions(
      templateId,
      activeFrame,
      null,
      config,
      gridSize,
    );

    set({
      suggestions,
      editableSuggestions: [],
      suggestionStartIndex: store.animState.activeFrameIndex,
      isShowingSuggestions: suggestions.length > 0,
      showMotionAssistDialog: false,
      useKeyframeInterpolation: false,
    });
  },

  generateKeyframeInterpolation: (endFrameIndex, config, gridSize) => {
    const store = get() as unknown as StoreState;
    const startFrame = store.animState.frames[store.animState.activeFrameIndex];
    const endFrame = store.animState.frames[endFrameIndex];
    if (!startFrame || !endFrame) return;

    const suggestions = interpolateKeyframes(startFrame, endFrame, {
      ...config,
      constraints: config.constraints ?? getDefaultConstraints(),
    }, gridSize);

    set({
      suggestions,
      editableSuggestions: [],
      suggestionStartIndex: store.animState.activeFrameIndex,
      isShowingSuggestions: suggestions.length > 0,
      showMotionAssistDialog: false,
      useKeyframeInterpolation: true,
    });
  },

  refreshTemplateScores: (gridSize) => {
    const store = get() as unknown as StoreState;
    const activeFrame = store.animState.frames[store.animState.activeFrameIndex];
    if (!activeFrame) {
      set({ templateScores: [] });
      return;
    }
    const scores = suggestTemplates(activeFrame, gridSize);
    set({ templateScores: scores });
  },

  acceptSuggestions: (layerName, duration) => {
    const { suggestions, suggestionStartIndex, editableSuggestions } = get();
    if (suggestions.length === 0) return;

    const store = get() as unknown as StoreState;
    store.pushUndoSnapshot(store.animState);

    // Use editable grids if available, otherwise use original suggestions
    const gridsToUse = editableSuggestions.length > 0
      ? editableSuggestions.map(e => ({ grid: e.grid, opacity: 1, tint: '' }))
      : suggestions;

    const newFrames = suggestionsToFrames(gridsToUse, layerName, duration);
    const frames = [...store.animState.frames];
    frames.splice(suggestionStartIndex + 1, 0, ...newFrames);

    store.setAnimState({
      ...store.animState,
      frames,
      activeFrameIndex: suggestionStartIndex + 1,
    });

    set({
      suggestions: [],
      editableSuggestions: [],
      isShowingSuggestions: false,
      suggestionStartIndex: 0,
      useKeyframeInterpolation: false,
    });
  },

  rejectSuggestions: () => {
    set({
      suggestions: [],
      editableSuggestions: [],
      isShowingSuggestions: false,
      suggestionStartIndex: 0,
      useKeyframeInterpolation: false,
    });
  },

  clearSuggestions: () => {
    set({
      suggestions: [],
      editableSuggestions: [],
      isShowingSuggestions: false,
      suggestionStartIndex: 0,
      useKeyframeInterpolation: false,
    });
  },

  // --- Editable suggestion actions ---

  makeSuggestionsEditable: () => {
    const { suggestions } = get();
    const editable: EditableSuggestion[] = suggestions.map(s => ({
      grid: s.grid.map(row => [...row]),
      opacity: 1,
      tint: s.tint,
      editable: true as const,
      editHistory: [s.grid.map(row => [...row])],
    }));
    set({ editableSuggestions: editable });
  },

  editSuggestionPixel: (frameIndex, x, y, color) => {
    const { editableSuggestions } = get();
    if (frameIndex < 0 || frameIndex >= editableSuggestions.length) return;

    const editable = editableSuggestions[frameIndex];
    const newGrid = editable.grid.map(row => [...row]);

    if (y >= 0 && y < newGrid.length && x >= 0 && x < newGrid[0].length) {
      newGrid[y][x] = color;
    }

    const newEditable = [...editableSuggestions];
    newEditable[frameIndex] = {
      ...editable,
      grid: newGrid,
      editHistory: [...editable.editHistory, newGrid.map(row => [...row])],
    };

    set({ editableSuggestions: newEditable });
  },

  undoSuggestionEdit: (frameIndex) => {
    const { editableSuggestions } = get();
    if (frameIndex < 0 || frameIndex >= editableSuggestions.length) return;

    const editable = editableSuggestions[frameIndex];
    if (editable.editHistory.length <= 1) return;

    const newHistory = editable.editHistory.slice(0, -1);
    const previousGrid = newHistory[newHistory.length - 1];

    const newEditable = [...editableSuggestions];
    newEditable[frameIndex] = {
      ...editable,
      grid: previousGrid.map(row => [...row]),
      editHistory: newHistory,
    };

    set({ editableSuggestions: newEditable });
  },

  getSuggestionGrid: (frameIndex) => {
    const { editableSuggestions, suggestions } = get();
    if (editableSuggestions.length > 0 && frameIndex < editableSuggestions.length) {
      return editableSuggestions[frameIndex].grid;
    }
    if (frameIndex < suggestions.length) {
      return suggestions[frameIndex].grid;
    }
    return null;
  },
});
