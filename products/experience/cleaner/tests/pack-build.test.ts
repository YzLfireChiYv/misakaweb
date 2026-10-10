import { describe, expect, it } from 'vitest'
// Build-time JavaScript is intentionally outside the browser TS project.
// @ts-expect-error Node build helper has no browser declarations.
import { profileFor, profiles, excludedKeys, pruneSource, pruneSelector, cssPruningPlugin, itemDefinitions, auditBundle } from '../scripts/pack-build.mjs'

describe('complete pack variants', () => {
    it('keeps nine real profiles and refuses reserved touch profiles', () => {
        expect(profiles).toHaveLength(9)
        expect(() => profileFor('tablet')).toThrow()
        const excluded = excludedKeys(profileFor('pure'))
        expect(excluded.size).toBe(73)
        for (const key of ['homepage-increase-rcmd-load-size','homepage-rcmd-video-preload','video-page-simple-share','live-page-disable-hotkey-g-follow']) expect(excluded.has(key)).toBe(false)
    })
    it('removes optional objects before their initializer can touch the page', () => {
        const code=`const items=[{type:'switch',id:'common-unify-font',attrName:(()=>{throw Error('UNWANTED_INIT')})(),enableFn:()=>alert('UNWANTED_BODY')},{type:'switch',id:'homepage-hide-banner',enableFn:()=>alert('CORE_BODY')}];`
        const pure=pruneSource(code,'/modules/rules/common.ts',profileFor('pure'))
        expect(pure).not.toContain('UNWANTED_')
        expect(pure).toContain('CORE_BODY')
        expect(pruneSource(code,'/modules/rules/common.ts',profileFor('text-style'))).toContain('UNWANTED_INIT')
    })
    it('removes link actions without removing adjacent filter actions', () => {
        const code=`menus.push({name:'复制视频链接',fn:()=>alert('COPY_BODY')});menus.push({name:'屏蔽视频',fn:()=>alert('BLOCK_BODY')});`
        const pure=pruneSource(code,'/modules/filters/page.ts',profileFor('pure'))
        expect(pure).not.toContain('COPY_BODY')
        expect(pure).toContain('BLOCK_BODY')
    })
    it('preserves cleaning selectors, including negative optional guards and internal commas', () => {
        const excluded=excludedKeys(profileFor('pure'))
        expect(pruneSelector('html[homepage-layout="2"] .card, html[homepage-hide-banner] :is(.one,.two)',excluded)).toBe('html[homepage-hide-banner] :is(.one,.two)')
        expect(pruneSelector('html[homepage-hide-banner]:not([homepage-layout]) .banner',excluded)).toBe('html[homepage-hide-banner] .banner')
        expect(pruneSelector('html[video-page-hide-right-container]:not([player-is-wide]) .right-container',excluded)).toContain('player-is-wide')
        expect(pruneSelector('html[border-radius-video] .card',excluded)).toBe('')
    })
    it('runs CSS pruning against real parsed styles and removes only our font resource', async () => {
        const {createRequire}=await import('node:module')
        const require=createRequire(import.meta.url)
        const postcss=require(require.resolve('postcss',{paths:[require.resolve('vite')]}))
        const css=`html[homepage-layout='2']{width:2px}html[homepage-hide-banner]{display:none}@font-face{font-family:HarmonyOS_Medium;src:url(a)}@font-face{font-family:OTHER;src:url(b)}`
        const result=await postcss([cssPruningPlugin(profileFor('pure'))]).process(css,{from:undefined})
        expect(result.css).not.toContain('homepage-layout')
        expect(result.css).not.toContain('HarmonyOS_')
        expect(result.css).toContain('homepage-hide-banner')
        expect(result.css).toContain('OTHER')
    })
    it('rejects unknown page capabilities until classified', () => {
        expect(()=>pruneSource(`const items=[{type:'switch',id:'new-unclassified-capability'}]`,'/modules/rules/page.ts',profileFor('pure'))).toThrow('unclassified')
    })
    it('checks repeated core settings across pages, rather than mere key presence', () => {
        const core=`[{id:'homepage-hide-banner',type:'switch'},{id:'homepage-hide-banner',type:'switch'}]`
        expect(itemDefinitions(core).get('homepage-hide-banner')).toBe(2)
        expect(()=>auditBundle(`[{id:'homepage-hide-banner',type:'switch'}]`,core,profileFor('pure'))).toThrow('retained item lost')
        expect(()=>auditBundle(core,core,profileFor('pure'))).not.toThrow()
    })
})
