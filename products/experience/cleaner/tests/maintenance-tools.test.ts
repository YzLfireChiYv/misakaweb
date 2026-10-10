import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { buildIndex, writeIndex } from '../scripts/maintenance-index.mjs'
import {
    assertAllowedOutputDir,
    findGitRoot,
    loadValidateEvidence,
    publicFilePath,
    sha256Normalized,
    stableStringify,
} from '../scripts/maintenance-lib.mjs'
import { buildPacket, listModules, parsePacketArgs } from '../scripts/maintenance-packet.mjs'

const PRODUCT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tmpDirs: string[] = []

afterEach(() => {
    while (tmpDirs.length) {
        const dir = tmpDirs.pop()
        try {
            fs.rmSync(dir!, { recursive: true, force: true })
        } catch {
            // best-effort cleanup of test fixtures only
        }
    }
})

const makeTmp = (prefix: string) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
    tmpDirs.push(dir)
    return dir
}

const writeAll = (root: string, files: Record<string, string>) => {
    for (const [rel, body] of Object.entries(files)) {
        const abs = path.join(root, rel)
        fs.mkdirSync(path.dirname(abs), { recursive: true })
        fs.writeFileSync(abs, body)
    }
}

const keepSource = `export const keep = 1
export const item = { type: 'switch', id: 'homepage-hide-banner' }
`

const makeFixture = () => {
    const root = makeTmp('maint-fix-')
    const keepHash = sha256Normalized(keepSource)
    writeAll(root, {
        'package.json': JSON.stringify({
            name: 'fixture',
            private: true,
            type: 'module',
            dependencies: { vue: '^3.5.0' },
            devDependencies: { typescript: '^5.0.0' },
        }),
        'tsconfig.json': '{}\n',
        'vite.config.ts': 'export default {}\n',
        LICENSE: 'MIT\n',
        'config/release.json': JSON.stringify({
            development: { version: '0.1.4.6', url: 'https://example.test/dev.user.js' },
            legacy: { version: '0.1.4', url: 'https://example.test/legacy.user.js' },
        }),
        'maintenance/registry.json': JSON.stringify({
            schemaVersion: 1,
            matching_path_note: 'Path match is a correspondence clue, not proof of authorship.',
            modules: [
                {
                    id: 'alpha',
                    label: 'Alpha',
                    paths: ['src/alpha/'],
                    recommended_checks: ['pnpm test', 'node tests/shortcut-playwright.mjs'],
                    live_verification: 'Required on affected page with actual complete script; passing unit/build alone is insufficient.',
                },
            ],
            sources: [
                {
                    id: 'cleaner',
                    repository: 'https://github.com/festoney8/bilibili-cleaner',
                    commit: '15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9',
                    relationship: 'copied baseline with local changes',
                },
            ],
            files: [
                {
                    file: 'src/alpha/keep.ts',
                    modules: ['alpha'],
                    provenance: 'matching-path-in-fixed-baseline',
                    upstream: {
                        source: 'cleaner',
                        path: 'src/alpha/keep.ts',
                        normalized_sha256: keepHash,
                    },
                },
                {
                    file: 'src/alpha/changed.ts',
                    modules: ['alpha'],
                    provenance: 'matching-path-in-fixed-baseline',
                    upstream: {
                        source: 'cleaner',
                        path: 'src/alpha/changed.ts',
                        normalized_sha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                    },
                },
            ],
        }),
        'src/alpha/keep.ts': keepSource,
        'src/alpha/changed.ts': 'export const changed = 2\n',
        'src/alpha/fresh.ts': 'export const fresh = 3\n',
        'src/alpha/mod.ts': `import { keep } from './keep'
import View from './view.vue'
import css from '../style.css?style'
import { item as aliasItem } from '@/alias-target'
import { reviewCatalog } from '@review-catalog'
import { settingsByKey } from '@feedback-index'
import { createApp } from 'vue'
export { changed } from './changed'
const loaded = await import('./fresh.ts')
const dynamic = await import(unresolvedName)
void keep
void View
void css
void aliasItem
void reviewCatalog
void settingsByKey
void createApp
void loaded
void dynamic
`,
        'src/alpha/view.vue': `<template><div /></template>
<script setup lang="ts">
import { keep } from './keep'
void keep
</script>
<style lang="scss">
@use './partial';
</style>
`,
        'src/alpha/_partial.scss': '$x: 1;\n',
        'src/style.css': 'body { margin: 0 }\n',
        'src/alias-target.ts': 'export const item = 1\n',
        'src/feedback/id-index.generated.ts': 'export const settingsByKey = {}\n',
        'src/feedback/review-catalog.generated.ts': 'export const reviewCatalog = []\n',
        'src/feedback/control-map.json': JSON.stringify({
            settings: [
                {
                    id: 'S179',
                    key: 'homepage-hide-banner',
                    type: 'switch',
                    names: ['隐藏 横幅banner'],
                },
            ],
            menus: [],
            actions: [],
        }),
        'tests/shortcut-playwright.mjs': 'export {}\n',
    })
    return root
}

