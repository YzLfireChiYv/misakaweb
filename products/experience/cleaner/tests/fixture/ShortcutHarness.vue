<template>
    <div id="shortcut-harness">
        <div id="shortcut-controls" style="position: fixed; bottom: 0; left: 0; z-index: 2147483647; background: #fff; padding: 4px">
            <p id="rule-open">{{ ruleStore.isShow ? 'open' : 'closed' }}</p>
            <p id="settings-open">{{ shortcutStore.isShow ? 'open' : 'closed' }}</p>
            <p id="settings-token">{{ shortcutStore.openToken }}</p>
            <p id="pref-enabled">{{ shortcutState.enabled ? 'on' : 'off' }}</p>
            <p id="pref-location">{{ shortcutState.location }}</p>
            <p id="legacy-show">{{ legacyShow }}</p>
            <p id="legacy-pos">{{ legacyPos }}</p>
            <p id="gm-raw">{{ gmRaw }}</p>
            <button id="m07" type="button" @click="shortcutStore.show()">m07-shortcut-settings</button>
            <button id="hide-settings" type="button" @click="shortcutStore.hide()">hide-settings</button>
            <button id="seed-pos" type="button" @click="seedPos">seed-pos</button>
            <button id="read-legacy" type="button" @click="readLegacy">read-legacy</button>
        </div>
        <HeaderShortcutView />
        <SideBtnView />
        <ShortcutSettingsPanelView />
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import HeaderShortcutView from '../../src/views/HeaderShortcutView.vue'
import ShortcutSettingsPanelView from '../../src/views/ShortcutSettingsPanelView.vue'
import SideBtnView from '../../src/views/SideBtnView.vue'
import { useRulePanelStore, useShortcutSettingsStore } from '../../src/stores/view'
import { useShortcutPreference, LEGACY_SIDE_POS_KEY, LEGACY_SIDE_SHOW_KEY, SHORTCUT_PREFERENCE_KEY } from '../../src/modules/shortcut/preference'
import { __gmStore } from '../gm-mock'

const ruleStore = useRulePanelStore()
const shortcutStore = useShortcutSettingsStore()
const { state: shortcutState } = useShortcutPreference()
const legacyShow = ref('')
const legacyPos = ref('')
const gmRaw = computed(() => JSON.stringify(__gmStore.get(SHORTCUT_PREFERENCE_KEY) ?? null))

const readLegacy = () => {
    legacyShow.value = localStorage.getItem(LEGACY_SIDE_SHOW_KEY) ?? ''
    legacyPos.value = localStorage.getItem(LEGACY_SIDE_POS_KEY) ?? ''
}

const seedPos = () => {
    localStorage.setItem(LEGACY_SIDE_POS_KEY, JSON.stringify({ right: 80, bottom: 220 }))
    readLegacy()
}

onMounted(() => {
    readLegacy()
})
</script>
