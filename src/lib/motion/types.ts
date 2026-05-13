import type { Frame, PixelGrid } from '../../types';

export type EasingType = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'bounce';

export type RegionType = 'body' | 'head' | 'arm' | 'leg' | 'accessory' | 'unknown';

export interface PixelRegion {
  id: string;
  pixels: { x: number; y: number }[];
  boundingBox: { x: number; y: number; width: number; height: number };
  center: { x: number; y: number };
  dominantColor: string | null;
  regionType: RegionType;
  verticalZone: 'upper' | 'middle' | 'lower';
  relativeSize: number; // 0-1, fraction of total sprite area
}

export interface SpriteAnalysis {
  regions: PixelRegion[];
  totalBounds: { x: number; y: number; width: number; height: number };
  centerOfMass: { x: number; y: number };
  outlinePixels: { x: number; y: number }[];
}

export interface SuggestionFrame {
  grid: PixelGrid;
  opacity: number;
  tint: string;
  editable?: boolean;
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

// --- Phase 3: Smart Tween Engine types ---

export interface RegionMatch {
  startRegion: PixelRegion;
  endRegion: PixelRegion;
  similarity: number; // 0-1
  offset: { dx: number; dy: number };
}

export interface PixelCorrespondence {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
}

export interface InterpolationConfig {
  frameCount: number;
  easing: EasingType;
  useRegionMatching: boolean;
  constraints: TweenConstraints;
}

export interface TweenConstraints {
  paletteLock: boolean;       // only use colors from source frames
  gridSnap: boolean;          // snap to integer pixel coords (always true for pixel art)
  preserveOutline: boolean;   // keep outline pixels connected
  maxDisplacement: number;    // max pixels a single pixel can move
}

export interface PaletteAnalysis {
  colors: string[];
  colorFrequency: Map<string, number>;
  primaryColors: string[];    // top N most used colors
}

export interface TemplateScore {
  templateId: string;
  score: number;       // 0-1 confidence
  reason: string;
}

export interface EditableSuggestion {
  grid: PixelGrid;
  opacity: number;
  tint: string;
  editable: true;
  editHistory: PixelGrid[];  // undo stack for per-frame edits
}
