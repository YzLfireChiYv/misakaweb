/**
 * Derived from Bilibili-Evolved player-gestures/swiper.ts at
 * fa06dcec095dbccaba82f50ae2318c8d61c26671 (MIT; see LICENCE.md).
 * Direction/three-band sensitivity are retained; threshold is sign symmetric.
 * Support: https://github.com/YzLfireChiYv/misakaweb/issues
 */
export type GestureDirection = 'horizontal' | 'vertical'

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export function gestureDirection(dx: number, dy: number, threshold: number): GestureDirection | null {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return null
    if (Math.abs(dx) > Math.abs(dy) * 1.15) return 'horizontal'
    if (Math.abs(dy) > Math.abs(dx) * 1.15) return 'vertical'
    return null
}

export function seekDelta(dx: number, startYRatio: number, threshold: number, scale: number) {
    const speed = startYRatio < 1 / 3 ? 0.05 : startYRatio <= 2 / 3 ? 0.2 : 1
    return Math.sign(dx) * Math.max(0, Math.abs(dx) - threshold) * speed * scale
}

export function verticalDelta(dy: number, height: number, threshold: number) {
    return (-Math.sign(dy) * Math.max(0, Math.abs(dy) - threshold) * 2) / (1.5 * Math.max(1, height))
}

export function seekTarget(start: number, delta: number, duration: number) {
    if (!Number.isFinite(duration) || duration <= 0) return null
    return clamp(start + delta, 0, duration)
}
