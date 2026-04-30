export type PixelGrid = (string | null)[][];

export type LayerTransform = {
  x: number;
  y: number;
  rotation: number;   // degrees
  scale: number;       // 1.0 = 100%
};

export type Layer = {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  grid: PixelGrid;
  transform: LayerTransform;
};

export type Frame = {
  id: string;
  layers: Layer[];
  duration: number;    // milliseconds
};

export type AnimationState = {
  frames: Frame[];
  activeFrameIndex: number;
  activeLayerId: string;
  selectedLayerIds: string[];
};

export type ToolType =
  | 'brush' | 'eraser' | 'fill' | 'picker'
  | 'line' | 'rect' | 'circle' | 'select' | 'move'
  | 'lighten' | 'darken' | 'spray' | 'text'
  | 'frame-move' | 'frame-rotate' | 'frame-scale';

export type SelectionState = {
  /** Top-left grid X of the selection region */
  x: number;
  /** Top-left grid Y of the selection region */
  y: number;
  /** Width in grid cells */
  width: number;
  /** Height in grid cells */
  height: number;
  /** Extracted pixel data (row-major, null = transparent) */
  pixels: (string | null)[][];
  /** Current drag offset X (grid cells) */
  offsetX: number;
  /** Current drag offset Y (grid cells) */
  offsetY: number;
};

export type GridSizeType = number;

/** Serialized project file (.pixly) */
export type ProjectData = {
  version: number;
  canvas: { width: number; height: number };
  animState: AnimationState;
  currentColor: string;
  currentTool: ToolType;
  savedAt: string; // ISO timestamp
};