const collectFixtureOccurrences = () => [
    {
        id: 'homepage-hide-banner',
        type: 'switch',
        name: '隐藏 横幅banner',
        file: 'alpha/keep.ts',
        panel: 'rule',
        pages: ['homepage'],
        group: 'basic',
    },
]

let productIndexPromise: Promise<Awaited<ReturnType<typeof buildIndex>>> | undefined
const productIndex = () => (productIndexPromise ??= buildIndex({ root: PRODUCT }))

describe('maintenance index', () => {
    it('classifies unchanged, diverged and unverified files and resolves aliases/vue/scss/style', async () => {
        const root = makeFixture()
        const index = await buildIndex({ root, collectOccurrences: collectFixtureOccurrences })
        const byPath = Object.fromEntries(index.files.map((f) => [f.path, f]))
        expect(byPath['src/alpha/keep.ts'].status).toBe('unchanged')
        expect(byPath['src/alpha/changed.ts'].status).toBe('diverged')
        expect(byPath['src/alpha/fresh.ts'].status).toBe('no-baseline')
        expect(byPath['src/alpha/fresh.ts'].provenance).toBe('unverified')
        expect(byPath['src/alpha/keep.ts'].modules).toEqual(['alpha'])
        expect(byPath['src/alpha/keep.ts'].upstream.url).toContain(
            '15d9bced793487a8c4b0f9e1f7f67c7ccf6f3da9/src/alpha/keep.ts',
        )
        expect(byPath['src/alpha/keep.ts'].upstream.pathMatch).toBe(true)

        const mod = byPath['src/alpha/mod.ts']
        expect(mod.imports).toEqual(
            expect.arrayContaining([
                'src/alpha/keep.ts',
                'src/alpha/view.vue',
                'src/style.css',
                'src/alias-target.ts',
                'src/feedback/review-catalog.generated.ts',
                'src/feedback/id-index.generated.ts',
                'src/alpha/changed.ts',
                'src/alpha/fresh.ts',
            ]),
        )
        expect(mod.external).toEqual([{ name: 'vue', version: '^3.5.0' }])
        expect(mod.unresolved.some((u) => u.reason === 'nonliteral-dynamic')).toBe(true)

        const view = byPath['src/alpha/view.vue']
        expect(view.imports).toEqual(expect.arrayContaining(['src/alpha/keep.ts', 'src/alpha/_partial.scss']))

        const s179 = index.settings.find((s) => s.id === 'S179')
        expect(s179?.key).toBe('homepage-hide-banner')
        expect(s179?.occurrences[0].path).toBe('src/alpha/keep.ts')
        expect(s179?.occurrences[0].line).toBe(2)
        expect(JSON.stringify(index)).not.toMatch(/[A-Za-z]:\\/)
        expect(index).not.toHaveProperty('sourceCommit')
        expect(index).not.toHaveProperty('generatedAt')
    })

    it('is deterministic and --check fails on a stale file without writing', async () => {
        const root = makeFixture()
        const first = await buildIndex({ root, collectOccurrences: collectFixtureOccurrences })
        const second = await buildIndex({ root, collectOccurrences: collectFixtureOccurrences })
        expect(stableStringify(first)).toBe(stableStringify(second))
        const dest = path.join(root, 'maintenance', 'index.generated.json')
        fs.writeFileSync(dest, stableStringify(first))
        const stamp = fs.statSync(dest).mtimeMs
        await expect(writeIndex({ root, check: true, collectOccurrences: collectFixtureOccurrences })).resolves.toMatchObject({
            wrote: false,
        })
        const mutated = JSON.parse(fs.readFileSync(dest, 'utf8'))
        mutated.counts.files = -1
        fs.writeFileSync(dest, stableStringify(mutated))
        await expect(writeIndex({ root, check: true, collectOccurrences: collectFixtureOccurrences })).rejects.toThrow(/stale/)
        const after = JSON.parse(fs.readFileSync(dest, 'utf8'))
        expect(after.counts.files).toBe(-1)
        expect(fs.statSync(dest).mtimeMs).toBeGreaterThanOrEqual(stamp)
    })

    it('keeps new product diagnostics files visible as no-baseline', async () => {
        const index = await productIndex()
        const diag = index.files.find((f) => f.path === 'src/modules/maintenance/diagnostics.ts')
        const evidence = index.files.find((f) => f.path === 'src/modules/maintenance/evidence.ts')
        expect(diag).toBeTruthy()
        expect(evidence).toBeTruthy()
        expect(diag?.status).toBe('no-baseline')
        expect(evidence?.status).toBe('no-baseline')
        expect(diag?.modules).toEqual(['diagnostics'])
        expect(index.files.some((f) => f.status === 'unchanged')).toBe(true)
        expect(index.files.some((f) => f.status === 'diverged')).toBe(true)
        const s179 = index.settings.find((s) => s.id === 'S179')
        expect(s179?.key).toBe('homepage-hide-banner')
        expect(s179?.occurrences.map((o) => o.path)).toEqual(
            expect.arrayContaining([
                'src/modules/rules/homepage/groups/basic.ts',
                'src/modules/rules/channel/groups/basic.ts',
                'src/modules/rules/popular/groups/basic.ts',
            ]),
        )
        expect(s179?.occurrences.every((o) => typeof o.line === 'number' && o.line > 0)).toBe(true)
        const shortcut = index.files.filter((f) => f.modules.includes('shortcut'))
        expect(s179?.occurrences.some(o=>o.path.endsWith('homepage/groups/basic.scss') && o.line===2)).toBe(true)
        const enabled=index.settings.find(s=>s.id==='S524')
        expect(enabled?.occurrences.some(o=>o.path==='src/modules/shortcut/preference.ts' && o.relation==='storage-binding')).toBe(true)
        expect(shortcut.some((f) => f.path.startsWith('src/modules/shortcut/'))).toBe(true)
        expect(shortcut.some((f) => f.path === 'src/views/HeaderShortcutView.vue')).toBe(true)
    }, 30000)
})

