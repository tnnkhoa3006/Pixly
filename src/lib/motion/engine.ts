import type { Frame } from '../../types';
import type { SuggestionFrame, MotionConfig } from './types';
import { getTemplate } from './templates';
import { generateId, createDefaultTransform } from '../frameHelpers';

export function generateSuggestions(
  templateId: string,
  startFrame: Frame,
  endFrame: Frame | null,
  config: MotionConfig,
  gridSize: number,
): SuggestionFrame[] {
  const template = getTemplate(templateId);
  if (!template) return [];

  const mergedConfig: MotionConfig = {
    ...template.defaultConfig,
    ...config,
    templateId,
  };

  return template.generate(startFrame, endFrame, mergedConfig, gridSize);
}

export function suggestionsToFrames(
  suggestions: SuggestionFrame[],
  layerName: string,
  duration: number,
): Frame[] {
  return suggestions.map((suggestion) => ({
    id: generateId(),
    layers: [{
      id: generateId(),
      name: layerName,
      visible: true,
      opacity: 1,
      grid: suggestion.grid.map((row) => [...row]),
      transform: createDefaultTransform(),
    }],
    duration,
  }));
}
