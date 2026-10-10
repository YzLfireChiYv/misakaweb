import { describe, expect, it } from 'vitest'
import { reviewCatalog } from '../src/feedback/review-catalog.generated'
import map from '../src/feedback/control-map.json'

describe('review classification matches actual controls', () => {
    it('covers all rule settings with stable IDs and no stored values', () => {
        const current = map.settings.filter((entry: { panels: string[] }) => entry.panels.includes('rule'))
        const byKey = new Map(reviewCatalog.map(entry => [entry.key, entry]))
        expect(byKey.size).toBe(reviewCatalog.length)
        expect(current).toHaveLength(397)
        for (const entry of current) {
            expect(byKey.get(entry.key)?.id).toBe(entry.id)
        }
        for (const entry of reviewCatalog) {
            expect(entry).not.toHaveProperty('value')
            expect(entry).not.toHaveProperty('defaultValue')
        }
    })

    it('separates mixed purposes and honors confirmed classifications', () => {
        const category = (key: string) => reviewCatalog.find(entry => entry.key === key)?.category
        expect(category('live-page-disable-hotkey-g-follow')).toBe('cleaning')
        expect(category('video-page-simple-share')).toBe('cleaning')
        expect(category('video-page-simple-share-domain')).toBe('optimization')
        expect(category('homepage-layout')).toBe('optimization')
        expect(category('homepage-layout-padding')).toBe('optimization')
        expect(category('homepage-hide-no-interest')).toBe('cleaning')
        expect(category('homepage-move-no-interest')).toBe('optimization')
        expect(category('video-page-coin-disable-auto-like')).toBe('cleaning')
        expect(category('debug-mode')).toBe('support')
        expect(category('ctx-copy-space-url')).toBe('optimization')
        expect(category('ctx-copy-video-url')).toBe('optimization')
    })
})
