<template>
    <PanelComp
        v-show="store.isShow"
        title="配置备份与恢复"
        :width-percent="42"
        :height-percent="72"
        :min-width="360"
        :min-height="480"
        close-action="panel-close-configuration"
        :center-on-open="true"
        :open-token="store.openToken"
        @close="closePanel"
    >
        <div v-if="store.isShow" class="flex flex-col gap-3 p-1 text-sm text-black" @keydown.stop>
            <p class="rounded-lg bg-blue-50 p-3 leading-6">
                下载配置备份，或通过文件和粘贴导入。应用前会先显示变动。
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
                        class="rounded-md border border-gray-300 px-3 py-2"
                        :aria-expanded="showPaste"
                        @click="togglePaste"
                    >
                        <FeedbackBadge :code="actionLabel('config-paste-import')" />粘贴配置
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
                <p class="mt-2 text-[13px] text-gray-600">
                    支持 MisakaWeb 备份和脚本猫单脚本 .storage.json 的 JSON 内容。
                </p>
                <div v-if="showPaste" class="mt-3 flex flex-col gap-2">
                    <label for="misakaweb-config-text" class="font-medium">配置 JSON</label>
                    <textarea
                        id="misakaweb-config-text"
                        ref="pasteInput"
                        v-model="pasteText"
                        rows="5"
                        spellcheck="false"
                        autocomplete="off"
                        class="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs"
                        @input="clearPreview"
                    />
                    <button
                        type="button"
                        :disabled="!pasteText.trim()"
                        class="self-start rounded-md border border-gray-300 px-3 py-2 disabled:opacity-40"
                        @click="previewText(pasteText, '粘贴的配置')"
                    >
                        <FeedbackBadge :code="actionLabel('config-preview-paste')" />预览粘贴内容
                    </button>
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
                        />完整恢复：让备份中明确未保存的设置重新继承默认值</label
                    >
                    <p class="text-[13px] leading-5 text-gray-600">
                        默认合并备份中的已保存值。备份未包含的设置保持原样。
                    </p>
                    <template v-if="preview">
                        <p class="my-2">
                            将改变 {{ preview.writes.length }} 项；{{ preview.unchanged }} 项保持原样；{{
                                preview.ignored.length
                            }}
                            项不在当前版本中，将跳过。
                            <span v-if="legacySkipped">另跳过脚本猫备份中的 {{ legacySkipped }} 项，含设备、连接或旧键。</span>
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
        </div>
    </PanelComp>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import PanelComp from '@/components/PanelComp.vue'
import FeedbackBadge from '@/feedback/Badge.vue'
import { actionLabel } from '@/feedback'
import { useConfigurationPanelStore } from '@/stores/view'
import { getConfigurationDefinitions } from '@/modules/configuration/registry'
import {
    MAX_CONFIGURATION_BYTES,
    planConfigurationImport,
    type ConfigDefinition,
    type ConfigImportPlan,
    type ConfigurationBackup,
} from '@/modules/configuration/backup'
import { parseConfigurationImportText } from '@/modules/configuration/scriptcat'
import {
    commitConfigurationPlan,
    configurationAccess,
    downloadConfigurationBackup,
    makeConfigurationBackup,
    readPreImportBackup,
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
const legacySkipped = ref(0)
const showPaste = ref(false)
const pasteText = ref('')
const pasteInput = ref<HTMLTextAreaElement | null>(null)
let fileReadId = 0
const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))
watch(
    () => store.openToken,
    () => {
        definitions.value = getConfigurationDefinitions()
        try {
            hasPrevious.value = Boolean(readPreImportBackup())
        } catch {
            hasPrevious.value = false
        }
    },
)

const definitionName = (key: string, storage: string) =>
    definitions.value.find((v) => v.key === key && v.storage === storage)?.name ?? key
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
const clearPreview = () => {
    ++fileReadId
    incoming.value = null
    preview.value = null
    legacySkipped.value = 0
    message.value = ''
}
const clearPaste = () => {
    showPaste.value = false
    pasteText.value = ''
}
const togglePaste = async () => {
    clearPreview()
    if (showPaste.value) {
        clearPaste()
    } else {
        showPaste.value = true
        await nextTick()
        pasteInput.value?.focus()
    }
}
const previewText = (text: string, name: string) => {
    clearPreview()
    try {
        const parsed = parseConfigurationImportText(text, definitions.value)
        incoming.value = parsed.backup
        legacySkipped.value = parsed.skipped
        incomingName.value = name
        restoreMode.value = false
        rebuildPreview()
    } catch (error) {
        message.value = errorMessage(error)
    }
}
const chooseFile = async (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    clearPaste()
    clearPreview()
    const readId = fileReadId
    try {
        if (file.size > MAX_CONFIGURATION_BYTES) throw new Error('配置文件超过 4 MB，未读取')
        const text = await file.text()
        if (readId === fileReadId) previewText(text, file.name)
    } catch (error) {
        if (readId === fileReadId) message.value = errorMessage(error)
    }
}
const previewPrevious = () => {
    clearPaste()
    clearPreview()
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
    clearPreview()
    clearPaste()
    message.value = `已保存 ${count} 项。刷新页面后完整应用。${notices.join(' ')}`
    needsRefresh.value = count > 0 || needsRefresh.value
    hasPrevious.value = true
}
const closePanel = () => {
    clearPreview()
    clearPaste()
    store.hide()
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
const reloadPage = () => window.location.reload()
</script>
