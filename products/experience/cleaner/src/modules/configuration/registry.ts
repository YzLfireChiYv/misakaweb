import { rules } from '@/modules/rules'
import { articleFilters, commentFilters, dynamicFilters, videoFilters } from '@/modules/filters'
import { RULE_FIELDS } from '@/modules/filters/rulePack'
import { SHORTCUT_PREFERENCE_DEFAULT, SHORTCUT_PREFERENCE_KEY } from '@/modules/shortcut/preference'
import type { Item } from '@/types/item'
import type { ConfigDefinition, ConfigValue } from './backup'

const ruleKeys = new Set(RULE_FIELDS.map((field) => field.gm))
const profile = __BUILD_PROFILE__
const pageLabels: Record<string, string> = {
    homepage: '首页',
    video: '播放页',
    festival: '活动页',
    bangumi: '番剧页',
    dynamic: '动态页',
    live: '直播页',
    popular: '热门页',
    channel: '分区页',
    space: '空间页',
    search: '搜索页',
    watchlater: '稍后再看',
    comment: '评论区',
    common: '全站',
    debug: '调试',
}
const suffix = (id: string) => {
    const classification = __SETTING_SECTIONS__[id]
    return classification?.category === 'optimization'
        ? `优化 - ${classification.packLabel ?? '其他'}`
        : classification?.category === 'cleaning'
          ? '净化'
          : '公共设置'
}

/** Build from live Item definitions, not the engineering review catalog. */
export const getConfigurationDefinitions = (): ConfigDefinition[] => {
    const definitions = new Map<string, ConfigDefinition>()
    const add = (incoming: ConfigDefinition) => {
        const identity = incoming.storage + ':' + incoming.key
        const existing = definitions.get(identity)
        if (!existing) {
            definitions.set(identity, incoming)
            return
        }
        existing.groups = [...new Set([...existing.groups, ...incoming.groups])]
        for (const value of incoming.defaults) {
            if (!existing.defaults.some((v) => v.context === value.context)) existing.defaults.push(value)
        }
        if (incoming.min !== undefined) existing.min = Math.min(existing.min ?? incoming.min, incoming.min)
        if (incoming.max !== undefined) existing.max = Math.max(existing.max ?? incoming.max, incoming.max)
        if (incoming.disabled) existing.disabled = [...(existing.disabled ?? []), ...incoming.disabled]
        if (incoming.options)
            existing.options = [
                ...new Map([...(existing.options ?? []), ...incoming.options].map((v) => [v.value, v])).values(),
            ]
    }
    const addItem = (item: Item, context: string, isFilter: boolean) => {
        if (item.type === 'webdav') {
            for (const [key, name] of [
                [item.urlId, 'WebDAV 地址'],
                [item.userId, 'WebDAV 账号'],
                [item.passwordId, 'WebDAV 密码'],
            ]) {
                add({
                    key: key!,
                    name: name!,
                    storage: 'gm',
                    scope: 'secrets',
                    kind: 'string',
                    groups: ['当前设备 - WebDAV 连接'],
                    defaults: [{ context: '当前设备', value: '' }],
                    availableProfiles: [profile],
                })
            }
            return
        }
        const defaultValue: ConfigValue =
            item.type === 'switch' ? Boolean(item.defaultEnable) : item.type === 'editor' ? [] : item.defaultValue
        const definition: ConfigDefinition = {
            key: item.id,
            name: item.name,
            storage: 'gm',
            scope: item.id === 'biliweb-sync-enabled' ? 'device' : ruleKeys.has(item.id) ? 'rules' : 'settings',
            kind: item.type === 'editor' ? 'lines' : item.type === 'list' ? 'choice' : item.type,
            groups: [context],
            defaults: [{ context, value: defaultValue }],
            availableProfiles: [profile],
        }
        if (isFilter && item.type === 'editor') definition.scope = 'rules'
        if (item.type === 'number') {
            definition.min = item.minValue
            definition.max = item.maxValue
            definition.disabled = [item.disableValue]
        }
        if (item.type === 'list') {
            definition.options = item.options.map(({ value, name }) => ({ value, name }))
            definition.disabled = [item.disableValue]
        }
        if (item.type === 'string') definition.disabled = [item.disableValue]
        add(definition)
    }
    for (const rule of rules) {
        for (const group of rule.groups) {
            for (const item of group.items)
                addItem(item, `${pageLabels[rule.name] ?? rule.name} / ${group.name} - ${suffix(item.id)}`, false)
        }
    }
    for (const filter of [...videoFilters, ...commentFilters, ...dynamicFilters, ...articleFilters]) {
        for (const group of filter.groups) {
            for (const item of group.items) addItem(item, `${filter.name} / ${group.name}`, true)
        }
    }
    // Some rules have no editor on a particular page. Their persistent values
    // still belong to the full backup, independently of the current page.
    for (const field of RULE_FIELDS) {
        if (definitions.has('gm:' + field.gm)) continue
        add({
            key: field.gm,
            name: field.gm,
            storage: 'gm',
            scope: 'rules',
            kind: field.kind === 'list' ? 'lines' : 'number',
            groups: ['全站 / 过滤规则'],
            defaults: [{ context: '过滤器', value: field.absent }],
            availableProfiles: [profile],
        })
    }
    add({
        key: SHORTCUT_PREFERENCE_KEY,
        name: '页面快捷入口',
        storage: 'gm',
        scope: 'device',
        kind: 'shortcut',
        groups: ['当前设备 / 快捷开关'],
        defaults: [{ context: '当前设备', value: SHORTCUT_PREFERENCE_DEFAULT }],
        availableProfiles: [profile],
    })
    add({
        key: 'bili-cleaner-side-btn-pos',
        name: '悬浮按钮位置',
        storage: 'local',
        scope: 'device',
        kind: 'position',
        groups: ['当前站点 / 界面位置'],
        defaults: [{ context: '当前站点', value: { right: 10, bottom: 180 } }],
        availableProfiles: [profile],
    })
    add({
        key: 'bili-cleaner-mini-player-pos',
        name: '小窗播放器位置',
        storage: 'local',
        scope: 'device',
        kind: 'position',
        groups: ['当前站点 / 界面位置'],
        defaults: [{ context: '当前站点', value: { tx: 0, ty: 0 } }],
        availableProfiles: [profile],
    })
    add({
        key: 'bili-cleaner-mini-player-zoom',
        name: '小窗播放器缩放',
        storage: 'local',
        scope: 'device',
        kind: 'zoom',
        min: 0.1,
        max: 10,
        groups: ['当前站点 / 界面位置'],
        defaults: [{ context: '当前站点', value: 1 }],
        availableProfiles: [profile],
    })
    return [...definitions.values()]
}
