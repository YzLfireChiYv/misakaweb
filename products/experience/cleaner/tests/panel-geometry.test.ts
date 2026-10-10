import { describe, expect, it } from 'vitest'
import {
    PANEL_DRAG_THRESHOLD_PX,
    capPanelSize,
    centeredPanelPosition,
    clampPanelPosition,
    clampSideBtnInset,
    exceededDragThreshold,
    isCloseHandleEvent,
    pointerDistance,
} from '../src/utils/panelGeometry'

describe('panel geometry helper', () => {
    it('treats sub-threshold pointer travel as a click', () => {
        const origin = { x: 100, y: 100 }
        expect(exceededDragThreshold(origin, { x: 103, y: 102 })).toBe(false)
        expect(pointerDistance(origin, { x: 103, y: 102 })).toBeLessThan(PANEL_DRAG_THRESHOLD_PX)
        expect(exceededDragThreshold(origin, { x: 100 + PANEL_DRAG_THRESHOLD_PX, y: 100 })).toBe(true)
        expect(exceededDragThreshold(null, { x: 140, y: 140 })).toBe(false)
    })

    it('keeps large-viewport size equal to percent/min and caps to a smaller viewport', () => {
        const spec = { widthPercent: 28, heightPercent: 85, minWidth: 360, minHeight: 600 }
        expect(capPanelSize({ width: 1920, height: 1080 }, spec)).toEqual({
            width: 1920 * 0.28,
            height: 1080 * 0.85,
        })
        expect(capPanelSize({ width: 800, height: 700 }, spec)).toEqual({ width: 360, height: 600 })
        expect(capPanelSize({ width: 300, height: 400 }, spec)).toEqual({ width: 300, height: 400 })
    })

    it('keeps the whole panel accessible using its computed size, even while hidden', () => {
        expect(clampPanelPosition({ x: 1008, y: 28 }, { width: 480, height: 560 }, { width: 360, height: 560 })).toEqual({
            x: 120,
            y: 0,
        })
        expect(clampPanelPosition({ x: 1008, y: 28 }, { width: 360, height: 420 }, { width: 360, height: 420 })).toEqual({
            x: 0,
            y: 0,
        })
    })

    it('clamps side-button inset without resetting the default when still in view', () => {
        const kept = clampSideBtnInset(
            { right: 10, bottom: 180 },
            { width: 1400, height: 900 },
            { width: 40, height: 40 },
        )
        expect(kept).toEqual({ right: 10, bottom: 180 })
        expect(
            clampSideBtnInset({ right: 2000, bottom: 180 }, { width: 400, height: 500 }, { width: 40, height: 88 }),
        ).toEqual({ right: 360, bottom: 180 })
        expect(
            clampSideBtnInset({ right: 10, bottom: 180 }, { width: 400, height: 500 }, { width: 0, height: 0 }),
        ).toEqual({ right: 10, bottom: 180 })
    })

    it('centers a panel and still clamps it inside a small viewport', () => {
        expect(centeredPanelPosition({ width: 1400, height: 900 }, { width: 340, height: 420 })).toEqual({
            x: (1400 - 340) / 2,
            y: (900 - 420) / 2,
        })
        expect(centeredPanelPosition({ width: 360, height: 420 }, { width: 360, height: 420 })).toEqual({ x: 0, y: 0 })
    })

    it('detects close-button events on nested svg targets', () => {
        const button = document.createElement('button')
        const svg = document.createElement('svg')
        button.append(svg)
        document.body.append(button)
        expect(isCloseHandleEvent({ target: svg } as unknown as Event, button)).toBe(true)
        expect(isCloseHandleEvent({ target: document.body } as unknown as Event, button)).toBe(false)
        button.remove()
    })
})
