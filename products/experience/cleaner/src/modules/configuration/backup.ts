/** Pure configuration schema. No DOM, network or userscript-manager dependency. */
export type ConfigScope = 'settings' | 'rules' | 'device' | 'secrets'
export type ConfigStorage = 'gm' | 'local'
export type ConfigValue = boolean | number | string | string[] | Record<string, boolean | number | string>
export type ConfigKind = 'switch' | 'number' | 'string' | 'choice' | 'lines' | 'shortcut' | 'position' | 'zoom'
export type ConfigDefinition = {
    key: string
    name: string
    storage: ConfigStorage
    scope: ConfigScope
    kind: ConfigKind
    groups: string[]
    defaults: { context: string; value: ConfigValue }[]
    min?: number
    max?: number
    options?: { value: string; name: string }[]
    disabled?: ConfigValue[]
    /** Present in the current build; other packages may have a smaller registry. */
    availableProfiles: string[]
}
export type ConfigEntry = {
    key: string
    storage: ConfigStorage
    scope: ConfigScope
    state: 'saved' | 'absent'
    value?: ConfigValue
}
export type ConfigurationBackup = {
    format: 'misakaweb-config-backup'
    schemaVersion: 1
    product: 'MisakaWeb'
    scriptVersion: string
    profile: string
    exportedAt: string
    scopes: ConfigScope[]
    definitions: ConfigDefinition[]
    entries: ConfigEntry[]
}
export interface ConfigAccess {
    read(storage: ConfigStorage, key: string): unknown
    write(storage: ConfigStorage, key: string, value: ConfigValue): void
    remove(storage: ConfigStorage, key: string): void
}
export type ConfigWrite = ConfigEntry & { before: unknown }
export type ConfigImportPlan = {
    backup: ConfigurationBackup
    writes: ConfigWrite[]
    ignored: string[]
    notices: string[]
    unchanged: number
    mode: 'merge' | 'restore'
}
const SCOPES: ConfigScope[] = ['settings', 'rules', 'device', 'secrets']
const MAX_TEXT = 4_000_000
const record = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
const ownKeys = (object: Record<string, unknown>, keys: string[]) =>
    Object.keys(object).every((key) => keys.includes(key))
const safeKey = (key: unknown): key is string =>
    typeof key === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/.test(key)
export const sameConfigValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isConfigValue = (value: unknown): value is ConfigValue => {
    if (typeof value === 'boolean' || isFiniteNumber(value)) return true
    if (typeof value === 'string') return value.length <= 1_000_000
    if (Array.isArray(value))
        return value.length <= 100_000 && value.every((v) => typeof v === 'string' && v.length <= 100_000)
    return (
        record(value) &&
        Object.keys(value).length <= 10 &&
        Object.entries(value).every(
            ([k, v]) =>
                safeKey(k) &&
                (typeof v === 'boolean' || isFiniteNumber(v) || (typeof v === 'string' && v.length <= 1000)),
        )
    )
}

export const validateConfigValue = (definition: ConfigDefinition, value: unknown): value is ConfigValue => {
    if (definition.disabled?.some((v) => sameConfigValue(v, value))) return true
    switch (definition.kind) {
        case 'switch':
            return typeof value === 'boolean'
        case 'number':
        case 'zoom':
            return (
                isFiniteNumber(value) &&
                (definition.min === undefined || value >= definition.min) &&
                (definition.max === undefined || value <= definition.max)
            )
        case 'string':
            return typeof value === 'string' && value.length <= 1_000_000
        case 'choice':
            return typeof value === 'string' && Boolean(definition.options?.some((option) => option.value === value))
        case 'lines':
            return (
                Array.isArray(value) &&
                value.length <= 100_000 &&
                value.every((v) => typeof v === 'string' && v.length <= 100_000)
            )
        case 'shortcut':
            return (
                record(value) &&
                ownKeys(value, ['enabled', 'location']) &&
                typeof value.enabled === 'boolean' &&
                (value.location === 'header' || value.location === 'floating')
            )
        case 'position': {
            const fields = definition.key.includes('side-btn') ? ['right', 'bottom'] : ['tx', 'ty']
            return (
                record(value) &&
                ownKeys(value, fields) &&
                fields.every((key) => isFiniteNumber(value[key]) && Math.abs(value[key]) <= 100_000)
            )
        }
    }
}

