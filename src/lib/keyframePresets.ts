import type { LayerKeyframes } from '../types/project'

/** Normalized keyframe times (0–1). Scaled to layer duration on apply. */
export const KEYFRAME_PRESETS: { id: string; label: string; keyframes: LayerKeyframes }[] = [
  {
    id: 'ken-burns',
    label: 'Ken Burns',
    keyframes: {
      name: 'Ken Burns',
      tracks: [
        {
          property: 'scale',
          keyframes: [
            { t: 0, value: 1, easing: 'linear' },
            { t: 1, value: 1.15, easing: 'easeInOut' },
          ],
        },
        {
          property: 'x',
          keyframes: [
            { t: 0, value: 0, easing: 'linear' },
            { t: 1, value: -40, easing: 'easeInOut' },
          ],
        },
        {
          property: 'y',
          keyframes: [
            { t: 0, value: 0, easing: 'linear' },
            { t: 1, value: -24, easing: 'easeInOut' },
          ],
        },
      ],
    },
  },
  {
    id: 'fade-pulse',
    label: 'Fade Pulse',
    keyframes: {
      name: 'Fade Pulse',
      tracks: [
        {
          property: 'opacity',
          keyframes: [
            { t: 0, value: 0, easing: 'easeOut' },
            { t: 0.25, value: 1, easing: 'easeInOut' },
            { t: 0.75, value: 1, easing: 'linear' },
            { t: 1, value: 0, easing: 'easeIn' },
          ],
        },
      ],
    },
  },
  {
    id: 'slide-across',
    label: 'Slide Across',
    keyframes: {
      name: 'Slide Across',
      tracks: [
        {
          property: 'x',
          keyframes: [
            { t: 0, value: -120, easing: 'easeOut' },
            { t: 0.35, value: 0, easing: 'easeInOut' },
            { t: 0.65, value: 0, easing: 'linear' },
            { t: 1, value: 120, easing: 'easeIn' },
          ],
        },
        {
          property: 'opacity',
          keyframes: [
            { t: 0, value: 0, easing: 'easeOut' },
            { t: 0.2, value: 1, easing: 'linear' },
            { t: 0.8, value: 1, easing: 'linear' },
            { t: 1, value: 0, easing: 'easeIn' },
          ],
        },
      ],
    },
  },
  {
    id: 'zoom-in-hold',
    label: 'Zoom In',
    keyframes: {
      name: 'Zoom In',
      tracks: [
        {
          property: 'scale',
          keyframes: [
            { t: 0, value: 0.85, easing: 'easeOut' },
            { t: 0.4, value: 1.08, easing: 'easeInOut' },
            { t: 1, value: 1.08, easing: 'linear' },
          ],
        },
        {
          property: 'opacity',
          keyframes: [
            { t: 0, value: 0, easing: 'easeOut' },
            { t: 0.25, value: 1, easing: 'linear' },
          ],
        },
      ],
    },
  },
  {
    id: 'bounce-float',
    label: 'Bounce Float',
    keyframes: {
      name: 'Bounce Float',
      tracks: [
        {
          property: 'y',
          keyframes: [
            { t: 0, value: 40, easing: 'easeOut' },
            { t: 0.3, value: -12, easing: 'easeOut' },
            { t: 0.5, value: 0, easing: 'easeInOut' },
            { t: 0.75, value: -8, easing: 'easeInOut' },
            { t: 1, value: 0, easing: 'easeOut' },
          ],
        },
        {
          property: 'opacity',
          keyframes: [
            { t: 0, value: 0, easing: 'easeOut' },
            { t: 0.15, value: 1, easing: 'linear' },
          ],
        },
      ],
    },
  },
  {
    id: 'spin-in',
    label: 'Spin In',
    keyframes: {
      name: 'Spin In',
      tracks: [
        {
          property: 'rotation',
          keyframes: [
            { t: 0, value: -90, easing: 'easeOut' },
            { t: 0.45, value: 0, easing: 'easeInOut' },
          ],
        },
        {
          property: 'scale',
          keyframes: [
            { t: 0, value: 0.5, easing: 'easeOut' },
            { t: 0.45, value: 1, easing: 'easeInOut' },
          ],
        },
        {
          property: 'opacity',
          keyframes: [
            { t: 0, value: 0, easing: 'easeOut' },
            { t: 0.3, value: 1, easing: 'linear' },
          ],
        },
      ],
    },
  },
  {
    id: 'drift-up',
    label: 'Drift Up',
    keyframes: {
      name: 'Drift Up',
      tracks: [
        {
          property: 'y',
          keyframes: [
            { t: 0, value: 30, easing: 'easeOut' },
            { t: 1, value: -30, easing: 'easeInOut' },
          ],
        },
        {
          property: 'opacity',
          keyframes: [
            { t: 0, value: 0.6, easing: 'linear' },
            { t: 0.5, value: 1, easing: 'linear' },
            { t: 1, value: 0.6, easing: 'linear' },
          ],
        },
      ],
    },
  },
  {
    id: 'none',
    label: 'Clear',
    keyframes: { tracks: [] },
  },
]
