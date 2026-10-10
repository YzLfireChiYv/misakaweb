import { validateEvidence, type MaintenanceEvidence, type StructuralSample } from './evidence'
import { isPageHomepage, isPageVideo, isPageLive, isPageBangumi, isPageDynamic, isPageSpace, isPageSearch, isPagePopular, isPageChannel, isPagePlaylist, isPageFestival, isPageWatchlater, isPageMessage } from '@/utils/pageType'

const pageType = () => {
    const checks: [string, () => boolean][] = [['homepage',isPageHomepage],['video',isPageVideo],['live',isPageLive],['bangumi',isPageBangumi],['dynamic',isPageDynamic],['space',isPageSpace],['search',isPageSearch],['popular',isPagePopular],['channel',isPageChannel],['playlist',isPagePlaylist],['festival',isPageFestival],['watchlater',isPageWatchlater],['message',isPageMessage]]
    return checks.find(([,check]) => check())?.[0] ?? 'unknown'
}
// CSS structure only. No IDs, attribute values, textContent, HTML, video metadata or storage reads.
const classes = (el: Element | null) => el ? [...el.classList].filter(c => /^[a-zA-Z_][\w-]{0,79}$/.test(c)).slice(0,12) : []
const sample = (el: Element): StructuralSample => {
    const rect = el.getBoundingClientRect()
    const style = getComputedStyle(el)
    const children = [...el.children].slice(0,12)
    const round = (v: number) => Math.round(v * 10) / 10
    return { tag: el.tagName.toLowerCase(), classes: classes(el),
        visible: rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0',
        rect: {x:round(rect.x),y:round(rect.y),width:round(rect.width),height:round(rect.height)},
        childTags: children.map(c => c.tagName.toLowerCase()), childClasses: children.map(classes),
        shadowRoot: Boolean(el.shadowRoot), parentTag: el.parentElement?.tagName.toLowerCase() ?? '',
        parentClasses: classes(el.parentElement), parentIsBody: el.parentElement === document.body,
        attributeNames: el.getAttributeNames().filter(n => /^[\w-]{1,80}$/.test(n)).slice(0,32) }
}

/** On-demand, bounded structural capture. No startup listeners or network requests. */
export const collectMaintenanceDiagnostic = (): MaintenanceEvidence => {
    const selectors: [string,string][] = [
        ['search-form','#nav-searchform'],['search-button','#nav-searchform .nav-search-btn'],
        ['search-wrapper','.center-search__bar'],['search-panel','.search-panel'],['search-history','.search-panel .history'],
        ['search-trending','.search-panel .trending'],['search-suggestions','.search-panel .suggestions'],
        ['shortcut-portal','#bili-cleaner-shortcut-host'],['video-card','.bili-video-card'],['feed-card','.feed-card'],
        ['filtered-elements','[bili-cleaner-hide]'],['player','.bpx-player-container'],['video-element','video'],['comment-host','bili-comments'],
    ]
    const probes = selectors.map(([id,selector]) => {
        const found = document.querySelectorAll(selector)
        return { id,selector,count:Math.min(found.length,100000),samples:[...found].slice(0,3).map(sample) }
    })
    const commentRoot = document.querySelector('bili-comments')?.shadowRoot
    const threads = commentRoot?.querySelectorAll('bili-comment-thread-renderer')
    probes.push({id:'comment-shadow-threads',selector:'bili-comments::shadow bili-comment-thread-renderer',count:Math.min(threads?.length ?? 0,100000),samples:[...(threads ?? [])].slice(0,3).map(sample)})
    return validateEvidence({format:'misakaweb-structural-diagnostic',schemaVersion:1,scriptVersion:__SCRIPT_VERSION__,
        capturedAt:new Date().toISOString(),pageType:pageType(),site:location.hostname,
        scope:'structure-only; no text, URLs, storage, cookies or account data',probes})
}

export const downloadMaintenanceDiagnostic = () => {
    const evidence = collectMaintenanceDiagnostic()
    const url = URL.createObjectURL(new Blob([JSON.stringify(evidence,null,2)],{type:'application/json;charset=utf-8'}))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `misakaweb-maintenance-${evidence.pageType}-${evidence.capturedAt.slice(0,10)}.json`
    document.body.append(anchor);anchor.click();anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url),10000)
}
