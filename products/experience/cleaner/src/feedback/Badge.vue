<template>
    <span
        v-if="code"
        :data-feedback-id="code"
        :title="code"
        :class="
            compact
                ? 'pointer-events-none absolute -top-1 -left-1 z-10 rounded bg-amber-300 px-0.5 font-mono text-[9px] leading-[12px] font-bold text-black'
                : 'mr-1 inline-block rounded bg-amber-300 px-1 py-px align-middle font-mono text-[11px] leading-4 font-bold text-black'
        "
        >{{ code }}</span
    >
</template>

<script setup lang="ts">
defineProps<{
    code: string
    compact?: boolean
}>()
</script>
