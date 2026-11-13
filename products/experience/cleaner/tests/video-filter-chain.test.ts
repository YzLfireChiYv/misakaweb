import { afterEach, expect, it, vi } from 'vitest'
import config from '@/config'
import { createFilterCheck } from '@/modules/filters/core/core'
import { restoreFiltered } from '@/modules/filters/core/paint'
import { BooleanFilter } from '@/modules/filters/core/subFilters/booleanFilter'
import { compatibilityDecision, statisticsDecision } from '@/modules/filters/decision/compatibility'
import { VideoPubdateFilter } from '@/modules/filters/variety/video/subFilters/black'

const coreCheck = createFilterCheck()

afterEach(() => vi.unstubAllGlobals())

const nextFrame = async (frames: FrameRequestCallback[]) => {
    await vi.waitFor(() => expect(frames.length).toBeGreaterThan(0))
    frames.splice(0).forEach(frame => frame(0))
}

it('treats publication age zero as unrestricted after a positive maximum', async () => {
    const rule = new VideoPubdateFilter()
    rule.enable()
    rule.setParam(60)
    expect(rule.matches(90)).toBe(true)
    rule.setParam(0)
    expect(rule.matches(90)).toBe(false)
})

it('allows a previously checked card to re-enter a later incremental scan after a data failure', async () => {
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback))
    const card = document.createElement('div')
    document.body.append(card)
    card.setAttribute(config.filterVisitSign, '')
    await coreCheck([card], true, 'sign', [], [], [], true, {
        complete: async () => undefined,
    })
    frames.shift()!(0)
    expect(card.hasAttribute(config.filterVisitSign)).toBe(false)
    await coreCheck([card], true, 'sign', [], [], [], true)
    frames.shift()!(0)
    expect(card.hasAttribute(config.filterVisitSign)).toBe(true)
    card.remove()
})

it('runs a replacement decision on extracted values and rejects a stale card result', async () => {
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback))
    const card = document.createElement('div')
    card.dataset.id = 'original'
    card.textContent = '短片'
    document.body.append(card)
    const rule = new BooleanFilter()
    const fields = () => card.textContent ?? undefined
    await coreCheck([card], true, 'sign', [[rule, fields]], [], [], true, {
        decide: ({ black }) => black[0].value === '短片' ? 'discard' : 'keep',
        identify: (element) => element.dataset.id,
    })
    card.dataset.id = 'reused'
    frames.shift()!(0)
    expect(card.hasAttribute(config.filterHideSign)).toBe(false)
    expect(card.hasAttribute(config.filterVisitSign)).toBe(false)
    card.remove()
})

it('restores the site inline display after filtering', async () => {
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback))
    const card = document.createElement('div')
    card.style.setProperty('display', 'grid', 'important')
    document.body.append(card)
    const rule = new BooleanFilter()
    rule.enable()
    await coreCheck([card], false, 'style', [[rule, () => true]], [], [], true)
    frames.shift()!(0)
    expect(card.style.display).toBe('none')
    restoreFiltered(card, 'style')
    expect(card.style.display).toBe('grid')
    expect(card.style.getPropertyPriority('display')).toBe('important')
    card.remove()
})

it('keeps compatibility priority and only completes a surviving, non-exempt card', async () => {
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback))
    const cards = Array.from({ length: 4 }, () => document.createElement('div'))
    document.body.append(...cards)
    const match = new BooleanFilter()
    match.enable()
    const complete = vi.fn(async () => 'discard' as const)
    const hidden = await coreCheck(
        cards, true, 'sign',
        [[match, card => card !== cards[3]]],
        [[match, card => card === cards[0] || card === cards[1]]],
        [[match, card => card === cards[1]]],
        true, { complete },
    )
    frames.shift()!(0)
    expect(hidden).toEqual(new Set([1, 2, 3]))
    expect(complete).toHaveBeenCalledExactlyOnceWith(cards[3], expect.any(Function))
    expect(cards[0].hasAttribute(config.filterHideSign)).toBe(false)
    expect(statisticsDecision({ view: 0, like: 0, favorite: 0 }, { likeRate: 1 })).toBe('keep')
    expect(compatibilityDecision({ black: [], white: [], force: [] }).verdict).toBe('keep')
    cards.forEach(card => card.remove())
})

