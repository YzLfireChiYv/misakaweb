import { actionsByKey, menusByKey, settingsByKey } from '@feedback-index'
import { FEEDBACK_LABELS } from './enabled'

export { FEEDBACK_LABELS } from './enabled'

const lookup = (table: Record<string, string>, key: string): string => {
    if (!FEEDBACK_LABELS) {
        return ''
    }
    return table[key] ?? ''
}

export const settingLabel = (key: string): string => lookup(settingsByKey, key)

export const menuLabel = (key: string): string => lookup(menusByKey, key)

export const actionLabel = (key: string): string => lookup(actionsByKey, key)

export const withMenuId = (key: string, text: string): string => {
    const id = menuLabel(key)
    return id ? `[${id}] ${text}` : text
}
