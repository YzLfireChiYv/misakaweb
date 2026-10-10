import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import * as gm from './gm-mock'
import { categoryFor, exportReview, normalizeReview, REVIEW_STORAGE_KEY, useReviewStore } from '../src/feedback/review-store'
import { reviewCatalog } from '../src/feedback/review-catalog.generated'
import { REVIEW_CATALOG_VERSION } from '../src/feedback/review-catalog.generated'

afterEach(() => { vi.restoreAllMocks(); gm.__gmReset() })
const makeStore = () => {
    const scope = effectScope()
    const store = scope.run(useReviewStore)!
    return { store, stop: () => scope.stop() }
}
const key = 'homepage-layout'

describe('feedback retention decisions are separate from runtime settings', () => {
    it('honors later optional retention over old marks without a startup write', () => {
        const old = {schemaVersion:1,catalogVersion:'2026-10-10.1',decisions:{
            'common-theme-dark':{remove:true},'border-radius':{remove:true},'common-unify-font':{remove:true},
            'homepage-layout':{remove:true},'homepage-rcmd-video-preload':{category:'cleaning'},
        }}
        gm.__gmStore.set(REVIEW_STORAGE_KEY,old)
        const {store,stop}=makeStore()
        expect(gm.__gmStore.get(REVIEW_STORAGE_KEY)).toEqual(old)
        expect(store.state.value.decisions['common-theme-dark']).toBeUndefined()
        expect(store.state.value.decisions['homepage-layout']?.remove).toBe(true)
        expect(exportReview(store.state.value).items.find(e=>e.key==='common-theme-dark')?.disposition).toBe('optional-retain')
        store.toggleRemove('homepage-layout-padding')
        const saved=gm.__gmStore.get(REVIEW_STORAGE_KEY) as any
        expect(saved.catalogVersion).toBe(REVIEW_CATALOG_VERSION)
        expect(saved.decisions['common-theme-dark']).toBeUndefined()
        expect(saved.decisions['homepage-layout'].remove).toBe(true)
        expect(saved.decisions['homepage-rcmd-video-preload'].category).toBe('cleaning')
        store.toggleRemove('common-theme-dark')
        expect(store.state.value.decisions['common-theme-dark']?.remove).toBe(true)
        stop()
    })
    it('does not write on initialization and never changes the original setting', () => {
        gm.__gmStore.set(key, 'four')
        const write = vi.spyOn(gm, 'GM_setValue')
        const { store, stop } = makeStore()
        expect(write).not.toHaveBeenCalled()
        expect(store.toggleRemove(key)).toBe(true)
        expect(gm.__gmStore.get(key)).toBe('four')
        expect([...gm.__gmStore.keys()]).toEqual([key, REVIEW_STORAGE_KEY])
        expect(store.state.value.decisions[key]?.remove).toBe(true)
        store.toggleRemove(key)
        expect(store.state.value.decisions[key]).toBeUndefined()
        stop()
    })

    it('validates known metadata, guards cleaning and refuses future schema writes', () => {
        const state = normalizeReview({ schemaVersion: 1, decisions: {
            [key]: { remove: true, secret: 'secret' },
            'homepage-hide-banner': { remove: true }, 'debug-mode': { category: 'optimization', remove: true },
            unknown: { remove: true }, 'video-page-simple-share-domain': { category: 'wrong', remove: 'yes' },
        } })
        expect(state.decisions).toEqual({ [key]: { remove: true } })
        gm.__gmStore.set(REVIEW_STORAGE_KEY, { schemaVersion: 2, decisions: {} })
        const { store, stop } = makeStore()
        const write = vi.spyOn(gm, 'GM_setValue')
        expect(store.readOnly.value).toBe(true)
        expect(store.toggleRemove(key)).toBe(false)
        expect(store.error.value).toContain('不支持')
        expect(write).not.toHaveBeenCalled()
        stop()
    })

    it('rereads before patch, preserves other marks and newer catalog entries', () => {
        const { store, stop } = makeStore()
        gm.__gmStore.set(REVIEW_STORAGE_KEY, { schemaVersion: 1, decisions: {
            'homepage-layout-padding': { remove: true }, futureKey: { category: 'optimization', remove: true },
        } })
        store.toggleRemove(key)
        expect(store.state.value.decisions['homepage-layout-padding']?.remove).toBe(true)
        expect((gm.__gmStore.get(REVIEW_STORAGE_KEY) as any).decisions.futureKey.remove).toBe(true)
        expect(store.state.value.decisions.futureKey).toBeUndefined()
        stop()
    })

    it('correcting a category clears deletion and can restore the original category', () => {
        const { store, stop } = makeStore()
        const entry = reviewCatalog.find(e => e.key === key)!
        store.toggleRemove(key)
        store.changeCategory(key)
        expect(categoryFor(entry, store.state.value)).toBe('cleaning')
        expect(store.state.value.decisions[key]?.remove).toBeUndefined()
        store.toggleRemove(key)
        expect(store.state.value.decisions[key]?.remove).toBeUndefined()
        store.changeCategory(key)
        expect(categoryFor(entry, store.state.value)).toBe('optimization')
        expect(store.state.value.decisions[key]).toBeUndefined()
        stop()
    })

    it('listeners refresh without echo, dispose, and reattach on a new scope', () => {
        const first = makeStore(), second = makeStore()
        const write = vi.spyOn(gm, 'GM_setValue')
        first.store.toggleRemove(key)
        expect(write).toHaveBeenCalledTimes(1)
        expect(second.store.state.value.decisions[key]?.remove).toBe(true)
        second.stop()
        first.store.toggleRemove(key)
        expect(second.store.state.value.decisions[key]?.remove).toBe(true)
        const third = makeStore()
        expect(third.store.state.value.decisions[key]).toBeUndefined()
        first.stop(); third.stop()
    })

    it('exports only public catalog and validated decisions; pending is not retention approval', () => {
        gm.__gmStore.set('biliweb-sync-password', 'DO_NOT_EXPORT_PASSWORD')
        gm.__gmStore.set('global-title-keyword-filter-value', 'DO_NOT_EXPORT_PRIVATE_RULE')
        const raw = { schemaVersion: 1, decisions: { [key]: { remove: true, actualValue: 'DO_NOT_EXPORT_VALUE' } }, cookie: 'DO_NOT_EXPORT_COOKIE' }
        const exported = exportReview(normalizeReview(raw))
        const text = JSON.stringify(exported)
        expect(text).not.toContain('DO_NOT_EXPORT')
        expect(exported.items).toHaveLength(399)
        expect(exported.items.find(e => e.key === key)?.disposition).toBe('delete-candidate')
        expect(exported.items.find(e => e.key === 'homepage-layout-padding')?.disposition).toBe('pending')
        expect(exported.items.find(e => e.key === 'homepage-hide-banner')?.disposition).toBe('retain')
    })

    it('shows a failed save without optimistic success', () => {
        const { store, stop } = makeStore()
        vi.spyOn(gm, 'GM_setValue').mockImplementation(() => { throw new Error('storage unavailable') })
        expect(store.toggleRemove(key)).toBe(false)
        expect(store.error.value).toContain('保存失败')
        expect(store.state.value.decisions[key]).toBeUndefined()
        stop()
    })
})
