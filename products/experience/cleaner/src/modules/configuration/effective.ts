import { GM_getValue } from '@/storage/configStorage'
import type { IListItem, INumberItem, IStringItem, ISwitchItem } from '@/types/item'

type SettingValue = boolean | number | string | string[]
type ValueItem = ISwitchItem | INumberItem | IStringItem | IListItem

const matchesValue = (value: unknown, fallback: SettingValue): boolean => {
    if (Array.isArray(fallback)) return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
    if (typeof fallback === 'number') return typeof value === 'number' && Number.isFinite(value)
    return typeof value === typeof fallback
}

export const settingDefault = <T extends SettingValue>(key: string, fallback: T, field?: string): T => {
    const value = __PRODUCT_DEFAULTS__[field ? `${key}.${field}` : key]
    return matchesValue(value, fallback) ? (value as T) : fallback
}

/** Resolve a runtime value without writing defaults or changing the raw storage API. */
export const readSettingValue = <T extends SettingValue>(key: string, fallback: T): T => {
    const saved: unknown = GM_getValue(key)
    return matchesValue(saved, fallback) ? (saved as T) : settingDefault(key, fallback)
}

export const declaredItemDefault = (item: ValueItem) =>
    item.type === 'switch' ? !!item.defaultEnable : item.defaultValue

export function readItemValue(item: ISwitchItem): boolean
export function readItemValue(item: INumberItem): number
export function readItemValue(item: IStringItem | IListItem): string
export function readItemValue(item: ValueItem): SettingValue {
    return readSettingValue(item.id, declaredItemDefault(item))
}
