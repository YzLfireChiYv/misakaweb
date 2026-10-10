import { describe, expect, it } from 'vitest'
import catalog from '../config/optimization-packs.json'
import { reviewCatalog } from '../src/feedback/review-catalog.generated'

describe('optimization group build inputs', () => {
    it('assigns each existing optimization to exactly one complete capability group', () => {
        const assigned = catalog.packs.flatMap(pack => pack.setting_keys)
        expect(new Set(assigned).size).toBe(assigned.length)
        expect(assigned).toHaveLength(73)
        expect([...assigned].sort()).toEqual(reviewCatalog.filter(row => row.category === 'optimization').map(row => row.key).sort())
        for (const pack of catalog.packs) {
            const members = reviewCatalog.filter(row => row.pack === pack.id)
            expect(members.map(row => row.key).sort()).toEqual([...pack.setting_keys].sort())
            expect(members.every(row => row.packLabel === pack.label)).toBe(true)
        }
    })

    it('keeps filtering support and share purification outside optional optimization', () => {
        for (const key of ['homepage-increase-rcmd-load-size', 'homepage-rcmd-video-preload', 'video-page-simple-share', 'live-page-disable-hotkey-g-follow']) {
            const row = reviewCatalog.find(row => row.key === key)!
            expect(row.category).toBe('cleaning')
            expect(row.pack).toBeUndefined()
        }
        expect(catalog.core_support.map(row => row.id)).toEqual(['S204', 'S209'])
    })

    it('keeps confirmed optional defaults and labels future gestures/profiles honestly', () => {
        expect(catalog.packs.flatMap(pack => pack.confirmed_default_off_keys).sort()).toEqual(['border-radius', 'common-theme-dark', 'common-unify-font'])
        const touch = catalog.packs.find(pack => pack.id === 'touch-controls')!
        expect(touch.status).toBe('planned-not-implemented')
        expect(touch.setting_keys).toHaveLength(0)
        expect(catalog.distribution.planned_profiles.filter(profile => profile.available).map(profile=>profile.id)).toEqual(['pure','desktop-toolkit','without-text-appearance'])
        expect(catalog.distribution.planned_profiles.find(profile=>profile.id==='tablet')?.available).toBe(false)
        expect(catalog.external_sources[0].commit).toHaveLength(40)
    })
})
