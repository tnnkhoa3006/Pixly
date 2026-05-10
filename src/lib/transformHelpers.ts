import type { LayerTransform, ToolType } from '../types';

export const FRAME_TRANSFORM_TOOLS = ['frame-move', 'frame-rotate', 'frame-scale'] as const;
export type FrameTransformTool = (typeof FRAME_TRANSFORM_TOOLS)[number];

export type TransformSession = {
  tool: FrameTransformTool;
  anchorLayerId: string;
  startPointer: { x: number; y: number };
  origin: { x: number; y: number };
  startAngle: number;
  startDistance: number;
  initialTransforms: Record<string, LayerTransform>;
};

export type TransformMetrics = {
  deltaGridX: number;
  deltaGridY: number;
  deltaAngle: number;
  scaleFactor: number;
};

export type TransformHud = {
  tool: FrameTransformTool;
  title: string;
  value: string;
  meta: string;
  hint: string;
  pointer: { x: number; y: number };
  origin: { x: number; y: number };
};

export const isFrameTransformTool = (tool: ToolType): tool is FrameTransformTool =>
  FRAME_TRANSFORM_TOOLS.includes(tool as FrameTransformTool);

export const roundTo = (value: number, decimals = 2) => Number(value.toFixed(decimals));

export const clampScale = (value: number) => Math.max(0.1, Math.min(5, roundTo(value, 3)));

export const snapScale = (value: number) => {
  if (value >= 1) return Math.min(5, Math.round(value));
  if (value >= 0.75) return 1;
  if (value >= 0.35) return 0.5;
  if (value >= 0.15) return 0.25;
  return 0.1;
};

export const wrapDegrees = (value: number) => {
  let wrapped = value % 360;
  if (wrapped > 180) wrapped -= 360;
  if (wrapped <= -180) wrapped += 360;
  return roundTo(wrapped, 1);
};

export const formatSigned = (value: number, decimals = 1) => `${value >= 0 ? '+' : ''}${roundTo(value, decimals)}`;
export const formatPlain = (value: number, decimals = 1) => `${roundTo(value, decimals)}`;

export const getFrameToolTitle = (tool: FrameTransformTool) => {
  if (tool === 'frame-move') return 'Move';
  if (tool === 'frame-rotate') return 'Rotate';
  return 'Scale';
};

export const getFrameToolHint = (tool: FrameTransformTool) => {
  if (tool === 'frame-move') return 'Drag to move selected layers';
  if (tool === 'frame-rotate') return 'Drag around the center pivot';
  return 'Drag away from or toward the center pivot';
};

export const buildTransformHud = (
  tool: FrameTransformTool,
  transform: LayerTransform,
  metrics: TransformMetrics,
  pointer: { x: number; y: number },
  origin: { x: number; y: number },
  selectedCount: number,
): TransformHud => {
  const countLabel = `${selectedCount} layer${selectedCount === 1 ? '' : 's'}`;

  if (tool === 'frame-move') {
    return {
      tool,
      title: getFrameToolTitle(tool),
      value: `X ${formatSigned(metrics.deltaGridX)}  Y ${formatSigned(metrics.deltaGridY)}`,
      meta: `Pos ${formatPlain(transform.x)}, ${formatPlain(transform.y)} | ${countLabel}`,
      hint: getFrameToolHint(tool),
      pointer,
      origin,
    };
  }

  if (tool === 'frame-rotate') {
    return {
      tool,
      title: getFrameToolTitle(tool),
      value: `${formatPlain(transform.rotation)} deg`,
      meta: `Delta ${formatSigned(metrics.deltaAngle)} deg | ${countLabel}`,
      hint: getFrameToolHint(tool),
      pointer,
      origin,
    };
  }

  return {
    tool,
    title: getFrameToolTitle(tool),
    value: `${Math.round(transform.scale * 100)}%`,
    meta: `${formatPlain(transform.scale, 2)}x | ${countLabel}`,
    hint: getFrameToolHint(tool),
    pointer,
    origin,
  };
};
