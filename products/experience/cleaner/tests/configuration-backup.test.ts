import { describe, expect, it } from 'vitest'
import {
    applyConfigurationPlan,
    createConfigurationBackup,
    parseConfigurationBackup,
    planConfigurationImport,
    type ConfigAccess,
    type ConfigDefinition,
    type ConfigValue,
} from '../src/modules/configuration/backup'

const definitions: ConfigDefinition[] = [
    {
        key: 'clean-a',
        name: '净化 A',
        storage: 'gm',
        scope: 'settings',
        kind: 'switch',
        groups: ['首页'],
        defaults: [
            { context: '首页', value: true },
            { context: '播放页', value: false },
        ],
        availableProfiles: ['development'],
    },
    {
        key: 'rule-list',
        name: '标题规则',
        storage: 'gm',
        scope: 'rules',
        kind: 'lines',
        groups: ['视频'],
        defaults: [{ context: '视频', value: [] }],
        availableProfiles: ['development'],
    },
    {
        key: 'rule-min',
        name: '最低点赞率',
        storage: 'gm',
        scope: 'rules',
        kind: 'number',
        min: 0,
        max: 100,
        disabled: [-1],
        groups: ['视频'],
        defaults: [{ context: '视频', value: 0 }],
        availableProfiles: ['development'],
    },
    {
        key: 'biliweb-shortcut-entry',
        name: '入口',
        storage: 'gm',
        scope: 'device',
        kind: 'shortcut',
        groups: ['设备'],
        defaults: [{ context: '设备', value: { enabled: true, location: 'header' } }],
        availableProfiles: ['development'],
    },
    {
        key: 'biliweb-sync-enabled',
        name: '同步',
        storage: 'gm',
        scope: 'device',
        kind: 'switch',
        groups: ['设备'],
        defaults: [{ context: '设备', value: false }],
        availableProfiles: ['development'],
    },
    {
        key: 'biliweb-sync-password',
        name: '密码',
        storage: 'gm',
        scope: 'secrets',
        kind: 'string',
        groups: ['连接'],
        defaults: [{ context: '连接', value: '' }],
        availableProfiles: ['development'],
    },
]
const memory = (initial: Record<string, ConfigValue> = {}) => {
    const values = new Map(Object.entries(initial))
    const writes: string[] = []
    const access: ConfigAccess = {
        read: (_storage, key) => values.get(key),
        write: (_storage, key, value) => {
            writes.push(key)
            values.set(key, value)
        },
        remove: (_storage, key) => {
            writes.push(key)
            values.delete(key)
        },
    }
    return { values, writes, access }
}
const options = { scriptVersion: '0.1.5', profile: 'development', now: '2026-10-11T12:00:00Z' }

