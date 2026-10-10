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
        @close="store.hide"
    >
        <div v-if="store.isShow" class="flex flex-col gap-3 p-1 text-sm text-black" @keydown.stop>
            <p class="rounded-lg bg-blue-50 p-3 leading-6">
                下载配置备份，或从文件恢复。备份可以带到另一台设备，导入前会先显示变动。
                日常设置仍在各页面、各功能栏目中调整。
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
        </div>
    </PanelComp>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import PanelComp from '@/components/PanelComp.vue'
import FeedbackBadge from '@/feedback/Badge.vue'
import { actionLabel } from '@/feedback'
import { useConfigurationPanelStore } from '@/stores/view'
import { getConfigurationDefinitions } from '@/modules/configuration/registry'
import {
    parseConfigurationBackup,
    planConfigurationImport,
    type ConfigDefinition,
    type ConfigImportPlan,
    type ConfigurationBackup,
} from '@/modules/configuration/backup'
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
const reloadPage = () => window.location.reload()
</script>
