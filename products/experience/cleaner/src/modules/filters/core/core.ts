import type { SelectorResult, SubFilterPair } from '@/types/filter'
import { logger } from '@/utils/logger'
import { useThrottleFn } from '@vueuse/core'
import {
    compatibilityDecision,
    type RuleInput,
    type RuleInputs,
    type Verdict,
} from '../decision/compatibility'
import { beginFilterPaint } from './paint'

type Match = (fields: RuleInputs) => Verdict
type Complete = (element: HTMLElement, isCurrent: () => boolean) => Promise<Verdict | undefined> | undefined
type FilterOptions = {
    identify?: (element: HTMLElement) => unknown
    decide?: Match
    complete?: Complete
    deferPaint?: boolean
}

const fieldInputs = (element: HTMLElement, groups: readonly (readonly SubFilterPair[])[]): RuleInputs => {
    const fields = new Map<SubFilterPair[1], SelectorResult>()
    const [black, white, force] = groups.map((pairs) =>
        pairs.map(([rule, select]): RuleInput => {
            if (!fields.has(select)) {
                try {
                    fields.set(select, select(element))
                } catch (err) {
                    logger.debug('filter field unavailable', err)
                    fields.set(select, undefined)
                }
            }
            return { value: fields.get(select), matches: (value) => rule.matches(value) }
        }),
    )
    return { black, white, force }
}

const rawCheck = async (
    elements: HTMLElement[],
    markVisited: boolean,
    black: SubFilterPair[],
    white: SubFilterPair[],
    force: SubFilterPair[],
    options: FilterOptions,
    drawing: ReturnType<typeof beginFilterPaint> | undefined,
): Promise<Set<number>> => {
    const isCurrent = (index: number) => drawing?.isCurrent(index) ?? true
    const hidden = new Set<number>()
    const retry = new Set<number>()
    const pending: Promise<void>[] = []
    const groups = [black, white, force]
    elements.forEach((element, index) => {
        if (!isCurrent(index)) return
        try {
            const inputs = fieldInputs(element, groups)
            if (options.decide) {
                if (options.decide(inputs) === 'discard') hidden.add(index)
                return
            }
            const { verdict, exemptFromStatistics } = compatibilityDecision(inputs)
            if (verdict === 'discard') {
                hidden.add(index)
            } else if (!exemptFromStatistics) {
                const complete = options.complete?.(element, () => isCurrent(index))
                if (complete) {
                    pending.push(complete.then((outcome) => {
                        if (outcome === 'discard') hidden.add(index)
                        if (outcome === undefined) retry.add(index)
                    }).catch((err) => {
                        logger.error('filter data unavailable', err)
                        retry.add(index)
                    }))
                }
            }
        } catch (err) {
            logger.error('filter decision failed', err)
            retry.add(index)
        }
    })
    if (pending.length) await Promise.all(pending)
    for (const index of hidden) if (!isCurrent(index)) hidden.delete(index)
    drawing?.paint(hidden, retry, markVisited)
    return hidden
}

// Each adapter uses its own scan entry, so observers on different pages or
// different lists cannot cancel one another's trailing scan.
export const createFilterCheck = () => {
    const throttledCheck = useThrottleFn(rawCheck, 100, true, true)
    return async (
        elements: HTMLElement[],
        markVisited: boolean,
        mode: 'style' | 'sign',
        black: SubFilterPair[],
        white: SubFilterPair[] = [],
        force: SubFilterPair[] = [],
        noThrottle = false,
        options: FilterOptions = {},
    ): Promise<Set<number>> => {
        const drawing = options.deferPaint ? undefined : beginFilterPaint(elements, mode, options.identify)
        return (
            await (noThrottle ? rawCheck : throttledCheck)(elements, markVisited, black, white, force, options, drawing)
        ) ?? new Set()
    }
}
