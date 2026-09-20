import type { EffectConfig } from '../types/project'

export function applyCanvasEffects(
  ctx: CanvasRenderingContext2D,
  effects: EffectConfig[] | undefined,
  draw: () => void,
): void {
  if (!effects?.length) {
    draw()
    return
  }

  const filters: string[] = []
  let hasVignette = false
  let hasGlow = false
  let vignetteIntensity = 0.5
  let glowIntensity = 0.5

  for (const effect of effects) {
    switch (effect.type) {
      case 'blur':
        filters.push(`blur(${effect.value ?? 4}px)`)
        break
      case 'brightness':
        filters.push(`brightness(${effect.value ?? 1.2})`)
        break
      case 'contrast':
        filters.push(`contrast(${effect.value ?? 1.2})`)
        break
      case 'grayscale':
        filters.push(`grayscale(${effect.value ?? 1})`)
        break
      case 'sepia':
        filters.push(`sepia(${effect.value ?? 0.8})`)
        break
      case 'vignette':
        hasVignette = true
        vignetteIntensity = effect.intensity ?? 0.5
        break
      case 'glow':
        hasGlow = true
        glowIntensity = effect.intensity ?? 0.5
        break
    }
  }

  ctx.save()
  if (filters.length) {
    ctx.filter = filters.join(' ')
  }

  if (hasGlow) {
    ctx.shadowColor = `rgba(255, 200, 100, ${glowIntensity})`
    ctx.shadowBlur = 24 * glowIntensity
  }

  draw()

  ctx.restore()

  if (hasVignette) {
    const { width, height } = ctx.canvas
    const gradient = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.2,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.7,
    )
    gradient.addColorStop(0, 'rgba(0,0,0,0)')
    gradient.addColorStop(1, `rgba(0,0,0,${vignetteIntensity})`)
    ctx.save()
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
    ctx.restore()
  }
}
