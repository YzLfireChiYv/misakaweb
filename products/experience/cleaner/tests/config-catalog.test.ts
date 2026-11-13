import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { buildCatalog, findCatalog, syntaxReader } from '../scripts/config-catalog.mjs'
import { filterCatalog, upstreamImpact } from '../scripts/catalog-relations.mjs'
import { coverageForPath } from '../scripts/catalog-coverage.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let catalogPromise: ReturnType<typeof buildCatalog> | undefined
const productCatalog = () => (catalogPromise ??= buildCatalog())
const temporary: string[] = []
afterEach(() => {
    for (const directory of temporary.splice(0)) {
        const resolved = fs.realpathSync(directory)
        if (path.dirname(resolved) !== fs.realpathSync(os.tmpdir()) || !path.basename(resolved).startsWith('misaka-catalog-'))
            throw new Error('Unexpected fixture cleanup target')
        fs.rmSync(resolved, { recursive: true })
    }
})

describe('review configuration catalog', () => {
    it('reads imported constants and helper parameters without executing arbitrary default expressions', () => {
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'misaka-catalog-'))
        temporary.push(directory)
        fs.mkdirSync(path.join(directory, 'src'))
        fs.writeFileSync(path.join(directory, 'src/keys.ts'), "export const KEYS = { enabled: 'flag', rate: 'rate' }")
        fs.writeFileSync(path.join(directory, 'src/items.ts'), `
            import { KEYS } from './keys'
            const numberItem = (id, options) => ({
                type: 'number' as const, id, defaultValue: 0,
                maxValue: options?.max ?? 1000, step: options?.step ?? 1,
            })
            export const items = [
                { type: 'switch', id: KEYS.enabled },
                { type: 'switch', id: 'explicit', defaultEnable: false },
                numberItem(KEYS.rate, { max: 100, step: 0.1 }),
                { type: 'number', id: 'dynamic', defaultValue: (() => { throw new Error('must not execute') })() },
            ]
        `)
        const rows = syntaxReader(directory).declarations('src/items.ts')
        const flag = rows.find(row => row.key === 'flag')!
        const explicit = rows.find(row => row.key === 'explicit')!
        expect(flag.declaredDefault.state).toBe('not-declared')
        expect(explicit.declaredDefault).toEqual({ state: 'literal', value: false })
        expect(flag.configurationDefault.value).toBe(false)
        expect(rows.find(row => row.key === 'rate')?.constraints).toMatchObject({
            maxValue: { state: 'literal', value: 100 }, step: { state: 'literal', value: 0.1 },
        })
        expect(rows.find(row => row.key === 'dynamic')?.configurationDefault.state).toBe('unresolved')
    })

    it('keeps shared storage, code observations, product decisions and package availability separate', async () => {
        const catalog = await productCatalog()
        const controlMap = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/feedback/control-map.json'), 'utf8'))
        expect(catalog.controls.map(row => row.key).sort()).toEqual(controlMap.settings.map(row => row.key).sort())
        expect(catalog.configurations.some(row => row.key === 'biliweb-sync-form')).toBe(false)
        const shortcut = catalog.configurations.find(row => row.key === 'biliweb-shortcut-entry')!
        expect(shortcut.controlIds).toEqual(['S524', 'S525'])
        expect(shortcut.productDefaultStatus).toBe('partially-confirmed')
        expect(shortcut.productDefaults).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'location', value: 'header' })]))
        const night = catalog.configurations.find(row => row.key === 'common-theme-dark')!
        expect(night.productDefaults).toEqual([])
        expect(night.productDefaultStatus).toBe('not-applicable')
        expect(night.tags.product).toEqual(['not-offered'])
        expect(night.registrationEditions).not.toContain('pure')
        expect(night.configurationDefaults).toEqual([])
        expect(night.readFallbacks).toEqual([])
        expect(night.effectiveDefaultStatus).toBe('not-derived')
        const untouched = catalog.configurations.find(row => row.key === 'homepage-hide-banner')!
        expect(untouched.productDefaultStatus).toBe('unreviewed')
        expect(untouched.productDefaults).toEqual([])
        expect(catalog.policy.candidatePreset.status).toBe('candidate')
        const share = catalog.configurations.find(row => row.key === 'video-page-simple-share')!
        expect(share.declarationDefaultConflict).toBe(true)
        expect(share.effectiveDefaultStatus).toBe('confirmed-override')
        expect(new Set(share.configurationDefaults.map(row => row.value))).toEqual(new Set([true, false]))
        expect(share.productDefaults).toEqual(expect.arrayContaining([expect.objectContaining({ value: true, status: 'confirmed' })]))
        expect(catalog.issues).toContainEqual(expect.objectContaining({
            kind: 'product-default-differs-from-code', configurationId: share.id,
        }))
        expect(catalog.counts.unresolvedDeclarations).toBe(0)
        expect(catalog.issues.some(row => row.kind === 'configuration-default-unresolved')).toBe(false)
        const found = findCatalog(catalog, 'F-MISAKA-TOUCH')
        expect(found.controls).toHaveLength(4)
        expect(found.controls.every(row => !row.capabilityEditions.includes('pure'))).toBe(true)
        const quality=catalog.configurations.find(row=>row.key==='global-quality-filter-value')!
        expect(quality.configurationDefaults[0].value).toBe(25)
        expect(quality.ruleAbsentDefault.value).toBe(0)
        expect(quality.readFallbackDifference).toBe(false)
        expect(quality.readFallbacks).toContainEqual(expect.objectContaining({
            reader: 'readSettingValue', fallback: { state: 'literal', value: 25 },
        }))
        expect(JSON.stringify(catalog)).not.toContain(ROOT.replaceAll('\\', '/'))
    }, 30000)

    it('filters by multiple tags without merging product scope into code availability', async () => {
        const catalog = await productCatalog()
        const finishing = filterCatalog(catalog, ['purpose=cleaning', 'role=finish', 'page=homepage'])
        expect(finishing.entries.map(row => row.id)).toEqual(expect.arrayContaining(['S190', 'S197']))
        const excluded = filterCatalog(catalog, ['product=not-offered'], {limit: 2, offset: 1})
        expect(excluded.total).toBe(3)
        expect(excluded.entries.map(row=>row.id)).toEqual(['M03','B17'])
        expect(excluded.entries[0].tags.implementation).toContain('historical')
        expect(() => filterCatalog(catalog, ['purpose=nonexistent'])).toThrow(/无效标签/)
    }, 30000)

    it('follows a shared configuration to its controls and both page implementations', async () => {
        const catalog = await productCatalog()
        const shortcut = findCatalog(catalog, 'gm:biliweb-shortcut-entry')
        expect(shortcut.controls.map(row => row.id)).toEqual(['S524', 'S525'])
        expect(shortcut.sourceFiles.map(row => row.path)).toContain('src/modules/shortcut/preference.ts')
        const share = findCatalog(catalog, 'gm:video-page-simple-share')
        expect(share.declarations.map(row => row.path)).toEqual(expect.arrayContaining([
            'src/modules/rules/video/groups/basic.ts', 'src/modules/rules/bangumi/groups/basic.ts',
        ]))
        expect(share.sourceFiles.some(row => row.upstream?.source === 'cleaner')).toBe(true)
        const connection = findCatalog(catalog, 'S026')
        expect(connection.configurations.map(row => row.key)).toEqual(expect.arrayContaining([
            'biliweb-sync-url', 'biliweb-sync-user', 'biliweb-sync-password',
        ]))
    }, 30000)

    it('reports direct and static reverse links and stops propagation at shared assembly files', async () => {
        const catalog = await productCatalog()
        const home = upstreamImpact(catalog, ['cleaner:src/modules/rules/homepage/groups/basic.scss'], {limit: 100})
        expect(home.hits).toContainEqual(expect.objectContaining({id:'S190', relation:'direct'}))
        expect(home.hits.some(row=>row.id==='B42')).toBe(false)
        expect(home.boundaries).toContainEqual(expect.objectContaining({path:'src/modules/rules/index.ts'}))
        const evolved = upstreamImpact(catalog, ['evolved:registry/lib/components/touch/player-gestures/swiper.ts'])
        expect(evolved.hits.filter(row=>row.relation==='direct').map(row=>row.id)).toEqual(['S526','S527','S528','S529'])
        expect(evolved.hits[0].localNotes.length).toBeGreaterThan(0)
        const shadow = upstreamImpact(catalog, ['cleaner:src/utils/shadow.ts','cleaner:src/new-upstream-only.ts'])
        expect(shadow.changes).toContainEqual(expect.objectContaining({status:'unmapped',path:'src/new-upstream-only.ts'}))
        expect(shadow.hits.some(row=>row.relation==='static-import'&&row.trail.at(-1)==='src/utils/shadow.ts')).toBe(true)
    }, 30000)

    it('keeps four stages independent of the current strategy and distinguishes tag sources', async () => {
        const catalog = await productCatalog()
        const chain = catalog.implementationChains.find(row=>row.id==='video-filter')!
        expect(chain.pages).toHaveLength(6)
        const home=chain.pages.find(row=>row.id==='homepage')!
        expect(home.currentStrategy.bindings).toContainEqual(expect.objectContaining({
            filter:'videoTitleFilter',field:'title',keys:['global-title-keyword-filter-value','homepage-title-keyword-filter-status'],
        }))
        expect(chain.decisionContractId).toBe(catalog.filterChainCommon.decisionContract.id)
        expect(catalog.filterChainCommon.decisionContract).toMatchObject({outcomes:['keep','discard'],status:'implemented'})
        expect(chain.shared.some(row=>row.stage==='decide')).toBe(false)
        expect(chain.pages.every(page=>page.stages.map(row=>row.stage).join(',')==='locate,fields,decide,layout')).toBe(true)
        expect(home.stages).toContainEqual(expect.objectContaining({stage:'layout',status:'natural'}))
        expect(chain.pages.every(page=>page.stages.some(row=>row.stage==='layout'&&row.refill?.status==='missing'))).toBe(true)
        const search=chain.pages.find(row=>row.id==='search')!
        expect(search.fields.some(row=>row.field==='relativity')).toBe(false)
        expect(search.currentStrategy.metrics).toContainEqual(expect.objectContaining({field:'relativity'}))
        expect(chain.shared.find(row=>row.id==='search-response-data')?.inputs[0]).toMatchObject({
            method:'site-response',fields:expect.arrayContaining(['tag']),
        })
        expect(chain.shared.find(row=>row.id==='video-statistics')?.inputs[0]).toMatchObject({
            method:'active-api',fields:['view','like','favorite'],
        })
        expect(chain.shared.find(row=>row.id==='general-tag-data')).toMatchObject({status:'missing',referenceIds:['video-tags-reference']})
        const byConfig=findCatalog(catalog,'S212').implementationChains[0]
        expect(byConfig.id).toBe('video-filter')
        expect(byConfig.pages.map(row=>row.id)).toEqual(['homepage'])
        expect(byConfig.pages[0].ruleBindings).toContainEqual(expect.objectContaining({field:'title',filter:'videoTitleFilter'}))
        const changed=upstreamImpact(catalog,['cleaner:src/utils/fetch.ts'])
        expect(changed.chainHits).toContainEqual(expect.objectContaining({label:'搜索结果的标签与相关度输入',pages:['search']}))
        const strategyChange=upstreamImpact(catalog,['cleaner:src/modules/filters/core/subFilters/keywordFilter.ts'])
        expect(strategyChange.chainHits).toContainEqual(expect.objectContaining({stage:'decide',strategyId:'current-core'}))
    }, 30000)

    it('keeps comment tiers, dynamic contexts and article search distinct while sharing execution evidence', async () => {
        const catalog=await productCatalog()
        const [comment,dynamic,article]=['comment-filter','dynamic-filter','article-filter'].map(id=>catalog.implementationChains.find(row=>row.id===id)!)
        expect(comment.pages.map(row=>row.id)).toEqual(['root','reply'])
        expect(comment.pages[0].routes).toEqual(['video','bangumi','playlist','dynamic','space','festival'])
        expect(comment.pages[1].currentStrategy.bindings).toContainEqual(expect.objectContaining({
            filter:'commentChainFilter',keys:['video-comment-chain-filter-status','video-comment-chain-level-value'],
        }))
        expect(comment.pages.every(row=>row.sharedStageIds.includes('hide-style'))).toBe(true)
        expect(dynamic.pages.map(row=>row.id)).toEqual(['dynamic','space','header'])
        expect(dynamic.pages[1].fields.some(row=>row.field==='uploader')).toBe(false)
        expect(dynamic.pages[2].currentStrategy.bindings).toContainEqual(expect.objectContaining({
            filter:'dynUploaderFilter',keys:['dyn-uploader-filter-status','dyn-uploader-filter-value'],
        }))
        expect(article.pages[0].fields.map(row=>row.field)).toEqual(['author','title'])
        expect(article.pages[0].sharedStageIds).toContain('hide-sign')
        const result=findCatalog(catalog,'global-title-keyword-filter-value')
        expect(result.implementationChains.map(row=>row.id)).toEqual(expect.arrayContaining(['video-filter','dynamic-filter']))
        const shadow=upstreamImpact(catalog,['cleaner:src/utils/shadow.ts'])
        expect(shadow.chainHits).toContainEqual(expect.objectContaining({chain:'comment-filter',stage:'locate',pages:['root','reply']}))
        const core=upstreamImpact(catalog,['cleaner:src/modules/filters/core/core.ts'])
        expect(core.chainHits.filter(row=>row.strategyId==='current-core')).toHaveLength(1)
    },30000)

    it('accounts for upstream declarations, actions, state and repository files with distinct dispositions',async()=>{
        const catalog=await productCatalog(),coverage=catalog.coverage
        const baseline=JSON.parse(fs.readFileSync(path.join(ROOT,'catalog/upstream-coverage-seed.json'),'utf8'))
        expect(new Set(coverage.files.map(row=>row.path))).toEqual(new Set(baseline.files))
        expect(new Set(coverage.baselineDefinitions.map(row=>row.id))).toEqual(new Set(baseline.declarations.map(row=>row.id)))
        expect(new Set(coverage.baselineActions.map(row=>row.id))).toEqual(new Set(baseline.actions.map(row=>row.id)))
        expect(coverage.baselineStorage).toHaveLength(baseline.storage.length)
        expect(coverage.controls).toHaveLength(catalog.controls.length)
        expect(coverage.checks).toEqual([])
        expect(coverage.declarations.filter(row=>row.status==='excluded')).toEqual([])
        expect(coverage.baselineDefinitions.filter(row=>row.status==='excluded').map(row=>row.key)).toEqual(['common-theme-dark'])
        expect(coverage.declarations.filter(row=>row.status==='inactive').map(row=>row.key).sort()).toEqual(['common-hide-nav-bdu','common-hide-nav-bml'])
        const selector=findCatalog(catalog,'S076').coverage.declarations[0]
        expect(selector.css.some(row=>row.path.endsWith('headerCenter.scss'))).toBe(true)
        expect(selector.callbacks.find(row=>row.name==='enableFn')?.operations).toContainEqual(expect.objectContaining({call:'document.querySelector'}))
        expect(findCatalog(catalog,'S524').coverage.controls[0]).toMatchObject({binding:'storage-field',field:'enabled'})
        expect(findCatalog(catalog,'B01').coverage.actions[0].refs).toContainEqual(expect.objectContaining({operation:'rule-write'}))
        const workflow=coverageForPath(coverage,'.github/workflows/main-release.yml')!
        expect(workflow.file).toMatchObject({kind:'upstream-workflow',status:'repository-entry',localPath:null})
        expect(upstreamImpact(catalog,['cleaner:.github/workflows/main-release.yml']).changes[0].status).toBe('registered-only')
        expect(coverageForPath(coverage,'src/components/DisclosureComp.vue')?.file.importedBy.length).toBeGreaterThan(0)
    },30000)
})
