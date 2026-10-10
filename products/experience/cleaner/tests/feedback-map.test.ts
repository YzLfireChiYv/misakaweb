import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'vitest'
import { actionsByKey, menusByKey, settingsByKey } from '../src/feedback/id-index.generated'
import { contextActionKey } from '../src/feedback/context-actions'
import { buildMap, collectOccurrences } from '../scripts/update-control-map.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const map = JSON.parse(readFileSync(join(root, 'src/feedback/control-map.json'), 'utf8'))

describe('feedback control map', () => {
    it('covers every live product key without duplicate ids', () => {
        const { map: rebuilt } = buildMap()
        const liveKeys = new Set(collectOccurrences().map((row) => row.id))
        const mappedKeys = new Set(map.settings.map((row: { key: string }) => row.key))
        const missing = [...liveKeys].filter((key) => !mappedKeys.has(key))
        assert.deepEqual(missing, [])

        const ids = map.settings.map((row: { id: string }) => row.id)
        assert.equal(new Set(ids).size, ids.length)
        assert.equal(new Set(map.menus.map((row: { id: string }) => row.id)).size, map.menus.length)
        assert.equal(new Set(map.actions.map((row: { id: string }) => row.id)).size, map.actions.length)

        const rebuiltByKey = new Map(rebuilt.settings.map((row) => [row.key, row.id]))
        for (const row of map.settings) {
            if (liveKeys.has(row.key)) {
                assert.equal(rebuiltByKey.get(row.key), row.id)
            }
        }
    })

    it('keeps experience keys and reuses one S id per persisted key', () => {
        const experience = [
            'biliweb-stat-view-status',
            'biliweb-stat-view-min',
            'biliweb-stat-like-status',
            'biliweb-stat-like-min',
            'biliweb-stat-like-rate-status',
            'biliweb-stat-like-rate-min',
            'biliweb-stat-fav-status',
            'biliweb-stat-fav-min',
            'biliweb-stat-fav-rate-status',
            'biliweb-stat-fav-rate-min',
            'biliweb-sync-enabled',
            'biliweb-sync-form',
            'biliweb-sync-url',
            'biliweb-sync-user',
            'biliweb-sync-password',
        ]
        for (const key of experience) {
            assert.equal(typeof settingsByKey[key], 'string')
            assert.match(settingsByKey[key], /^S\d{3}$/)
        }
        const uploader = map.settings.find((row: { key: string }) => row.key === 'global-uploader-filter-value')
        assert.ok(uploader.pages.length > 1)
        assert.equal(settingsByKey['global-uploader-filter-value'], uploader.id)
    })

    it('maps dynamic context menus to stable action classes', () => {
        assert.equal(contextActionKey('屏蔽UP主：测试UP'), 'ctx-block-uploader')
        assert.equal(contextActionKey('屏蔽视频 BV1xx411c7mD'), 'ctx-block-bvid')
        assert.equal(contextActionKey('将UP主加入白名单'), 'ctx-whitelist-uploader')
        assert.equal(contextActionKey('复制主页链接'), 'ctx-copy-space-url')
        assert.equal(contextActionKey('复制视频链接'), 'ctx-copy-video-url')
        assert.equal(contextActionKey('屏蔽用户：张三'), 'ctx-block-comment-user')
        assert.equal(contextActionKey('隐藏用户动态：李四'), 'ctx-hide-dyn-uploader')
        assert.equal(contextActionKey('屏蔽专栏作者：王五'), 'ctx-block-article-author')
        assert.equal(contextActionKey('将专栏作者加入白名单'), 'ctx-whitelist-article-author')
        assert.equal(actionsByKey['ctx-block-uploader'], actionsByKey['ctx-block-uploader'])
        assert.match(menusByKey['menu-rule-panel'], /^M\d{2}$/)
    })

    it('appends shortcut ids without renumbering the saved baseline', () => {
        const before = JSON.parse(
            readFileSync(join(root, 'tests/fixture/feedback-id-baseline.json'), 'utf8'),
        )
        const oldSettings = new Map(before.settings.map((row) => [row.key, row.id]))
        for (const row of map.settings) {
            if (oldSettings.has(row.key)) {
                assert.equal(row.id, oldSettings.get(row.key), row.key)
            }
        }
        const oldMenus = new Map(before.menus.map((row) => [row.key, row.id]))
        for (const row of map.menus) {
            if (oldMenus.has(row.key)) {
                assert.equal(row.id, oldMenus.get(row.key), row.key)
            }
        }
        const oldActions = new Map(before.actions.map((row) => [row.key, row.id]))
        for (const row of map.actions) {
            if (oldActions.has(row.key)) {
                assert.equal(row.id, oldActions.get(row.key), row.key)
            }
        }
        assert.equal(menusByKey['menu-side-btn'], 'M07')
        assert.equal(actionsByKey['side-rule-panel'], 'B19')
        assert.match(settingsByKey['biliweb-shortcut-enabled'], /^S\d{3}$/)
        assert.match(settingsByKey['biliweb-shortcut-location'], /^S\d{3}$/)
        assert.match(actionsByKey['panel-close-shortcut-settings'], /^B\d{2}$/)
        assert.match(actionsByKey['side-shortcut-settings'], /^B\d{2}$/)
        assert.notEqual(settingsByKey['biliweb-shortcut-enabled'], settingsByKey['biliweb-shortcut-location'])
    })
})
