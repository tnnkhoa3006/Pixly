import type { EasingType } from './types';

const easings: Record<EasingType, (t: number) => number> = {
  linear: (t) => t,

  easeIn: (t) => t * t,

  easeOut: (t) => 1 - (1 - t) * (1 - t),

  easeInOut: (t) =>
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,

  bounce: (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

export function getEasing(type: EasingType): (t: number) => number {
  return easings[type] ?? easings.linear;
}

export function pingPong(t: number): number {
  return t < 0.5 ? t * 2 : 2 - t * 2;
}
