/**
 * MisakaWeb adapter for Evolved's touch gesture trajectory/sensitivity.
 * Upstream: the1812/Bilibili-Evolved, fa06dcec095dbccaba82f50ae2318c8d61c26671.
 * See gesture-math.ts / LICENCE.md. Settings, DOM preview and disposal are ours.
 */
import { clamp, gestureDirection, seekDelta, seekTarget, verticalDelta, type GestureDirection } from './gesture-math'

export interface GestureOptions {
    minDistance: number
    seekScale: number
    vertical: boolean
}

const VIDEO_SELECTOR = '.bpx-player-container video, .bilibili-player-video video'
const SURFACE_SELECTOR = '.bpx-player-video-wrap, .bilibili-player-video-wrap'
const INTERACTIVE_SELECTOR =
    'a, button, input, textarea, select, [contenteditable="true"], [role="button"], [role="slider"], ' +
    '.bpx-player-control-wrap, .bpx-player-ctrl-btn, .bpx-player-progress-wrap, .bpx-player-setting-panel, ' +
    '.bpx-player-contextmenu, .bpx-player-ending-wrap, .bilibili-player-video-control, .bilibili-player-video-popup'

interface Gesture {
    id: number
    x: number
    y: number
    yRatio: number
    left: boolean
    height: number
    startTime: number
    startVolume: number
    startBrightness: number
    direction: GestureDirection | null
    target: number | null
    canceled: boolean
    options: GestureOptions
}

