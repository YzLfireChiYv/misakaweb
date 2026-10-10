export const SEARCH_ANCHOR_SELECTORS = ['#nav-searchform .nav-search-btn', '#nav-searchform .search-btn'] as const

export const SHORTCUT_HOST_ID = 'bili-cleaner-shortcut-host'
export const SHORTCUT_RESERVE_ATTR = 'data-bili-cleaner-shortcut-reserve'
export const SHORTCUT_POS_ATTR = 'data-bili-cleaner-shortcut-pos'
export const HOST_SLOT_PX = 40
export const HOST_GAP_PX = 8

export type Size = { width: number; height: number }
export type Rect = { left: number; top: number; right: number; bottom: number; width: number; height: number }

export type AnchorReason = 'ready' | 'missing' | 'hidden' | 'offscreen' | 'collapsed'

export type AnchorReport = {
    available: boolean
    reason: AnchorReason
    message: string
}

const ANCHOR_MESSAGES: Record<AnchorReason, string> = {
    ready: '顶栏搜索按钮可用，入口显示在搜索图标右侧并占用独立空位。',
    missing: '未找到顶栏搜索按钮。快捷入口不会自动改成悬浮按钮，仍可从脚本菜单「快捷开关设置」打开本面板。',
    hidden: '顶栏搜索按钮已隐藏，页面快捷入口暂不显示。不会自动改成悬浮按钮。',
    offscreen: '顶栏搜索按钮在视口外，页面快捷入口暂不显示。不会自动改成悬浮按钮。',
    collapsed: '顶栏搜索按钮没有可用尺寸，页面快捷入口暂不显示。不会自动改成悬浮按钮。',
}

export const findSearchAnchor = (root: ParentNode = document): HTMLElement | null => {
    const candidates: HTMLElement[] = []
    for (const selector of SEARCH_ANCHOR_SELECTORS) {
        for (const found of root.querySelectorAll(selector)) {
            if (found instanceof HTMLElement) candidates.push(found)
        }
    }
    return candidates.find((candidate) => classifyAnchor(candidate) === 'ready') ?? candidates[0] ?? null
}

const ancestorHidden = (el: HTMLElement): boolean => {
    let node: HTMLElement | null = el
    while (node) {
        const style = getComputedStyle(node)
        if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') {
            return true
        }
        if (Number.parseFloat(style.opacity) === 0) {
            return true
        }
        node = node.parentElement
    }
    return false
}

export const classifyAnchor = (
    el: HTMLElement | null,
    viewport: Size = { width: window.innerWidth, height: window.innerHeight },
): AnchorReason => {
    if (!el || !el.isConnected) {
        return 'missing'
    }
    if (ancestorHidden(el)) {
        return 'hidden'
    }
    const rect = el.getBoundingClientRect()
    if (rect.width < 2 || rect.height < 2) {
        return 'collapsed'
    }
    if (rect.bottom <= 0 || rect.right <= 0 || rect.top >= viewport.height || rect.left >= viewport.width) {
        return 'offscreen'
    }
    return 'ready'
}

export const reportAnchor = (el: HTMLElement | null, viewport?: Size): AnchorReport => {
    const reason = classifyAnchor(el, viewport)
    return {
        available: reason === 'ready',
        reason,
        message: ANCHOR_MESSAGES[reason],
    }
}

export const reservationShift = (host: Rect, neighbor: Rect, gap = HOST_GAP_PX): number => {
    const needed = host.right + gap - neighbor.left
    return needed > 0 ? Math.ceil(needed) : 0
}

export const clampDropdownBox = (opts: {
    anchor: Rect
    viewport: Size
    desiredWidth: number
    desiredHeight: number
    gap?: number
    margin?: number
}): { left: number; top: number; width: number; height: number } => {
    const gap = opts.gap ?? 4
    const margin = opts.margin ?? 8
    const vw = Math.max(0, opts.viewport.width)
    const vh = Math.max(0, opts.viewport.height)
    const maxWidth = Math.max(0, vw - margin * 2)
    const width = Math.min(Math.max(120, opts.desiredWidth), maxWidth || opts.desiredWidth)
    let left = opts.anchor.left
    if (left + width > vw - margin) {
        left = vw - margin - width
    }
    if (left < margin) {
        left = margin
    }

    const top = opts.anchor.bottom + gap
    const available = vh - margin - top
    const height = Math.min(opts.desiredHeight, Math.max(0, available))
    return {
        left: Number.isFinite(left) ? left : margin,
        top: Number.isFinite(top) ? top : margin,
        width,
        height,
    }
}

export const rectFromDom = (el: Element): Rect => {
    const box = el.getBoundingClientRect()
    return {
        left: box.left,
        top: box.top,
        right: box.right,
        bottom: box.bottom,
        width: box.width,
        height: box.height,
    }
}
