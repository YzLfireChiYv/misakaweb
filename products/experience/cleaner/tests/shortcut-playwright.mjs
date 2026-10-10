/**
 * Isolated Edge regressions for shortcut settings / header entry.
 * Not a live Bilibili or logged-in verification.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { createServer } from 'vite'

const root = path.dirname(fileURLToPath(import.meta.url))
const cleaner = path.resolve(root, '..')
const require = createRequire(import.meta.url)

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const loadPlaywright = async () => {
    const candidates = [
        'playwright-core',
        'playwright',
        path.join(cleaner, 'node_modules/.tmp/pw-lib/node_modules/playwright-core'),
        ...(process.env.PLAYWRIGHT_MODULE_PATH ? [process.env.PLAYWRIGHT_MODULE_PATH] : []),
    ]
    for (const id of candidates) {
        try {
            return require(id)
        } catch {
            // try next
        }
    }
    return null
}

const launchEdge = async (playwright) => {
    const userDataDir = path.join(cleaner, 'node_modules/.tmp/pw-edge-shortcut')
    const opts = {
        headless: true,
        viewport: { width: 1400, height: 900 },
        args: ['--disable-extensions', '--no-first-run', '--no-default-browser-check'],
    }
    try {
        return await playwright.chromium.launchPersistentContext(userDataDir, { channel: 'msedge', ...opts })
    } catch {
        return playwright.chromium.launchPersistentContext(userDataDir, {
            executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
            ...opts,
        })
    }
}

const fullyIn = (box, vw, vh) =>
    Boolean(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= vw + 1 && box.y + box.height <= vh + 1)

const assert = (cond, message) => {
    if (!cond) {
        throw new Error(message)
    }
}

const overlaps = (a, b) =>
    Boolean(a && b && a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y)

const main = async () => {
    const playwright = await loadPlaywright()
    if (!playwright) {
        console.log('PLAYWRIGHT_SKIP: playwright-core is not installed; jsdom shortcut tests remain.')
        process.exit(0)
    }

    process.env.FIXTURE_LABELS = 'on'
    const server = await createServer({
        configFile: path.join(root, 'fixture/vite.config.ts'),
        root: path.join(root, 'fixture'),
        cacheDir: path.join(cleaner, 'node_modules/.tmp/fixture-cache-shortcut'),
        server: { host: '127.0.0.1', port: 4180, strictPort: true },
    })
    await server.listen()
    const url = server.resolvedUrls?.local?.[0] ?? 'http://127.0.0.1:4180/'
    const context = await launchEdge(playwright)
    const page = await context.newPage()

    try {
        await page.addInitScript(() => {
            localStorage.setItem('bili-cleaner-side-btn-show', 'true')
            localStorage.setItem('bili-cleaner-side-btn-pos', JSON.stringify({ right: 10, bottom: 180 }))
        })
        await page.goto(new URL('shortcut.html', url).href, { waitUntil: 'networkidle' })
        await page.waitForSelector('#m07')

        const host = page.locator('#bili-cleaner-shortcut-host')
        await host.waitFor()
        assert((await host.count()) === 1, 'default header mode should create one host')
        assert(
            await page.evaluate(() => document.getElementById('bili-cleaner-shortcut-host')?.parentElement === document.body),
            'host must be a document.body portal',
        )
        assert(
            await page.evaluate(() => document.getElementById('nav-searchform')?.nextElementSibling?.id !== 'bili-cleaner-shortcut-host'),
            'host must not sit after the search form',
        )
        assert((await page.locator('.group.fixed').count()) === 0, 'floating button must not show in header mode')
        assert((await page.textContent('#pref-location'))?.trim() === 'header', 'default location is header')
        assert((await page.textContent('#pref-enabled'))?.trim() === 'on', 'default enabled')
        assert((await page.textContent('#legacy-show'))?.trim() === 'true', 'legacy show key must be preserved')
        assert((await page.textContent('#gm-raw'))?.trim() === 'null', 'startup must not write GM preference')

        const searchBtn = page.locator('#search-btn')
        const navLink = page.locator('#nav-link')
        const hostBox = await host.boundingBox()
        const searchBox = await searchBtn.boundingBox()
        const linkBox = await navLink.boundingBox()
        assert(hostBox && searchBox, 'host or search box missing')
        assert(hostBox.x + 1 >= searchBox.x + searchBox.width, 'host must sit to the right of the search icon')
        assert(!overlaps(hostBox, searchBox), 'host must not cover the search icon')
        assert(linkBox && hostBox.x + hostBox.width <= linkBox.x + 1, 'host must reserve room instead of overlaying nav')

        const trigger = host.locator('#trigger')
        await trigger.click()
        const pageClean = host.locator('[data-action-key="side-rule-panel"]')
        const openSettings = host.locator('[data-action-key="side-shortcut-settings"]')
        await pageClean.waitFor()
        assert((await pageClean.textContent())?.includes('页面净化'), 'header menu must include page cleaning')
        assert((await pageClean.getAttribute('data-action-key')) === 'side-rule-panel', 'B19 action key must stay')
        await pageClean.click()
        await wait(80)
        assert((await page.textContent('#rule-open'))?.trim() === 'open', 'B19 callback should toggle the rule panel')

        await trigger.click()
        await openSettings.click()
        await wait(80)
        assert((await page.textContent('#settings-open'))?.trim() === 'open', 'page entry should open shortcut settings')
        assert((await page.getByText('快捷开关设置').count()) > 0, 'settings panel title missing')
        const b19 = await pageClean.count()
        assert(b19 >= 0, 'keep locator alive')

        await page.locator('#m07').click()
        await wait(80)
        const token1 = (await page.textContent('#settings-token'))?.trim()
        await page.locator('#m07').click()
        await wait(80)
        const token2 = (await page.textContent('#settings-token'))?.trim()
        assert((await page.textContent('#settings-open'))?.trim() === 'open', 'M07 must keep the panel open')
        assert(Number(token2) > Number(token1), 'repeated M07 should bump the open token')

        const settingsPanel = page.locator('#shortcut-harness div.fixed.overflow-auto').first()
        const bar = page.locator('#shortcut-harness div.cursor-move').first()
        await page.setViewportSize({ width: 1400, height: 900 })
        let panelBox = await settingsPanel.boundingBox()
        const barBox = await bar.boundingBox()
        assert(barBox, 'settings header missing')
        await page.mouse.move(barBox.x + 80, barBox.y + 12)
        await page.mouse.down()
        await page.mouse.move(40, 40, { steps: 10 })
        await page.mouse.up()
        await wait(50)
        const dragged = await settingsPanel.boundingBox()
        assert(dragged && Math.abs(dragged.x - (panelBox?.x ?? 0)) > 40, 'settings panel should drag while open')

        await page.locator('#hide-settings').click()
        await wait(50)
        await page.setViewportSize({ width: 520, height: 480 })
        await wait(120)
        await page.locator('#m07').click()
        await wait(150)
        const reopened = await settingsPanel.boundingBox()
        assert(fullyIn(reopened, 520, 480), `reopened settings panel left the viewport: ${JSON.stringify(reopened)}`)
        const cx = reopened.x + reopened.width / 2
        const cy = reopened.y + reopened.height / 2
        assert(Math.abs(cx - 260) < 8, `expected centered x, got ${cx}`)
        assert(Math.abs(cy - 240) < 8, `expected centered y, got ${cy}`)

        await page.locator('#m07').click()
        await wait(80)
        const afterToken = await settingsPanel.boundingBox()
        const recenteredX = afterToken.x + afterToken.width / 2
        assert(Math.abs(recenteredX - 260) < 8, 'M07 while open should re-center')

        await page.setViewportSize({ width: 1400, height: 900 })
        await wait(120)
        await page.getByRole('radio', { name: '悬浮按钮' }).check({ force: true })
        await wait(120)
        assert((await host.count()) === 0, 'header host must leave when floating is selected')
        const side = page.locator('.group.fixed')
        await side.waitFor()
        const visibleSide = side.locator('div.cursor-pointer').last()
        await visibleSide.click()
        await wait(80)
        assert((await page.textContent('#rule-open'))?.trim() === 'closed', 'second B19 click on floating should toggle')

        await page.locator('#seed-pos').click()
        await wait(30)
        await page.evaluate(() => document.querySelector('#read-legacy')?.click())
        const posAfterSeed = (await page.textContent('#legacy-pos'))?.trim()
        assert(posAfterSeed?.includes('"right":80'), `seeded position missing: ${posAfterSeed}`)

        await page.getByRole('radio', { name: '顶栏搜索右侧' }).check({ force: true })
        await wait(120)
        await host.waitFor()
        assert((await side.count()) === 0, 'header and floating must not show together')
        await page.getByRole('radio', { name: '悬浮按钮' }).check({ force: true })
        await wait(120)
        await page.locator('#read-legacy').click()
        assert((await page.textContent('#legacy-pos'))?.trim() === posAfterSeed, 'floating position key must be preserved')
        assert((await page.textContent('#legacy-show'))?.trim() === 'true', 'legacy show key must not be deleted')

        await page.locator('#shortcut-enabled').uncheck({ force: true })
        await wait(80)
        assert((await host.count()) === 0, 'disabled mode should hide header host')
        assert((await page.locator('.group.fixed').count()) === 0, 'disabled mode should hide floating button')
        await page.locator('#m07').click()
        await wait(50)
        assert((await page.textContent('#settings-open'))?.trim() === 'open', 'M07 remains usable when page entry is off')

        await page.locator('#shortcut-enabled').check({ force: true })
        await page.getByRole('radio', { name: '顶栏搜索右侧' }).check({ force: true })
        await wait(120)
        await host.waitFor()
        await trigger.click()
        await wait(50)
        await page.keyboard.press('Escape')
        await wait(50)
        assert((await host.locator('#menu').isHidden()) === true, 'Escape should close the dropdown')

        await trigger.click()
        await wait(40)
        const clicksBefore = (await page.textContent('#search-clicks'))?.trim()
        await searchBtn.click()
        await wait(40)
        assert((await host.locator('#menu').isHidden()) === true, 'outside click should close the dropdown')
        assert(Number((await page.textContent('#search-clicks'))?.trim()) === Number(clicksBefore) + 1, 'search click must still fire')

        await page.evaluate(() => {
            const header = document.getElementById('page-header')
            if (!header) {
                return
            }
            header.innerHTML = `<form id="nav-searchform"><div class="nav-search-content"><input class="nav-search-input" /><div class="nav-search-btn" id="search-btn">🔍</div></div></form><a id="nav-link" href="#nav">番剧</a>`
        })
        await wait(200)
        assert((await page.locator('#bili-cleaner-shortcut-host').count()) === 1, 'header replacement must not duplicate hosts')
        assert(
            await page.evaluate(() => document.getElementById('bili-cleaner-shortcut-host')?.parentElement === document.body),
            'replaced header must keep the host as a body portal',
        )

        await page.evaluate(() => {
            const header = document.getElementById('page-header')
            if (header) {
                header.style.display = 'none'
            }
        })
        await wait(200)
        assert((await page.locator('#bili-cleaner-shortcut-host').count()) === 0, 'hidden header should drop the host')
        assert((await page.locator('.group.fixed').count()) === 0, 'hidden header must not fall back to floating')

        await page.setViewportSize({ width: 520, height: 480 })
        await page.evaluate(() => {
            const header = document.getElementById('page-header')
            if (header) {
                header.style.display = 'flex'
                header.style.justifyContent = 'flex-end'
            }
        })
        await wait(200)
        await host.waitFor()
        await trigger.click()
        await wait(50)
        const menu = host.locator('#menu')
        const menuBox = await menu.boundingBox()
        const vw = 520
        const vh = 480
        assert(fullyIn(menuBox, vw, vh), `dropdown left the viewport: ${JSON.stringify(menuBox)}`)

        await page.goto(new URL('shortcut.html', url).href, { waitUntil: 'networkidle' })
        await page.evaluate(() => {
            sessionStorage.setItem('shortcut-preset', JSON.stringify({ enabled: true, location: 'nope' }))
        })
        await page.reload({ waitUntil: 'networkidle' })
        await page.waitForSelector('#pref-location')
        assert((await page.textContent('#pref-location'))?.trim() === 'header', 'invalid location reloads as header')
        assert((await page.textContent('#gm-raw'))?.includes('nope'), 'invalid stored location must not be rewritten')
        assert((await page.locator('#bili-cleaner-shortcut-host').count()) === 1, 'invalid stored mode still uses header default')

        console.log('shortcut playwright ok')
    } finally {
        await context.close()
        await server.close()
    }
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
