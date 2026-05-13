import type { StateCreator } from 'zustand';
import type { CutMode, ToolType } from '../../types';
import type { TransformHud } from '../../lib/transformHelpers';

export type BrushPixels = { pixels: (string | null)[][]; width: number; height: number };
type BrushData = BrushPixels | null;

const DEFAULT_BRUSHES: BrushPixels[] = [
  { // Star
    width: 5, height: 5,
    pixels: [
      [null, null, 'CURRENT', null, null],
      [null, 'CURRENT', 'CURRENT', 'CURRENT', null],
      ['CURRENT', 'CURRENT', 'CURRENT', 'CURRENT', 'CURRENT'],
      [null, 'CURRENT', null, 'CURRENT', null],
      ['CURRENT', null, null, null, 'CURRENT']
    ]
  },
  { // Cross
    width: 5, height: 5,
    pixels: [
      [null, null, 'CURRENT', null, null],
      [null, null, 'CURRENT', null, null],
      ['CURRENT', 'CURRENT', 'CURRENT', 'CURRENT', 'CURRENT'],
      [null, null, 'CURRENT', null, null],
      [null, null, 'CURRENT', null, null]
    ]
  },
  { // Checkered
    width: 4, height: 4,
    pixels: [
      ['CURRENT', null, 'CURRENT', null],
      [null, 'CURRENT', null, 'CURRENT'],
      ['CURRENT', null, 'CURRENT', null],
      [null, 'CURRENT', null, 'CURRENT']
    ]
  },
  { // Pencil (Diagonal)
    width: 3, height: 3,
    pixels: [
      [null, null, 'CURRENT'],
      [null, 'CURRENT', null],
      ['CURRENT', null, null]
    ]
  }
];

export interface DrawingSlice {
  currentTool: ToolType;
  currentColor: string;
  cutMode: CutMode;
  customBrush: BrushData;
  savedBrushes: BrushPixels[];
  transformHud: TransformHud | null;

  setCurrentTool: (tool: ToolType | ((prev: ToolType) => ToolType)) => void;
  setCurrentColor: (color: string) => void;
  setCutMode: (mode: CutMode) => void;
  setCustomBrush: (brush: BrushData) => void;
  setSavedBrushes: (brushes: BrushPixels[] | ((prev: BrushPixels[]) => BrushPixels[])) => void;
  setTransformHud: (hud: TransformHud | null) => void;
}

export const createDrawingSlice: StateCreator<DrawingSlice, [], [], DrawingSlice> = (set) => ({
  currentTool: 'brush',
  currentColor: '#000000',
  cutMode: 'lasso',
  customBrush: null,
  savedBrushes: DEFAULT_BRUSHES,
  transformHud: null,

  setCurrentTool: (tool) => set(prev => ({
    currentTool: typeof tool === 'function' ? tool(prev.currentTool) : tool,
  })),
  setCurrentColor: (color) => set({ currentColor: color }),
  setCutMode: (mode) => set({ cutMode: mode }),
  setCustomBrush: (brush) => set({ customBrush: brush }),
  setSavedBrushes: (brushes) => set(prev => ({
    savedBrushes: typeof brushes === 'function' ? brushes(prev.savedBrushes) : brushes,
  })),
  setTransformHud: (hud) => set({ transformHud: hud }),
});
