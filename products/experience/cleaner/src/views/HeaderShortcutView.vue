<script setup lang="ts">
import { useQuickActions } from '@/modules/shortcut/actions'
import { createShortcutHostController } from '@/modules/shortcut/host'
import { useShortcutPreference } from '@/modules/shortcut/preference'
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'

const { state } = useShortcutPreference()
const actions = useQuickActions()
const active = computed(() => state.value.enabled && state.value.location === 'header')

const controller = createShortcutHostController({
    isActive: () => active.value,
    getActions: () => actions.value,
})

onMounted(() => {
    controller.start()
})

watch([active, actions], () => {
    controller.refresh()
})

onBeforeUnmount(() => {
    controller.stop()
})
</script>

<template>
    <span class="hidden" aria-hidden="true"></span>
</template>
