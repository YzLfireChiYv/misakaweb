import { getCurrentScope, onScopeDispose, ref, type Ref } from 'vue'
import { GM_addValueChangeListener, GM_getValue, GM_removeValueChangeListener, GM_setValue } from '@/storage/configStorage'

/**
 * Device-local UI preference for the page quick entry.
 *
 * Future cloud / rule sync must exclude SHORTCUT_PREFERENCE_KEY. It is not a
 * content rule and is not part of RULE_FIELDS. This module never writes on
 * startup, never echoes listener-fed values back to GM, and never deletes
 * the legacy localStorage side-show flag.
 *
 * Legacy `bili-cleaner-side-btn-show` used to select the floating button. It
 * is no longer a default selector: missing/invalid GM data uses the header
 * location even if that flag is true. The old key is preserved in place.
 * Floating coordinates remain `bili-cleaner-side-btn-pos`.
 */
export const SHORTCUT_PREFERENCE_KEY = 'biliweb-shortcut-entry'
export const LEGACY_SIDE_SHOW_KEY = 'bili-cleaner-side-btn-show'
export const LEGACY_SIDE_POS_KEY = 'bili-cleaner-side-btn-pos'

export type ShortcutLocation = 'header' | 'floating'

export type ShortcutPreference = {
    enabled: boolean
    location: ShortcutLocation
}

export const SHORTCUT_PREFERENCE_DEFAULT: ShortcutPreference = {
    enabled: true,
    location: 'header',
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const isLocation = (value: unknown): value is ShortcutLocation => value === 'header' || value === 'floating'

/** Pure. Invalid or partial values become in-memory defaults. Does not write. */
export const normalizeShortcutPreference = (raw: unknown): ShortcutPreference => {
    if (!isRecord(raw)) {
        return { ...SHORTCUT_PREFERENCE_DEFAULT }
    }
    return {
        enabled: typeof raw.enabled === 'boolean' ? raw.enabled : SHORTCUT_PREFERENCE_DEFAULT.enabled,
        location: isLocation(raw.location) ? raw.location : SHORTCUT_PREFERENCE_DEFAULT.location,
    }
}

export const readShortcutPreference = (): ShortcutPreference => {
    const raw = GM_getValue(SHORTCUT_PREFERENCE_KEY)
    return normalizeShortcutPreference(raw)
}

const writeValidated = (value: ShortcutPreference): ShortcutPreference => {
    const next = normalizeShortcutPreference(value)
    GM_setValue(SHORTCUT_PREFERENCE_KEY, { enabled: next.enabled, location: next.location })
    return next
}

let shared: Ref<ShortcutPreference> | null = null
let listenerId: string | number | undefined
let holders = 0

const samePref = (a: ShortcutPreference, b: ShortcutPreference) =>
    a.enabled === b.enabled && a.location === b.location

const attachListener = () => {
    if (listenerId != null) {
        return
    }
    listenerId = GM_addValueChangeListener(SHORTCUT_PREFERENCE_KEY, (_name, _oldValue, newValue) => {
        if (!shared) {
            return
        }
        const next = normalizeShortcutPreference(newValue)
        if (samePref(shared.value, next)) {
            return
        }
        shared.value = next
    })
}

const detachListener = () => {
    if (listenerId != null) {
        GM_removeValueChangeListener(listenerId)
        listenerId = undefined
    }
}

const ensureState = (): Ref<ShortcutPreference> => {
    if (!shared) {
        shared = ref(readShortcutPreference())
    } else if (holders === 0) {
        shared.value = readShortcutPreference()
    }
    attachListener()
    return shared
}

export const useShortcutPreference = () => {
    const state = ensureState()
    holders += 1
    if (getCurrentScope()) {
        onScopeDispose(() => {
            holders -= 1
            if (holders <= 0) {
                holders = 0
                detachListener()
            }
        })
    }

    const apply = (patch: Partial<ShortcutPreference>) => {
        const current = readShortcutPreference()
        const next = writeValidated({
            enabled: patch.enabled ?? current.enabled,
            location: patch.location ?? current.location,
        })
        state.value = next
        return next
    }

    return {
        state,
        setEnabled: (enabled: boolean) => apply({ enabled }),
        setLocation: (location: ShortcutLocation) => apply({ location }),
        setPreference: apply,
    }
}

/** Test helper: drop cached state so the next reader loads GM again. */
export const resetShortcutPreferenceState = () => {
    detachListener()
    shared = null
    holders = 0
}

/** Test/fixture helper: replace in-memory state from current GM without writing. */
export const hydrateShortcutPreferenceFromStorage = () => {
    const next = readShortcutPreference()
    if (shared) {
        shared.value = next
        return next
    }
    shared = ref(next)
    attachListener()
    return next
}
