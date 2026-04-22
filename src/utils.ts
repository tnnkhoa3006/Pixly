import type { Layer, PixelGrid, Frame, LayerTransform } from './types';

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
