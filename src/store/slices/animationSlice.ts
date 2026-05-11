import type { StateCreator } from 'zustand';
import type { AnimationState } from '../../types';
import { createDefaultFrame, cloneFrame, shallowCloneFrame, generateId, createEmptyGrid, createDefaultTransform } from '../../lib/frameHelpers';

import type { StoreState } from '../index';

export interface AnimationSlice {
  animState: AnimationState;
  setAnimState: (state: AnimationState | ((prev: AnimationState) => AnimationState)) => void;

  // Frame operations
  handleAddFrame: () => void;
  handleDuplicateFrame: () => void;
  handleDeleteFrame: () => void;
  handleSetDuration: (index: number, duration: number) => void;
  handleSetDurationAll: (duration: number) => void;
  handleReorderFrame: (oldIndex: number, newIndex: number) => void;
  handleFrameChange: (index: number) => void;

  // Layer operations
  toggleLayerVisibility: (id: string) => void;
  addLayer: (layerCount: number, gridSize: number) => void;
  deleteLayer: (id: string) => void;
  toggleLayerSelection: (id: string) => void;
  handleLayerClick: (id: string, isMulti: boolean) => void;
  handleReorderLayer: (oldIndex: number, newIndex: number) => void;
}

const defaultFrame = createDefaultFrame(16);

