import type { StateCreator } from 'zustand';
import type { StoreState } from '../index';
import type { SuggestionFrame, MotionConfig } from '../../lib/motion/types';
import { generateSuggestions, suggestionsToFrames } from '../../lib/motion/engine';

export interface MotionSlice {
  suggestions: SuggestionFrame[];
  suggestionStartIndex: number;
  isShowingSuggestions: boolean;
  showMotionAssistDialog: boolean;

  setShowMotionAssistDialog: (show: boolean) => void;
  generateMotionAssist: (templateId: string, config: MotionConfig, gridSize: number) => void;
  acceptSuggestions: (layerName: string, duration: number) => void;
  rejectSuggestions: () => void;
  clearSuggestions: () => void;
}

export const createMotionSlice: StateCreator<MotionSlice, [], [], MotionSlice> = (set, get) => ({
  suggestions: [],
  suggestionStartIndex: 0,
  isShowingSuggestions: false,
  showMotionAssistDialog: false,

  setShowMotionAssistDialog: (show) => set({ showMotionAssistDialog: show }),

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
      suggestionStartIndex: store.animState.activeFrameIndex,
      isShowingSuggestions: suggestions.length > 0,
      showMotionAssistDialog: false,
    });
  },

  acceptSuggestions: (layerName, duration) => {
    const { suggestions, suggestionStartIndex } = get();
    if (suggestions.length === 0) return;

    const store = get() as unknown as StoreState;

    store.pushUndoSnapshot(store.animState);

    const newFrames = suggestionsToFrames(suggestions, layerName, duration);
    const frames = [...store.animState.frames];
    frames.splice(suggestionStartIndex + 1, 0, ...newFrames);

    store.setAnimState({
      ...store.animState,
      frames,
      activeFrameIndex: suggestionStartIndex + 1,
    });

    set({
      suggestions: [],
      isShowingSuggestions: false,
      suggestionStartIndex: 0,
    });
  },

  rejectSuggestions: () => {
    set({
      suggestions: [],
      isShowingSuggestions: false,
      suggestionStartIndex: 0,
    });
  },

  clearSuggestions: () => {
    set({
      suggestions: [],
      isShowingSuggestions: false,
      suggestionStartIndex: 0,
    });
  },
});
