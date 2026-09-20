import type { EasingType } from '../types/project'

export function applyEasing(t: number, easing: EasingType = 'easeInOut'): number {
  const clamped = Math.max(0, Math.min(1, t))

  switch (easing) {
    case 'linear':
      return clamped
    case 'easeIn':
      return clamped * clamped
    case 'easeOut':
      return 1 - (1 - clamped) * (1 - clamped)
    case 'easeInOut':
    default:
      return clamped < 0.5
        ? 2 * clamped * clamped
        : 1 - Math.pow(-2 * clamped + 2, 2) / 2
  }
}

export function bounceOut(t: number): number {
  const n1 = 7.5625
  const d1 = 2.75
  if (t < 1 / d1) return n1 * t * t
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375
  return n1 * (t -= 2.625 / d1) * t + 0.984375
}
