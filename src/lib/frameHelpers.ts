import type { Layer, PixelGrid, Frame, LayerTransform } from '../types';

export const generateId = (): string =>
  Math.random().toString(36).substring(2, 9);

export const createEmptyGrid = (size: number): PixelGrid =>
  Array(size).fill(null).map(() => Array(size).fill(null));

export const createDefaultTransform = (): LayerTransform => ({
  x: 0,
  y: 0,
  rotation: 0,
  scale: 1,
});

/** Deep clone a layer array — copies every pixel row */
export const cloneLayers = (layersArray: Layer[]): Layer[] =>
  layersArray.map(layer => ({
    ...layer,
    grid: layer.grid.map(row => [...row]),
    transform: { ...layer.transform }
  }));

/** Deep clone a frame — clones all layers + copies transform */
export const cloneFrame = (frame: Frame): Frame => ({
  id: generateId(),
  layers: cloneLayers(frame.layers),
  duration: frame.duration,
});

/**
 * Shallow clone a frame — shares layer *references* for fast duplication.
 * The layer objects themselves are shared, not deep-copied.
 * Pixel edits on the duplicate will need to copy-on-write.
 */
export const shallowCloneFrame = (frame: Frame): Frame => ({
  id: generateId(),
  layers: frame.layers.map(l => ({
    ...l,
    id: generateId(),
    grid: l.grid.map(row => [...row]),
    transform: { ...l.transform }
  })),
  duration: frame.duration,
});

/** Create a blank frame with one empty layer */
export const createDefaultFrame = (gridSize: number): Frame => {
  const layerId = generateId();
  return {
    id: generateId(),
    layers: [{
      id: layerId,
      name: 'Layer 1',
      visible: true,
      opacity: 1,
      grid: createEmptyGrid(gridSize),
      transform: createDefaultTransform(),
    }],
    duration: 100,
  };
};

/**
 * Bakes the layer's transform (translate, rotate, scale) into its pixel grid.
 * Returns a new layer object with the updated grid and a reset transform.
 */
export const bakeLayerTransform = (layer: Layer, gridSize: number): Layer => {
  if (
    layer.transform.x === 0 &&
    layer.transform.y === 0 &&
    layer.transform.rotation === 0 &&
    layer.transform.scale === 1
  ) {
    return layer;
  }

  const newGrid = createEmptyGrid(gridSize);
  const cx = gridSize / 2;
  const cy = gridSize / 2;
  const cos = Math.cos((-layer.transform.rotation * Math.PI) / 180);
  const sin = Math.sin((-layer.transform.rotation * Math.PI) / 180);

  for (let ny = 0; ny < gridSize; ny++) {
    for (let nx = 0; nx < gridSize; nx++) {
      // 1. Inverse translate
      let ox = nx - layer.transform.x;
      let oy = ny - layer.transform.y;

      // 2. Inverse rotate around center
      if (layer.transform.rotation !== 0) {
        const dx = ox - cx;
        const dy = oy - cy;
        ox = cx + dx * cos - dy * sin;
        oy = cy + dx * sin + dy * cos;
      }

      // 3. Inverse scale around center
      if (layer.transform.scale !== 1) {
        const dx = ox - cx;
        const dy = oy - cy;
        ox = cx + dx / layer.transform.scale;
        oy = cy + dy / layer.transform.scale;
      }

      // Nearest neighbor
      const srcX = Math.floor(ox);
      const srcY = Math.floor(oy);

      if (srcX >= 0 && srcX < gridSize && srcY >= 0 && srcY < gridSize) {
        newGrid[ny][nx] = layer.grid[srcY][srcX];
      }
    }
  }

  return {
    ...layer,
    grid: newGrid,
    transform: createDefaultTransform(),
  };
};
