import type { StateCreator } from 'zustand';
import type { StoreState } from '../index';
import type { SuggestionFrame } from '../../lib/motion/types';
import { suggestionsToFrames } from '../../lib/motion/engine';

export interface MotionSlice {
  suggestions: SuggestionFrame[];
  suggestionStartIndex: number;
  isShowingSuggestions: boolean;
  showMotionAssistDialog: boolean;
  useKeyframeInterpolation: boolean;

  setShowMotionAssistDialog: (show: boolean) => void;
  showMotionSuggestions: (suggestions: SuggestionFrame[], startIndex: number, useKeyframeInterpolation: boolean) => void;
  acceptSuggestions: (layerName: string, duration: number) => void;
  rejectSuggestions: () => void;
  clearSuggestions: () => void;
}

export const createMotionSlice: StateCreator<MotionSlice, [], [], MotionSlice> = (set, get) => ({
  suggestions: [],
  suggestionStartIndex: 0,
  isShowingSuggestions: false,
  showMotionAssistDialog: false,
  useKeyframeInterpolation: false,

  setShowMotionAssistDialog: (show) => set({ showMotionAssistDialog: show }),

  showMotionSuggestions: (suggestions, startIndex, useKeyframeInterpolation) => {
    set({
      suggestions,
      suggestionStartIndex: startIndex,
      isShowingSuggestions: suggestions.length > 0,
      showMotionAssistDialog: false,
      useKeyframeInterpolation,
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
      useKeyframeInterpolation: false,
    });
  },

  rejectSuggestions: () => {
    set({
      suggestions: [],
      isShowingSuggestions: false,
      suggestionStartIndex: 0,
      useKeyframeInterpolation: false,
    });
  },

  clearSuggestions: () => {
    set({
      suggestions: [],
      isShowingSuggestions: false,
      suggestionStartIndex: 0,
      useKeyframeInterpolation: false,
    });
  },
});
