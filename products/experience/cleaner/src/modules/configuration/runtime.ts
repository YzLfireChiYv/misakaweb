import { deviceStorage, GM_deleteValue, GM_getValue, GM_setValue } from '@/storage/configStorage'
import { withConfigImportSuppressed } from '@/modules/filters/ruleSync'
import {
    applyConfigurationPlan,
    createConfigurationBackup,
    parseConfigurationBackup,
    type ConfigAccess,
    type ConfigImportPlan,
    type ConfigValue,
} from './backup'
import { getConfigurationDefinitions } from './registry'

/** Last local safety snapshot; intentionally absent from export/sync registry. */
const LAST_BACKUP_KEY = 'misakaweb-config-preimport-backup'
export const configurationAccess: ConfigAccess = {
    read: (storage, key) => {
        if (storage === 'gm') return GM_getValue(key, undefined)
        const raw = deviceStorage.getItem(key)
        if (raw === null) return undefined
        try {
            return JSON.parse(raw)
        } catch {
            throw new Error(`「${key}」的本机数据不是有效 JSON`)
        }
    },
    write: (storage, key, value) => {
        if (storage === 'gm') GM_setValue(key, value)
        else deviceStorage.setItem(key, JSON.stringify(value))
    },
    remove: (storage, key) => {
        if (storage === 'gm') GM_deleteValue(key)
        else deviceStorage.removeItem(key)
    },
}

export const makeConfigurationBackup = (includeDevice = true, includeSecrets = false) =>
    createConfigurationBackup(getConfigurationDefinitions(), configurationAccess, {
        scriptVersion: __SCRIPT_VERSION__,
        profile: __BUILD_PROFILE__,
        includeDevice,
        includeSecrets,
    })

export const readPreImportBackup = () => {
    const raw = GM_getValue(LAST_BACKUP_KEY, undefined)
    if (raw === undefined) return null
    return parseConfigurationBackup(raw)
}

export const commitConfigurationPlan = (plan: ConfigImportPlan) => {
    if (!plan.writes.length) return 0
    return withConfigImportSuppressed(() => {
        const previous = makeConfigurationBackup(true, true)
        const serialized = JSON.stringify(previous)
        if (new TextEncoder().encode(serialized).byteLength > 4_000_000) throw new Error('导入前备份超过 4 MB，请先手动导出并精简规则')
        // Keep one snapshot locally, including credentials for exact recovery.
        // Saving must succeed before any user configuration is touched.
        GM_setValue(LAST_BACKUP_KEY, serialized)
        return applyConfigurationPlan(plan, configurationAccess)
    })
}

export const saveSingleConfiguration = (
    definitionKey: string,
    storage: 'gm' | 'local',
    value: ConfigValue | undefined,
) => {
    const definitions = getConfigurationDefinitions()
    const definition = definitions.find((v) => v.key === definitionKey && v.storage === storage)
    if (!definition) throw new Error('此版本没有这项设置')
    const backup = createConfigurationBackup([definition], configurationAccess, {
        scriptVersion: __SCRIPT_VERSION__,
        profile: __BUILD_PROFILE__,
        includeDevice: true,
        includeSecrets: true,
    })
    backup.entries = [
        {
            key: definition.key,
            storage,
            scope: definition.scope,
            state: value === undefined ? 'absent' : 'saved',
            ...(value === undefined ? {} : { value }),
        },
    ]
    return backup
}

export const downloadConfigurationBackup = (backup: ReturnType<typeof makeConfigurationBackup>) => {
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' })
    if (blob.size > 4_000_000) throw new Error('配置备份超过 4 MB，请精简规则后再导出')
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `MisakaWeb-配置-${backup.exportedAt.replace(/[:.]/g, '-')}.json`
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
