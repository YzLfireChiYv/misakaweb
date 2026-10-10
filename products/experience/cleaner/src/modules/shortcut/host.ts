import { actionLabel } from '@/feedback'
import { ref } from 'vue'
import {
    HOST_GAP_PX,
    HOST_SLOT_PX,
    SHORTCUT_HOST_ID,
    SHORTCUT_RESERVE_ATTR,
    clampDropdownBox,
    findSearchAnchor,
    reportAnchor,
    reservationShift,
    rectFromDom,
    type AnchorReport,
} from './anchor'
import type { QuickAction } from './actions'

const HOST_CSS = `
:host { display: inline-flex; width: ${HOST_SLOT_PX}px; height: ${HOST_SLOT_PX}px; }
.trigger {
  position: relative;
  box-sizing: border-box;
  width: ${HOST_SLOT_PX}px;
  height: ${HOST_SLOT_PX}px;
  margin: 0;
  padding: 0;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #111;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  line-height: 14px;
  font-size: 12px;
  font-family: inherit;
}
.trigger:hover { background: #00aeec; color: #fff; border-color: #00aeec; }
.trigger:focus-visible { outline: 2px solid #00aeec; outline-offset: 1px; }
.line { pointer-events: none; user-select: none; }
.menu {
  position: fixed;
  z-index: 2147483646;
  margin: 0;
  padding: 4px 0;
  background: #fff;
  color: #111;
  border-radius: 6px;
  box-shadow: 0 8px 24px rgb(0 0 0 / 20%);
  overflow: auto;
  box-sizing: border-box;
}
.item {
  display: block;
  width: 100%;
  box-sizing: border-box;
  border: 0;
  background: transparent;
  text-align: left;
  padding: 6px 12px;
  font-size: 14px;
  cursor: pointer;
  color: inherit;
  font-family: inherit;
}
.item:hover, .item:focus { background: #00aeec; color: #fff; outline: none; }
.badge {
  display: inline-block;
  margin-right: 4px;
  padding: 0 3px;
  border-radius: 3px;
  background: #fcd34d;
  color: #111;
  font-size: 10px;
  font-weight: 700;
  font-family: ui-monospace, monospace;
}
.trigger .badge { position: absolute; top: -3px; right: -3px; margin: 0; }
`

type ReserveRecord = {
    el: HTMLElement
    prop: 'marginLeft' | 'left' | 'right'
    inline: string
}

let reserveRecord: ReserveRecord | null = null
let searchSlot: { el: HTMLElement; paddingRight: string; boxSizing: string } | null = null

export const shortcutAnchorStatus = ref<AnchorReport>({
    available: false,
    reason: 'missing',
    message: reportAnchor(null).message,
})

const isInsideHost = (node: Node | null): boolean => {
    const host = document.getElementById(SHORTCUT_HOST_ID)
    if (!host || !node) {
        return false
    }
    if (node === host || host.contains(node)) {
        return true
    }
    const root = host.shadowRoot
    return Boolean(root && (node === root || root.contains(node)))
}

const restoreReserve = () => {
    if (reserveRecord) {
        const { el, prop, inline } = reserveRecord
        el.style[prop] = inline
        el.removeAttribute(SHORTCUT_RESERVE_ATTR)
        reserveRecord = null
    }
    document.querySelectorAll(`[${SHORTCUT_RESERVE_ATTR}]`).forEach((node) => {
        if (node instanceof HTMLElement) {
            node.style.marginLeft = ''
            node.removeAttribute(SHORTCUT_RESERVE_ATTR)
        }
    })
}

const restoreSearchSlot = () => {
    if (!searchSlot) return
    searchSlot.el.style.paddingRight = searchSlot.paddingRight
    searchSlot.el.style.boxSizing = searchSlot.boxSizing
    searchSlot.el.removeAttribute('data-bili-cleaner-shortcut-slot')
    searchSlot = null
}

