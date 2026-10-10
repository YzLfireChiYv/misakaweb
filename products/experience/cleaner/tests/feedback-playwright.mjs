/**
 * Isolated Edge fixture check. Not a live Bilibili verification.
 */
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = path.dirname(fileURLToPath(import.meta.url))
const cleaner = path.resolve(root, '..')
const require = createRequire(import.meta.url)

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const startFixture = async (labels) => {
    process.env.FIXTURE_LABELS = labels ? 'on' : 'off'
    const server = await createServer({
        configFile: path.join(root, 'fixture/vite.config.ts'),
        root: path.join(root, 'fixture'),
        cacheDir: path.join(cleaner, `node_modules/.tmp/fixture-cache-${labels ? 'on' : 'off'}`),
        server: { host: '127.0.0.1', port: labels ? 4177 : 4178, strictPort: true },
    })
    await server.listen()
    const urls = server.resolvedUrls?.local
    return { server, url: urls?.[0] ?? `http://127.0.0.1:${labels ? 4177 : 4178}/` }
}

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
    const userDataDir = path.join(cleaner, 'node_modules/.tmp/pw-edge-feedback')
    try {
        return await playwright.chromium.launchPersistentContext(userDataDir, {
            channel: 'msedge',
            headless: true,
            args: ['--disable-extensions', '--no-first-run', '--no-default-browser-check'],
        })
    } catch {
        return playwright.chromium.launchPersistentContext(userDataDir, {
            executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
            headless: true,
            args: ['--disable-extensions', '--no-first-run', '--no-default-browser-check'],
        })
    }
}

const collectIds = async (page) =>
    page.$$eval('[data-feedback-id]', (nodes) => nodes.map((node) => node.getAttribute('data-feedback-id')))

const main = async () => {
    const playwright = await loadPlaywright()
    if (!playwright) {
        console.log('PLAYWRIGHT_SKIP: playwright-core is not installed; jsdom fixture remains the UI check.')
        process.exit(0)
    }

    const context = await launchEdge(playwright)
    let on
    let off
    try {
        on = await startFixture(true)
        const labeled = await context.newPage()
        await labeled.goto(on.url, { waitUntil: 'networkidle' })
        await labeled.waitForSelector('#fixture-flag')
        const flagOn = await labeled.textContent('#fixture-flag')
        const ids = await collectIds(labeled)
        if (flagOn?.trim() !== 'feedback-on' || ids.length < 6) {
            throw new Error(`feedback fixture missing labels: flag=${flagOn} ids=${ids.join(',')}`)
        }
        if (!ids.some((id) => /^S\d{3}$/.test(id ?? ''))) {
            throw new Error(`feedback fixture has no S ids: ${ids.join(',')}`)
        }
        await labeled.locator('button').first().click()
        await wait(50)
        await on.server.close()
        on = null

        off = await startFixture(false)
        const plain = await context.newPage()
        await plain.goto(off.url, { waitUntil: 'networkidle' })
        const flagOff = await plain.textContent('#fixture-flag')
        const offIds = await collectIds(plain)
        if (flagOff?.trim() !== 'feedback-off' || offIds.length) {
            throw new Error(`standard fixture still labeled: flag=${flagOff} ids=${offIds.join(',')}`)
        }
        console.log('playwright fixture ok', { ids })
    } finally {
        await context.close()
        if (on) {
            await on.server.close()
        }
        if (off) {
            await off.server.close()
        }
    }
}

const childEnv = { ...process.env, FIXTURE_LABELS: process.env.FIXTURE_LABELS }
if (process.argv.includes('--install-playwright')) {
    const child = spawn('pnpm', ['dlx', 'playwright-core'], { stdio: 'inherit', shell: true, cwd: cleaner, env: childEnv })
    child.on('exit', (code) => process.exit(code ?? 1))
} else {
    main().catch((err) => {
        console.error(err)
        process.exit(1)
    })
}
