import type { VideoProject } from '../types/project'
import { createGradientDataUrl } from '../engine/assetLoader'
import { normalizeProjectKeyframes } from '../lib/keyframes'

const W = 1280
const H = 720

const scene1 = createGradientDataUrl(W, H, ['#1a1a2e', '#16213e'], 'Scene 1')
const scene2 = createGradientDataUrl(W, H, ['#0f3460', '#533483'], 'Scene 2')
const scene3 = createGradientDataUrl(W, H, ['#e94560', '#ff6b6b'], 'Scene 3')

export const sampleProject: VideoProject = {
  name: 'Demo Reel',
  width: W,
  height: H,
  fps: 30,
  duration: 12,
  backgroundColor: '#0a0a0f',
  layers: [
    {
      id: 'bg-1',
      type: 'image',
      src: scene1,
      start: 0,
      duration: 4,
      width: W,
      height: H,
      zIndex: 0,
      transition: { in: 'fade', out: 'slideLeft', duration: 0.8 },
      effects: [{ type: 'vignette', intensity: 0.4 }],
      keyframes: {
        name: 'Ken Burns',
        tracks: [
          {
            property: 'scale',
            keyframes: [
              { t: 0, value: 1, easing: 'linear' },
              { t: 4, value: 1.15, easing: 'easeInOut' },
            ],
          },
          {
            property: 'x',
            keyframes: [
              { t: 0, value: 0, easing: 'linear' },
              { t: 4, value: -40, easing: 'easeInOut' },
            ],
          },
          {
            property: 'y',
            keyframes: [
              { t: 0, value: 0, easing: 'linear' },
              { t: 4, value: -24, easing: 'easeInOut' },
            ],
          },
        ],
      },
    },
    {
      id: 'bg-2',
      type: 'image',
      src: scene2,
      start: 3.2,
      duration: 4,
      width: W,
      height: H,
      zIndex: 0,
      transition: { in: 'slideRight', out: 'zoomOut', duration: 0.8 },
      effects: [{ type: 'brightness', value: 1.1 }],
    },
    {
      id: 'bg-3',
      type: 'image',
      src: scene3,
      start: 6.4,
      duration: 5.6,
      width: W,
      height: H,
      zIndex: 0,
      transition: { in: 'zoomIn', out: 'fade', duration: 0.8 },
      effects: [{ type: 'contrast', value: 1.15 }, { type: 'glow', intensity: 0.3 }],
    },
    {
      id: 'title-main',
      type: 'title',
      text: 'JSON Video Studio',
      start: 0.5,
      duration: 3,
      x: 0,
      y: H * 0.35,
      width: W,
      height: 120,
      zIndex: 10,
      animation: { in: 'slideInUp', out: 'fadeOut', duration: 0.7, easing: 'easeOut' },
      style: {
        fontSize: 72,
        fontWeight: '800',
        color: '#ffffff',
        align: 'center',
        shadow: { color: 'rgba(0,0,0,0.6)', blur: 16, offsetY: 4 },
      },
    },
    {
      id: 'subtitle',
      type: 'overlay',
      overlayType: 'text',
      text: 'Images · Transitions · Effects',
      start: 1.2,
      duration: 2.5,
      x: W * 0.25,
      y: H * 0.52,
      width: W * 0.5,
      height: 60,
      zIndex: 11,
      animation: { in: 'fadeIn', out: 'fadeOut', duration: 0.5 },
      keyframes: {
        name: 'Drift Up',
        tracks: [
          {
            property: 'y',
            keyframes: [
              { t: 0, value: 20, easing: 'easeOut' },
              { t: 2.5, value: -20, easing: 'easeInOut' },
            ],
          },
          {
            property: 'opacity',
            keyframes: [
              { t: 0, value: 0.5, easing: 'linear' },
              { t: 1.25, value: 1, easing: 'linear' },
              { t: 2.5, value: 0.7, easing: 'linear' },
            ],
          },
        ],
      },
      style: {
        fontSize: 28,
        color: '#e0e0ff',
        align: 'center',
        backgroundColor: 'rgba(0,0,0,0.35)',
        borderRadius: 30,
        padding: 12,
      },
    },
    {
      id: 'badge',
      type: 'overlay',
      overlayType: 'shape',
      shape: 'rectangle',
      start: 4,
      duration: 3,
      x: 40,
      y: 40,
      width: 180,
      height: 48,
      zIndex: 12,
      animation: { in: 'slideInLeft', out: 'slideInRight', duration: 0.6 },
      style: {
        backgroundColor: 'rgba(99, 102, 241, 0.85)',
        borderRadius: 8,
      },
    },
    {
      id: 'badge-text',
      type: 'overlay',
      overlayType: 'text',
      text: 'NEW',
      start: 4,
      duration: 3,
      x: 40,
      y: 40,
      width: 180,
      height: 48,
      zIndex: 13,
      style: {
        fontSize: 22,
        fontWeight: '700',
        color: '#ffffff',
        align: 'center',
      },
    },
    {
      id: 'logo-overlay',
      type: 'overlay',
      overlayType: 'image',
      src: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="24" fill="#6366f1"/><path d="M45 35 L85 60 L45 85 Z" fill="white"/><circle cx="85" cy="35" r="8" fill="#e94560"/></svg>',
      start: 4,
      duration: 3,
      x: W - 160,
      y: 40,
      width: 80,
      height: 80,
      zIndex: 14,
      animation: { in: 'scaleIn', out: 'scaleOut', duration: 0.5 },
    },
    {
      id: 'svg-path-demo',
      type: 'overlay',
      overlayType: 'image',
      src: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><circle cx="100" cy="100" r="90" fill="#e94560" opacity="0.9"/><text x="100" y="108" text-anchor="middle" font-family="system-ui" font-size="28" font-weight="700" fill="white">SVG</text></svg>',
      start: 8.5,
      duration: 3,
      x: W / 2 - 60,
      y: H * 0.62,
      width: 120,
      height: 120,
      zIndex: 16,
      animation: { in: 'bounce', duration: 0.8 },
    },
    {
      id: 'cta',
      type: 'title',
      text: 'Edit JSON → Preview → Export',
      start: 8,
      duration: 3.5,
      x: 0,
      y: H * 0.4,
      width: W,
      height: 100,
      zIndex: 20,
      animation: { in: 'bounce', duration: 0.9, easing: 'easeOut' },
      transition: { out: 'fade', duration: 0.6 },
      style: {
        fontSize: 48,
        fontWeight: '700',
        color: '#ffffff',
        align: 'center',
        shadow: { color: 'rgba(233,69,96,0.8)', blur: 20 },
      },
      effects: [{ type: 'glow', intensity: 0.6 }],
    },
    {
      id: 'lower-third',
      type: 'overlay',
      overlayType: 'text',
      text: 'Powered by Canvas + WebCodecs',
      start: 9,
      duration: 2.5,
      x: 40,
      y: H - 100,
      width: 400,
      height: 50,
      zIndex: 15,
      animation: { in: 'slideInUp', out: 'fadeOut', duration: 0.5 },
      style: {
        fontSize: 20,
        color: '#ffffff',
        align: 'left',
        backgroundColor: 'rgba(0,0,0,0.55)',
        borderRadius: 6,
        padding: 10,
      },
    },
  ],
}

export const sampleProjectJson = JSON.stringify(sampleProject, null, 2)

export function parseProjectJson(json: string): VideoProject {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('Invalid JSON syntax. The project must be one complete object with width, height, fps, duration, and layers[].')
  }

  const project = parsed as VideoProject

  if (!project.width || !project.height || !project.fps || !project.duration || !Array.isArray(project.layers)) {
    if (parsed && typeof parsed === 'object' && ('tracks' in (parsed as object) || 'keyframes' in (parsed as object))) {
      throw new Error(
        'This looks like a keyframe fragment, not a full project. Paste a complete project JSON, or put keyframes inside a layer in layers[].',
      )
    }
    throw new Error('Invalid project JSON: requires width, height, fps, duration, and layers[]')
  }

  return normalizeProjectKeyframes(project)
}
