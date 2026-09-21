export type TransitionType =
  | 'fade'
  | 'slideLeft'
  | 'slideRight'
  | 'slideUp'
  | 'slideDown'
  | 'zoomIn'
  | 'zoomOut'
  | 'wipeLeft'
  | 'wipeRight'

export type AnimationType =
  | 'fadeIn'
  | 'fadeOut'
  | 'slideInLeft'
  | 'slideInRight'
  | 'slideInUp'
  | 'slideInDown'
  | 'scaleIn'
  | 'scaleOut'
  | 'bounce'

export type EffectType =
  | 'blur'
  | 'brightness'
  | 'contrast'
  | 'grayscale'
  | 'sepia'
  | 'vignette'
  | 'glow'

export type EasingType = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'

export interface TransitionConfig {
  in?: TransitionType
  out?: TransitionType
  duration?: number
}

export interface AnimationConfig {
  in?: AnimationType
  out?: AnimationType
  duration?: number
  easing?: EasingType
}

export type KeyframeProperty =
  | 'opacity'
  | 'x'
  | 'y'
  | 'scale'
  | 'rotation'
  | 'width'
  | 'height'
  | 'color'
  | 'fontSize'
  | 'backgroundColor'

export type KeyframeValue = number | string

export interface Keyframe {
  /** Seconds from layer start */
  t: number
  value: KeyframeValue
  easing?: EasingType
}

export interface KeyframeTrack {
  property: KeyframeProperty
  keyframes: Keyframe[]
}

export interface LayerKeyframes {
  name?: string
  tracks: KeyframeTrack[]
}

export interface EffectConfig {
  type: EffectType
  value?: number
  intensity?: number
}

export interface TextStyle {
  fontFamily?: string
  fontSize?: number
  fontWeight?: string | number
  color?: string
  align?: CanvasTextAlign
  baseline?: CanvasTextBaseline
  letterSpacing?: number
  shadow?: {
    color?: string
    blur?: number
    offsetX?: number
    offsetY?: number
  }
}

export interface OverlayStyle extends TextStyle {
  backgroundColor?: string
  borderRadius?: number
  padding?: number
  borderColor?: string
  borderWidth?: number
}

export interface BaseLayer {
  id?: string
  start: number
  duration: number
  x?: number
  y?: number
  width?: number
  height?: number
  opacity?: number
  zIndex?: number
  rotation?: number
  transition?: TransitionConfig
  animation?: AnimationConfig
  keyframes?: LayerKeyframes
  effects?: EffectConfig[]
}

export interface ImageLayer extends BaseLayer {
  type: 'image'
  src: string
  fit?: 'cover' | 'contain' | 'fill'
}

export interface VideoLayer extends BaseLayer {
  type: 'video'
  src: string
  fit?: 'cover' | 'contain' | 'fill'
  trimStart?: number
  trimEnd?: number
  playbackRate?: number
  volume?: number
  loop?: boolean
}

export interface TitleLayer extends BaseLayer {
  type: 'title'
  text: string
  style?: TextStyle
}

export interface OverlayLayer extends BaseLayer {
  type: 'overlay'
  overlayType: 'text' | 'image' | 'shape'
  text?: string
  src?: string
  shape?: 'rectangle' | 'circle'
  style?: OverlayStyle
}

export interface AudioLayer extends BaseLayer {
  type: 'audio'
  src: string
  volume?: number
}

export type FlowNodeStyle = 'step' | 'card' | 'n8n'

export interface FlowNode {
  id: string
  /** step = numbered circle + label, card = white card + badge, n8n = automation node */
  style?: FlowNodeStyle
  label: string
  subtitle?: string
  number?: number | string
  x: number
  y: number
  width?: number
  height?: number
  /** Emoji or short icon label for n8n nodes */
  icon?: string
  /** Image src for thumbnail-style nodes */
  image?: string
  color?: string
}

export interface FlowEdge {
  from: string
  to: string
  /** Optional polyline waypoints between nodes (absolute coords) */
  points?: { x: number; y: number }[]
}

export type FlowAnimationMode = 'sequential' | 'parallel' | 'instant'

export interface FlowAnimationConfig {
  mode?: FlowAnimationMode
  /** Pause between steps (seconds) */
  stepDelay?: number
  /** Edge draw duration (seconds) */
  lineDuration?: number
  /** Node reveal duration (seconds) */
  nodeDuration?: number
  easing?: EasingType
  /** Reveal order: node ids and/or edge tokens like "edge:from->to" */
  sequence?: string[]
}

export interface FlowTheme {
  lineColor?: string
  lineWidth?: number
  badgeColor?: string
  cardBackground?: string
  cardBorder?: string
  n8nBackground?: string
  n8nBorder?: string
  labelColor?: string
  subtitleColor?: string
}

export interface ProjectTheme {
  fonts?: {
    body?: string
    heading?: string
  }
  colors?: {
    primary?: string
    secondary?: string
    text?: string
    background?: string
  }
  radius?: number
  spacing?: number
  motion?: {
    defaultDuration?: number
    defaultEasing?: EasingType
  }
}

export interface FlowLayer extends BaseLayer {
  type: 'flow'
  defaultNodeStyle?: FlowNodeStyle
  nodes: FlowNode[]
  edges: FlowEdge[]
  flowAnimation?: FlowAnimationConfig
  theme?: FlowTheme
}

export type Layer = ImageLayer | VideoLayer | TitleLayer | OverlayLayer | AudioLayer | FlowLayer

export interface Scene {
  id?: string
  name?: string
  duration: number
  layers: Layer[]
}

export interface VideoProject {
  schemaVersion?: string
  name?: string
  width: number
  height: number
  fps: number
  duration: number
  backgroundColor?: string
  theme?: ProjectTheme
  /** Root folder under repo projects/ for this video, e.g. "projects/demo-reel" */
  projectPath?: string
  /** Authoring format — compiled to flat layers[] at render time */
  scenes?: Scene[]
  layers: Layer[]
}

export interface LayerTransform {
  opacity: number
  x: number
  y: number
  scaleX: number
  scaleY: number
  rotation?: number
  clipPath?: Path2D
}

export interface KeyframeStyleOverrides {
  color?: string
  fontSize?: number
  backgroundColor?: string
}

export interface KeyframeBoundsOverrides {
  width?: number
  height?: number
}

export interface SelectedKeyframeRef {
  layerId: string
  property: KeyframeProperty
  t: number
}
