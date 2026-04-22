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
  | 'frame-move' | 'frame-rotate' | 'frame-scale';

export type GridSizeType = 16 | 32 | 64 | 128;
