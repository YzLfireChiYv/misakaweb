/** 点赞或收藏占播放量的百分比，保留 1 位小数。播放量不是正数时无法计算。 */
export const ratePercent = (part: number, whole: number): number | null => {
    if (!(whole > 0) || !Number.isFinite(part) || !Number.isFinite(whole)) {
        return null
    }
    return Number(((part / whole) * 100).toFixed(1))
}

export const round1 = (value: number) => {
    if (!Number.isFinite(value)) {
        return 0
    }
    return Number(value.toFixed(1))
}