it('keeps fetch untouched until a feature subscribes and restores it after both features unsubscribe', async () => {
    vi.doMock('$', async importOriginal => ({ ...await importOriginal<object>(), unsafeWindow: window }))
    const original = vi.fn<typeof fetch>().mockResolvedValue(new Response('original'))
    vi.stubGlobal('fetch', original)
    const { default: hook } = await import('@/utils/fetch')
    expect(window.fetch).toBe(original)
    const stopRewrite = hook.addPreFn(() => 'rewritten')
    const stopRead = hook.addPostFn(() => {})
    await window.fetch('initial')
    expect(original).toHaveBeenCalledWith('rewritten', undefined)
    stopRewrite()
    await window.fetch('initial')
    expect(original).toHaveBeenCalledWith('initial', undefined)
    expect(window.fetch).not.toBe(original)
    stopRead()
    expect(window.fetch).toBe(original)
})

it('uses this scan’s BV matches for the optional related cache before DOM marking', async () => {
    // The script manager alias used in this test must expose the page object.
    vi.doMock('$', async importOriginal => ({ ...await importOriginal<object>(), unsafeWindow: window }))
    const { videoFilterVideoGroups, videoFilterVideoEntry } = await import('@/modules/filters/variety/video/pages/video')
    const { GM_setValue } = await import('@/storage/configStorage')
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback))
    const previous = 'BV1AA411c7mD', matched = 'BV1BB411c7mD'
    // Insert after entry to exercise the observer path, with multiple container classes.
    await videoFilterVideoEntry()
    const related = videoFilterVideoGroups.flatMap(group=>group.items).find(item=>item.id==='video-related-filter-status')
    if(related?.type!=='switch')throw new Error('Related-video switch is missing')
    related.enableFn?.()
    GM_setValue('global-bvid-filter-value', [matched])
    const list = document.createElement('div')
    list.className='recommend-list-container extra-class'
    list.innerHTML=`<div class="rec-list">
        <div class="video-page-card-small" ${config.filterHideSign}><div class="info"><a href="/video/${previous}"></a></div></div>
        <div class="video-page-card-small"><div class="pic-box"><div class="framepreview-box"><a href="/video/${matched}"></a></div></div></div>
    </div>`
    const page = window as unknown as {__INITIAL_STATE__: {related: {bvid:string}[]}}
    page.__INITIAL_STATE__ = {related:[{bvid:previous},{bvid:matched}]}
    const blocked=videoFilterVideoGroups.flatMap(group=>group.items).find(item=>item.id==='video-bvid-filter-status')
    const editor=videoFilterVideoGroups.flatMap(group=>group.items).find(item=>item.id==='global-bvid-filter-value')
    if(blocked?.type!=='switch'||editor?.type!=='editor')throw new Error('BV filter is missing')
    await editor.saveFn()
    blocked.enableFn?.()
    document.body.appendChild(list)
    await vi.waitFor(()=>expect(page.__INITIAL_STATE__.related).toEqual([{bvid:previous}]))
    expect(frames.length).toBeGreaterThan(0)
    // The old hidden mark is still present because no frame has run.
    expect(list.querySelector('.video-page-card-small')?.hasAttribute(config.filterHideSign)).toBe(true)
    list.remove()
})

it('leaves a popular card with zero likes undecided by the old quality rule', async () => {
    const { videoFilterPopularGroups, videoFilterPopularEntry } = await import('@/modules/filters/variety/video/pages/popular')
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback))
    const items=videoFilterPopularGroups.flatMap(group=>group.items)
    const enabled=items.find(item=>item.id==='popular-quality-filter-status')
    const threshold=items.find(item=>item.id==='global-quality-filter-value')
    if(enabled?.type!=='switch'||threshold?.type!=='number')throw new Error('Quality filter is missing')
    const app=document.createElement('div')
    app.id='app'
    const list=document.createElement('div')
    list.className='card-list'
    const makeCard=(like:number)=>{
        const element=document.createElement('div') as HTMLElement & {__vue__:unknown}
        element.className='video-card'
        element.__vue__={videoData:{stat:{coin:0,like}}}
        list.appendChild(element)
        return element
    }
    const unknown=makeCard(0), low=makeCard(10)
    app.appendChild(list)
    document.body.appendChild(app)
    await videoFilterPopularEntry()
    expect(threshold.defaultValue).toBe(25)
    enabled.enableFn?.()
    await nextFrame(frames)
    expect(unknown.hasAttribute(config.filterHideSign)).toBe(false)
    expect(low.hasAttribute(config.filterHideSign)).toBe(true)
    app.remove()
})
