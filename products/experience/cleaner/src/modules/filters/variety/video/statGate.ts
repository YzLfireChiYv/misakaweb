import { GM_getValue } from '@/storage/configStorage'
import { type CoreCheckExtra } from '@/modules/filters/core/core'
import { Group } from '@/types/collection'
import { SelectorResult } from '@/types/filter'
import pLimit from 'p-limit'
import { ratePercent, round1 } from './statRate'
import { fetchVideoStat } from './viewStat'

export const STAT_KEYS = {
    viewStatus: 'biliweb-stat-view-status',
    viewValue: 'biliweb-stat-view-min',
    likeStatus: 'biliweb-stat-like-status',
    likeValue: 'biliweb-stat-like-min',
    favStatus: 'biliweb-stat-fav-status',
    favValue: 'biliweb-stat-fav-min',
    likeRateStatus: 'biliweb-stat-like-rate-status',
    likeRateValue: 'biliweb-stat-like-rate-min',
    favRateStatus: 'biliweb-stat-fav-rate-status',
    favRateValue: 'biliweb-stat-fav-rate-min',
}

const limit = pLimit(4)

type GateConfig = {
    viewOn: boolean
    likeOn: boolean
    favOn: boolean
    likeRateOn: boolean
    favRateOn: boolean
    viewMin: number
    likeMin: number
    favMin: number
    likeRateMin: number
    favRateMin: number
}

const readNumber = (key: string) => {
    const value = GM_getValue(key, 0)
    return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export const readStatGate = (): GateConfig => ({
    viewOn: Boolean(GM_getValue(STAT_KEYS.viewStatus, false)),
    likeOn: Boolean(GM_getValue(STAT_KEYS.likeStatus, false)),
    favOn: Boolean(GM_getValue(STAT_KEYS.favStatus, false)),
    likeRateOn: Boolean(GM_getValue(STAT_KEYS.likeRateStatus, false)),
    favRateOn: Boolean(GM_getValue(STAT_KEYS.favRateStatus, false)),
    viewMin: readNumber(STAT_KEYS.viewValue),
    likeMin: readNumber(STAT_KEYS.likeValue),
    favMin: readNumber(STAT_KEYS.favValue),
    likeRateMin: round1(readNumber(STAT_KEYS.likeRateValue)),
    favRateMin: round1(readNumber(STAT_KEYS.favRateValue)),
})

const gateActive = (gate: GateConfig) =>
    gate.viewOn || gate.likeOn || gate.favOn || gate.likeRateOn || gate.favRateOn

export const statGateEnabled = () => gateActive(readStatGate())

const bvidOf = (value: SelectorResult) => (typeof value === 'string' && /^BV[0-9A-Za-z]+$/.test(value) ? value : '')

/**
 * 现有黑白名单画到页面之前，对仍会显示、且不是白名单救回的视频按需取数。
 * 取数失败的卡片不藏，并跳过已访问标记，下次增量扫描再试。
 */
export const applyStatGate = async (
    videos: HTMLElement[],
    hideIdx: Set<number>,
    exemptIdx: Set<number>,
    readBvid: (el: HTMLElement) => SelectorResult,
    skipVisitIdx: Set<number>,
) => {
    const gate = readStatGate()
    if (!gateActive(gate)) {
        return
    }
    const jobs: { index: number; bvid: string }[] = []
    for (let index = 0; index < videos.length; index++) {
        if (hideIdx.has(index) || exemptIdx.has(index)) {
            continue
        }
        const bvid = bvidOf(readBvid(videos[index]))
        if (!bvid) {
            continue
        }
        jobs.push({ index, bvid })
    }
    await Promise.all(
        jobs.map((job) =>
            limit(async () => {
                const stat = await fetchVideoStat(job.bvid)
                if (!stat) {
                    skipVisitIdx.add(job.index)
                    return
                }
                const likeRate = ratePercent(stat.like, stat.view)
                const favRate = ratePercent(stat.favorite, stat.view)
                const below =
                    (gate.viewOn && stat.view < gate.viewMin) ||
                    (gate.likeOn && stat.like < gate.likeMin) ||
                    (gate.favOn && stat.favorite < gate.favMin) ||
                    (gate.likeRateOn && likeRate != null && likeRate < gate.likeRateMin) ||
                    (gate.favRateOn && favRate != null && favRate < gate.favRateMin)
                if (below) {
                    hideIdx.add(job.index)
                }
            }),
        ),
    )
}

export const statGateExtra = (
    videos: HTMLElement[],
    readBvid: (el: HTMLElement) => SelectorResult,
): CoreCheckExtra => {
    const skipVisitIdx = new Set<number>()
    return {
        skipVisitIdx,
        beforePaint: (hideIdx, exemptIdx) => applyStatGate(videos, hideIdx, exemptIdx, readBvid, skipVisitIdx),
    }
}

const numberItem = (
    id: string,
    name: string,
    recheck: () => void,
    options?: { max?: number; step?: number; decimals?: number; addon?: string; description?: string[] },
) => ({
    type: 'number' as const,
    id,
    name,
    description: options?.description ?? ['低于该数则隐藏。0 表示这一项不设下限。'],
    noStyle: true,
    minValue: 0,
    maxValue: options?.max ?? 999999999,
    step: options?.step ?? 1,
    decimals: options?.decimals,
    defaultValue: 0,
    disableValue: -1,
    addonText: options?.addon ?? '次',
    fn: (value: number) => {
        if (!Number.isFinite(value)) {
            return
        }
        recheck()
    },
})

const switchItem = (id: string, name: string, recheck: () => void) => ({
    type: 'switch' as const,
    id,
    name,
    noStyle: true,
    enableFn: () => {
        recheck()
    },
    disableFn: () => {
        recheck()
    },
})

const rateItem = (id: string, name: string, description: string, recheck: () => void) =>
    numberItem(id, name, recheck, {
        max: 100,
        step: 0.1,
        decimals: 1,
        addon: '%',
        description: [description],
    })

/** 开关留在本机。播放、点赞、收藏的下限，以及点赞率、收藏率，属于规则仓库。 */
export const statGateGroup = (recheck: () => void): Group => ({
    name: '接口数据过滤',
    fold: true,
    items: [
        switchItem(STAT_KEYS.viewStatus, '启用 接口播放量下限', recheck),
        numberItem(STAT_KEYS.viewValue, '最低播放量', recheck),
        switchItem(STAT_KEYS.likeStatus, '启用 点赞数下限', recheck),
        numberItem(STAT_KEYS.likeValue, '最低点赞数', recheck),
        switchItem(STAT_KEYS.likeRateStatus, '启用 点赞率下限', recheck),
        rateItem(
            STAT_KEYS.likeRateValue,
            '最低点赞率',
            '点赞数占播放量的百分比。低于该数则隐藏，可填整数或一位小数。0 表示不设下限。',
            recheck,
        ),
        switchItem(STAT_KEYS.favStatus, '启用 收藏数下限', recheck),
        numberItem(STAT_KEYS.favValue, '最低收藏数', recheck),
        switchItem(STAT_KEYS.favRateStatus, '启用 收藏率下限', recheck),
        rateItem(
            STAT_KEYS.favRateValue,
            '最低收藏率',
            '收藏数占播放量的百分比。低于该数则隐藏，可填整数或一位小数。0 表示不设下限。',
            recheck,
        ),
    ],
})

