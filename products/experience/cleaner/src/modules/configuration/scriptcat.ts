import {
    parseConfigurationBackup,
    validateConfigValue,
    type ConfigDefinition,
    type ConfigEntry,
    type ConfigurationBackup,
} from './backup'

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value)

const decodeValue = (encoded: unknown): unknown => {
    if (typeof encoded !== 'string') return undefined
    const payload = encoded.slice(1)
    switch (encoded[0]) {
        case 's':
            return payload
        case 'b':
            if (payload === 'true') return true
            if (payload === 'false') return false
            return undefined
        case 'n':
            return payload.trim() ? Number(payload) : undefined
        case 'o':
            try {
                return JSON.parse(payload)
            } catch {
                return undefined
            }
        default:
            return undefined
    }
}

/** Import a single extracted .storage.json using only this build's settings and rules. */
export const parseConfigurationImportFile = (
    raw: unknown,
    definitions: ConfigDefinition[],
): { backup: ConfigurationBackup; skipped: number } => {
    if (!isRecord(raw) || !isRecord(raw.data) || typeof raw.ts !== 'number' ||
        !Object.keys(raw).every((key) => key === 'data' || key === 'ts')) {
        return { backup: parseConfigurationBackup(raw), skipped: 0 }
    }

    const registry = new Map(definitions
        .filter((item) => item.storage === 'gm' && (item.scope === 'settings' || item.scope === 'rules'))
        .map((item) => [item.key, item]))
    const entries: ConfigEntry[] = []
    let skipped = 0
    for (const [key, encoded] of Object.entries(raw.data)) {
        const definition = registry.get(key)
        if (!definition) {
            skipped++
            continue
        }
        const value = decodeValue(encoded)
        if (!validateConfigValue(definition, value)) {
            throw new Error(`脚本猫备份中的「${definition.name}」值不合法，未修改本机数据`)
        }
        entries.push({ key, storage: 'gm', scope: definition.scope, state: 'saved', value })
    }
    if (!entries.length) throw new Error('脚本猫存储文件没有本版本可导入的设置或规则')
    return {
        backup: parseConfigurationBackup({
            format: 'misakaweb-config-backup',
            schemaVersion: 1,
            product: 'MisakaWeb',
            scriptVersion: '旧存储',
            profile: '脚本猫',
            exportedAt: new Date().toISOString(),
            scopes: ['settings', 'rules'],
            definitions: [],
            entries,
        }),
        skipped,
    }
}