/** Reserve within the existing search width, instead of pushing the nav outwards. */
const prepareSearchSlot = (anchor: HTMLElement) => {
    const wrapper = anchor.closest('#nav-searchform')?.parentElement
    if (!(wrapper instanceof HTMLElement) || !wrapper.matches('.center-search__bar, .search-bar, .nav-search-box')) {
        restoreSearchSlot()
        return false
    }
    if (searchSlot?.el === wrapper) return true
    restoreSearchSlot()
    const base = Number.parseFloat(getComputedStyle(wrapper).paddingRight) || 0
    searchSlot = { el: wrapper, paddingRight: wrapper.style.paddingRight, boxSizing: wrapper.style.boxSizing }
    wrapper.style.boxSizing = 'border-box'
    wrapper.style.paddingRight = `${base + HOST_SLOT_PX + HOST_GAP_PX}px`
    wrapper.setAttribute('data-bili-cleaner-shortcut-slot', '')
    return true
}

const applyHostBox = (host: HTMLElement) => {
    host.id = SHORTCUT_HOST_ID
    host.setAttribute('data-shortcut-host', '1')
    host.style.boxSizing = 'border-box'
    host.style.display = 'inline-flex'
    host.style.flex = `0 0 ${HOST_SLOT_PX}px`
    host.style.width = `${HOST_SLOT_PX}px`
    host.style.minWidth = `${HOST_SLOT_PX}px`
    host.style.height = `${HOST_SLOT_PX}px`
    host.style.marginLeft = `${HOST_GAP_PX}px`
    host.style.marginRight = '0px'
    host.style.verticalAlign = 'middle'
    host.style.position = 'relative'
    host.style.left = ''
    host.style.top = ''
    host.style.zIndex = '30'
    host.style.pointerEvents = 'auto'
    host.style.flexShrink = '0'
}

const findHeader = (anchor: HTMLElement): HTMLElement => {
    const found = anchor.closest(
        'header, .bili-header, .bili-header__bar, #bili-header-m, .international-header, #internationalHeader',
    )
    return found instanceof HTMLElement ? found : document.body
}

const findRightNeighbor = (anchor: HTMLElement, host: HTMLElement): HTMLElement | null => {
    const form = anchor.closest('#nav-searchform')
    const start = form instanceof HTMLElement ? form : anchor
    const visit = (from: Element | null): HTMLElement | null => {
        let sib = from?.nextElementSibling ?? null
        while (sib) {
            if (sib !== host && sib instanceof HTMLElement && !host.contains(sib) && !sib.contains(host)) {
                const width = sib.getBoundingClientRect().width
                if (width > 8 && width < window.innerWidth * 0.7) {
                    return sib
                }
            }
            sib = sib.nextElementSibling
        }
        return null
    }
    return visit(start) ?? visit(start.parentElement)
}

const applyReservation = (host: HTMLElement, anchor: HTMLElement) => {
    restoreReserve()
    const neighbor = findRightNeighbor(anchor, host)
    if (!neighbor) {
        return
    }
    const shift = reservationShift(rectFromDom(host), rectFromDom(neighbor), HOST_GAP_PX)
    if (shift <= 0) {
        return
    }
    const style = getComputedStyle(neighbor)
    if (style.position === 'absolute' || style.position === 'fixed') {
        if (style.left.endsWith('px')) {
            reserveRecord = { el: neighbor, prop: 'left', inline: neighbor.style.left }
            neighbor.style.left = `${Number.parseFloat(style.left) + shift}px`
            neighbor.setAttribute(SHORTCUT_RESERVE_ATTR, 'left')
            return
        }
        if (style.right.endsWith('px')) {
            reserveRecord = { el: neighbor, prop: 'right', inline: neighbor.style.right }
            neighbor.style.right = `${Math.max(0, Number.parseFloat(style.right) - shift)}px`
            neighbor.setAttribute(SHORTCUT_RESERVE_ATTR, 'right')
            return
        }
    }
    const base = Number.parseFloat(style.marginLeft) || 0
    reserveRecord = { el: neighbor, prop: 'marginLeft', inline: neighbor.style.marginLeft }
    neighbor.style.marginLeft = `${base + shift}px`
    neighbor.setAttribute(SHORTCUT_RESERVE_ATTR, 'margin')
}

