<template>
    <PanelComp
        v-show="store.isShow"
        title="配置管理"
        :width-percent="58"
        :height-percent="88"
        :min-width="360"
        :min-height="480"
        close-action="panel-close-configuration"
        :center-on-open="true"
        :open-token="store.openToken"
        @close="store.hide"
    >
        <div v-if="store.isShow" class="flex flex-col gap-3 p-1 text-sm text-black" @keydown.stop>
            <p class="rounded-lg bg-blue-50 p-3 leading-6">
                这里统一管理净化、过滤和优化设置。备份可以带到另一台设备，导入前会先显示变动。
                页面中的设置面板仍可照常使用。
            </p>
            <p v-if="message" role="status" class="rounded-md bg-gray-100 p-3 leading-6">{{ message }}</p>
            <button
                v-if="needsRefresh"
                type="button"
                class="rounded-md bg-[#00AEEC] px-3 py-2 text-white"
                @click="reloadPage"
            >
                <FeedbackBadge :code="actionLabel('config-refresh-page')" />刷新页面，应用已保存设置
            </button>
            <section class="rounded-lg border border-gray-200 p-3">
                <h2 class="mb-2 text-base font-bold">备份与恢复</h2>
                <label class="mr-4 inline-flex items-center gap-2 py-1"
                    ><input v-model="includeDevice" type="checkbox" />包含当前设备的入口与窗口位置</label
                >
                <label class="inline-flex items-center gap-2 py-1"
                    ><input v-model="includeSecrets" type="checkbox" />包含 WebDAV 连接和密码</label
                >
                <p v-if="includeSecrets" class="mt-1 text-amber-700">
                    下载的文件将包含明文密码，请仅保存在自己的安全位置。
                </p>
                <p class="my-2 text-[13px] leading-5 text-gray-600">
                    默认包含全部设置和过滤规则，不包含 WebDAV
                    连接、缓存、同步历史或旧测试取舍记录。未保存项保留各页面的默认值说明，不会为导出而写入默认值。
                </p>
                <div class="flex flex-wrap gap-2">
                    <button type="button" class="rounded-md bg-[#00AEEC] px-3 py-2 text-white" @click="exportBackup">
                        <FeedbackBadge :code="actionLabel('config-export')" />下载配置备份
                    </button>
                    <button
                        type="button"
                        class="rounded-md border border-gray-300 px-3 py-2"
                        @click="fileInput?.click()"
                    >
                        <FeedbackBadge :code="actionLabel('config-choose-import')" />选择配置文件
                    </button>
                    <button
                        type="button"
                        :disabled="!hasPrevious"
                        class="rounded-md border border-gray-300 px-3 py-2 disabled:opacity-40"
                        @click="previewPrevious"
                    >
                        <FeedbackBadge :code="actionLabel('config-restore-backup')" />恢复上次保存前的配置
                    </button>
                    <input
                        ref="fileInput"
                        type="file"
                        accept=".json,application/json"
                        class="hidden"
                        @change="chooseFile"
                    />
                </div>
                <div v-if="incoming" class="mt-3 rounded-md bg-gray-50 p-3">
                    <p class="font-bold">
                        {{ incomingName }} · 来自 {{ incoming.scriptVersion }} / {{ incoming.profile }}
                    </p>
                    <label class="my-2 flex items-center gap-2"
                        ><input
                            v-model="restoreMode"
                            type="checkbox"
                            @change="rebuildPreview"
                        />完整恢复：让文件中明确未保存的设置重新继承默认值</label
                    >
                    <p class="text-[13px] leading-5 text-gray-600">
                        默认只合并文件中的已保存值。文件未包含的设置和未勾选导出的设备、连接信息都保持原样。
                    </p>
                    <template v-if="preview">
                        <p class="my-2">
                            将改变 {{ preview.writes.length }} 项；{{ preview.unchanged }} 项保持原样；{{
                                preview.ignored.length
                            }}
                            项不在当前版本中，将跳过。
                        </p>
                        <p v-for="notice in preview.notices" :key="notice" class="mb-1 text-amber-700">{{ notice }}</p>
                        <details v-if="preview.writes.length || preview.ignored.length" class="my-2">
                            <summary class="cursor-pointer">查看涉及的设置</summary>
                            <ul class="mt-2 max-h-44 overflow-auto text-[13px] leading-6">
                                <li v-for="write in preview.writes" :key="write.storage + write.key">
                                    {{ definitionName(write.key, write.storage) }}：{{
                                        write.value === undefined ? '回到默认值' : '更新已保存值'
                                    }}
                                </li>
                                <li v-for="key in preview.ignored" :key="key" class="text-gray-500">跳过：{{ key }}</li>
                            </ul>
                        </details>
                        <button
                            type="button"
                            :disabled="!preview.writes.length"
                            class="rounded-md bg-[#00AEEC] px-3 py-2 text-white disabled:opacity-40"
                            @click="applyPreview"
                        >
                            <FeedbackBadge :code="actionLabel('config-apply-import')" />应用这些变动
                        </button>
                    </template>
                </div>
            </section>
            <section class="rounded-lg border border-gray-200 p-3">
                <h2 class="mb-2 text-base font-bold">全部设置</h2>
                <div class="flex flex-wrap gap-2">
                    <input
                        v-model="search"
                        type="search"
                        placeholder="搜索名称、栏目或编号"
                        class="min-w-40 flex-1 rounded-md border border-gray-300 px-2 py-2"
                    />
                    <select v-model="selectedScope" class="rounded-md border border-gray-300 bg-white px-2 py-2">
                        <option value="">全部类型</option>
                        <option value="settings">功能设置</option>
                        <option value="rules">过滤规则</option>
                        <option value="device">当前设备</option>
                        <option value="secrets">WebDAV 连接</option>
                    </select>
                </div>
                <p class="my-2 text-[13px] leading-5 text-gray-600">
                    同名键只列一次；共用的设置会列出所在栏目。这里修改后显式保存并刷新，避免在不相关页面启动功能。
                </p>
                <div v-if="editing" ref="editSection" class="my-3 rounded-lg border border-blue-300 bg-blue-50 p-3">
                    <p class="mb-2 font-bold"><FeedbackBadge :code="settingLabel(editing.key)" />{{ editing.name }}</p>
                    <label v-if="editing.kind === 'switch'" class="flex items-center gap-2"
                        ><input v-model="editBoolean" type="checkbox" />启用</label
                    >
                    <select
                        v-else-if="editing.kind === 'choice'"
                        v-model="editText"
                        class="w-full rounded-md border border-gray-300 bg-white p-2"
                    >
                        <option v-for="option in editing.options" :key="option.value" :value="option.value">
                            {{ option.name }}
                        </option>
                    </select>
                    <input
                        v-else-if="editing.kind === 'number' || editing.kind === 'zoom'"
                        v-model="editText"
                        type="number"
                        step="any"
                        class="w-full rounded-md border border-gray-300 bg-white p-2"
                    />
                    <input
                        v-else-if="editing.kind === 'string'"
                        v-model="editText"
                        :type="editing.key.endsWith('password') ? 'password' : 'text'"
                        class="w-full rounded-md border border-gray-300 bg-white p-2"
                    />
                    <textarea
                        v-else
                        v-model="editText"
                        class="min-h-32 w-full resize-y rounded-md border border-gray-300 bg-white p-2"
                        spellcheck="false"
                    />
                    <p v-if="editing.kind === 'lines'" class="mt-1 text-[13px] text-gray-600">
                        每行一条规则，空行不保存。
                    </p>
                    <p
                        v-if="editing.kind === 'position' || editing.kind === 'shortcut'"
                        class="mt-1 text-[13px] text-gray-600"
                    >
                        保留所显示的字段名，仅修改对应的值。
                    </p>
                    <p v-if="editing.defaults.length > 1" class="mt-1 text-[13px] text-gray-600">
                        此项在多个页面共用；各页面默认值可能不同。恢复默认会保留这种差异。
                    </p>
                    <details class="my-2 text-[13px]">
                        <summary class="cursor-pointer">所在栏目与默认值</summary>
                        <p v-for="item in editing.defaults" :key="item.context" class="mt-1">
                            {{ item.context }}：{{ formatValue(item.value, editing) }}
                        </p>
                    </details>
                    <div class="flex flex-wrap gap-2">
                        <button
                            type="button"
                            class="rounded-md bg-[#00AEEC] px-3 py-2 text-white"
                            @click="saveEdit(false)"
                        >
                            <FeedbackBadge :code="actionLabel('config-save-setting')" />保存此项
                        </button>
                        <button
                            type="button"
                            class="rounded-md border border-gray-300 px-3 py-2"
                            @click="saveEdit(true)"
                        >
                            恢复默认
                        </button>
                        <button
                            type="button"
                            class="rounded-md border border-gray-300 px-3 py-2"
                            @click="editing = null"
                        >
                            取消
                        </button>
                    </div>
                </div>
                <p class="mb-1 text-[13px] text-gray-500">共 {{ filtered.length }} 项</p>
                <div
                    v-for="definition in visibleDefinitions"
                    :key="definition.storage + definition.key"
                    class="border-t border-gray-100 py-2"
                >
                    <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0 flex-1">
                            <p><FeedbackBadge :code="settingLabel(definition.key)" />{{ definition.name }}</p>
                            <p class="mt-1 text-[12px] leading-5 text-gray-500">{{ definition.groups.join('；') }}</p>
                            <p class="mt-1 text-[13px] break-words text-gray-600">
                                {{ storedDescription(definition) }}
                            </p>
                        </div>
                        <button
                            type="button"
                            class="shrink-0 rounded-md border border-gray-300 px-3 py-1"
                            @click="beginEdit(definition)"
                        >
                            修改
                        </button>
                    </div>
                </div>
                <button
                    v-if="shownCount < filtered.length"
                    type="button"
                    class="mt-2 w-full rounded-md bg-gray-100 p-2"
                    @click="shownCount += 40"
                >
                    再显示 40 项
                </button>
            </section>
        </div>
    </PanelComp>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import PanelComp from '@/components/PanelComp.vue'
