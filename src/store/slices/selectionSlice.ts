import type { StateCreator } from 'zustand';
import type { SelectionState } from '../../types';
import type { StoreState } from '../index';

export interface SelectionSlice {
  selection: SelectionState | null;
  clipboard: { pixels: (string | null)[][]; width: number; height: number } | null;

  setSelection: (sel: SelectionState | null | ((prev: SelectionState | null) => SelectionState | null)) => void;
  setClipboard: (clip: { pixels: (string | null)[][]; width: number; height: number } | null) => void;

  // Selection operations
  commitSelection: () => void;
  selectionCopy: () => void;
  selectionDelete: () => void;
  selectionFlipH: () => void;
  selectionFlipV: () => void;
}

export const createSelectionSlice: StateCreator<SelectionSlice, [], [], SelectionSlice> = (set, get) => ({
  selection: null,
  clipboard: null,

  setSelection: (sel) => set(prev => ({
    selection: typeof sel === 'function' ? sel(prev.selection) : sel,
  })),
  setClipboard: (clip) => set({ clipboard: clip }),

  commitSelection: () => {
    const { selection } = get();
    if (!selection) return;
    const store = get() as unknown as StoreState;
    const { gridSize, setAnimState } = store;
    const { x, y, width, height, pixels, offsetX, offsetY } = selection;
    const placeX = x + offsetX;
    const placeY = y + offsetY;

    setAnimState((prev: any) => {
      const activeIdx = prev.activeFrameIndex;
      const frame = { ...prev.frames[activeIdx] };
      const newLayers = [...frame.layers];
      const layerIdx = newLayers.findIndex((l: any) => l.id === prev.activeLayerId);
      if (layerIdx === -1) return prev;
      const al = { ...newLayers[layerIdx] };
      const newGrid = al.grid.map((row: any) => [...row]);
      for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
          const gx = placeX + col;
          const gy = placeY + row;
          if (gx < 0 || gx >= gridSize || gy < 0 || gy >= gridSize) continue;
          const pixel = pixels[row]?.[col];
          if (pixel !== null) newGrid[gy][gx] = pixel;
        }
      }
      al.grid = newGrid;
      newLayers[layerIdx] = al;
      frame.layers = newLayers;
      const nextFrames = [...prev.frames];
      nextFrames[activeIdx] = frame;
      return { ...prev, frames: nextFrames };
    });

    set({ selection: null });
  },

  selectionCopy: () => {
    const { selection } = get();
    if (!selection) return;
    set({ clipboard: { pixels: selection.pixels.map(r => [...r]), width: selection.width, height: selection.height } });
  },

  selectionDelete: () => {
    if (!get().selection) return;
    set({ selection: null });
  },

  selectionFlipH: () => {
    const { selection } = get();
    if (!selection) return;
    set(prev => ({
      selection: prev.selection ? { ...prev.selection, pixels: prev.selection.pixels.map(row => [...row].reverse()) } : prev.selection,
    }));
  },

  selectionFlipV: () => {
    const { selection } = get();
    if (!selection) return;
    set(prev => ({
      selection: prev.selection ? { ...prev.selection, pixels: [...prev.selection.pixels].reverse() } : prev.selection,
    }));
  },
});
