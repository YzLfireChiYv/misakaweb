import type { SelectorResult } from '@/types/filter'
import { ratePercent } from '../variety/video/statRate'
import type { VideoStat } from '../variety/video/viewStat'

export type Verdict = 'keep' | 'discard'
export type CompatibilityResult = { verdict: Verdict; exemptFromStatistics: boolean }
export type RuleInput = { value: SelectorResult; matches: (value: SelectorResult) => boolean }
export type RuleInputs = {
    black: readonly RuleInput[]
    white: readonly RuleInput[]
    force: readonly RuleInput[]
}

export type VideoLimits = {
    views?: number
    likes?: number
    favorites?: number
    likeRate?: number
    favoriteRate?: number
}

const anyMatch = (checks: readonly RuleInput[]) => checks.some(({ value, matches }) => matches(value))

/** The existing priority is one strategy. Its inputs contain values from the page adapter. */
export const compatibilityDecision = ({ black, white, force }: RuleInputs): CompatibilityResult => {
    if (anyMatch(force)) return { verdict: 'discard', exemptFromStatistics: false }
    if (!anyMatch(black)) return { verdict: 'keep', exemptFromStatistics: false }
    if (anyMatch(white)) return { verdict: 'keep', exemptFromStatistics: true }
    return { verdict: 'discard', exemptFromStatistics: false }
}

export const statisticsDecision = (stat: VideoStat, limits: VideoLimits): Verdict => {
    const below = (value: number | null, limit?: number) => value !== null && limit !== undefined && value < limit
    return (
        below(stat.view, limits.views) ||
        below(stat.like, limits.likes) ||
        below(stat.favorite, limits.favorites) ||
        (limits.likeRate !== undefined && below(ratePercent(stat.like, stat.view), limits.likeRate)) ||
        (limits.favoriteRate !== undefined && below(ratePercent(stat.favorite, stat.view), limits.favoriteRate))
    ) ? 'discard' : 'keep'
}