import FeedbackBadge from '@/feedback/Badge.vue'
import { actionLabel, settingLabel } from '@/feedback'
import { useConfigurationPanelStore } from '@/stores/view'
import { getConfigurationDefinitions } from '@/modules/configuration/registry'
import {
    parseConfigurationBackup,
    planConfigurationImport,
    type ConfigDefinition,
    type ConfigImportPlan,
    type ConfigValue,
    type ConfigurationBackup,
} from '@/modules/configuration/backup'
import {
    commitConfigurationPlan,
    configurationAccess,
    downloadConfigurationBackup,
    makeConfigurationBackup,
    readPreImportBackup,
    saveSingleConfiguration,
} from '@/modules/configuration/runtime'

const store = useConfigurationPanelStore()
const definitions = ref<ConfigDefinition[]>([])
const includeDevice = ref(true)
const includeSecrets = ref(false)
const message = ref('')
const needsRefresh = ref(false)
const hasPrevious = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const incoming = ref<ConfigurationBackup | null>(null)
const incomingName = ref('')
const preview = ref<ConfigImportPlan | null>(null)
const restoreMode = ref(false)
const search = ref('')
const selectedScope = ref('')
const shownCount = ref(40)
const editing = ref<ConfigDefinition | null>(null)
const editText = ref('')
const editBoolean = ref(false)
const editSection = ref<HTMLElement | null>(null)
const revision = ref(0)
const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))
const filtered = computed(() => {
    const query = search.value.trim().toLowerCase()
    return definitions.value.filter(
        (v) =>
            (!selectedScope.value || v.scope === selectedScope.value) &&
            (!query || [v.name, v.key, ...v.groups, settingLabel(v.key)].join(' ').toLowerCase().includes(query)),
    )
})
const visibleDefinitions = computed(() => filtered.value.slice(0, shownCount.value))
watch([search, selectedScope], () => {
    shownCount.value = 40
})
watch(
    () => store.openToken,
    () => {
        definitions.value = getConfigurationDefinitions()
        revision.value++
        try {
            hasPrevious.value = Boolean(readPreImportBackup())
        } catch {
            hasPrevious.value = false
        }
    },
)

