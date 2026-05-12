import type { Frame, PixelGrid } from '../../types';

export type EasingType = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'bounce';

export interface PixelRegion {
  id: string;
  pixels: { x: number; y: number }[];
  boundingBox: { x: number; y: number; width: number; height: number };
  center: { x: number; y: number };
  dominantColor: string | null;
}

export interface SuggestionFrame {
  grid: PixelGrid;
  opacity: number;
  tint: string;
}

export interface MotionConfig {
  templateId: string;
  frameCount: number;
  intensity: number;
  easing: EasingType;
}

export interface MotionTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  defaultConfig: Partial<MotionConfig>;
  generate: (
    startFrame: Frame,
    endFrame: Frame | null,
    config: MotionConfig,
    gridSize: number,
  ) => SuggestionFrame[];
}
