import config from '@/config'
import { SubFilterPair } from '@/types/filter'
import { logger } from '@/utils/logger'
import { hideEle, showEle } from '@/utils/tool'
import { useThrottleFn } from '@vueuse/core'
import pLimit from 'p-limit'

export type CoreCheckExtra = {
    /** 画到页面前改写 hideIdx。白名单救回的下标在 whiteExemptIdx。 */
    beforePaint?: (hideIdx: Set<number>, whiteExemptIdx: Set<number>) => Promise<void>
    /** 这些下标不打已访问标记，留给下一次增量扫描。 */
    skipVisitIdx?: Set<number>
}

// 限制并发
const limit = pLimit(10)

const rawCheck = async (
    elements: HTMLElement[],
    enableFilterVisitSign = true,
    hideMode: 'style' | 'sign',
    blackPairs: SubFilterPair[],
    whitePairs?: SubFilterPair[],
    forceBlackPairs?: SubFilterPair[],
    extra?: CoreCheckExtra,
): Promise<Set<number>> => {
    const toHideIdx = new Set<number>()
    const whiteExemptIdx = new Set<number>()

    const tasks = elements.map((el, idx) =>
        limit(async () => {
            const blackTasks: Promise<void>[] = []
            blackPairs.forEach((pair) => {
                blackTasks.push(pair[0].check(el, pair[1]))
            })
            const forceBlackTasks: Promise<void>[] = []
            forceBlackPairs?.forEach((pair) => {
                forceBlackTasks.push(pair[0].check(el, pair[1]))
            })
            await Promise.all(blackTasks).catch(async () => {
                // 命中黑名单，构建白名单任务
                const whiteTasks: Promise<void>[] = []
                whitePairs?.forEach((pair) => {
                    whiteTasks.push(pair[0].check(el, pair[1]))
                })
                let savedByWhite = false
                await Promise.all(whiteTasks)
                    .then(() => {
                        // 命中黑名单，未命中白名单
                        toHideIdx.add(idx)
                    })
                    .catch(() => {
                        savedByWhite = true
                    })
                if (savedByWhite) {
                    whiteExemptIdx.add(idx)
                }
            })
            await Promise.all(forceBlackTasks).catch(() => {
                // 命中高权限黑名单
                toHideIdx.add(idx)
                whiteExemptIdx.delete(idx)
            })
        }),
    )

    try {
        await Promise.all(tasks).catch(() => {})
        if (extra?.beforePaint) {
            try {
                await extra.beforePaint(toHideIdx, whiteExemptIdx)
            } catch (err) {
                logger.error('coreCheck beforePaint', err)
            }
        }
    } finally {
        // 隐藏元素、标记已访问
        const skipVisitIdx = extra?.skipVisitIdx
        requestAnimationFrame(() => {
            for (let i = 0; i < elements.length; i++) {
                toHideIdx.has(i) ? hideEle(elements[i], hideMode) : showEle(elements[i], hideMode)
                if (enableFilterVisitSign && !skipVisitIdx?.has(i)) {
                    elements[i].setAttribute(config.filterVisitSign, '')
                }
            }
        })
    }
    return toHideIdx
}

const throttledCheck = useThrottleFn(rawCheck, 100, true)

/**
 * 检测元素列表中每个元素是否合法, 隐藏不合法的元素
 * 对选取出的元素内容进行并发检测
 * @param elements 元素列表
 * @param enableFilterVisitSign 是否标记已检测过
 * @param hideMode 隐藏模式，style 用display none隐藏，sign 用 attribute 隐藏
 * @param blackPairs 黑名单过滤器与使用的选择函数列表
 * @param whitePairs 白名单过滤器与使用的选择函数列表
 * @param forceBlackPairs 高权限黑名单过滤器与使用的选择函数列表
 * @param noThrottle 是否节流
 * @param extra 画页面前的追加判断，以及不打已访问标记的下标
 */
export const coreCheck = async (
    elements: HTMLElement[],
    enableFilterVisitSign = true,
    hideMode: 'style' | 'sign',
    blackPairs: SubFilterPair[],
    whitePairs?: SubFilterPair[],
    forceBlackPairs?: SubFilterPair[],
    noThrottle?: boolean,
    extra?: CoreCheckExtra,
): Promise<Set<number>> => {
    if (noThrottle) {
        return rawCheck(elements, enableFilterVisitSign, hideMode, blackPairs, whitePairs, forceBlackPairs, extra)
    }
    return (
        (await throttledCheck(
            elements,
            enableFilterVisitSign,
            hideMode,
            blackPairs,
            whitePairs,
            forceBlackPairs,
            extra,
        )) ?? new Set<number>()
    )
}
