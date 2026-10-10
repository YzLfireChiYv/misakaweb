import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useQuickActions } from '../src/modules/shortcut/actions'
import { useRulePanelStore, useShortcutSettingsStore } from '../src/stores/view'
import { actionsByKey, menusByKey } from '../src/feedback/id-index.generated'

describe('shared quick actions', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
    })

    it('keeps B19 as page cleaning and opens shortcut settings without toggling it closed', () => {
        const actions = useQuickActions()
        const pageClean = actions.value.find((item) => item.actionKey === 'side-rule-panel')
        const settings = actions.value.find((item) => item.actionKey === 'side-shortcut-settings')
        expect(pageClean?.text).toBe('页面净化')
        expect(pageClean?.isValid).toBe(true)
        expect(actions.value.at(-1)?.actionKey).toBe('side-rule-panel')
        expect(actionsByKey['side-rule-panel']).toBe('B19')
        expect(menusByKey['menu-side-btn']).toBe('M07')

        const rule = useRulePanelStore()
        pageClean?.run()
        expect(rule.isShow).toBe(true)

        const shortcut = useShortcutSettingsStore()
        settings?.run()
        expect(shortcut.isShow).toBe(true)
        expect(shortcut.openToken).toBe(1)
        settings?.run()
        expect(shortcut.isShow).toBe(true)
        expect(shortcut.openToken).toBe(2)
    })

    it('reads page validity again after navigation rather than caching the first page', () => {
        try {
            vi.stubGlobal('location', new URL('https://www.bilibili.com/'))
            const actions = useQuickActions()
            expect(actions.value.find((item) => item.actionKey === 'side-comment-filter')?.isValid).toBe(false)
            vi.stubGlobal('location', new URL('https://www.bilibili.com/video/BV1xx411c7mD/'))
            expect(actions.value.find((item) => item.actionKey === 'side-comment-filter')?.isValid).toBe(true)
            vi.stubGlobal('location', new URL('https://www.bilibili.com/unknown/'))
            expect(actions.value.find((item) => item.actionKey === 'side-comment-filter')?.isValid).toBe(false)
        } finally {
            vi.unstubAllGlobals()
        }
    })
})
