/** 小于该位移视为点击，避免指针微抖把 click 当成拖拽 */
export const PANEL_DRAG_THRESHOLD_PX = 5

export type Point = { x: number; y: number }
export type Size = { width: number; height: number }
export type Inset = { right: number; bottom: number }

export const pointerDistance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y)

export const exceededDragThreshold = (
    origin: Point | null | undefined,
    current: Point,
    threshold = PANEL_DRAG_THRESHOLD_PX,
): boolean => {
    if (!origin) {
        return false
    }
    return pointerDistance(origin, current) >= threshold
}

export const capPanelSize = (
    viewport: Size,
    spec: { widthPercent: number; heightPercent: number; minWidth: number; minHeight: number },
): Size => {
    const vw = Math.max(0, viewport.width)
    const vh = Math.max(0, viewport.height)
    const desiredWidth = Math.max((vw * spec.widthPercent) / 100, spec.minWidth)
    const desiredHeight = Math.max((vh * spec.heightPercent) / 100, spec.minHeight)
    return {
        width: vw > 0 ? Math.min(vw, desiredWidth) : 0,
        height: vh > 0 ? Math.min(vh, desiredHeight) : 0,
    }
}

/** 使用计算出的完整面板尺寸；隐藏状态也能避免内容落在视口外。 */
export const centeredPanelPosition = (viewport: Size, panel: Size): Point =>
    clampPanelPosition(
        {
            x: viewport.width / 2 - panel.width / 2,
            y: viewport.height / 2 - panel.height / 2,
        },
        viewport,
        panel,
    )

export const clampPanelPosition = (pos: Point, viewport: Size, panel: Size): Point => {
    const panelW = Math.max(0, panel.width)
    const panelH = Math.max(0, panel.height)
    const maxX = Math.max(0, viewport.width - panelW)
    const maxY = Math.max(0, viewport.height - panelH)
    return {
        x: Math.min(Math.max(0, pos.x), maxX),
        y: Math.min(Math.max(0, pos.y), maxY),
    }
}

export const clampSideBtnInset = (inset: Inset, viewport: Size, size: Size): Inset => {
    const w = Math.max(0, size.width)
    const h = Math.max(0, size.height)
    if (w === 0 || h === 0) {
        return {
            right: Math.max(0, inset.right),
            bottom: Math.max(0, inset.bottom),
        }
    }
    const maxRight = Math.max(0, viewport.width - w)
    const maxBottom = Math.max(0, viewport.height - h)
    return {
        right: Math.min(Math.max(0, inset.right), maxRight),
        bottom: Math.min(Math.max(0, inset.bottom), maxBottom),
    }
}

export const isCloseHandleEvent = (event: Event, closeEl: EventTarget | null | undefined): boolean => {
    if (!closeEl || !(event.target instanceof Node)) {
        return false
    }
    return closeEl === event.target || (closeEl instanceof Node && closeEl.contains(event.target))
}
