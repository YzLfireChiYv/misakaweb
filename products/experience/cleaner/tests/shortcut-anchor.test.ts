import { afterEach, describe, expect, it } from 'vitest'
import {
    classifyAnchor,
    clampDropdownBox,
    findSearchAnchor,
    HOST_GAP_PX,
    reservationShift,
} from '../src/modules/shortcut/anchor'
import { createShortcutHostController, releaseHost } from '../src/modules/shortcut/host'

const stubRect = (el: HTMLElement, box: { x: number; y: number; w: number; h: number }) => {
    el.getBoundingClientRect = () =>
        ({
            x: box.x,
            y: box.y,
            left: box.x,
            top: box.y,
            right: box.x + box.w,
            bottom: box.y + box.h,
            width: box.w,
            height: box.h,
            toJSON: () => ({}),
        }) as DOMRect
}

const headerHtml = (btnClass = 'nav-search-btn') => `
<header class="bili-header" style="display:flex;align-items:center;height:52px">
  <form id="nav-searchform" style="display:flex;width:376px;height:40px">
    <div class="nav-search-content">
      <input class="nav-search-input" />
      <div class="${btnClass}" id="search-btn">go</div>
    </div>
  </form>
  <a id="nav-link" href="#n">番剧</a>
</header>
<button class="nav-search-btn" id="body-search">body</button>
`

afterEach(() => {
    releaseHost()
    document.body.innerHTML = ''
})

describe('search anchor helpers', () => {
    it('prefers a visible header when an older hidden header remains in the DOM', () => {
        document.body.innerHTML = headerHtml() + '<div><form id="nav-searchform"><div class="search-btn" id="visible-search">go</div></form></div>'
        const hidden = document.getElementById('search-btn') as HTMLElement
        hidden.style.display = 'none'
        const visible = document.getElementById('visible-search') as HTMLElement
        stubRect(visible, { x: 400, y: 12, w: 32, h: 32 })
        expect(findSearchAnchor()).toBe(visible)
    })

    it('selects the header form button and ignores body search controls', () => {
        document.body.innerHTML = headerHtml()
        const found = findSearchAnchor()
        expect(found?.id).toBe('search-btn')
        expect(found).not.toBe(document.getElementById('body-search'))
    })

    it('accepts the live search-btn class inside #nav-searchform', () => {
        document.body.innerHTML = headerHtml('search-btn')
        expect(findSearchAnchor()?.id).toBe('search-btn')
    })

    it('classifies missing, hidden, collapsed, and offscreen anchors', () => {
        expect(classifyAnchor(null)).toBe('missing')
        document.body.innerHTML = headerHtml()
        const btn = document.getElementById('search-btn') as HTMLElement
        btn.style.display = 'none'
        expect(classifyAnchor(btn)).toBe('hidden')
        btn.style.display = ''
        stubRect(btn, { x: 10, y: 10, w: 0, h: 0 })
        expect(classifyAnchor(btn)).toBe('collapsed')
        stubRect(btn, { x: 20, y: -80, w: 32, h: 32 })
        expect(classifyAnchor(btn, { width: 800, height: 600 })).toBe('offscreen')
        stubRect(btn, { x: 400, y: 12, w: 32, h: 32 })
        expect(classifyAnchor(btn, { width: 800, height: 600 })).toBe('ready')
    })

    it('clamps a downward dropdown against the right and bottom of the viewport', () => {
        const box = clampDropdownBox({
            anchor: { left: 700, top: 10, right: 740, bottom: 50, width: 40, height: 40 },
            viewport: { width: 720, height: 200 },
            desiredWidth: 180,
            desiredHeight: 240,
        })
        expect(box.left + box.width).toBeLessThanOrEqual(720 - 8 + 0.01)
        expect(box.top).toBeGreaterThanOrEqual(50)
        expect(box.top + box.height).toBeLessThanOrEqual(200 - 8 + 0.01)
        expect(box.height).toBeLessThan(240)
    })

    it('computes the extra shift needed to keep a neighbor out of the host box', () => {
        expect(
            reservationShift(
                { left: 832, top: 12, right: 872, bottom: 52, width: 40, height: 40 },
                { left: 840, top: 12, right: 900, bottom: 44, width: 60, height: 32 },
                HOST_GAP_PX,
            ),
        ).toBe(40)
        expect(
            reservationShift(
                { left: 832, top: 12, right: 872, bottom: 52, width: 40, height: 40 },
                { left: 890, top: 12, right: 950, bottom: 44, width: 60, height: 32 },
            ),
        ).toBe(0)
    })
})

describe('shortcut host controller', () => {
    it('places one host after the form, ignores search clicks, and cleans up after replacement', () => {
        document.body.innerHTML = headerHtml()
        const search = document.getElementById('search-btn') as HTMLElement
        stubRect(search, { x: 800, y: 12, w: 32, h: 32 })
        let clicks = 0
        search.addEventListener('click', () => {
            clicks += 1
        })
        const controller = createShortcutHostController({
            isActive: () => true,
            getActions: () => [
                { text: '页面净化', defaultHidden: false, isValid: true, actionKey: 'side-rule-panel', run: () => {} },
            ],
        })
        controller.start()
        expect(document.querySelectorAll('#bili-cleaner-shortcut-host')).toHaveLength(1)
        const host = document.getElementById('bili-cleaner-shortcut-host')
        expect(host?.previousElementSibling?.id).toBe('nav-searchform')
        search.click()
        expect(clicks).toBe(1)

        const header = document.querySelector('header') as HTMLElement
        header.innerHTML = `
          <form id="nav-searchform"><div class="nav-search-btn" id="search-btn-2">go</div></form>
          <a id="nav-link" href="#n">番剧</a>`
        const next = document.getElementById('search-btn-2') as HTMLElement
        stubRect(next, { x: 800, y: 12, w: 32, h: 32 })
        controller.refresh()
        expect(document.querySelectorAll('#bili-cleaner-shortcut-host')).toHaveLength(1)
        expect(document.getElementById('bili-cleaner-shortcut-host')?.previousElementSibling?.id).toBe('nav-searchform')

        controller.stop()
        expect(document.getElementById('bili-cleaner-shortcut-host')).toBeNull()
    })

    it('does not invent a floating host when the header search button is hidden', () => {
        document.body.innerHTML = headerHtml()
        const form = document.getElementById('nav-searchform') as HTMLElement
        form.style.display = 'none'
        const controller = createShortcutHostController({
            isActive: () => true,
            getActions: () => [],
        })
        controller.start()
        expect(document.getElementById('bili-cleaner-shortcut-host')).toBeNull()
        expect(document.querySelector('.group.fixed')).toBeNull()
        controller.stop()
    })
})
