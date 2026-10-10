/** Full userscript on real anonymous pages. Uses isolated GM shims, not a real extension profile. */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
let playwright
for (const name of [process.env.PLAYWRIGHT_MODULE_PATH, 'playwright', 'playwright-core'].filter(Boolean)) {
    try { playwright = require(name); break } catch { /* next optional runtime */ }
}
if (!playwright) throw new Error('Install Playwright or set PLAYWRIGHT_MODULE_PATH to run this optional live test.')
const source = await fs.readFile(path.resolve(root, '../misakaweb-feedback-test.user.js'), 'utf8')
const vue = await fs.readFile(path.join(root, 'node_modules/vue/dist/vue.global.prod.js'), 'utf8')
const out = process.env.TEST_OUTPUT_DIR || path.join(root, 'node_modules/.tmp/live-search')
await fs.mkdir(out, { recursive: true })
const report = { bundle_sha256: crypto.createHash('sha256').update(source).digest('hex'),
    environment: 'Anonymous isolated Edge; complete script + GM shim; not ScriptCat installation', cases: [] }
const makeBootstrap = location => `(() => {
 if(window !== top || !window.location.hostname.endsWith('bilibili.com'))return;
 const run=()=>{
 const data=new Map([
  ['__MIGRATED__','4.4.0'],['biliweb-shortcut-entry',{enabled:${location !== 'disabled'},location:'${location === 'floating' ? 'floating' : 'header'}'}],
  ['common-hide-nav-search-btn',false],['common-hide-nav-search-rcmd',false],
  ['common-hide-nav-search-history',false],['common-hide-nav-search-trending',false]
 ]);
 const listeners=new Map();let serial=0;
 window.__searchTest={data,menus:[],gmRequests:[]};window.unsafeWindow=window;
 window.GM_info={scriptHandler:'isolated test shim',script:{name:'MisakaWeb'}};
 window.GM_getValue=(k,f)=>data.has(k)?data.get(k):f;
 window.GM_setValue=(k,v)=>{const old=data.get(k);data.set(k,v);for(const l of listeners.values())if(l.key===k)l.fn(k,old,v,false)};
 window.GM_deleteValue=k=>data.delete(k);window.GM_listValues=()=>[...data.keys()];
 window.GM_addValueChangeListener=(key,fn)=>{const id=++serial;listeners.set(id,{key,fn});return id};
 window.GM_removeValueChangeListener=id=>listeners.delete(id);
 window.GM_registerMenuCommand=(text,fn)=>{window.__searchTest.menus.push({text,fn});return window.__searchTest.menus.length};
 window.GM_unregisterMenuCommand=()=>{};window.GM_setClipboard=()=>{};
 window.GM_xmlhttpRequest=d=>{window.__searchTest.gmRequests.push(d.method);d.onerror?.({status:0})};
 ${vue}
 ${source}
 };
 if(document.documentElement)run();else{const observer=new MutationObserver(()=>{if(document.documentElement){observer.disconnect();run()}});observer.observe(document,{childList:true})}
})();`

const browser = await playwright.chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true })
const queryText = 'MisakaWeb搜索测试'
const urls = [['homepage','https://www.bilibili.com/'],['video','https://www.bilibili.com/video/BV1x2HS66E96/']]
try {
    for (const [pageName, url] of urls) for (const mode of ['native', 'header', 'floating', 'disabled']) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
        const record = { page: pageName, mode, checks: [], pageErrors: [] }
        report.cases.push(record)
        const pass = label => { record.checks.push(label); console.log(JSON.stringify({page: pageName, mode, pass:label})) }
        try {
            if (mode !== 'native') await context.addInitScript({ content: makeBootstrap(mode) })
            const page = await context.newPage()
            page.on('pageerror', error => record.pageErrors.push(error.message.slice(0,300)))
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
            const input = page.locator('#nav-searchform input').first()
            await input.waitFor({state:'visible',timeout:25000})
            if(mode !== 'native') await page.waitForFunction(()=>window.__searchTest?.menus.length===8,{timeout:20000})
            await page.waitForTimeout(700)
            const panel = page.locator('.search-panel.nav-search-panel').first()
            await input.click()
            await panel.waitFor({state:'visible',timeout:12000})
            await panel.locator('.trending').waitFor({state:'visible',timeout:12000})
            pass('native_search_panel_and_trending_visible')
            await input.fill('哔哩哔哩')
            await panel.locator('.suggestions .suggest-item').first().waitFor({state:'visible',timeout:12000})
            pass('native_search_suggestions_visible')
            await input.fill(queryText)
            const popupPromise = context.waitForEvent('page',{timeout:10000})
            await input.press('Enter')
            const popup = await popupPromise
            await page.waitForTimeout(300); await popup.close()
            await input.fill('')
            await page.locator('body').click({position:{x:30,y:500}})
            await input.click()
            await panel.locator('.history').waitFor({state:'visible',timeout:12000})
            assert((await panel.locator('.history').innerText()).includes(queryText))
            pass('history_created_by_native_search_and_visible')
            if(mode==='header') {
                const host = page.locator('#bili-cleaner-shortcut-host')
                await host.waitFor({state:'visible'})
                assert(await host.evaluate(el=>el.parentElement===document.body && el.children.length===0))
                const geometry = await page.evaluate(()=>{
                    const a=document.querySelector('#nav-searchform .nav-search-btn').getBoundingClientRect()
                    const h=document.querySelector('#bili-cleaner-shortcut-host').getBoundingClientRect()
                    return {gap:h.left-a.right, midpoint:h.top+h.height/2-(a.top+a.height/2)}
                })
                assert(Math.abs(geometry.gap-8)<3&&Math.abs(geometry.midpoint)<3,JSON.stringify(geometry))
                await host.locator('#trigger').click()
                await host.locator('[data-action-key="side-rule-panel"]').click()
                const rulePanel=page.locator('#bili-cleaner div.fixed.overflow-auto:visible').first()
                await rulePanel.waitFor({state:'visible'})
                await rulePanel.getByRole('button',{name:'关闭',exact:true}).click()
                await input.click();await panel.waitFor({state:'visible'})
                pass('body_portal_position_B24_B19_and_search_reopen')
                for (const next of [{enabled:false,location:'header'},{enabled:true,location:'floating'},{enabled:true,location:'header'}]) {
                    await page.evaluate(next=>window.GM_setValue('biliweb-shortcut-entry',next),next)
                    await page.waitForTimeout(200)
                    await input.click();await panel.waitFor({state:'visible'})
                    assert.equal(await page.locator('#bili-cleaner-shortcut-host').count(),next.enabled&&next.location==='header'?1:0)
                }
                pass('mode_switches_preserve_native_dropdown')
            }
            if(mode!=='native')assert.equal(await page.evaluate(()=>window.__searchTest.gmRequests.length),0)
            assert.equal(record.pageErrors.length,0,JSON.stringify(record.pageErrors))
            await page.screenshot({path:path.join(out,`${pageName}-${mode}.png`)})
        } catch(error) {record.failure=error.message;throw error}
        finally {await context.close();await fs.writeFile(path.join(out,'results.json'),JSON.stringify(report,null,2))}
    }
} finally {await browser.close();await fs.writeFile(path.join(out,'results.json'),JSON.stringify(report,null,2))}