export const createConfigurationBackup = (
    definitions: ConfigDefinition[],
    access: ConfigAccess,
    options: {
        scriptVersion: string
        profile: string
        includeDevice?: boolean
        includeSecrets?: boolean
        now?: string
    },
): ConfigurationBackup => {
    const scopes: ConfigScope[] = ['settings', 'rules']
    if (options.includeDevice !== false) scopes.push('device')
    if (options.includeSecrets === true) scopes.push('secrets')
    const selected = definitions.filter((definition) => scopes.includes(definition.scope))
    const entries = selected.map((definition): ConfigEntry => {
        const value = access.read(definition.storage, definition.key)
        if (value === undefined || value === null) {
            return { key: definition.key, storage: definition.storage, scope: definition.scope, state: 'absent' }
        }
        if (!validateConfigValue(definition, value))
            throw new Error(`「${definition.name}」的已保存值格式异常，请先修正再导出`)
        return { key: definition.key, storage: definition.storage, scope: definition.scope, state: 'saved', value }
    })
    const backup: ConfigurationBackup = {
        format: 'misakaweb-config-backup',
        schemaVersion: 1,
        product: 'MisakaWeb',
        scriptVersion: options.scriptVersion,
        profile: options.profile,
        exportedAt: options.now ?? new Date().toISOString(),
        scopes,
        definitions: selected,
        entries,
    }
    if (new TextEncoder().encode(JSON.stringify(backup)).length > MAX_TEXT)
        throw new Error('配置备份超过 4 MB，请精简规则后再导出')
    return backup
}

/** Unknown keys may be from another package; never trust their embedded definitions for writes. */
export const parseConfigurationBackup = (input: unknown): ConfigurationBackup => {
    let raw: unknown = input
    if (typeof input === 'string') {
        if (input.length > MAX_TEXT || new TextEncoder().encode(input).length > MAX_TEXT)
            throw new Error('配置文件超过 4 MB，未读取')
        try {
            raw = JSON.parse(input)
        } catch {
            throw new Error('配置文件不是有效的 JSON')
        }
    }
    if (!record(raw) || raw.format !== 'misakaweb-config-backup' || raw.product !== 'MisakaWeb')
        throw new Error('这不是 MisakaWeb 配置备份')
    if (raw.schemaVersion !== 1) throw new Error('此备份格式版本尚不支持，请更新脚本后再导入')
    if (
        !ownKeys(raw, [
            'format',
            'schemaVersion',
            'product',
            'scriptVersion',
            'profile',
            'exportedAt',
            'scopes',
            'definitions',
            'entries',
        ]) ||
        typeof raw.scriptVersion !== 'string' ||
        raw.scriptVersion.length > 80 ||
        typeof raw.profile !== 'string' ||
        raw.profile.length > 100 ||
        typeof raw.exportedAt !== 'string' ||
        !Number.isFinite(Date.parse(raw.exportedAt)) ||
        !Array.isArray(raw.scopes) ||
        raw.scopes.length > 4 ||
        !raw.scopes.every((v) => SCOPES.includes(v as ConfigScope)) ||
        new Set(raw.scopes).size !== raw.scopes.length ||
        !Array.isArray(raw.entries) ||
        raw.entries.length > 2000 ||
        !Array.isArray(raw.definitions) ||
        raw.definitions.length > 2000
    )
        throw new Error('配置备份结构异常，未修改本机数据')
    const keys = new Set<string>()
    for (const entry of raw.entries) {
        if (
            !record(entry) ||
            !ownKeys(entry, ['key', 'storage', 'scope', 'state', 'value']) ||
            !safeKey(entry.key) ||
            (entry.storage !== 'gm' && entry.storage !== 'local') ||
            !raw.scopes.includes(entry.scope) ||
            (entry.state !== 'saved' && entry.state !== 'absent') ||
            (entry.state === 'saved'
                ? !isConfigValue(entry.value)
                : Object.prototype.hasOwnProperty.call(entry, 'value'))
        )
            throw new Error('配置条目结构异常，未修改本机数据')
        const identity = `${entry.storage}:${entry.key}`
        if (keys.has(identity)) throw new Error('配置文件存在重复条目，未修改本机数据')
        keys.add(identity)
    }
    // Definitions are display-only provenance. Bound their size, never execute or
    // use imported defaults/ranges to authorize a value against local code.
    for (const definition of raw.definitions) {
        if (
            !record(definition) ||
            !safeKey(definition.key) ||
            typeof definition.name !== 'string' ||
            definition.name.length > 500 ||
            !Array.isArray(definition.groups) ||
            !definition.groups.every((v) => typeof v === 'string' && v.length < 500) ||
            !Array.isArray(definition.defaults) ||
            definition.defaults.length > 100 ||
            !definition.defaults.every(
                (v) => record(v) && typeof v.context === 'string' && v.context.length < 500 && isConfigValue(v.value),
            ) ||
            !Array.isArray(definition.availableProfiles) ||
            definition.availableProfiles.length > 30 ||
            !definition.availableProfiles.every((v) => typeof v === 'string' && v.length < 100)
        )
            throw new Error('配置定义结构异常，未修改本机数据')
    }
    return raw as unknown as ConfigurationBackup
}