const definitionName = (key: string, storage: string) =>
    definitions.value.find((v) => v.key === key && v.storage === storage)?.name ?? key
const formatValue = (value: unknown, definition: ConfigDefinition) => {
    if (definition.scope === 'secrets') return value ? '已保存（不展示）' : '空'
    if (Array.isArray(value)) return `${value.length} 条规则`
    if (typeof value === 'boolean') return value ? '开启' : '关闭'
    if (definition.kind === 'choice') return definition.options?.find((v) => v.value === value)?.name ?? String(value)
    return typeof value === 'object' ? JSON.stringify(value) : String(value)
}
const storedDescription = (definition: ConfigDefinition) => {
    void revision.value
    try {
        const value = configurationAccess.read(definition.storage, definition.key)
        if (value !== undefined && value !== null) return '已保存：' + formatValue(value, definition)
        const uniqueDefaults = [...new Set(definition.defaults.map((v) => formatValue(v.value, definition)))]
        return uniqueDefaults.length === 1 ? '继承默认：' + uniqueDefaults[0] : '继承各页面默认值（不同页面存在差异）'
    } catch (error) {
        return errorMessage(error)
    }
}
const exportBackup = () => {
    try {
        downloadConfigurationBackup(makeConfigurationBackup(includeDevice.value, includeSecrets.value))
        message.value = '配置备份已交给浏览器下载。'
    } catch (error) {
        message.value = errorMessage(error)
    }
}
const rebuildPreview = () => {
    preview.value = null
    if (!incoming.value) return
    try {
        preview.value = planConfigurationImport(
            incoming.value,
            definitions.value,
            configurationAccess,
            restoreMode.value ? 'restore' : 'merge',
        )
    } catch (error) {
        message.value = errorMessage(error)
    }
}
const chooseFile = async (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    incoming.value = null
    preview.value = null
    try {
        if (file.size > 4_000_000) throw new Error('配置文件超过 4 MB，未读取')
        incoming.value = parseConfigurationBackup(await file.text())
        incomingName.value = file.name
        restoreMode.value = false
        message.value = ''
        rebuildPreview()
    } catch (error) {
        message.value = errorMessage(error)
    }
}
const previewPrevious = () => {
    try {
        const previous = readPreImportBackup()
        if (!previous) throw new Error('当前设备没有上次保存前的备份')
        incoming.value = previous
        incomingName.value = '上次保存前的本机备份'
        restoreMode.value = true
        rebuildPreview()
    } catch (error) {
        message.value = errorMessage(error)
    }
}
const applied = (count: number, notices: string[] = []) => {
    message.value = `已保存 ${count} 项。刷新页面后完整应用。${notices.join(' ')}`
    needsRefresh.value = count > 0 || needsRefresh.value
    hasPrevious.value = true
    revision.value++
    preview.value = null
    incoming.value = null
}
const applyPreview = () => {
    if (!preview.value) return
    try {
        const plan = preview.value
        applied(commitConfigurationPlan(plan), plan.notices)
    } catch (error) {
        message.value = errorMessage(error)
    }
}
const beginEdit = async (definition: ConfigDefinition) => {
    try {
        const saved = configurationAccess.read(definition.storage, definition.key)
        const value = saved ?? definition.defaults[0]?.value
        editing.value = definition
        editBoolean.value = value === true
        editText.value = Array.isArray(value)
            ? value.join('\n')
            : typeof value === 'object'
              ? JSON.stringify(value, null, 2)
              : String(value ?? '')
        await nextTick()
        editSection.value?.scrollIntoView({ block: 'nearest' })
    } catch (error) {
        message.value = errorMessage(error)
    }
}
const saveEdit = (reset: boolean) => {
    const definition = editing.value
    if (!definition) return
    try {
        let value: ConfigValue | undefined
        if (reset) value = undefined
        else if (definition.kind === 'switch') value = editBoolean.value
        else if (definition.kind === 'number' || definition.kind === 'zoom') {
            if (!editText.value.trim()) throw new Error('请填写数值')
            value = Number(editText.value)
        } else if (definition.kind === 'lines')
            value = [...new Set(editText.value.split('\n').filter((v) => v.trim() !== ''))]
        else if (definition.kind === 'position' || definition.kind === 'shortcut')
            value = JSON.parse(editText.value) as ConfigValue
        else value = editText.value
        const backup = saveSingleConfiguration(definition.key, definition.storage, value)
        const plan = planConfigurationImport(backup, definitions.value, configurationAccess, 'restore', {
            allowManualSyncEnable: definition.key === 'biliweb-sync-enabled' && value === true,
        })
        applied(
            commitConfigurationPlan(plan),
            plan.notices.filter((v) => !v.startsWith('完整恢复') && !v.startsWith('文件包含')),
        )
        editing.value = null
    } catch (error) {
        message.value = errorMessage(error)
    }
}
const reloadPage = () => window.location.reload()
</script>
