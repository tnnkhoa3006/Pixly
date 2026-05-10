import type { StateCreator } from 'zustand';

const MIN_PIXEL_SIZE = 1;

export interface CanvasSlice {
  gridSize: number;
  pixelSize: number;
  pan: { x: number; y: number };
  hasCentered: boolean;

  setGridSize: (v: number) => void;
  setPixelSize: (v: number) => void;
  setPan: (v: { x: number; y: number }) => void;
  setHasCentered: (v: boolean) => void;
  handleZoom: (delta: number, mouseX: number, mouseY: number, transformContainer: HTMLDivElement | null) => void;
}

export const createCanvasSlice: StateCreator<CanvasSlice, [], [], CanvasSlice> = (set, get) => ({
  gridSize: 16,
  pixelSize: 32,
  pan: { x: 0, y: 0 },
  hasCentered: false,

  setGridSize: (v) => set({ gridSize: v }),
  setPixelSize: (v) => set({ pixelSize: v }),
  setPan: (v) => set({ pan: v }),
  setHasCentered: (v) => set({ hasCentered: v }),

  handleZoom: (delta, mouseX, mouseY, transformContainer) => {
    const { pixelSize, pan, gridSize } = get();
    const oldPixelSize = pixelSize;
    let newPixelSize = oldPixelSize;
    if (delta > 0) {
      newPixelSize = oldPixelSize < 8 ? oldPixelSize + 1 : oldPixelSize + 4;
      newPixelSize = Math.min(newPixelSize, 128);
    } else if (delta < 0) {
      newPixelSize = oldPixelSize <= 8 ? oldPixelSize - 1 : oldPixelSize - 4;
      newPixelSize = Math.max(newPixelSize, MIN_PIXEL_SIZE);
    }

    if (newPixelSize === oldPixelSize) return;

    const scale = newPixelSize / oldPixelSize;
    const logicalW = gridSize * oldPixelSize;
    const logicalH = gridSize * oldPixelSize;

    const targetX = Math.max(pan.x, Math.min(mouseX, pan.x + logicalW));
    const targetY = Math.max(pan.y, Math.min(mouseY, pan.y + logicalH));

    const newPan = {
      x: targetX - (targetX - pan.x) * scale,
      y: targetY - (targetY - pan.y) * scale,
    };

    if (transformContainer) {
      transformContainer.style.transform = `translate(${newPan.x}px, ${newPan.y}px)`;
    }

    set({ pixelSize: newPixelSize, pan: newPan });
  },
});