const pinBesideAnchor = (host: HTMLElement, anchor: HTMLElement) => {
    host.style.position = 'absolute'
    host.style.marginLeft = '0px'
    const a = anchor.getBoundingClientRect()
    const parent = host.offsetParent
    const initialBlock = !(parent instanceof HTMLElement) ||
        (parent === document.body && getComputedStyle(parent).position === 'static' && getComputedStyle(parent).transform === 'none')
    const r = parent instanceof HTMLElement ? parent.getBoundingClientRect() : null
    const originX = initialBlock ? -window.scrollX : r!.left + (parent as HTMLElement).clientLeft - (parent as HTMLElement).scrollLeft
    const originY = initialBlock ? -window.scrollY : r!.top + (parent as HTMLElement).clientTop - (parent as HTMLElement).scrollTop
    host.style.left = `${a.right + HOST_GAP_PX - originX}px`
    host.style.top = `${a.top + (a.height - HOST_SLOT_PX) / 2 - originY}px`
}

export const ensureHost = (anchor: HTMLElement): HTMLElement => {
    restoreReserve()
    document.querySelectorAll(`#${SHORTCUT_HOST_ID}`).forEach((node, index) => {
        if (index > 0) {
            node.remove()
        }
    })
    let host = document.getElementById(SHORTCUT_HOST_ID)
    if (!host) {
        host = document.createElement('div')
        host.id = SHORTCUT_HOST_ID
    }
    const form = anchor.closest('#nav-searchform')
    const after = form instanceof HTMLElement ? form : anchor
    if (host.parentElement !== after.parentElement || host.previousElementSibling !== after) {
        after.after(host)
    }
    applyHostBox(host)
    if (prepareSearchSlot(anchor)) {
        pinBesideAnchor(host, anchor)
        return host
    }
    const a = anchor.getBoundingClientRect()
    const h = host.getBoundingClientRect()
    const nearRight = h.left >= a.right - 2 && h.left <= a.right + HOST_GAP_PX + 28
    const vertical = Math.min(a.bottom, h.bottom) - Math.max(a.top, h.top) > 4
    if (!nearRight || !vertical) {
        pinBesideAnchor(host, anchor)
    }
    applyReservation(host, anchor)
    return host
}

export const releaseHost = () => {
    restoreReserve()
    restoreSearchSlot()
    document.querySelectorAll(`#${SHORTCUT_HOST_ID}`).forEach((node) => node.remove())
}

type HostOptions = {
    isActive: () => boolean
    getActions: () => QuickAction[]
}

