import { createPinia, setActivePinia } from 'pinia'
import { effectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
    LEGACY_SIDE_POS_KEY,
    LEGACY_SIDE_SHOW_KEY,
    SHORTCUT_PREFERENCE_DEFAULT,
    SHORTCUT_PREFERENCE_KEY,
    hydrateShortcutPreferenceFromStorage,
    normalizeShortcutPreference,
    readShortcutPreference,
    resetShortcutPreferenceState,
    useShortcutPreference,
} from '../src/modules/shortcut/preference'
import { __gmReset, __gmStore, GM_getValue, GM_setValue } from './gm-mock'

beforeEach(() => {
    __gmReset()
    resetShortcutPreferenceState()
    setActivePinia(createPinia())
})

afterEach(() => {
    resetShortcutPreferenceState()
    __gmReset()
})

describe('shortcut preference storage', () => {
    it('re-reads and reattaches storage listeners after the last scope is disposed', () => {
        const firstScope = effectScope()
        firstScope.run(() => useShortcutPreference())
        firstScope.stop()
        GM_setValue(SHORTCUT_PREFERENCE_KEY, { enabled: false, location: 'floating' })
        const nextScope = effectScope()
        const next = nextScope.run(() => useShortcutPreference())!
        expect(next.state.value).toEqual({ enabled: false, location: 'floating' })
        GM_setValue(SHORTCUT_PREFERENCE_KEY, { enabled: true, location: 'header' })
        expect(next.state.value).toEqual({ enabled: true, location: 'header' })
        nextScope.stop()
    })

    it('uses header+enabled defaults without writing at init', () => {
        expect(readShortcutPreference()).toEqual(SHORTCUT_PREFERENCE_DEFAULT)
        expect(__gmStore.has(SHORTCUT_PREFERENCE_KEY)).toBe(false)
        expect(GM_getValue(SHORTCUT_PREFERENCE_KEY)).toBeUndefined()
    })

    it('rejects invalid stored mode and type without overwriting GM', () => {
        __gmStore.set(SHORTCUT_PREFERENCE_KEY, { enabled: true, location: 'nope' })
        expect(readShortcutPreference()).toEqual({ enabled: true, location: 'header' })
        expect(__gmStore.get(SHORTCUT_PREFERENCE_KEY)).toEqual({ enabled: true, location: 'nope' })

        __gmStore.set(SHORTCUT_PREFERENCE_KEY, 12)
        expect(readShortcutPreference()).toEqual(SHORTCUT_PREFERENCE_DEFAULT)
        expect(__gmStore.get(SHORTCUT_PREFERENCE_KEY)).toBe(12)
    })

    it('writes only from the validated setter', () => {
        const scope = effectScope()
        const pref = scope.run(() => useShortcutPreference())
        if (!pref) {
            throw new Error('preference hook missing')
        }
        expect(__gmStore.has(SHORTCUT_PREFERENCE_KEY)).toBe(false)
        pref.setLocation('floating')
        expect(__gmStore.get(SHORTCUT_PREFERENCE_KEY)).toEqual({ enabled: true, location: 'floating' })
        pref.setEnabled(false)
        expect(__gmStore.get(SHORTCUT_PREFERENCE_KEY)).toEqual({ enabled: false, location: 'floating' })
        expect(LEGACY_SIDE_SHOW_KEY).toBe('bili-cleaner-side-btn-show')
        expect(LEGACY_SIDE_POS_KEY).toBe('bili-cleaner-side-btn-pos')
        scope.stop()
    })

    it('updates in-memory state from a value listener without writing invalid data back', () => {
        const scope = effectScope()
        const pref = scope.run(() => useShortcutPreference())
        if (!pref) {
            throw new Error('preference hook missing')
        }
        GM_setValue(SHORTCUT_PREFERENCE_KEY, { enabled: false, location: 'floating' })
        expect(pref.state.value).toEqual({ enabled: false, location: 'floating' })

        GM_setValue(SHORTCUT_PREFERENCE_KEY, { enabled: 'yes', location: 'side' })
        expect(pref.state.value).toEqual(SHORTCUT_PREFERENCE_DEFAULT)
        expect(__gmStore.get(SHORTCUT_PREFERENCE_KEY)).toEqual({ enabled: 'yes', location: 'side' })
        scope.stop()
    })

    it('reloads a hydrated invalid snapshot into safe defaults without rewriting', () => {
        __gmStore.set(SHORTCUT_PREFERENCE_KEY, { location: 'floating' })
        hydrateShortcutPreferenceFromStorage()
        expect(readShortcutPreference()).toEqual({ enabled: true, location: 'floating' })
        expect(__gmStore.get(SHORTCUT_PREFERENCE_KEY)).toEqual({ location: 'floating' })
        expect(normalizeShortcutPreference(null)).toEqual(SHORTCUT_PREFERENCE_DEFAULT)
    })
})
