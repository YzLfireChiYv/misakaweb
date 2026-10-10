import { computed, getCurrentScope, onScopeDispose, ref } from 'vue'
import { GM_addValueChangeListener, GM_getValue, GM_removeValueChangeListener, GM_setValue } from '$'
import { reviewCatalog, REVIEW_CATALOG_VERSION, REVIEW_SOURCE_COMMIT } from '@review-catalog'
import type { ReviewCategory, ReviewEntry } from './review-types'

/** Feedback only. Excluded from rule packs/WebDAV; never stores actual setting values. */
export const REVIEW_STORAGE_KEY = 'misakaweb-review-decisions-v1'
const entries = new Map(reviewCatalog.map(entry => [entry.key, entry]))
export type ReviewDecision = { category?: 'cleaning' | 'optimization'; remove?: true }
export type ReviewState = { decisions: Record<string, ReviewDecision>; readOnly: boolean }
const record = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value)

export const normalizeReview = (raw: unknown): ReviewState => {
    const state: ReviewState = { decisions: {}, readOnly: false }
    if (!record(raw)) return state
    if (raw.schemaVersion !== 1) return { ...state, readOnly: true }
    if (!record(raw.decisions)) return state
    for (const [key, value] of Object.entries(raw.decisions)) {
        const entry = entries.get(key)
        if (!entry || entry.category === 'support' || !record(value)) continue
        const decision: ReviewDecision = {}
        if (value.category === 'cleaning' || value.category === 'optimization') decision.category = value.category
        const superseded = entry.retention === 'optional-retain' && raw.catalogVersion !== REVIEW_CATALOG_VERSION
        if (!superseded && (decision.category ?? entry.category) === 'optimization' && value.remove === true) decision.remove = true
        if (Object.keys(decision).length) state.decisions[key] = decision
    }
    return state
}

export const categoryFor = (entry: ReviewEntry, state: ReviewState): ReviewCategory =>
    state.decisions[entry.key]?.category ?? entry.category

/** Only allowlisted public metadata + validated decisions, never a GM dump. */
export const exportReview = (state: ReviewState) => ({
    format: 'misakaweb-optimization-review',
    schemaVersion: 1,
    scriptVersion: __SCRIPT_VERSION__,
    catalogVersion: REVIEW_CATALOG_VERSION,
    upstreamCommit: REVIEW_SOURCE_COMMIT,
    exportedAt: new Date().toISOString(),
    scope: 'product-retention-feedback; does not describe enabled settings',
    items: reviewCatalog.map(entry => ({
        key: entry.key, id: entry.id, names: entry.names, pages: entry.pages, groups: entry.groups,
        proposedCategory: entry.category, category: categoryFor(entry, state), rationale: entry.rationale,
        pack: entry.pack, packLabel: entry.packLabel,
        categoryExplicit: Boolean(state.decisions[entry.key]?.category),
        disposition: categoryFor(entry, state) !== 'optimization' ? 'retain' : state.decisions[entry.key]?.remove ? 'delete-candidate' : entry.retention ?? 'pending',
        dispositionSource: categoryFor(entry, state) !== 'optimization' ? 'retain-cleaning-and-support' : state.decisions[entry.key]?.remove ? 'user-mark' : entry.retention ? 'confirmed-product-choice' : 'undecided',
        proposedDefaultEnabled: entry.defaultOff ? false : undefined,
    })),
})

export const useReviewStore = () => {
    const error = ref('')
    const state = ref<ReviewState>({ decisions: {}, readOnly: false })
    const refresh = (raw?: unknown, supplied = false) => {
        try { state.value = normalizeReview(supplied ? raw : GM_getValue(REVIEW_STORAGE_KEY)) }
        catch { error.value = '无法读取取舍标记，请稍后重新打开设置。'; state.value.readOnly = true }
    }
    refresh()
    const listener = GM_addValueChangeListener(REVIEW_STORAGE_KEY, (_key, _old, value) => refresh(value, true))
    const dispose = () => GM_removeValueChangeListener(listener)
    if (getCurrentScope()) onScopeDispose(dispose)

    const patch = (key: string, update: (old: ReviewDecision, entry: ReviewEntry) => ReviewDecision) => {
        error.value = ''
        const entry = entries.get(key)
        if (!entry || entry.category === 'support') return false
        try {
            // Preserve unrelated/newer catalog entries. This is not an atomic multi-tab merge protocol.
            const raw = GM_getValue(REVIEW_STORAGE_KEY)
            const latest = normalizeReview(raw)
            if (latest.readOnly) { state.value = latest; error.value = '此标记文件使用了不支持的格式，已停止写入。'; return false }
            const original = record(raw) ? raw : {}
            const decisions = { ...(record(original.decisions) ? original.decisions : {}) }
            // Carry forward the user's later retention decision over the older review snapshot.
            // No startup write; remove only superseded marks during an explicit edit.
            if (original.catalogVersion !== REVIEW_CATALOG_VERSION) for (const entry of reviewCatalog) {
                const prior = decisions[entry.key]
                if (entry.retention !== 'optional-retain' || !record(prior)) continue
                const migrated = { ...prior }
                delete migrated.remove
                if (Object.keys(migrated).length) decisions[entry.key] = migrated
                else delete decisions[entry.key]
            }
            const decision = update(latest.decisions[key] ?? {}, entry)
            if (Object.keys(decision).length) decisions[key] = decision
            else delete decisions[key]
            const next = { ...original, schemaVersion: 1, catalogVersion: REVIEW_CATALOG_VERSION, decisions }
            GM_setValue(REVIEW_STORAGE_KEY, next)
            state.value = normalizeReview(next)
            return true
        } catch { error.value = '取舍标记保存失败，本次操作未确认保存，请重试。'; return false }
    }

    const toggleRemove = (key: string) => patch(key, (old, entry) => {
        if ((old.category ?? entry.category) !== 'optimization') return old
        return old.remove ? (old.category ? { category: old.category } : {}) : { ...old, remove: true }
    })
    const changeCategory = (key: string) => patch(key, (old, entry) => {
        const category = (old.category ?? entry.category) === 'cleaning' ? 'optimization' : 'cleaning'
        // Changing the category always clears an old deletion mark.
        return category === entry.category ? {} : { category }
    })

    const download = () => {
        error.value = ''
        try {
            refresh()
            if (state.value.readOnly) { error.value = '当前标记格式无法安全导出，请使用支持该格式的版本。'; return false }
            const blob = new Blob([JSON.stringify(exportReview(state.value), null, 2)], { type: 'application/json;charset=utf-8' })
            const url = URL.createObjectURL(blob)
            const anchor = document.createElement('a')
            anchor.href = url
            anchor.download = `misakaweb-optimization-review-${new Date().toISOString().slice(0, 10)}.json`
            document.body.append(anchor)
            anchor.click()
            anchor.remove()
            setTimeout(() => URL.revokeObjectURL(url), 10000)
            return true
        } catch { error.value = '导出失败，请重试。'; return false }
    }
    return { state, error, readOnly: computed(() => state.value.readOnly), toggleRemove, changeCategory, download, dispose }
}

export type ReviewStore = ReturnType<typeof useReviewStore>
