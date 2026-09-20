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
  effects?: EffectConfig[]
}

export interface ImageLayer extends BaseLayer {
  type: 'image'
  src: string
  fit?: 'cover' | 'contain' | 'fill'
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

export type Layer = ImageLayer | TitleLayer | OverlayLayer | AudioLayer

export interface VideoProject {
  name?: string
  width: number
  height: number
  fps: number
  duration: number
  backgroundColor?: string
  /** Root folder under repo projects/ for this video, e.g. "projects/demo-reel" */
  projectPath?: string
  layers: Layer[]
}

export interface LayerTransform {
  opacity: number
  x: number
  y: number
  scaleX: number
  scaleY: number
  clipPath?: Path2D
}