export const createAnimationSlice: StateCreator<AnimationSlice, [], [], AnimationSlice> = (set, get) => {
  const pushUndo = () => (get() as unknown as StoreState).pushUndoSnapshot(get().animState);
  return {
  animState: {
    frames: [defaultFrame],
    activeFrameIndex: 0,
    activeLayerId: defaultFrame.layers[0].id,
    selectedLayerIds: [defaultFrame.layers[0].id],
  },
  setAnimState: (state) => set(prev => ({
    animState: typeof state === 'function' ? state(prev.animState) : state,
  })),

  handleAddFrame: () => {
    pushUndo();
    set(prev => {
      const newFrame = cloneFrame(prev.animState.frames[prev.animState.activeFrameIndex]);
      const nextFrames = [...prev.animState.frames, newFrame];
      return { animState: { ...prev.animState, frames: nextFrames, activeFrameIndex: nextFrames.length - 1 } };
    });
  },

  handleDuplicateFrame: () => {
    pushUndo();
    set(prev => {
      const newFrame = shallowCloneFrame(prev.animState.frames[prev.animState.activeFrameIndex]);
      const nextFrames = [...prev.animState.frames, newFrame];
      return { animState: { ...prev.animState, frames: nextFrames, activeFrameIndex: nextFrames.length - 1 } };
    });
  },

  handleDeleteFrame: () => {
    const { animState } = get();
    if (animState.frames.length <= 1) return;
    pushUndo();
    set(prev => {
      const nextFrames = prev.animState.frames.filter((_, i) => i !== prev.animState.activeFrameIndex);
      const nextIndex = Math.min(prev.animState.activeFrameIndex, nextFrames.length - 1);
      return { animState: { ...prev.animState, frames: nextFrames, activeFrameIndex: nextIndex } };
    });
  },

  handleSetDuration: (index, duration) => {
    pushUndo();
    set(prev => {
      const nextFrames = [...prev.animState.frames];
      nextFrames[index] = { ...nextFrames[index], duration };
      return { animState: { ...prev.animState, frames: nextFrames } };
    });
  },

  handleSetDurationAll: (duration) => {
    pushUndo();
    set(prev => {
      const nextFrames = prev.animState.frames.map(f => ({ ...f, duration }));
      return { animState: { ...prev.animState, frames: nextFrames } };
    });
  },

  handleReorderFrame: (oldIndex, newIndex) => {
    if (oldIndex === newIndex) return;
    pushUndo();
    set(prev => {
      const nextFrames = [...prev.animState.frames];
      const [movedFrame] = nextFrames.splice(oldIndex, 1);
      nextFrames.splice(newIndex, 0, movedFrame);

      let nextActiveIndex = prev.animState.activeFrameIndex;
      if (prev.animState.activeFrameIndex === oldIndex) {
        nextActiveIndex = newIndex;
      } else if (prev.animState.activeFrameIndex > oldIndex && prev.animState.activeFrameIndex <= newIndex) {
        nextActiveIndex--;
      } else if (prev.animState.activeFrameIndex < oldIndex && prev.animState.activeFrameIndex >= newIndex) {
        nextActiveIndex++;
      }
      return { animState: { ...prev.animState, frames: nextFrames, activeFrameIndex: nextActiveIndex } };
    });
  },

  handleFrameChange: (index) => {
    set(prev => ({ animState: { ...prev.animState, activeFrameIndex: index } }));
  },

  toggleLayerVisibility: (id) => {
    pushUndo();
    set(prev => {
      const nextLayers = prev.animState.frames[prev.animState.activeFrameIndex].layers.map(
        l => l.id === id ? { ...l, visible: !l.visible } : l
      );
      const frame = { ...prev.animState.frames[prev.animState.activeFrameIndex], layers: nextLayers };
      const nextFrames = [...prev.animState.frames];
      nextFrames[prev.animState.activeFrameIndex] = frame;
      return { animState: { ...prev.animState, frames: nextFrames } };
    });
  },

  addLayer: (layerCount, gridSize) => {
    pushUndo();
    set(prev => {
      const nextLayers = [...prev.animState.frames[prev.animState.activeFrameIndex].layers, {
        id: generateId(),
        name: `Layer ${layerCount + 1}`,
        visible: true,
        opacity: 1,
        grid: createEmptyGrid(gridSize),
        transform: createDefaultTransform(),
      }];
      const frame = { ...prev.animState.frames[prev.animState.activeFrameIndex], layers: nextLayers };
      const nextFrames = [...prev.animState.frames];
      nextFrames[prev.animState.activeFrameIndex] = frame;
      return {
        animState: {
          ...prev.animState,
          frames: nextFrames,
          activeLayerId: nextLayers[nextLayers.length - 1].id,
          selectedLayerIds: [nextLayers[nextLayers.length - 1].id],
        },
      };
    });
  },

  deleteLayer: (id) => {
    const { animState } = get();
    const layers = animState.frames[animState.activeFrameIndex]?.layers ?? [];
    if (layers.length <= 1) return;
    pushUndo();
    set(prev => {
      const nextLayers = prev.animState.frames[prev.animState.activeFrameIndex].layers.filter(l => l.id !== id);
      const frame = { ...prev.animState.frames[prev.animState.activeFrameIndex], layers: nextLayers };
      const nextFrames = [...prev.animState.frames];
      nextFrames[prev.animState.activeFrameIndex] = frame;
      let nextLayerId = prev.animState.activeLayerId;
      if (nextLayerId === id) nextLayerId = nextLayers[nextLayers.length - 1].id;
      const nextSelected = (prev.animState.selectedLayerIds || [prev.animState.activeLayerId]).filter(lid => lid !== id);
      if (nextSelected.length === 0) nextSelected.push(nextLayerId);
      return {
        animState: { ...prev.animState, frames: nextFrames, activeLayerId: nextLayerId, selectedLayerIds: nextSelected },
      };
    });
  },

  toggleLayerSelection: (id) => {
    set(prev => {
      const isSelected = prev.animState.selectedLayerIds.includes(id);
      let nextSelected: string[];
      if (isSelected) {
        if (prev.animState.selectedLayerIds.length <= 1) return prev;
        nextSelected = prev.animState.selectedLayerIds.filter(lid => lid !== id);
      } else {
        nextSelected = [...prev.animState.selectedLayerIds, id];
      }
      let nextActive = prev.animState.activeLayerId;
      if (id === prev.animState.activeLayerId && isSelected) {
        nextActive = nextSelected[0];
      }
      return { animState: { ...prev.animState, selectedLayerIds: nextSelected, activeLayerId: nextActive } };
    });
  },

  handleLayerClick: (id, isMulti) => {
    set(prev => {
      if (isMulti) {
        const isSelected = prev.animState.selectedLayerIds.includes(id);
        const nextSelected = isSelected
          ? (prev.animState.selectedLayerIds.length > 1 ? prev.animState.selectedLayerIds.filter(lid => lid !== id) : prev.animState.selectedLayerIds)
          : [...prev.animState.selectedLayerIds, id];
        let nextActive = prev.animState.activeLayerId;
        if (!isSelected) nextActive = id;
        else if (id === prev.animState.activeLayerId && nextSelected.length > 0) nextActive = nextSelected[0];
        return { animState: { ...prev.animState, selectedLayerIds: nextSelected, activeLayerId: nextActive } };
      } else {
        return { animState: { ...prev.animState, activeLayerId: id, selectedLayerIds: [id] } };
      }
    });
  },

  handleReorderLayer: (oldIndex, newIndex) => {
    if (oldIndex === newIndex) return;
    pushUndo();
    set(prev => {
      const activeIdx = prev.animState.activeFrameIndex;
      const frame = { ...prev.animState.frames[activeIdx] };
      const nextLayers = [...frame.layers];
      const [movedLayer] = nextLayers.splice(oldIndex, 1);
      nextLayers.splice(newIndex, 0, movedLayer);
      frame.layers = nextLayers;
      const nextFrames = [...prev.animState.frames];
      nextFrames[activeIdx] = frame;
      return { animState: { ...prev.animState, frames: nextFrames } };
    });
  },
};
};
