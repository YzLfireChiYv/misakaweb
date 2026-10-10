import { createApp, type App } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import SwitchComp from '../src/components/items/SwitchComp.vue'
import NumberComp from '../src/components/items/NumberComp.vue'
import StringComp from '../src/components/items/StringComp.vue'
import ListComp from '../src/components/items/ListComp.vue'
import EditorComp from '../src/components/items/EditorComp.vue'
import WebdavComp from '../src/components/items/WebdavComp.vue'
import { settingsByKey } from '../src/feedback/id-index.generated'
import { __gmReset, __gmStore } from './gm-mock'

const mounts: App[] = []

const mountComp = (component: unknown, props: Record<string, unknown>) => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const app = createApp(component as never, props)
    app.mount(host)
    mounts.push(app)
    return host
}

afterEach(() => {
    for (const app of mounts.splice(0)) {
        app.unmount()
    }
    document.body.innerHTML = ''
    __gmReset()
})

describe('feedback labels on rendered controls', () => {
    it('shows setting ids and writes the original GM key', async () => {
        const key = 'homepage-hide-banner'
        const host = mountComp(SwitchComp, {
            type: 'switch',
            id: key,
            name: '隐藏 横幅banner',
        })
        const code = settingsByKey[key]
        const badge = host.querySelector('[data-feedback-id]')
        expect(badge?.textContent).toBe(code)
        expect(host.textContent).toContain('隐藏 横幅banner')

        const button = host.querySelector('button')
        expect(button).toBeTruthy()
        button?.click()
        await Promise.resolve()
        expect(__gmStore.get(key)).toBe(true)
        expect([...__gmStore.keys()].some((k) => k.startsWith('S') || k.includes('feedback'))).toBe(false)
    })

    it('labels number/string/list/editor without changing handlers', async () => {
        const numberHost = mountComp(NumberComp, {
            type: 'number',
            id: 'biliweb-stat-like-min',
            name: '最低点赞数',
            minValue: 0,
            maxValue: 99,
            step: 1,
            defaultValue: 0,
            disableValue: -1,
            fn: () => {},
        })
        expect(numberHost.querySelector('[data-feedback-id]')?.textContent).toBe(settingsByKey['biliweb-stat-like-min'])

        const stringHost = mountComp(StringComp, {
            type: 'string',
            id: 'video-page-danmaku-font-family',
            name: '弹幕字体',
            defaultValue: '',
            disableValue: '',
            fn: () => {},
        })
        expect(stringHost.querySelector('[data-feedback-id]')?.textContent).toBe(
            settingsByKey['video-page-danmaku-font-family'],
        )

        const listHost = mountComp(ListComp, {
            type: 'list',
            id: 'homepage-layout',
            name: '首页布局',
            defaultValue: 'off',
            disableValue: 'off',
            options: [
                { value: 'off', name: '关闭' },
                { value: 'two', name: '两列' },
            ],
        })
        expect(listHost.querySelector('[data-feedback-id]')?.textContent).toBe(settingsByKey['homepage-layout'])

        const editorHost = mountComp(EditorComp, {
            type: 'editor',
            id: 'global-uploader-filter-value',
            name: '编辑 UP主黑名单',
            editorTitle: 'UP主黑名单',
            saveFn: () => {},
        })
        expect(editorHost.querySelector('[data-feedback-id]')?.textContent).toBe(
            settingsByKey['global-uploader-filter-value'],
        )
    })

    it('labels WebDAV fields and verify, saving original keys', async () => {
        const host = mountComp(WebdavComp, {
            type: 'webdav',
            id: 'biliweb-sync-form',
            name: 'WebDAV',
            urlId: 'biliweb-sync-url',
            userId: 'biliweb-sync-user',
            passwordId: 'biliweb-sync-password',
            onEdit: () => {},
            verify: async () => '已连通',
        })
        const ids = [...host.querySelectorAll('[data-feedback-id]')].map((el) => el.getAttribute('data-feedback-id'))
        expect(ids).toContain(settingsByKey['biliweb-sync-form'])
        expect(ids).toContain(settingsByKey['biliweb-sync-url'])
        expect(ids).toContain(settingsByKey['biliweb-sync-user'])
        expect(ids).toContain(settingsByKey['biliweb-sync-password'])
        expect(ids.some((id) => id?.startsWith('B'))).toBe(true)

        const url = host.querySelector('input[type="url"]') as HTMLInputElement
        url.value = 'https://example.com/dav/'
        url.dispatchEvent(new Event('input', { bubbles: true }))
        await new Promise((resolve) => setTimeout(resolve, 300))
        expect(__gmStore.get('biliweb-sync-url')).toBe('https://example.com/dav/')
        expect(__gmStore.has('S026')).toBe(false)
        expect(__gmStore.has('feedback-biliweb-sync-url')).toBe(false)
    })
})
