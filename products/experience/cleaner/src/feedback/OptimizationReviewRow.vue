<template>
    <div class="mt-1 mb-2 flex flex-wrap items-center gap-2 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700"
        :data-review-key="entry.key" :data-review-category="category">
        <span v-if="category === 'optimization'">{{ removed ? '已标记删除' : entry.retention ? '可选保留 · 默认关闭' : '优化 · 待定' }}</span>
        <span v-else-if="category === 'cleaning'">净化 · 保留</span>
        <span v-else>公共支撑 · 保留</span>
        <button v-if="category === 'optimization'" type="button" :disabled="store.readOnly.value" :aria-pressed="removed"
            class="rounded border px-2 py-1 disabled:opacity-50" :class="removed ? 'border-red-600 text-red-700' : 'border-gray-400'"
            @click.stop="store.toggleRemove(entry.key)">
            <FeedbackBadge :code="actionLabel('review-toggle-remove')" />{{ removed ? '撤销删除' : '建议删除' }}
        </button>
        <button v-if="category !== 'support'" type="button" :disabled="store.readOnly.value"
            class="rounded border border-gray-400 px-2 py-1 disabled:opacity-50" @click.stop="store.changeCategory(entry.key)">
            <FeedbackBadge :code="actionLabel('review-change-category')" />{{ category === 'cleaning' ? '归为优化' : '归为净化' }}
        </button>
        <details class="w-full"><summary class="cursor-pointer">分类依据</summary><p class="pt-1">{{ entry.rationale }}</p></details>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import FeedbackBadge from './Badge.vue'
import { actionLabel } from './index'
import { categoryFor, type ReviewStore } from './review-store'
import type { ReviewEntry } from './review-types'
const props = defineProps<{ entry: ReviewEntry; store: ReviewStore }>()
const category = computed(() => categoryFor(props.entry, props.store.state.value))
const removed = computed(() => Boolean(props.store.state.value.decisions[props.entry.key]?.remove))
</script>
