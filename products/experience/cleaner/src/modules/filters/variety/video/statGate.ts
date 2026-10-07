import { GM_getValue } from '$'
import { type CoreCheckExtra } from '@/modules/filters/core/core'
import { Group } from '@/types/collection'
import { SelectorResult } from '@/types/filter'
import pLimit from 'p-limit'
import { fetchVideoStat } from './viewStat'

export const STAT_KEYS = {
    viewStatus: 'biliweb-stat-view-status',
    viewValue: 'biliweb-stat-view-min',
    likeStatus: 'biliweb-stat-like-status',
    likeValue: 'biliweb-stat-like-min',
    favStatus: 'biliweb-stat-fav-status',
    favValue: 'biliweb-stat-fav-min',
}

const limit = pLimit(4)

type GateConfig = {
    viewOn: boolean
    likeOn: boolean
    favOn: boolean
    viewMin: number
    likeMin: number
    favMin: number
}

const readNumber = (key: string) => {
    const value = GM_getValue(key, 0)
    return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export const readStatGate = (): GateConfig => ({
    viewOn: Boolean(GM_getValue(STAT_KEYS.viewStatus, false)),
    likeOn: Boolean(GM_getValue(STAT_KEYS.likeStatus, false)),
    favOn: Boolean(GM_getValue(STAT_KEYS.favStatus, false)),
    viewMin: readNumber(STAT_KEYS.viewValue),
    likeMin: readNumber(STAT_KEYS.likeValue),
    favMin: readNumber(STAT_KEYS.favValue),
})

export const statGateEnabled = () => {
    const gate = readStatGate()
    return gate.viewOn || gate.likeOn || gate.favOn
}

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
    if (!gate.viewOn && !gate.likeOn && !gate.favOn) {
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
                const below =
                    (gate.viewOn && stat.view < gate.viewMin) ||
                    (gate.likeOn && stat.like < gate.likeMin) ||
                    (gate.favOn && stat.favorite < gate.favMin)
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

const numberItem = (id: string, name: string, recheck: () => void) => ({
    type: 'number' as const,
    id,
    name,
    description: ['低于该数则隐藏。0 表示这一项不设下限。'],
    noStyle: true,
    minValue: 0,
    maxValue: 999999999,
    step: 1,
    defaultValue: 0,
    disableValue: -1,
    addonText: '次',
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

/** 三个开关是本机配置，阈值数字属于规则仓库。 */
export const statGateGroup = (recheck: () => void): Group => ({
    name: '接口数据过滤',
    fold: true,
    items: [
        switchItem(STAT_KEYS.viewStatus, '启用 接口播放量下限', recheck),
        numberItem(STAT_KEYS.viewValue, '最低播放量', recheck),
        switchItem(STAT_KEYS.likeStatus, '启用 点赞数下限', recheck),
        numberItem(STAT_KEYS.likeValue, '最低点赞数', recheck),
        switchItem(STAT_KEYS.favStatus, '启用 收藏数下限', recheck),
        numberItem(STAT_KEYS.favValue, '最低收藏数', recheck),
    ],
})

