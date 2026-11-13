import { readSettingValue } from '@/modules/configuration/effective'
import { statisticsDecision, type VideoLimits } from '@/modules/filters/decision/compatibility'
import { Group } from '@/types/collection'
import { SelectorResult } from '@/types/filter'
import pLimit from 'p-limit'
import { round1 } from './statRate'
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

const readLimit = (statusKey: string, value: number) => value > 0 && readSettingValue(statusKey, false)

export const readStatGate = (): GateConfig => {
    const viewMin = readSettingValue(STAT_KEYS.viewValue, 0)
    const likeMin = readSettingValue(STAT_KEYS.likeValue, 0)
    const favMin = readSettingValue(STAT_KEYS.favValue, 0)
    const likeRateMin = round1(readSettingValue(STAT_KEYS.likeRateValue, 0))
    const favRateMin = round1(readSettingValue(STAT_KEYS.favRateValue, 0))
    return {
        viewOn: readLimit(STAT_KEYS.viewStatus, viewMin),
        likeOn: readLimit(STAT_KEYS.likeStatus, likeMin),
        favOn: readLimit(STAT_KEYS.favStatus, favMin),
        likeRateOn: readLimit(STAT_KEYS.likeRateStatus, likeRateMin),
        favRateOn: readLimit(STAT_KEYS.favRateStatus, favRateMin),
        viewMin,
        likeMin,
        favMin,
        likeRateMin,
        favRateMin,
    }
}

const gateActive = (gate: GateConfig) =>
    gate.viewOn || gate.likeOn || gate.favOn || gate.likeRateOn || gate.favRateOn

export const statGateEnabled = () => gateActive(readStatGate())

const bvidOf = (value: SelectorResult) => (typeof value === 'string' && /^BV[0-9A-Za-z]+$/.test(value) ? value : '')

/**
 * 现有黑白名单画到页面之前，对仍会显示、且不是白名单救回的视频按需取数。
 * 取数失败的卡片不藏，并跳过已访问标记，下次增量扫描再试。
 */
export const videoStatOptions = (identify: (el: HTMLElement) => SelectorResult) => {
    const gate = readStatGate()
    if (!gateActive(gate)) return { identify }
    const limits: VideoLimits = {
        views: gate.viewOn ? gate.viewMin : undefined,
        likes: gate.likeOn ? gate.likeMin : undefined,
        favorites: gate.favOn ? gate.favMin : undefined,
        likeRate: gate.likeRateOn ? gate.likeRateMin : undefined,
        favoriteRate: gate.favRateOn ? gate.favRateMin : undefined,
    }
    return {
        identify,
        complete: (element: HTMLElement, isCurrent: () => boolean) => {
            const bvid = bvidOf(identify(element))
            if (!bvid) return
            return limit(async () => {
                if (!isCurrent()) return
                const stat = await fetchVideoStat(bvid)
                return stat ? statisticsDecision(stat, limits) : undefined
            })
        },
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
    applyDisabledValue: true,
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

