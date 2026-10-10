<template>
    <div
        class="group fixed flex flex-col justify-end will-change-[right,bottom] select-none"
        v-if="floatingVisible"
        ref="target"
        :style="{ right: btnPos.right + 'px', bottom: btnPos.bottom + 'px' }"
        :class="[
            isDarkMode ? 'text-white/50 hover:text-white' : 'text-black/50 hover:text-black',
            isPageBangumi() || isPageVideo() ? 'z-100' : 'z-2000',
        ]"
    >
        <div
            class="relative mt-1 h-10 w-10 cursor-pointer items-center justify-center rounded-lg border transition-colors hover:border-none hover:bg-[#00AEEC] hover:text-white"
            v-for="(btn, index) in visibleButtons"
            :key="index"
            :class="[
                // 主题
                isDarkMode ? 'border-[#2f3134] bg-[#242628]' : 'border-gray-200 bg-white',
                // 显示
                btn.defaultHidden && !isDragging ? 'hidden group-hover:flex' : 'flex',
            ]"
            @click="onSideClick(btn.run)"
        >
            <FeedbackBadge :code="actionLabel(btn.actionKey)" compact />
            <div>
                <p class="text-center text-[13px] leading-4 select-none">{{ btn.text.substring(0, 2) }}</p>
                <p class="text-center text-[13px] leading-4 select-none">{{ btn.text.substring(2, 4) }}</p>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { deviceStorage } from '@/storage/configStorage'
import { isDarkMode } from '@/modules/rules/common/groups/theme'
import { useQuickActions } from '@/modules/shortcut/actions'
import { useShortcutPreference } from '@/modules/shortcut/preference'
import { isPageBangumi, isPageVideo } from '@/utils/pageType'
import { Position, useDraggable, useElementBounding, useStorage, useWindowSize } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import FeedbackBadge from '@/feedback/Badge.vue'
import { actionLabel } from '@/feedback'
import { clampSideBtnInset, exceededDragThreshold } from '@/utils/panelGeometry'

const { state: shortcutState } = useShortcutPreference()
const actions = useQuickActions()
const floatingVisible = computed(
    () => shortcutState.value.enabled && shortcutState.value.location === 'floating',
)
const visibleButtons = computed(() => actions.value.filter((btn) => btn.isValid))

const target = ref<HTMLElement | null>(null)
const { width, height } = useElementBounding(target, { windowScroll: false })

const btnPos = useStorage('bili-cleaner-side-btn-pos', { right: 10, bottom: 180 }, deviceStorage)

const isDragging = ref(false)

const windowSize = useWindowSize({ includeScrollbar: false })

const maxPos = computed(() => {
    return {
        x: windowSize.width.value - width.value,
        y: windowSize.height.value - height.value,
    }
})

const onSideClick = (fn: () => void) => {
    if (!isDragging.value) {
        fn()
    }
}

const applySideClamp = () => {
    const next = clampSideBtnInset(
        btnPos.value,
        { width: windowSize.width.value, height: windowSize.height.value },
        { width: width.value, height: height.value },
    )
    if (next.right !== btnPos.value.right || next.bottom !== btnPos.value.bottom) {
        btnPos.value.right = next.right
        btnPos.value.bottom = next.bottom
    }
}

watch([() => windowSize.width.value, () => windowSize.height.value, width, height], applySideClamp)

let pointerOrigin: { x: number; y: number } | null = null

useDraggable(target, {
    initialValue: {
        x: windowSize.width.value - btnPos.value.right,
        y: windowSize.height.value - btnPos.value.bottom,
    },
    preventDefault: false,
    handle: computed(() => target.value),
    onStart: (_pos, event) => {
        pointerOrigin = { x: event.clientX, y: event.clientY }
        isDragging.value = false
    },
    onMove: (pos: Position, event) => {
        if (!exceededDragThreshold(pointerOrigin, { x: event.clientX, y: event.clientY })) {
            return
        }
        isDragging.value = true
        btnPos.value.right = maxPos.value.x - pos.x
        btnPos.value.bottom = maxPos.value.y - pos.y
        applySideClamp()
    },
    onEnd: () => {
        pointerOrigin = null
        window.setTimeout(() => {
            isDragging.value = false
        }, 0)
    },
})
</script>
