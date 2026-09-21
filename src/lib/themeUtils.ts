import type { Layer, OverlayStyle, ProjectTheme, TextStyle, VideoProject } from '../types/project'

export function resolveProjectBackground(project: VideoProject): string {
  return project.backgroundColor ?? project.theme?.colors?.background ?? '#000000'
}

export function mergeTextStyle(
  theme: ProjectTheme | undefined,
  layerStyle: TextStyle | undefined,
  overrides: TextStyle = {},
): TextStyle {
  return {
    fontFamily: layerStyle?.fontFamily ?? theme?.fonts?.heading ?? theme?.fonts?.body,
    fontSize: layerStyle?.fontSize,
    fontWeight: layerStyle?.fontWeight,
    color: layerStyle?.color ?? theme?.colors?.text ?? '#ffffff',
    align: layerStyle?.align,
    baseline: layerStyle?.baseline,
    letterSpacing: layerStyle?.letterSpacing,
    shadow: layerStyle?.shadow,
    ...overrides,
  }
}

export function mergeOverlayStyle(
  theme: ProjectTheme | undefined,
  layerStyle: OverlayStyle | undefined,
  overrides: OverlayStyle = {},
): OverlayStyle {
  return {
    ...mergeTextStyle(theme, layerStyle, overrides),
    backgroundColor: layerStyle?.backgroundColor ?? theme?.colors?.primary,
    borderRadius: layerStyle?.borderRadius ?? theme?.radius,
    padding: layerStyle?.padding ?? theme?.spacing,
    borderColor: layerStyle?.borderColor,
    borderWidth: layerStyle?.borderWidth,
    ...overrides,
  }
}

export function isVisualLayer(layer: Layer): boolean {
  return layer.type !== 'audio'
}
