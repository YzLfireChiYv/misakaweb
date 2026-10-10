import type { Group } from '@/types/collection'

export type SettingSection = {
    category: 'cleaning' | 'optimization' | 'support'
    pack?: string
    packLabel?: string
}
export type SettingSections = Record<string, SettingSection>
export type SectionGroup = Group & { sectionKey: string }

// The build supplies public, fixed classifications. No review storage or GM IO.
// Keep the actual Item references so grouping cannot change defaults or callbacks.
export const sectionGroups = (groups: Group[], classification: SettingSections): SectionGroup[] =>
    groups.flatMap((group, groupIndex) => {
        const sections = new Map<string, SectionGroup>()
        for (const item of group.items) {
            const entry = classification[item.id] ?? { category: 'support' }
            const suffix = entry.category === 'cleaning' ? '净化'
                : entry.category === 'optimization' ? '优化 - ' + (entry.packLabel ?? '其他') : '公共设置'
            const key = entry.category + ':' + (entry.pack ?? '')
            const section = sections.get(key) ?? {
                name: group.name + ' - ' + suffix,
                fold: group.fold,
                items: [],
                sectionKey: groupIndex + ':' + key,
            }
            section.items.push(item)
            sections.set(key, section)
        }
        const rank = (section: SectionGroup) => section.sectionKey.includes(':cleaning:') ? 0
            : section.sectionKey.includes(':optimization:') ? 1 : 2
        return [...sections.values()].sort((a, b) => rank(a) - rank(b))
    })