describe('maintenance packet', () => {
    it('keeps new structural evidence fields and blocks private source even inside products', async () => {
        const root=makeFixture()
        const evidence={format:'misakaweb-structural-diagnostic',schemaVersion:1,scriptVersion:'0.1.4',capturedAt:'2026-10-11T00:00:00Z',pageType:'homepage',site:'www.bilibili.com',scope:'structure-only; no text, URLs, storage, cookies or account data',probes:[{id:'portal',selector:'#bili-cleaner-shortcut-host',count:1,samples:[{tag:'div',classes:[],visible:true,rect:{x:1,y:1,width:40,height:40},childTags:[],childClasses:[],shadowRoot:true,parentTag:'body',parentClasses:[],parentIsBody:true,attributeNames:['id']}]}]}
        const {rebuildEvidence,isBlockedSourceAbs}=await import('../scripts/maintenance-lib.mjs')
        expect(rebuildEvidence(evidence).probes[0].samples[0].parentIsBody).toBe(true)
        expect(rebuildEvidence(evidence).probes[0].samples[0].attributeNames).toEqual(['id'])
        expect(isBlockedSourceAbs(path.join(root,'products/private/secret.ts'))).toBe(true)
        expect(()=>publicFilePath(root,path.resolve(root,'../outside.json'))).toThrow('escapes')
    })
    it('resolves module, setting and file selectors with transitive deps', async () => {
        const root = makeFixture()
        const index = await buildIndex({ root, collectOccurrences: collectFixtureOccurrences })
        const out = path.join(root, 'node_modules', '.tmp', 'maintenance-packets', 'mod-alpha')
        const result = await buildPacket({
            root,
            modules: ['alpha'],
            out,
            collectOccurrences: collectFixtureOccurrences,
            index,
        })
        expect(fs.existsSync(result.paths.context)).toBe(true)
        expect(fs.existsSync(path.join(result.paths.source, 'src/alpha/keep.ts'))).toBe(true)
        expect(fs.existsSync(path.join(result.paths.source, 'src/alpha/view.vue'))).toBe(true)
        expect(fs.existsSync(path.join(result.paths.source, 'src/style.css'))).toBe(true)
        expect(fs.existsSync(path.join(result.paths.source, 'src/feedback/id-index.generated.ts'))).toBe(true)
        expect(fs.existsSync(path.join(result.paths.source, 'package.json'))).toBe(true)
        expect(fs.existsSync(path.join(result.paths.source, 'tests/shortcut-playwright.mjs'))).toBe(true)
        expect(fs.existsSync(path.join(result.paths.source, 'node_modules'))).toBe(false)
        const context = fs.readFileSync(result.paths.context, 'utf8')
        expect(context).toContain('NOT RUN')
        expect(context).toContain('保持 GM 存储键')
        expect(context).toContain('SHA256')
        expect(context).toContain('homepage-hide-banner')
        const manifest = JSON.parse(fs.readFileSync(result.paths.manifest, 'utf8'))
        expect(manifest.liveVerification).toBe('NOT RUN')
        expect(manifest.release.copiedUserscript).toBe(false)

        const settingOut = path.join(root, 'node_modules', '.tmp', 'maintenance-packets', 'set-S179')
        const settingPacket = await buildPacket({
            root,
            settings: ['S179'],
            out: settingOut,
            collectOccurrences: collectFixtureOccurrences,
            index,
        })
        expect(settingPacket.files).toContain('src/alpha/keep.ts')

        const fileOut = path.join(root, 'node_modules', '.tmp', 'maintenance-packets', 'file-style')
        const filePacket = await buildPacket({
            root,
            files: ['src/style.css'],
            out: fileOut,
            collectOccurrences: collectFixtureOccurrences,
            index,
        })
        expect(filePacket.files).toEqual(['src/style.css'])
    })

    it('lists module ids and rejects a missing selector', async () => {
        const root = makeFixture()
        const ids = await listModules({ root, index: await buildIndex({ root, collectOccurrences: collectFixtureOccurrences }) })
        expect(ids).toEqual(['alpha'])
        await expect(buildPacket({ root, collectOccurrences: collectFixtureOccurrences })).rejects.toThrow(
            /--module|--setting|--file/,
        )
        const parsed = parsePacketArgs(['--module', 'shortcut', '--setting', 'S179', '--file', 'src/main.ts'])
        expect(parsed.modules).toEqual(['shortcut'])
        expect(parsed.settings).toEqual(['S179'])
        expect(parsed.files).toEqual(['src/main.ts'])
    })

    it('rejects outside, protected and overwrite output plus src traversal', async () => {
        const root = makeFixture()
        const index = await buildIndex({ root, collectOccurrences: collectFixtureOccurrences })
        await expect(
            buildPacket({
                root,
                files: ['src/../package.json'],
                collectOccurrences: collectFixtureOccurrences,
                index,
            }),
        ).rejects.toThrow(/src\//)
        await expect(
            buildPacket({
                root,
                files: ['tests/shortcut-playwright.mjs'],
                collectOccurrences: collectFixtureOccurrences,
                index,
            }),
        ).rejects.toThrow(/src\//)
        expect(() => assertAllowedOutputDir(root, path.join(root, 'src', 'packet-out'))).toThrow(/protected|must remain/)
        expect(() => assertAllowedOutputDir(root, path.join(os.tmpdir(), 'outside-packet'))).toThrow(/must remain/)
        const existing = path.join(root, 'node_modules', '.tmp', 'maintenance-packets', 'exists')
        fs.mkdirSync(existing, { recursive: true })
        expect(() => assertAllowedOutputDir(root, existing)).toThrow(/overwrite/)
        const repoRoot = findGitRoot(PRODUCT)
        if (repoRoot && fs.existsSync(path.join(repoRoot, 'private'))) {
            const priv = path.join(repoRoot, 'private', `maint-packet-allow-${Date.now()}`)
            expect(() => assertAllowedOutputDir(PRODUCT, priv, repoRoot)).not.toThrow()
        }

        const outside = makeTmp('maint-out-')
        const linkParent = path.join(root, 'node_modules', '.tmp', 'maintenance-packets')
        fs.mkdirSync(linkParent, { recursive: true })
        const link = path.join(linkParent, 'escape-link')
        try {
            fs.symlinkSync(outside, link, process.platform === 'win32' ? 'junction' : 'dir')
            expect(() => assertAllowedOutputDir(root, path.join(link, 'pkt'))).toThrow()
        } catch (err) {
            if ((err as NodeJS.ErrnoException).code && ['EPERM', 'EACCES', 'ENOTSUP'].includes((err as NodeJS.ErrnoException).code!)) {
                expect(() => assertAllowedOutputDir(root, path.join(root, 'src', 'nope'))).toThrow()
            } else if (err instanceof Error && /must remain|protected|overwrite|traversal|blocked/.test(err.message)) {
                // assertion threw as expected
            } else {
                throw err
            }
        }

        const leakDir = makeTmp('maint-leak-')
        const secret = path.join(leakDir, 'secret.ts')
        fs.writeFileSync(secret, 'export const secret = 1\n')
        const leakLink = path.join(root, 'src', 'alpha', 'leak.ts')
        try {
            fs.symlinkSync(secret, leakLink)
            const leakedIndex = await buildIndex({ root, collectOccurrences: collectFixtureOccurrences })
            expect(leakedIndex.files.some((f) => f.path === 'src/alpha/leak.ts')).toBe(false)
        } catch (err) {
            if (!(err as NodeJS.ErrnoException).code || !['EPERM', 'EACCES', 'ENOTSUP'].includes((err as NodeJS.ErrnoException).code!)) {
                if (!fs.existsSync(leakLink)) {
                    return
                }
                throw err
            }
        }
    })

    it('fails oversized packets before creating the output directory', async () => {
        const root = makeFixture()
        const index = await buildIndex({ root, collectOccurrences: collectFixtureOccurrences })
        const out = path.join(root, 'node_modules', '.tmp', 'maintenance-packets', 'too-big')
        await expect(
            buildPacket({
                root,
                modules: ['alpha'],
                out,
                maxBytes: 20,
                collectOccurrences: collectFixtureOccurrences,
                index,
            }),
        ).rejects.toThrow(/Narrow/)
        expect(fs.existsSync(out)).toBe(false)
    })

    it('rejects extra evidence fields and labels a version mismatch stale', async () => {
        const validate = await loadValidateEvidence(PRODUCT)
        expect(() =>
            validate({
                format: 'misakaweb-structural-diagnostic',
                schemaVersion: 1,
                scriptVersion: '0.1.4.6',
                capturedAt: '2026-10-11T00:00:00.000Z',
                pageType: 'homepage',
                site: 'www.bilibili.com',
                scope: 'structure-only; no text, URLs, storage, cookies or account data',
                probes: [],
                secret: 'nope',
            }),
        ).toThrow(/unsupported fields/)

        const root = makeFixture()
        fs.mkdirSync(path.join(root, 'src/modules/maintenance'), { recursive: true })
        fs.copyFileSync(path.join(PRODUCT, 'src/modules/maintenance/evidence.ts'), path.join(root, 'src/modules/maintenance/evidence.ts'))
        const index = await buildIndex({ root, collectOccurrences: collectFixtureOccurrences })
        const evidencePath = path.join(root, 'evidence.json')
        fs.writeFileSync(
            evidencePath,
            JSON.stringify({
                format: 'misakaweb-structural-diagnostic',
                schemaVersion: 1,
                scriptVersion: '0.0.0.1',
                capturedAt: '2026-10-11T00:00:00.000Z',
                pageType: 'homepage',
                site: 'www.bilibili.com',
                scope: 'structure-only; no text, URLs, storage, cookies or account data',
                probes: [],
            }),
        )
        const out = path.join(root, 'node_modules', '.tmp', 'maintenance-packets', 'evidence-stale')
        const result = await buildPacket({
            root,
            files: ['src/style.css'],
            out,
            evidence: evidencePath,
            collectOccurrences: collectFixtureOccurrences,
            index,
        })
        const manifest = JSON.parse(fs.readFileSync(result.paths.manifest, 'utf8'))
        expect(manifest.evidence.stale).toBe(true)
        const copied = JSON.parse(fs.readFileSync(result.paths.evidence!, 'utf8'))
        expect(copied).not.toHaveProperty('secret')
        expect(copied.scriptVersion).toBe('0.0.0.1')
        const context = fs.readFileSync(result.paths.context, 'utf8')
        expect(context).toContain('过期')
    })

    it('builds from an isolated tree without refs or private', async () => {
        const root = makeFixture()
        expect(fs.existsSync(path.join(root, 'refs'))).toBe(false)
        expect(fs.existsSync(path.join(root, 'private'))).toBe(false)
        const result = await buildPacket({
            root,
            files: ['src/alias-target.ts'],
            collectOccurrences: collectFixtureOccurrences,
        })
        expect(result.paths.directory.replaceAll('\\', '/')).toContain('node_modules/.tmp/maintenance-packets/')
        expect(fs.existsSync(result.paths.manifest)).toBe(true)
    })
})

describe('maintenance CLI syntax', () => {
    it('parses with node --check', () => {
        for (const rel of ['scripts/maintenance-lib.mjs', 'scripts/maintenance-index.mjs', 'scripts/maintenance-packet.mjs']) {
            const result = spawnSync(process.execPath, ['--check', path.join(PRODUCT, rel)], { encoding: 'utf8' })
            expect(result.status, result.stderr).toBe(0)
        }
    })
})
