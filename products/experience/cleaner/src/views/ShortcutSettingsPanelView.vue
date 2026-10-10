<template>
    <PanelComp
        v-show="store.isShow"
        :title="'快捷开关设置'"
        :width-percent="34"
        :height-percent="70"
        :min-width="340"
        :min-height="420"
        close-action="panel-close-shortcut-settings"
        :center-on-open="true"
        :open-token="store.openToken"
        @close="store.hide"
    >
        <div class="flex flex-col gap-3 p-1 text-sm text-black">
            <p class="text-[13px] leading-5 text-gray-600">
                页面快捷入口默认放在顶栏搜索按钮右侧，并单独占位。关闭或找不到搜索按钮时，仍可用脚本菜单打开本面板。
            </p>
            <label class="flex cursor-pointer items-center gap-2 rounded-lg py-1 hover:bg-blue-50/50">
                <input
                    id="shortcut-enabled"
                    type="checkbox"
                    class="h-4 w-4 accent-[#00AEEC]"
                    :checked="state.enabled"
                    @change="onEnabled"
                />
                <span>
                    <FeedbackBadge :code="settingLabel('biliweb-shortcut-enabled')" />
                    启用页面快捷入口
                </span>
            </label>
            <fieldset class="rounded-lg border border-gray-200 p-2">
                <legend class="px-1">
                    <FeedbackBadge :code="settingLabel('biliweb-shortcut-location')" />
                    入口位置
                </legend>
                <label class="mt-1 flex cursor-pointer items-center gap-2 py-1">
                    <input
                        type="radio"
                        name="shortcut-location"
                        value="header"
                        class="accent-[#00AEEC]"
                        :checked="state.location === 'header'"
                        @change="setLocation('header')"
                    />
                    顶栏搜索右侧
                </label>
                <label class="flex cursor-pointer items-center gap-2 py-1">
                    <input
                        type="radio"
                        name="shortcut-location"
                        value="floating"
                        class="accent-[#00AEEC]"
                        :checked="state.location === 'floating'"
                        @change="setLocation('floating')"
                    />
                    悬浮按钮
                </label>
            </fieldset>
            <p id="shortcut-anchor-status" class="rounded-md bg-gray-50 p-2 text-[13px] leading-5 text-gray-700">
                {{ statusText }}
            </p>
            <p class="text-[12px] leading-5 text-gray-500">
                选择悬浮按钮后，可拖动调整位置；切回时保留原位置。入口设置保存在当前设备。
            </p>
        </div>
    </PanelComp>
</template>

<script setup lang="ts">
import PanelComp from '@/components/PanelComp.vue'
import FeedbackBadge from '@/feedback/Badge.vue'
import { settingLabel } from '@/feedback'
import { shortcutAnchorStatus } from '@/modules/shortcut/host'
import { findSearchAnchor, reportAnchor } from '@/modules/shortcut/anchor'
import { useShortcutPreference } from '@/modules/shortcut/preference'
import { useShortcutSettingsStore } from '@/stores/view'
import { computed } from 'vue'

const store = useShortcutSettingsStore()
const { state, setEnabled, setLocation } = useShortcutPreference()

const statusText = computed(() => {
    if (!state.value.enabled) {
        return '页面快捷入口已关闭。脚本菜单「快捷开关设置」仍可打开本面板。'
    }
    if (state.value.location === 'floating') {
        return '当前使用悬浮按钮。顶栏搜索右侧不会同时出现。'
    }
    return shortcutAnchorStatus.value.message || reportAnchor(findSearchAnchor()).message
})

const onEnabled = (event: Event) => {
    const target = event.target
    if (target instanceof HTMLInputElement) {
        setEnabled(target.checked)
    }
}
</script>
