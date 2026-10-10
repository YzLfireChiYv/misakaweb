<template>
    <div
        ref="panel"
        :style="[panelStyle, style]"
        class="no-scrollbar fixed z-10000000 overflow-auto overscroll-none rounded-xl bg-white shadow-lg will-change-[top,left] select-none"
    >
        <div ref="bar" class="sticky top-0 z-10 w-full cursor-move bg-[#00AEEC] py-1.5 text-center">
            <div class="text-xl font-black text-white">{{ title }}</div>
            <span v-if="closeCode" class="pointer-events-none absolute top-1.5 right-10">
                <FeedbackBadge :code="closeCode" />
            </span>
            <button
                ref="closeBtn"
                type="button"
                class="absolute top-0 right-0 m-1 cursor-pointer border-0 bg-transparent p-0 text-white hover:rounded-full hover:bg-white/40"
                aria-label="关闭"
                @click.stop="emit('close')"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2.5"
                    stroke="currentColor"
                    class="size-8"
                >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
        <div class="no-scrollbar flex min-h-[calc(100%-2.5rem)] flex-1 flex-col p-2">
            <slot />
        </div>
    </div>
</template>

<script setup lang="ts">
import { Position, useDraggable, useWindowSize } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import FeedbackBadge from '@/feedback/Badge.vue'
import { actionLabel } from '@/feedback'
import { capPanelSize, centeredPanelPosition, clampPanelPosition, isCloseHandleEvent } from '@/utils/panelGeometry'

const emit = defineEmits(['close'])

const props = defineProps<{
    title: string
    widthPercent: number // 单位vw
    heightPercent: number // 单位vh
    minWidth: number // 单位px
    minHeight: number // 单位px
    closeAction?: string
    /** Opt-in: recenter using the current viewport whenever openToken changes. */
    centerOnOpen?: boolean
    openToken?: number
}>()

const closeCode = computed(() => (props.closeAction ? actionLabel(props.closeAction) : ''))

const panel = ref<HTMLElement | null>(null)
const bar = ref<HTMLElement | null>(null)
const closeBtn = ref<HTMLButtonElement | null>(null)

const windowSize = useWindowSize({ includeScrollbar: false })

const viewport = computed(() => ({
    width: windowSize.width.value,
    height: windowSize.height.value,
}))

const cappedSize = computed(() =>
    capPanelSize(viewport.value, {
        widthPercent: props.widthPercent,
        heightPercent: props.heightPercent,
        minWidth: props.minWidth,
        minHeight: props.minHeight,
    }),
)

const applyClamp = (pos: Position) => {
    const next = clampPanelPosition(pos, viewport.value, cappedSize.value)
    pos.x = next.x
    pos.y = next.y
}

const { x, y, style } = useDraggable(panel, {
    // 在bewly首页iframe内位置异常，强制在左上角显示
    initialValue: {
        x: Math.max(windowSize.width.value / 2 - cappedSize.value.width / 2, 0),
        y: Math.max(windowSize.height.value / 2 - cappedSize.value.height / 2, 0),
    },
    handle: computed(() => bar.value),
    preventDefault: true,
    onStart: (_pos, event) => {
        if (isCloseHandleEvent(event, closeBtn.value)) {
            return false
        }
    },
    onMove: (pos: Position) => {
        applyClamp(pos)
    },
})

watch([viewport, cappedSize], () => {
    const next = clampPanelPosition({ x: x.value, y: y.value }, viewport.value, cappedSize.value)
    if (x.value !== next.x) {
        x.value = next.x
    }
    if (y.value !== next.y) {
        y.value = next.y
    }
})

watch(
    () => (props.centerOnOpen ? props.openToken : undefined),
    (token) => {
        if (!props.centerOnOpen || token === undefined) {
            return
        }
        // A resize event may not have reached VueUse before a menu opens.
        // Measure now so this opening is centered in the current viewport.
        windowSize.width.value = document.documentElement.clientWidth || window.innerWidth
        windowSize.height.value = window.innerHeight
        const next = centeredPanelPosition(viewport.value, cappedSize.value)
        x.value = next.x
        y.value = next.y
    },
)

const panelStyle = computed(() => {
    return {
        width: cappedSize.value.width + 'px',
        height: cappedSize.value.height + 'px',
    }
})
</script>
