/**
 * Isolated Edge regressions for settings panel / side-button interaction.
 * Not a live Bilibili or script-manager verification.
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
    const userDataDir = path.join(cleaner, 'node_modules/.tmp/pw-edge-panel')
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

const main = async () => {
    const playwright = await loadPlaywright()
    if (!playwright) {
        console.log('PLAYWRIGHT_SKIP: playwright-core is not installed; jsdom geometry tests remain.')
        process.exit(0)
    }

    process.env.FIXTURE_LABELS = 'on'
    const server = await createServer({
        configFile: path.join(root, 'fixture/vite.config.ts'),
        root: path.join(root, 'fixture'),
        cacheDir: path.join(cleaner, 'node_modules/.tmp/fixture-cache-panel'),
        server: { host: '127.0.0.1', port: 4179, strictPort: true },
    })
    await server.listen()
    const url = server.resolvedUrls?.local?.[0] ?? 'http://127.0.0.1:4179/'
    const context = await launchEdge(playwright)
    const page = await context.newPage()

    try {
        await page.addInitScript(() => {
            localStorage.setItem('bili-cleaner-side-btn-show', 'true')
            localStorage.setItem('bili-cleaner-side-btn-pos', JSON.stringify({ right: 10, bottom: 180 }))
        })
        await page.goto(new URL('panel.html', url).href, { waitUntil: 'networkidle' })
        await page.waitForSelector('#panel-open')
        await page.waitForSelector('.group.fixed')

        const side = page.locator('.group.fixed div.cursor-pointer').last()
        const panel = page.locator('#panel-harness div.fixed.overflow-auto').first()
        const close = page.getByRole('button', { name: '关闭' })
        const bar = page.locator('#panel-harness div.cursor-move').first()

        assert((await page.textContent('#panel-open'))?.trim() === 'closed', 'fixture should start closed')

        await side.click()
        await wait(80)
        assert((await page.textContent('#panel-open'))?.trim() === 'open', 'normal click should open the panel')

        await page.locator('#hide-panel').click()
        await wait(50)
        let box = await side.boundingBox()
        assert(box, 'side button box missing')
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.mouse.down()
        await page.mouse.move(box.x + box.width / 2 + 3, box.y + box.height / 2 + 2)
        await page.mouse.up()
        await wait(80)
        assert((await page.textContent('#panel-open'))?.trim() === 'open', 'tiny pointer move should still count as click')

        await page.locator('#hide-panel').click()
        await wait(50)
        box = await side.boundingBox()
        const beforeDrag = box
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.mouse.down()
        await page.mouse.move(box.x + box.width / 2 - 80, box.y + box.height / 2 - 40, { steps: 8 })
        await page.mouse.up()
        await wait(80)
        assert((await page.textContent('#panel-open'))?.trim() === 'closed', 'intentional drag should not toggle')
        const afterDrag = await side.boundingBox()
        assert(afterDrag && Math.abs(afterDrag.x - beforeDrag.x) > 40, 'intentional drag should move the side button')

        await page.locator('#open-panel').click()
        await wait(80)
        await close.click()
        await wait(80)
        assert((await page.textContent('#panel-open'))?.trim() === 'closed', 'close click should hide the panel')
        assert((await page.textContent('#close-count'))?.trim() === '1', 'close handler should fire once')

        await page.locator('#open-panel').click()
        await wait(80)
        const closeBox = await close.boundingBox()
        assert(closeBox, 'close button box missing')
        await page.mouse.move(closeBox.x + closeBox.width / 2, closeBox.y + closeBox.height / 2)
        await page.mouse.down()
        await page.mouse.move(closeBox.x + closeBox.width / 2 + 3, closeBox.y + closeBox.height / 2 + 2)
        await page.mouse.up()
        await wait(80)
        assert((await page.textContent('#panel-open'))?.trim() === 'closed', 'tiny move on close should still close')
        assert((await page.textContent('#close-count'))?.trim() === '2', 'close should fire after tiny move')

        await page.setViewportSize({ width: 1400, height: 900 })
        await page.locator('#open-panel').click()
        await wait(80)
        const barBox = await bar.boundingBox()
        assert(barBox, 'panel header box missing')
        await page.mouse.move(barBox.x + 80, barBox.y + 12)
        await page.mouse.down()
        await page.mouse.move(1200, 40, { steps: 12 })
        await page.mouse.up()
        await wait(50)
        await page.setViewportSize({ width: 480, height: 560 })
        await wait(150)
        const narrowPanel = await panel.boundingBox()
        const narrowClose = await close.boundingBox()
        assert(fullyIn(narrowPanel, 480, 560), `resized panel is partially outside viewport: ${JSON.stringify(narrowPanel)}`)
        assert(fullyIn(narrowClose, 480, 560), `resized close left the viewport: ${JSON.stringify(narrowClose)}`)
        assert(narrowPanel.width <= 480 + 1, `panel width ${narrowPanel.width} exceeds 480 viewport`)
        assert(narrowPanel.height <= 560 + 1, `panel height ${narrowPanel.height} exceeds 560 viewport`)

        await close.click()
        await wait(50)
        await page.setViewportSize({ width: 360, height: 420 })
        await wait(120)
        await page.evaluate(() => document.querySelector('#toggle-panel').click())
        await wait(150)
        assert((await page.textContent('#panel-open'))?.trim() === 'open', 'reopen via store toggle should show the panel')
        const reopened = await panel.boundingBox()
        const reopenedClose = await close.boundingBox()
        assert(fullyIn(reopened, 360, 420), `reopened panel is partially outside viewport: ${JSON.stringify(reopened)}`)
        assert(fullyIn(reopenedClose, 360, 420), `reopened close left the viewport: ${JSON.stringify(reopenedClose)}`)
        assert(reopened.width <= 360 + 1, `reopened width ${reopened.width} exceeds viewport`)
        assert(reopened.height <= 420 + 1, `reopened height ${reopened.height} exceeds viewport`)

        console.log('panel playwright ok', {
            narrowPanel,
            reopened,
        })
    } finally {
        await context.close()
        await server.close()
    }
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
