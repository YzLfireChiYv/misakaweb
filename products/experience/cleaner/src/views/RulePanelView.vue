<template>
    <PanelComp
        v-bind="{ title: 'MisakaWeb · 页面设置', widthPercent: 32, heightPercent: 85, minWidth: 400, minHeight: 600, closeAction: 'panel-close-rule' }"
        v-show="store.isShow"
        @close="store.hide"
    >
        <p class="mb-2 text-sm text-gray-500" :data-build-profile="buildProfile">
            {{ buildLabel }} · {{ scriptVersion }}
        </p>
        <input v-model="query" type="search" aria-label="搜索设置" placeholder="搜索设置"
            class="mb-3 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
            @keydown.stop />
        <div v-for="rule in displayedRules" :key="rule.name">
            <section v-for="group in rule.groups" :key="group.sectionKey" :data-setting-section="group.name">
                <DisclosureComp v-bind="{ title: group.name, isFold: group.fold, isSpecial: rule.isSpecial }">
                    <div v-for="item in group.items" :key="item.id" :data-setting-key="item.id">
                        <SwitchComp v-if="item.type === 'switch'" v-bind="item" />
                        <NumberComp v-else-if="item.type === 'number'" v-bind="item" />
                        <StringComp v-else-if="item.type === 'string'" v-bind="item" />
                        <WebdavComp v-else-if="item.type === 'webdav'" v-bind="item" />
                        <EditorComp v-else-if="item.type === 'editor'" v-bind="item" @edit="handleEdit" />
                        <ListComp v-else-if="item.type === 'list'" v-bind="item" />
                    </div>
                </DisclosureComp>
            </section>
        </div>
        <p v-if="!displayedRules.length" class="p-3 text-sm text-gray-500">没有匹配的设置。</p>
        <div class="mt-3 border-t border-gray-200 pt-2">
            <button type="button" class="rounded border border-gray-300 px-2 py-1 text-sm text-gray-700"
                @click="exportDiagnostic">
                <FeedbackBadge :code="actionLabel('maintenance-export-diagnostic')" />导出维护信息
            </button>
            <p v-if="diagnosticError" role="alert" class="mt-1 text-sm text-red-700">{{ diagnosticError }}</p>
        </div>
        <EditorDialog ref="editorDialogRef" />
    </PanelComp>
</template>

<script setup lang="ts">
import DisclosureComp from '@/components/DisclosureComp.vue'
import EditorDialog from '@/components/EditorDialog.vue'
import EditorComp from '@/components/items/EditorComp.vue'
import ListComp from '@/components/items/ListComp.vue'
import NumberComp from '@/components/items/NumberComp.vue'
import StringComp from '@/components/items/StringComp.vue'
import SwitchComp from '@/components/items/SwitchComp.vue'
import WebdavComp from '@/components/items/WebdavComp.vue'
import PanelComp from '@/components/PanelComp.vue'
import { rules } from '@/modules/rules'
import { sectionGroups } from '@/modules/settings/sections'
import { useRulePanelStore } from '@/stores/view'
import type { IEditorItem } from '@/types/item'
import { computed, ref } from 'vue'
import { actionLabel, settingLabel } from '@/feedback'
import FeedbackBadge from '@/feedback/Badge.vue'
import { downloadMaintenanceDiagnostic } from '@/modules/maintenance/diagnostics'

const store = useRulePanelStore()
const buildProfile = __BUILD_PROFILE__
const buildLabel = __BUILD_LABEL__
const scriptVersion = __SCRIPT_VERSION__
const editorDialogRef = ref<InstanceType<typeof EditorDialog> | null>(null)
const query = ref('')
const diagnosticError = ref('')

const handleEdit = (item: IEditorItem) => editorDialogRef.value?.openEditor(item)
const exportDiagnostic = () => {
    diagnosticError.value = ''
    try { downloadMaintenanceDiagnostic() }
    catch { diagnosticError.value = '导出失败，请重试。' }
}
const displayedRules = computed(() => {
    const search = query.value.trim().toLowerCase()
    return rules.filter(rule => rule.checkFn()).map(rule => ({
        ...rule,
        groups: sectionGroups(rule.groups, __SETTING_SECTIONS__).map(group => ({
            ...group,
            // A match on the section title exposes the entire section.
            items: !search || group.name.toLowerCase().includes(search) ? group.items
                : group.items.filter(item => [item.name, settingLabel(item.id)].join(' ').toLowerCase().includes(search)),
            // Search results must be visible even if the original group was folded.
            fold: search ? false : group.fold,
            sectionKey: group.sectionKey + (search ? '-search' : ''),
        })).filter(group => group.items.length),
    })).filter(rule => rule.groups.length)
})
</script>