function formatTime(seconds: number) {
    const s = Math.max(0, Math.floor(seconds))
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Binding has no global side effects. All listeners, preview and owned filter are removable. */
class PlayerGestureBinding {
    private gesture: Gesture | null = null
    private overlay: HTMLDivElement | null = null
    private frame = 0
    private pendingText = ''
    private brightness = 1
    private filterBefore: string
    private filterPriority: string
    private baseFilter = ''
    private ownedFilter: string | null = null
    private suppressClickUntil = 0

    constructor(
        readonly video: HTMLVideoElement,
        readonly surface: HTMLElement,
        private readonly options: () => GestureOptions,
    ) {
        this.filterBefore = video.style.getPropertyValue('filter')
        this.filterPriority = video.style.getPropertyPriority('filter')
        surface.addEventListener('touchstart', this.onStart, { passive: true, capture: true })
        surface.addEventListener('touchmove', this.onMove, { passive: false, capture: true })
        surface.addEventListener('touchend', this.onEnd, { passive: false, capture: true })
        surface.addEventListener('touchcancel', this.onCancel, { passive: true, capture: true })
        surface.addEventListener('click', this.onClick, true)
        video.addEventListener('emptied', this.onCancel)
    }

    private interactive(target: EventTarget | null) {
        return target instanceof Element && !!target.closest(INTERACTIVE_SELECTOR)
    }

    private onStart = (event: TouchEvent) => {
        this.cancel()
        if (event.touches.length !== 1 || this.interactive(event.target)) return
        const point = event.touches[0]
        const rect = this.surface.getBoundingClientRect()
        if (!rect.width || !rect.height) return
        this.gesture = {
            id: point.identifier,
            x: point.clientX,
            y: point.clientY,
            yRatio: clamp((point.clientY - rect.top) / rect.height, 0, 1),
            left: point.clientX < rect.left + rect.width / 2,
            height: rect.height,
            startTime: this.video.currentTime,
            startVolume: this.video.volume,
            startBrightness: this.brightness,
            direction: null,
            target: null,
            canceled: false,
            options: this.options(),
        }
    }

    private onMove = (event: TouchEvent) => {
        const state = this.gesture
        if (!state) return
        if (event.touches.length !== 1 || event.touches[0].identifier !== state.id) {
            this.cancel()
            return
        }
        if (state.canceled) return
        const point = event.touches[0]
        const dx = point.clientX - state.x
        const dy = point.clientY - state.y
        const options = state.options
        state.direction ??= gestureDirection(dx, dy, options.minDistance)
        if (!state.direction) return
        if (state.direction === 'vertical' && !options.vertical) {
            state.canceled = true
            return
        }
        if (!event.cancelable) {
            this.cancel()
            return
        }
        // Native controls keep their own touch handling; only an accepted canvas gesture is consumed.
        event.preventDefault()
        event.stopPropagation()
        if (state.direction === 'horizontal') {
            const delta = seekDelta(dx, state.yRatio, options.minDistance, options.seekScale)
            state.target = seekTarget(state.startTime, delta, this.video.duration)
            if (state.target === null) {
                this.preview('当前视频尚未取得时长，无法调整进度')
                return
            }
            const mode = state.yRatio < 1 / 3 ? '精细' : state.yRatio <= 2 / 3 ? '中速' : '快速'
            const difference = state.target - state.startTime
            this.preview(
                `${mode}调节  ${difference >= 0 ? '+' : ''}${difference.toFixed(1)} 秒\n` +
                    `${formatTime(state.target)} / ${formatTime(this.video.duration)}\n松开跳转 · 多指触摸取消`,
            )
        } else {
            const delta = verticalDelta(dy, state.height, options.minDistance)
            state.target = state.left
                ? clamp(state.startBrightness + delta, 0.2, 2)
                : clamp(state.startVolume + delta, 0, 1)
            this.preview(
                `${state.left ? '画面亮度' : '音量'}  ${Math.round(state.target * 100)}%\n` +
                    '松开应用 · 多指触摸取消',
            )
        }
    }

    private onEnd = (event: TouchEvent) => {
        const state = this.gesture
        if (!state) return
        if (event.touches.length || !Array.from(event.changedTouches).some((touch) => touch.identifier === state.id)) {
            this.cancel()
            return
        }
        const accepted = !!state.direction && !state.canceled
        if (accepted) {
            if (event.cancelable) event.preventDefault()
            event.stopPropagation()
            this.suppressClickUntil = performance.now() + 500
            if (state.target !== null) {
                try {
                    if (state.direction === 'horizontal') {
                        // Setting currentTime preserves paused/playing state and avoids an upstream runtime dependency.
                        this.video.currentTime = state.target
                    } else if (state.left) {
                        this.applyBrightness(state.target)
                    } else {
                        this.video.volume = state.target
                        if (state.target > 0) this.video.muted = false
                    }
                } catch {
                    // Some tablet browsers do not permit programmatic volume changes.
                }
            }
        }
        this.cancel()
    }

    private onClick = (event: MouseEvent) => {
        if (performance.now() <= this.suppressClickUntil && !this.interactive(event.target)) {
            event.preventDefault()
            event.stopPropagation()
        }
    }

    private onCancel = () => this.cancel()

    private applyBrightness(value: number) {
        const current = this.video.style.getPropertyValue('filter')
        if (this.ownedFilter === null || current !== this.ownedFilter) {
            // Keep another script's newer filter instead of restoring an obsolete copy.
            this.filterBefore = current
            this.filterPriority = this.video.style.getPropertyPriority('filter')
            const effectiveFilter = current || getComputedStyle(this.video).filter
            this.baseFilter = effectiveFilter === 'none' ? '' : effectiveFilter
        }
        this.brightness = value
        this.ownedFilter = `${this.baseFilter} brightness(${value})`.trim()
        this.video.style.setProperty('filter', this.ownedFilter, this.filterPriority)
    }

    private preview(text: string) {
        this.pendingText = text
        if (this.frame) return
        this.frame = requestAnimationFrame(() => {
            this.frame = 0
            if (!this.gesture) return
            if (!this.overlay) {
                this.overlay = document.createElement('div')
                this.overlay.className = 'misakaweb-touch-preview'
                this.overlay.setAttribute('role', 'status')
                Object.assign(this.overlay.style, {
                    position: 'fixed',
                    pointerEvents: 'none',
                    zIndex: '2147483646',
                    transform: 'translate(-50%, -50%)',
                    padding: '14px 20px',
                    borderRadius: '10px',
                    color: '#fff',
                    background: 'rgba(0, 0, 0, .78)',
                    font: '14px/1.7 system-ui, sans-serif',
                    textAlign: 'center',
                    whiteSpace: 'pre-line',
                    maxWidth: 'min(80vw, 420px)',
                    boxSizing: 'border-box',
                })
            }
            const fullscreen = document.fullscreenElement
            const mount = fullscreen instanceof HTMLElement && fullscreen.contains(this.video) ? fullscreen : document.body
            if (this.overlay.parentElement !== mount) mount?.appendChild(this.overlay)
            const rect = this.surface.getBoundingClientRect()
            this.overlay.style.left = `${rect.left + rect.width / 2}px`
            this.overlay.style.top = `${rect.top + rect.height / 2}px`
            this.overlay.textContent = this.pendingText
        })
    }

    cancel() {
        this.gesture = null
        if (this.frame) cancelAnimationFrame(this.frame)
        this.frame = 0
        this.overlay?.remove()
        this.overlay = null
    }

    dispose() {
        this.cancel()
        this.surface.removeEventListener('touchstart', this.onStart, true)
        this.surface.removeEventListener('touchmove', this.onMove, true)
        this.surface.removeEventListener('touchend', this.onEnd, true)
        this.surface.removeEventListener('touchcancel', this.onCancel, true)
        this.surface.removeEventListener('click', this.onClick, true)
        this.video.removeEventListener('emptied', this.onCancel)
        if (this.ownedFilter !== null && this.video.style.getPropertyValue('filter') === this.ownedFilter) {
            if (this.filterBefore) this.video.style.setProperty('filter', this.filterBefore, this.filterPriority)
            else this.video.style.removeProperty('filter')
        }
    }
}

/** One current player binding; disabled means no observer, timers or input listeners. */
export class TouchGestureController {
    private binding: PlayerGestureBinding | null = null
    private observer: MutationObserver | null = null
    private enabled = false
    private scanQueued = false

    constructor(private readonly options: () => GestureOptions) {}

    enable() {
        if (this.enabled) return
        this.enabled = true
        this.observer = new MutationObserver((records) => {
            // Avoid rescanning for subtitles, comments and preview text mutations.
            const relevant = records.some((record) => {
                if (this.binding && !this.binding.video.isConnected) return true
                return Array.from(record.addedNodes).some(
                    (node) =>
                        node instanceof Element &&
                        (node.matches('video, .bpx-player-container, .bpx-player-video-wrap, .bilibili-player-video') ||
                            !!node.querySelector(VIDEO_SELECTOR)),
                )
            })
            if (relevant) this.queueScan()
        })
        this.observer.observe(document.documentElement, { childList: true, subtree: true })
        document.addEventListener('fullscreenchange', this.onFullscreen)
        window.addEventListener('resize', this.onResize, { passive: true })
        this.scan()
    }

    disable() {
        this.enabled = false
        this.observer?.disconnect()
        this.observer = null
        document.removeEventListener('fullscreenchange', this.onFullscreen)
        window.removeEventListener('resize', this.onResize)
        this.binding?.dispose()
        this.binding = null
    }

    private onFullscreen = () => {
        this.binding?.cancel()
        this.queueScan()
    }

    private onResize = () => this.binding?.cancel()

    private queueScan() {
        if (this.scanQueued || !this.enabled) return
        this.scanQueued = true
        queueMicrotask(() => {
            this.scanQueued = false
            if (this.enabled) this.scan()
        })
    }

    private scan() {
        const candidates = Array.from(document.querySelectorAll<HTMLVideoElement>(VIDEO_SELECTOR))
        const video = candidates.find((candidate) => candidate.getBoundingClientRect().width > 0) ?? candidates[0]
        const surface = video?.closest<HTMLElement>(SURFACE_SELECTOR) ?? video?.parentElement
        if (video === this.binding?.video && surface === this.binding?.surface) return
        this.binding?.dispose()
        this.binding = video && surface ? new PlayerGestureBinding(video, surface, this.options) : null
    }
}