describe('registered configuration backups', () => {
    it('permits explicit local sync-switch enable only for a single-setting plan', () => {
        const syncDefinition = definitions.filter((v) => v.key === 'biliweb-sync-enabled')
        const source = memory({ 'biliweb-sync-enabled': true })
        const backup = createConfigurationBackup(syncDefinition, source.access, options)
        const local = memory({ 'biliweb-sync-enabled': false })
        const manual = planConfigurationImport(backup, definitions, local.access, 'restore', { allowManualSyncEnable: true })
        applyConfigurationPlan(manual, local.access)
        expect(local.values.get('biliweb-sync-enabled')).toBe(true)
        const fileImport = memory({ 'biliweb-sync-enabled': false })
        applyConfigurationPlan(planConfigurationImport(backup, definitions, fileImport.access, 'restore'), fileImport.access)
        expect(fileImport.values.get('biliweb-sync-enabled')).toBe(false)
        const full = createConfigurationBackup(definitions, source.access, options)
        const multi = memory({ 'biliweb-sync-enabled': false })
        applyConfigurationPlan(planConfigurationImport(full, definitions, multi.access, 'restore', { allowManualSyncEnable: true }), multi.access)
        expect(multi.values.get('biliweb-sync-enabled')).toBe(false)
    })
    it('exports only registered scopes, retains inherited defaults without writing, and excludes secrets by default', () => {
        const m = memory({ 'rule-list': ['A'], 'biliweb-sync-password': 'SECRET', 'runtime-cache': 'private' })
        const backup = createConfigurationBackup(definitions, m.access, options)
        expect(backup.entries.find((v) => v.key === 'clean-a')?.state).toBe('absent')
        expect(backup.definitions[0]?.defaults).toHaveLength(2)
        expect(JSON.stringify(backup)).not.toContain('SECRET')
        expect(JSON.stringify(backup)).not.toContain('runtime-cache')
        expect(backup.scopes).toContain('device')
        expect(m.writes).toHaveLength(0)
        expect(parseConfigurationBackup(JSON.stringify(backup))).toEqual(backup)
    })
    it('merge keeps explicitly absent values while restore removes only explicit absences', () => {
        const source = memory({ 'rule-list': ['new'] })
        const backup = createConfigurationBackup(definitions, source.access, { ...options, includeDevice: false })
        const m = memory({
            'clean-a': false,
            'rule-list': ['old'],
            'biliweb-shortcut-entry': { enabled: false, location: 'floating' },
        })
        applyConfigurationPlan(planConfigurationImport(backup, definitions, m.access), m.access)
        expect(m.values.get('clean-a')).toBe(false)
        expect(m.values.get('rule-list')).toEqual(['new'])
        applyConfigurationPlan(planConfigurationImport(backup, definitions, m.access, 'restore'), m.access)
        expect(m.values.has('clean-a')).toBe(false)
        expect(m.values.get('biliweb-shortcut-entry')).toEqual({ enabled: false, location: 'floating' })
    })
    it('unknown cross-package keys are ignored and imported ranges never authorize invalid values', () => {
        const source = memory({ 'rule-min': 10 })
        const backup = createConfigurationBackup(definitions, source.access, options)
        backup.definitions = structuredClone(backup.definitions)
        backup.entries.push({
            key: 'future-player-setting',
            storage: 'gm',
            scope: 'settings',
            state: 'saved',
            value: true,
        })
        const m = memory()
        expect(planConfigurationImport(backup, definitions, m.access).ignored).toEqual(['future-player-setting'])
        backup.entries.find((v) => v.key === 'rule-min')!.value = 101
        backup.definitions.find((v) => v.key === 'rule-min')!.max = 999
        expect(() => planConfigurationImport(backup, definitions, m.access)).toThrow('值不合法')
        expect(m.writes).toHaveLength(0)
    })
    it('rejects unsupported schemas, duplicate entries and invalid shortcut objects before writes', () => {
        const m = memory()
        const backup = createConfigurationBackup(definitions, m.access, options)
        expect(() => parseConfigurationBackup({ ...backup, schemaVersion: 2 })).toThrow('尚不支持')
        expect(() => parseConfigurationBackup({ ...backup, entries: [backup.entries[0], backup.entries[0]] })).toThrow(
            '重复',
        )
        const shortcut = backup.entries.find((v) => v.key === 'biliweb-shortcut-entry')!
        shortcut.state = 'saved'
        shortcut.value = { enabled: true, location: 'outside', extra: false }
        expect(() => planConfigurationImport(backup, definitions, m.access)).toThrow('值不合法')
        expect(m.writes).toHaveLength(0)
    })
    it('never imports an enabled sync flag and turns off existing automatic sync even when device scope is omitted', () => {
        const source = memory({ 'rule-list': ['new'], 'biliweb-sync-enabled': true })
        const backup = createConfigurationBackup(definitions, source.access, options)
        const m = memory({ 'biliweb-sync-enabled': true })
        const plan = planConfigurationImport(backup, definitions, m.access)
        applyConfigurationPlan(plan, m.access)
        expect(m.values.get('biliweb-sync-enabled')).toBe(false)
        expect(plan.notices.join()).toContain('同步开关保持关闭')
        const noDevice = createConfigurationBackup(definitions, source.access, { ...options, includeDevice: false })
        const existing = memory({ 'biliweb-sync-enabled': true })
        applyConfigurationPlan(planConfigurationImport(noDevice, definitions, existing.access), existing.access)
        expect(existing.values.get('biliweb-sync-enabled')).toBe(false)
        expect(existing.writes[0]).toBe('biliweb-sync-enabled')
    })
    it('rolls back earlier and partially failed writes, preserving absent keys', () => {
        const source = memory({ 'clean-a': true, 'rule-list': ['new'] })
        const backup = createConfigurationBackup(definitions, source.access, options)
        const m = memory({ 'rule-list': ['old'] })
        let fail = true
        const access = {
            ...m.access,
            write: (storage: 'gm' | 'local', key: string, value: ConfigValue) => {
                m.access.write(storage, key, value)
                if (key === 'rule-list' && fail) {
                    fail = false
                    throw new Error('disk full')
                }
            },
        }
        const plan = planConfigurationImport(backup, definitions, access)
        expect(() => applyConfigurationPlan(plan, access)).toThrow('已恢复')
        expect(m.values.get('rule-list')).toEqual(['old'])
        expect(m.values.has('clean-a')).toBe(false)
    })
    it('rejects stale preview and supports the registered disabled sentinel', () => {
        const source = memory({ 'clean-a': true, 'rule-min': -1 })
        const backup = createConfigurationBackup(definitions, source.access, options)
        const m = memory()
        const plan = planConfigurationImport(backup, definitions, m.access)
        m.values.set('clean-a', false)
        expect(() => applyConfigurationPlan(plan, m.access)).toThrow('预览后设置已发生变化')
        expect(m.writes).toHaveLength(0)
    })
})
