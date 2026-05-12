import type { MotionTemplate } from '../types';
import { breathingTemplate } from './breathing';
import { bounceTemplate } from './bounce';
import { swingTemplate } from './swing';
import { flickerTemplate } from './flicker';
import { impactTemplate } from './impact';
import { fireTemplate } from './fire';

const templates: MotionTemplate[] = [
  breathingTemplate,
  bounceTemplate,
  swingTemplate,
  flickerTemplate,
  impactTemplate,
  fireTemplate,
];

export function getTemplate(id: string): MotionTemplate | undefined {
  return templates.find((t) => t.id === id);
}

export function getAllTemplates(): MotionTemplate[] {
  return templates;
}