export const createShortcutHostController = (opts: HostOptions) => {
    let observer: MutationObserver | null = null
    let attrObserver: MutationObserver | null = null
    let observedHeader: Element | null = null
    let sizeObserver: ResizeObserver | null = null
    let sizeAnchor: HTMLElement | null = null
    let raf = 0
    let menuOpen = false
    let onDocPointer: ((event: Event) => void) | null = null
    let onKey: ((event: KeyboardEvent) => void) | null = null
    let onWin: (() => void) | null = null

    const schedule = () => {
        if (raf) {
            return
        }
        raf = window.requestAnimationFrame(() => {
            raf = 0
            reconcile()
        })
    }

    const mutationsFromSelf = (records: MutationRecord[]) =>
        records.every((record) => {
            if (isInsideHost(record.target)) {
                return true
            }
            const nodes = [...record.addedNodes, ...record.removedNodes]
            return nodes.length > 0 && nodes.every((node) => isInsideHost(node))
        })

    const bindAttrObserver = (anchor: HTMLElement | null) => {
        attrObserver?.disconnect()
        observedHeader = null
        if (sizeAnchor !== anchor) {
            sizeObserver?.disconnect()
            sizeObserver = null
            sizeAnchor = anchor
            if (anchor && typeof ResizeObserver !== 'undefined') {
                sizeObserver = new ResizeObserver(schedule)
                sizeObserver.observe(anchor)
                const form = anchor.closest('#nav-searchform')
                if (form) sizeObserver.observe(form)
                if (form?.parentElement) sizeObserver.observe(form.parentElement)
            }
        }
        if (!anchor) {
            return
        }
        const header = findHeader(anchor)
        attrObserver = new MutationObserver(schedule)
        // Visibility can also be changed by our rule attributes on <html>.
        let ancestor: HTMLElement | null = anchor
        while (ancestor) {
            attrObserver.observe(ancestor, ancestor === document.documentElement
                ? { attributes: true }
                : { attributes: true, attributeFilter: ['class', 'style', 'hidden'] })
            ancestor = ancestor.parentElement
        }
        observedHeader = header
    }

    const positionMenu = (host: HTMLElement) => {
        const root = host.shadowRoot
        const menu = root?.getElementById('menu')
        const trigger = root?.getElementById('trigger')
        if (!(menu instanceof HTMLElement) || !(trigger instanceof HTMLElement)) {
            return
        }
        const box = clampDropdownBox({
            anchor: rectFromDom(trigger),
            viewport: { width: window.innerWidth, height: window.innerHeight },
            desiredWidth: 180,
            desiredHeight: Math.min(320, opts.getActions().filter((item) => item.isValid).length * 36 + 12),
        })
        menu.style.left = `${box.left}px`
        menu.style.top = `${box.top}px`
        menu.style.width = `${box.width}px`
        menu.style.maxHeight = `${box.height}px`
        menu.style.display = box.height > 0 ? '' : 'none'
        menu.style.height = 'auto'
    }

    const fillMenu = (host: HTMLElement) => {
        const root = host.shadowRoot
        const menu = root?.getElementById('menu')
        if (!(menu instanceof HTMLElement)) {
            return
        }
        menu.replaceChildren()
        for (const action of opts.getActions()) {
            if (!action.isValid) {
                continue
            }
            const item = document.createElement('button')
            item.type = 'button'
            item.className = 'item'
            item.setAttribute('role', 'menuitem')
            item.dataset.actionKey = action.actionKey
            item.title = action.text
            const code = actionLabel(action.actionKey)
            if (code) {
                const badge = document.createElement('span')
                badge.className = 'badge'
                badge.dataset.feedbackId = code
                badge.textContent = code
                item.append(badge)
            }
            item.append(document.createTextNode(action.text))
            item.addEventListener('click', (event) => {
                event.preventDefault()
                event.stopPropagation()
                menuOpen = false
                syncOpen(host)
                action.run()
            })
            menu.append(item)
        }
    }

    const syncOpen = (host: HTMLElement) => {
        const root = host.shadowRoot
        const menu = root?.getElementById('menu')
        const trigger = root?.getElementById('trigger')
        if (!(menu instanceof HTMLElement) || !(trigger instanceof HTMLElement)) {
            return
        }
        trigger.setAttribute('aria-expanded', menuOpen ? 'true' : 'false')
        menu.hidden = !menuOpen
        if (menuOpen) {
            fillMenu(host)
            positionMenu(host)
        }
    }

    const ensureShadow = (host: HTMLElement) => {
        const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' })
        if (!root.getElementById('trigger')) {
            const triggerCode = actionLabel('header-shortcut-toggle')
            root.innerHTML = `<style>${HOST_CSS}</style>
<button type="button" class="trigger" id="trigger" title="快捷入口" aria-label="快捷入口" aria-haspopup="menu" aria-expanded="false" aria-controls="menu">
  ${triggerCode ? `<span class="badge" data-feedback-id="${triggerCode}">${triggerCode}</span>` : ''}
  <span class="line">快捷</span><span class="line">入口</span>
</button>
<div class="menu" id="menu" role="menu" hidden></div>`
            const trigger = root.getElementById('trigger')
            trigger?.addEventListener('click', (event) => {
                event.preventDefault()
                event.stopPropagation()
                menuOpen = !menuOpen
                syncOpen(host)
            })
            trigger?.addEventListener('keydown', (event) => {
                if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    menuOpen = true
                    syncOpen(host)
                    const first = root.querySelector('[role="menuitem"]')
                    if (first instanceof HTMLElement) {
                        first.focus()
                    }
                }
            })
        }
        fillMenu(host)
        syncOpen(host)
    }

    const reconcile = () => {
        if (!opts.isActive()) {
            menuOpen = false
            releaseHost()
            shortcutAnchorStatus.value = {
                available: false,
                reason: 'missing',
                message: '页面快捷入口已关闭或未使用顶栏位置。仍可从脚本菜单「快捷开关设置」打开本面板。',
            }
            bindAttrObserver(null)
            return
        }
        const anchor = findSearchAnchor()
        const report = reportAnchor(anchor)
        shortcutAnchorStatus.value = report
        if (!anchor || !report.available) {
            menuOpen = false
            releaseHost()
            bindAttrObserver(anchor)
            return
        }
        const host = ensureHost(anchor)
        ensureShadow(host)
        bindAttrObserver(anchor)
        if (menuOpen) {
            positionMenu(host)
        }
    }

    const start = () => {
        if (observer) {
            reconcile()
            return
        }
        observer = new MutationObserver((records) => {
            if (mutationsFromSelf(records)) {
                return
            }
            schedule()
        })
        const root = document.body ?? document.documentElement
        observer.observe(root, { childList: true, subtree: true })
        onDocPointer = (event: Event) => {
            if (!menuOpen) {
                return
            }
            const host = document.getElementById(SHORTCUT_HOST_ID)
            if (!host) {
                return
            }
            const path = event.composedPath()
            if (path.includes(host) || (host.shadowRoot && path.includes(host.shadowRoot))) {
                return
            }
            menuOpen = false
            syncOpen(host)
        }
        onKey = (event: KeyboardEvent) => {
            if (!menuOpen) {
                return
            }
            if (event.key !== 'Escape') {
                return
            }
            event.stopPropagation()
            menuOpen = false
            const host = document.getElementById(SHORTCUT_HOST_ID)
            if (host) {
                syncOpen(host)
                host.shadowRoot?.getElementById('trigger')?.focus()
            }
        }
        onWin = () => {
            schedule()
            const host = document.getElementById(SHORTCUT_HOST_ID)
            if (host && menuOpen) {
                positionMenu(host)
            }
        }
        document.addEventListener('pointerdown', onDocPointer, true)
        document.addEventListener('keydown', onKey, true)
        window.addEventListener('resize', onWin, { passive: true })
        window.addEventListener('scroll', onWin, { passive: true, capture: true })
        reconcile()
    }

    const stop = () => {
        if (raf) {
            window.cancelAnimationFrame(raf)
            raf = 0
        }
        observer?.disconnect()
        observer = null
        attrObserver?.disconnect()
        attrObserver = null
        sizeObserver?.disconnect()
        sizeObserver = null
        sizeAnchor = null
        observedHeader = null
        if (onDocPointer) {
            document.removeEventListener('pointerdown', onDocPointer, true)
        }
        if (onKey) {
            document.removeEventListener('keydown', onKey, true)
        }
        if (onWin) {
            window.removeEventListener('resize', onWin)
            window.removeEventListener('scroll', onWin, true)
        }
        onDocPointer = null
        onKey = null
        onWin = null
        menuOpen = false
        releaseHost()
    }

    return {
        start,
        stop,
        refresh: reconcile,
        observedHeader: () => observedHeader,
    }
}
