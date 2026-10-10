import { createApp } from 'vue'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/feedback/enabled', () => ({
    FEEDBACK_LABELS: false,
}))

vi.mock('@feedback-index', () => ({
    settingsByKey: {},
    menusByKey: {},
    actionsByKey: {},
}))

describe('standard-mode labels stay off', () => {
    it('does not render badges when the compile flag is false', async () => {
        const { settingLabel } = await import('../src/feedback/index')
        expect(settingLabel('homepage-hide-banner')).toBe('')

        const SwitchComp = (await import('../src/components/items/SwitchComp.vue')).default
        const host = document.createElement('div')
        document.body.appendChild(host)
        const app = createApp(SwitchComp, {
            type: 'switch',
            id: 'homepage-hide-banner',
            name: '隐藏 横幅banner',
        })
        app.mount(host)
        expect(host.querySelector('[data-feedback-id]')).toBeNull()
        expect(host.textContent).toContain('隐藏 横幅banner')
        expect(host.textContent ?? '').not.toMatch(/S\d{3}/)
        app.unmount()
        host.remove()
    })
})