export const planConfigurationImport = (
    input: unknown,
    definitions: ConfigDefinition[],
    access: ConfigAccess,
    mode: 'merge' | 'restore' = 'merge',
    options: { allowManualSyncEnable?: boolean } = {},
): ConfigImportPlan => {
    const backup = parseConfigurationBackup(input)
    const registry = new Map(definitions.map((definition) => [`${definition.storage}:${definition.key}`, definition]))
    const plan: ConfigImportPlan = { backup, writes: [], ignored: [], notices: [], unchanged: 0, mode }
    for (const entry of backup.entries) {
        const definition = registry.get(`${entry.storage}:${entry.key}`)
        if (!definition) {
            plan.ignored.push(entry.key)
            continue
        }
        if (entry.scope !== definition.scope) throw new Error(`「${definition.name}」的数据分类不符，未修改本机数据`)
        if (entry.state === 'absent' && mode === 'merge') {
            plan.unchanged++
            continue
        }
        let incoming = entry.state === 'saved' ? entry.value : undefined
        if (entry.state === 'saved' && !validateConfigValue(definition, incoming))
            throw new Error(`「${definition.name}」的值不合法，未修改本机数据`)
        // Only a deliberate local edit of this single switch may enable sync.
        // File imports and full restores never pass this opt-in.
        const manualSyncEnable = options.allowManualSyncEnable === true && backup.entries.length === 1 &&
            entry.key === 'biliweb-sync-enabled' && entry.storage === 'gm'
        if (entry.key === 'biliweb-sync-enabled' && incoming === true && !manualSyncEnable) {
            incoming = false
            plan.notices.push('WebDAV 同步开关保持关闭；请检查连接后手动启用。')
        }
        const before = access.read(entry.storage, entry.key)
        if (sameConfigValue(before, incoming)) {
            plan.unchanged++
            continue
        }
        plan.writes.push({ ...entry, value: incoming, before })
    }
    if (
        plan.writes.length &&
        access.read('gm', 'biliweb-sync-enabled') === true &&
        !plan.writes.some((v) => v.key === 'biliweb-sync-enabled')
    ) {
        plan.writes.push({
            key: 'biliweb-sync-enabled',
            storage: 'gm',
            scope: 'device',
            state: 'saved',
            value: false,
            before: true,
        })
        plan.notices.push('当前 WebDAV 自动同步将关闭，避免刷新后覆盖刚导入的数据；请检查连接和规则后手动启用。')
    }
    if (backup.scopes.includes('secrets')) plan.notices.push('文件包含 WebDAV 连接信息和密码，将仅保存在当前设备。')
    if (mode === 'restore')
        plan.notices.push('完整恢复会删除备份中明确标为「未保存」的设置，使其重新继承本版本默认值。')
    return plan
}

/** Verify preview still matches storage; rollback partial writes on failure. */
export const applyConfigurationPlan = (plan: ConfigImportPlan, access: ConfigAccess): number => {
    for (const write of plan.writes) {
        if (!sameConfigValue(access.read(write.storage, write.key), write.before)) {
            throw new Error('预览后设置已发生变化，请重新预览再应用')
        }
    }
    const applied: ConfigWrite[] = []
    try {
        // Close the shared automatic-sync switch before modifying rules so
        // other tabs also see it before their value-change listeners react.
        const writes = [...plan.writes].sort((a, b) =>
            a.key === 'biliweb-sync-enabled' ? -1 : b.key === 'biliweb-sync-enabled' ? 1 : 0)
        for (const write of writes) {
            // Include attempted write in rollback: a manager can throw after saving.
            applied.push(write)
            if (write.value === undefined) access.remove(write.storage, write.key)
            else access.write(write.storage, write.key, write.value)
        }
    } catch (error) {
        let failed = false
        for (const write of applied.reverse()) {
            try {
                if (write.before === undefined || write.before === null) access.remove(write.storage, write.key)
                else access.write(write.storage, write.key, write.before as ConfigValue)
            } catch {
                failed = true
            }
        }
        throw new Error(
            failed
                ? '保存失败，部分数据未能回滚。请从导入前备份恢复。'
                : `保存失败，已恢复导入前的数据：${String(error)}`,
        )
    }
    return plan.writes.length
}
