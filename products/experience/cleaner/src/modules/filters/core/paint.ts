import config from '@/config'
import { hideEle, showEle } from '@/utils/tool'
import type { Verdict } from '../decision/compatibility'

type HideMode = 'style' | 'sign'
type InlineDisplay = { value: string; priority: string }
const inlineDisplay = new WeakMap<HTMLElement, InlineDisplay>()
const revisions = new WeakMap<HTMLElement, object>()

export const filterPaint = (element: HTMLElement, mode: HideMode, verdict: Verdict) => {
    if (mode === 'sign') {
        if (verdict === 'discard') hideEle(element, mode)
        else showEle(element, mode)
        return
    }
    const previous = inlineDisplay.get(element)
    if (verdict === 'discard') {
        if (!previous) {
            inlineDisplay.set(element, {
                value: element.style.getPropertyValue('display'),
                priority: element.style.getPropertyPriority('display'),
            })
        }
        hideEle(element, mode)
    } else if (previous) {
        inlineDisplay.delete(element)
        if (element.style.display === 'none' && element.style.getPropertyPriority('display') === 'important') {
            element.style.setProperty('display', previous.value, previous.priority)
        }
    }
}

export const restoreFiltered = (element: HTMLElement, mode: HideMode) => {
    revisions.delete(element)
    filterPaint(element, mode, 'keep')
}

export const beginFilterPaint = (
    elements: readonly HTMLElement[],
    mode: HideMode,
    identify?: (element: HTMLElement) => unknown,
) => {
    const revision = {}
    const page = location.href
    const cards = elements.map((element) => {
        revisions.set(element, revision)
        return { element, identity: identify?.(element) }
    })
    const isCurrent = (index: number) => {
        const { element, identity } = cards[index]
        return (
            revisions.get(element) === revision &&
            element.isConnected &&
            page === location.href &&
            (!identify || identify(element) === identity)
        )
    }
    const paint = (hidden: ReadonlySet<number>, skipped: ReadonlySet<number>, markVisited: boolean) => {
        requestAnimationFrame(() => {
            cards.forEach(({ element }, index) => {
                if (!isCurrent(index)) return
                filterPaint(element, mode, hidden.has(index) ? 'discard' : 'keep')
                if (markVisited) element.toggleAttribute(config.filterVisitSign, !skipped.has(index))
            })
        })
    }
    return { isCurrent, paint }
}
