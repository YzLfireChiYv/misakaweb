/**
 * Build a webpage-AI maintenance packet: selected source + transitive deps,
 * CONTEXT.md, and a per-packet manifest. Does not message external AI.
 */
import fs from 'node:fs'
import path from 'node:path'
import { buildIndex } from './maintenance-index.mjs'
import {
    DEFAULT_MAX_BYTES,
    SCHEMA_VERSION,
    assertAllowedOutputDir,
    assertSrcSelector,
    compareUrl,
    currentScriptVersion,
    defaultPacketDir,
    fence,
    findGitRoot,
    gitSnapshot,
    isMainModule,
    langFor,
    loadReleaseRecord,
    loadValidateEvidence,
    packetSlug,
    parseMaxBytes,
    parseUpstreamFlag,
    posixRel,
    productRootFromScript,
    readEvidenceFile,
    rebuildEvidence,
    sha256Normalized,
    stableStringify,
    toPosix,
} from './maintenance-lib.mjs'

const PRODUCT_ROOT = productRootFromScript(import.meta.url)

const SUPPORTING_FILES = [
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'tsconfig.json',
    'vite.config.ts',
    'vitest.config.ts',
    'postcss.config.js',
    'LICENSE',
    'config/release.json',
    'config/optimization-packs.json',
    'config/build-profiles.json',
    'scripts/pack-build.mjs',
    'scripts/build-variants.mjs',
    'PACKS.md',
    'community/README.md',
    'community/evolved-player-gestures.json',
    'src/feedback/review-catalog.generated.ts',
    'src/modules/configuration/README.md',
    'src/modules/touch/README.md',
    'src/modules/touch/LICENCE.md',
    'maintenance/registry.json',
    'maintenance/README.md',
]

const TEST_GLOBS = {
    'node tests/shortcut-playwright.mjs': [
        'tests/shortcut-playwright.mjs',
        'tests/shortcut-actions.test.ts',
        'tests/shortcut-anchor.test.ts',
        'tests/shortcut-preference.test.ts',
        'tests/fixture/shortcut.html',
        'tests/fixture/shortcut.ts',
        'tests/fixture/ShortcutHarness.vue',
        'tests/gm-mock.ts',
    ],
    'pnpm test:search': ['tests/live-search-playwright.mjs'],
}

export const parsePacketArgs = (argv) => {
    const out = {
        modules: [],
        settings: [],
        files: [],
        list: false,
        out: null,
        evidence: null,
        maxBytes: DEFAULT_MAX_BYTES,
        upstream: [],
    }
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]
        const next = () => {
            const value = argv[++i]
            if (value == null || value.startsWith('--')) {
                throw new Error(`missing value for ${arg}`)
            }
            return value
        }
        if (arg === '--list') {
            out.list = true
        } else if (arg === '--module' || arg.startsWith('--module=')) {
            out.modules.push(arg.includes('=') ? arg.slice('--module='.length) : next())
        } else if (arg === '--setting' || arg.startsWith('--setting=')) {
            out.settings.push(arg.includes('=') ? arg.slice('--setting='.length) : next())
        } else if (arg === '--file' || arg.startsWith('--file=')) {
            out.files.push(arg.includes('=') ? arg.slice('--file='.length) : next())
        } else if (arg === '--out' || arg.startsWith('--out=')) {
            out.out = arg.includes('=') ? arg.slice('--out='.length) : next()
        } else if (arg === '--evidence' || arg.startsWith('--evidence=')) {
            out.evidence = arg.includes('=') ? arg.slice('--evidence='.length) : next()
        } else if (arg === '--max-bytes' || arg.startsWith('--max-bytes=')) {
            out.maxBytes = parseMaxBytes(arg.includes('=') ? arg.slice('--max-bytes='.length) : next())
        } else if (arg === '--upstream' || arg.startsWith('--upstream=')) {
            out.upstream.push(parseUpstreamFlag(arg.includes('=') ? arg.slice('--upstream='.length) : next()))
        } else if (arg === '--help' || arg === '-h') {
            out.help = true
        } else {
            throw new Error(`unknown argument: ${arg}`)
        }
    }
    return out
}

const fileByPath = (index) => {
    const map = new Map()
    for (const file of index.files) {
        map.set(file.path, file)
    }
    return map
}

const settingByQuery = (index) => {
    const byId = new Map()
    const byKey = new Map()
    for (const row of index.settings) {
        byId.set(row.id, row)
        byKey.set(row.key, row)
    }
    return { byId, byKey }
}

const resolveSetting = (index, query) => {
    const maps = settingByQuery(index)
    const row = maps.byId.get(query) ?? maps.byKey.get(query)
    if (!row) {
        throw new Error(`unknown setting: ${query}`)
    }
    return row
}

const collectSeeds = (root, index, selectors) => {
    const files = new Set()
    const omissions = []
    const selectedModules = []
    const selectedSettings = []
    const moduleIds = new Set(index.modules.map((m) => m.id))

    for (const id of selectors.modules) {
        if (!moduleIds.has(id)) {
            throw new Error(`unknown module: ${id}`)
        }
        const mod = index.modules.find((m) => m.id === id)
        selectedModules.push(mod)
        let count = 0
        for (const file of index.files) {
            if (file.modules.includes(id)) {
                files.add(file.path)
                count += 1
            }
        }
        if (!count) {
            omissions.push({ kind: 'module-empty', id })
        }
    }

    for (const query of selectors.settings) {
        const row = resolveSetting(index, query)
        selectedSettings.push(row)
        const occPaths = row.occurrences.map((o) => o.path).filter(Boolean)
        if (!occPaths.length) {
            omissions.push({ kind: 'setting-no-occurrence', id: row.id, key: row.key })
        }
        for (const p of occPaths) {
            if (index.files.some((f) => f.path === p)) {
                files.add(p)
            } else {
                omissions.push({ kind: 'setting-missing-file', id: row.id, key: row.key, path: p })
            }
        }
    }

    for (const rel of selectors.files) {
        const posix = assertSrcSelector(root, rel)
        if (!index.files.some((f) => f.path === posix)) {
            omissions.push({ kind: 'file-not-in-index', path: posix })
        }
        files.add(posix)
    }

    return { files, omissions, selectedModules, selectedSettings }
}

const expandTransitive = (index, seeds) => {
    const byPath = fileByPath(index)
    const selected = new Set()
    const queue = [...seeds]
    while (queue.length) {
        const rel = queue.shift()
        if (selected.has(rel)) {
            continue
        }
        selected.add(rel)
        const rec = byPath.get(rel)
        if (!rec) {
            continue
        }
        for (const dep of rec.imports ?? []) {
            if (!selected.has(dep)) {
                queue.push(dep)
            }
        }
    }
    return selected
}

const testsForModules = (root, modules) => {
    const checks = new Set()
    for (const mod of modules) {
        for (const check of mod.recommendedChecks ?? []) {
            checks.add(check)
        }
    }
    const files = []
    const missing = []
    for (const [needle, list] of Object.entries(TEST_GLOBS)) {
        if (![...checks].some((c) => c === needle || c.includes(needle.replace(/^pnpm /, '')))) {
            continue
        }
        for (const rel of list) {
            const abs = path.join(root, rel)
            if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
                files.push(rel)
            } else {
                missing.push(rel)
            }
        }
    }
    return { checks: [...checks], files: [...new Set(files)].sort(), missing }
}

const supportingPresent = (root) => SUPPORTING_FILES.filter((rel) => fs.existsSync(path.join(root, rel)))

const subsetIndex = (index, selectedPaths) => {
    const set = new Set(selectedPaths)
    const files = index.files.filter((f) => set.has(f.path))
    const settings = index.settings.filter((row) => row.occurrences.some((o) => set.has(o.path)))
    const unresolved = (index.unresolved ?? []).filter((u) => set.has(u.from))
    const externalNames = new Set(files.flatMap((f) => (f.external ?? []).map((e) => e.name)))
    const external = (index.external ?? []).filter((e) => externalNames.has(e.name))
    return {
        schemaVersion: index.schemaVersion,
        matchingPathNote: index.matchingPathNote,
        sources: index.sources,
        modules: index.modules,
        files,
        settings,
        external,
        unresolved,
        counts: {
            files: files.length,
            settings: settings.length,
            unresolved: unresolved.length,
        },
    }
}

const publicCopySource = (root, rel) => {
    const from = path.resolve(root, rel)
    if (!fs.existsSync(from) || !fs.statSync(from).isFile()) {
        throw new Error(`missing copy source: ${rel}`)
    }
    const real = fs.realpathSync(from)
    const relFromRoot = posixRel(root, real)
    if (!relFromRoot || relFromRoot.startsWith('..') || path.isAbsolute(relFromRoot)) {
        throw new Error(`copy source escapes product: ${rel}`)
    }
    const n = `/${toPosix(relFromRoot).toLowerCase()}/`
    for (const seg of ['/node_modules/', '/.git/', '/refs/', '/private/', '/onedrive/', '/dist/']) {
        if (n.includes(seg)) {
            throw new Error(`refusing to copy blocked path: ${rel}`)
        }
    }
    return real
}

const copyTreeFile = (root, rel, destRoot) => {
    const real = publicCopySource(root,rel)
    const to = path.join(destRoot, 'source', toPosix(rel))
    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.writeFileSync(to, fs.readFileSync(real))
    return to
}

const languageFence = (rel, text) => fence(langFor(rel), text)

const renderContext = ({
    selectors,
    selectedModules,
    selectedSettings,
    sourceFiles,
    texts,
    hashes,
    indexSubset,
    unresolved,
    omissions,
    checks,
    git,
    release,
    evidenceMeta,
    upstreamLinks,
}) => {
    const lines = []
    lines.push('# 维护上下文包')
    lines.push('')
    lines.push('## 给网页 AI 的交接说明')
    lines.push('')
    lines.push('1. 上游基线仓库与固定 commit 见下文 URL。路径对应只是对照线索，不是作者证明，也不是语义等价证明。')
    lines.push('2. 以本包中的本地 SHA 与 status（unchanged / diverged / no-baseline）处理本地偏差，不要用上游整文件覆盖本地实现。')
    lines.push('3. 保持 GM 存储键、默认值与数据边界。不要改键名，不要把用户文本、Cookie、账号数据或页面 HTML 写入诊断。')
    lines.push('4. 明确写出假设。未实际运行的测试不要写成已经通过。')
    lines.push('5. 现场验证默认状态为 NOT RUN，需要用户在真实页面用完整脚本复核。')
    lines.push('6. 预览文档需用户自行上传。本工具不会向外部 AI 发送消息。')
    lines.push('7. 本包是相关源码子集，不是独立可编译工程；构建请使用上述Git提交的完整仓库。存在工作树改动时，以文件哈希识别输入。')
    lines.push('8. virtual-module表示脚本管理器/Vite插件注入的API（如$），不是需要重新下载的源码；其他未解析项另行确认。')
    lines.push('')
    lines.push('## 任务描述（由提问者补充）')
    lines.push('')
    lines.push('- 实际问题与预期行为：待填写。')
    lines.push('- 示例页面及重现步骤：待填写；不要附带账号/访问令牌/私人名单。')
    lines.push('- 浏览器、登录或匿名状态、相关脚本组合：待填写。')
    lines.push('- 上游是否已有修复、需要保持的本地功能：待填写。')
    lines.push('- 没有这些信息时先定位需要补充的证据，不把猜测写成已确认的修复。')
    lines.push('')
    lines.push('## 选择范围')
    lines.push('')
    if (selectors.modules.length) {
        lines.push(`- 模块：${selectors.modules.join(', ')}`)
    }
    if (selectors.settings.length) {
        lines.push(`- 设置：${selectors.settings.join(', ')}`)
    }
    if (selectors.files.length) {
        lines.push(`- 文件：${selectors.files.join(', ')}`)
    }
    for (const mod of selectedModules) {
        lines.push(`- ${mod.id}（${mod.label}）`)
    }
    for (const row of selectedSettings) {
        lines.push(`- ${row.id} \`${row.key}\``)
    }
    lines.push('')
    lines.push('## 上游基线')
    lines.push('')
    for (const source of indexSubset.sources ?? []) {
        lines.push(`- ${source.id}: ${source.repository}/tree/${source.commit}`)
        lines.push(`  - ${source.relationship}`)
    }
    lines.push('')
    lines.push('## 源码快照')
    lines.push('')
    if (git.available) {
        lines.push(`- Git HEAD: \`${git.head}\``)
        if (git.dirty.length) {
            lines.push('- 相关工作区改动：')
            for (const d of git.dirty) {
                lines.push(`  - ${d}`)
            }
        } else {
            lines.push('- 相关工作区：干净（所选路径）')
        }
    } else {
        lines.push('- Git 不可用；未记录 HEAD。')
    }
    lines.push('')
    lines.push('## 现场验证')
    lines.push('')
    lines.push('- 状态：NOT RUN（默认）')
    for (const mod of selectedModules) {
        if (mod.liveVerification) {
            lines.push(`- ${mod.id}: ${mod.liveVerification}`)
        }
    }
    lines.push('')
    lines.push('## 要求检查')
    lines.push('')
    if (checks.length) {
        for (const check of checks) {
            lines.push(`- \`${check}\``)
        }
    } else {
        lines.push('- （选择范围内无登记检查）')
    }
    lines.push('- 未运行这些检查；不要把本包当作测试已通过。')
    lines.push('')
    lines.push('## 编译产物')
    lines.push('')
    lines.push('- 未复制完整编译 userscript。')
    if (release.artifact) {
        lines.push(`- 发布清单版本 ${release.artifact.version} SHA256 ${release.artifact.sha256} bytes ${release.artifact.bytes}`)
        lines.push(`- updateURL: ${release.artifact.updateURL}`)
        lines.push(`- downloadURL: ${release.artifact.downloadURL}`)
    } else if (release.development) {
        lines.push(`- 开发通道版本 ${release.development.version} ${release.development.url}`)
    }
    if (release.legacy) {
        lines.push(`- 正式通道版本 ${release.legacy.version} ${release.legacy.url}`)
    }
    lines.push('')
    if (evidenceMeta) {
        lines.push('## 结构诊断')
        lines.push('')
        lines.push(`- 脚本版本 ${evidenceMeta.scriptVersion}；当前产品版本 ${evidenceMeta.currentVersion ?? '未知'}`)
        if (evidenceMeta.stale) {
            lines.push('- 版本不一致：证据视为过期，不能当作当前已核实状态。')
        } else {
            lines.push('- 版本与当前开发通道一致；仍只是结构快照，不是现场验证通过。')
        }
        lines.push('')
    }
    if (upstreamLinks.length) {
        lines.push('## 上游对比链接')
        lines.push('')
        lines.push('- 下列 commit 由用户提供，本工具未下载、未核验。')
        for (const link of upstreamLinks) {
            lines.push(`- ${link.sourceId}: ${link.url}`)
        }
        lines.push('')
    }
    lines.push('## 未解析导入')
    lines.push('')
    if (unresolved.length) {
        for (const u of unresolved) {
            lines.push(`- \`${u.from}\` ← ${u.specifier ?? '(non-literal dynamic)'} (${u.reason})`)
        }
    } else {
        lines.push('- （所选源码树中没有未解析导入）')
    }
    lines.push('')
    lines.push('## 覆盖遗漏')
    lines.push('')
    if (omissions.length) {
        for (const o of omissions) {
            lines.push(`- ${JSON.stringify(o)}`)
        }
    } else {
        lines.push('- （无）')
    }
    lines.push('')
    lines.push('## 外部包（摘要，未复制）')
    lines.push('')
    for (const ext of indexSubset.external ?? []) {
        lines.push(`- ${ext.name} ${ext.version ?? '(version unknown)'}`)
    }
    if (!(indexSubset.external ?? []).length) {
        lines.push('- （无）')
    }
    lines.push('')
    lines.push('## 源文件')
    lines.push('')
    for (const rel of sourceFiles) {
        const rec = (indexSubset.files ?? []).find((f) => f.path === rel)
        lines.push(`### ${rel}`)
        lines.push('')
        lines.push(`- SHA256 ${hashes.get(rel)}`)
        if (rec) {
            lines.push(`- status ${rec.status}; modules ${(rec.modules ?? []).join(', ') || '(none)'}; provenance ${rec.provenance}`)
            if (rec.upstream?.url) {
                lines.push(`- upstream ${rec.upstream.url}`)
                lines.push(`- ${rec.upstream.caution}`)
            }
        }
        lines.push('')
        lines.push(languageFence(rel, texts.get(rel) ?? ''))
        lines.push('')
    }
    return `${lines.join('\n').trim()}\n`
}

export async function buildPacket({
    root = PRODUCT_ROOT,
    modules = [],
    settings = [],
    files = [],
    out = null,
    evidence = null,
    maxBytes = DEFAULT_MAX_BYTES,
    upstream = [],
    collectOccurrences,
    index: providedIndex,
} = {}) {
    if (!modules.length && !settings.length && !files.length) {
        throw new Error('one of --module, --setting, --file is required')
    }
    const index = providedIndex ?? (await buildIndex({ root, collectOccurrences }))
    const selectors = { modules: [...modules], settings: [...settings], files: [...files] }
    const { files: seeds, omissions, selectedModules, selectedSettings } = collectSeeds(root, index, selectors)
    const selected = expandTransitive(index, seeds)
    const sourceFiles = [...selected].sort()
    const checkModules = [...selectedModules]
    const seenModuleIds = new Set(selectedModules.map((m) => m.id))
    for (const rel of seeds) {
        const rec = fileByPath(index).get(rel)
        for (const id of rec?.modules ?? []) {
            if (seenModuleIds.has(id)) {
                continue
            }
            seenModuleIds.add(id)
            const mod = index.modules.find((m) => m.id === id)
            if (mod) {
                checkModules.push(mod)
            }
        }
    }
    const texts = new Map()
    const hashes = new Map()
    let totalBytes = 0
    for (const rel of sourceFiles) {
        const abs = publicCopySource(root,rel)
        if (!fs.existsSync(abs)) {
            omissions.push({ kind: 'missing-source', path: rel })
            continue
        }
        const buf = fs.readFileSync(abs)
        const text = buf.toString('utf8')
        texts.set(rel, text)
        hashes.set(rel, sha256Normalized(text))
        totalBytes += Buffer.byteLength(text, 'utf8')
    }
    const tests = testsForModules(root, checkModules)
    const testTexts = new Map()
    for (const rel of tests.files) {
        const text = fs.readFileSync(publicCopySource(root,rel), 'utf8')
        testTexts.set(rel, text)
        hashes.set(rel, sha256Normalized(text))
        totalBytes += Buffer.byteLength(text, 'utf8')
    }
    for (const rel of tests.missing) {
        omissions.push({ kind: 'missing-test', path: rel })
    }
    if (totalBytes > maxBytes) {
        throw new Error(
            `selected source is ${totalBytes} bytes (limit ${maxBytes}). Narrow --module/--setting/--file or raise --max-bytes (max ${4 * 1024 * 1024}).`,
        )
    }

    const slug = packetSlug(selectors)
    const dest = out ? path.resolve(out) : defaultPacketDir(root, slug)
    const repoRoot = findGitRoot(root)
    const outDir = assertAllowedOutputDir(root, dest, repoRoot)

    let evidenceRecord = null
    let evidenceMeta = null
    if (evidence) {
        const raw = readEvidenceFile(root, evidence)
        const validateEvidence = await loadValidateEvidence(root)
        const valid = validateEvidence(raw)
        evidenceRecord = rebuildEvidence(valid)
        const currentVersion = currentScriptVersion(root)
        evidenceMeta = {
            scriptVersion: evidenceRecord.scriptVersion,
            currentVersion,
            stale: Boolean(currentVersion) && evidenceRecord.scriptVersion !== currentVersion,
            capturedAt: evidenceRecord.capturedAt,
            pageType: evidenceRecord.pageType,
            site: evidenceRecord.site,
        }
    }

    const indexSubset = subsetIndex(index, sourceFiles)
    const unresolved = indexSubset.unresolved ?? []
    const supporting = supportingPresent(root)
    for (const rel of supporting) publicCopySource(root,rel)
    const gitPaths = [...sourceFiles, ...tests.files, ...supporting]
    const git = gitSnapshot(root, gitPaths)
    const release = loadReleaseRecord(root)
    const sourceById = new Map((index.sources ?? []).map((s) => [s.id, s]))
    const upstreamLinks = []
    for (const item of upstream) {
        const src = sourceById.get(item.sourceId)
        if (!src) {
            throw new Error(`unknown upstream source: ${item.sourceId}`)
        }
        upstreamLinks.push({
            sourceId: item.sourceId,
            sha: item.sha,
            unverified: true,
            url: compareUrl(src, item.sha),
            note: 'user-provided commit; not downloaded or verified',
        })
    }

    const fencedSource = [...sourceFiles]
    const context = renderContext({
        selectors,
        selectedModules,
        selectedSettings,
        sourceFiles: [...sourceFiles, ...tests.files],
        texts: new Map([...texts, ...testTexts]),
        hashes,
        indexSubset,
        unresolved,
        omissions,
        checks: tests.checks,
        git,
        release,
        evidenceMeta,
        upstreamLinks,
    })

    const manifest = {
        schemaVersion: SCHEMA_VERSION,
        sourceCommit: git.available ? git.head : null,
        dirty: git.dirty,
        liveVerification: 'NOT RUN',
        selectors,
        slug,
        bytes: totalBytes,
        maxBytes,
        files: sourceFiles,
        tests: tests.files,
        supporting,
        unresolved,
        omissions,
        recommendedChecks: tests.checks,
        release,
        evidence: evidenceMeta,
        upstreamCompare: upstreamLinks,
        output: {
            directory: 'CONTEXT.md and manifest.json plus source/',
        },
    }

    fs.mkdirSync(outDir, { recursive: true })
    const written = []
    const write = (rel, content) => {
        const abs = path.join(outDir, rel)
        fs.mkdirSync(path.dirname(abs), { recursive: true })
        fs.writeFileSync(abs, content)
        written.push(abs)
        return abs
    }
    const contextPath = write('CONTEXT.md', context)
    const manifestPath = write('manifest.json', stableStringify(manifest))
    let evidencePath = null
    if (evidenceRecord) {
        evidencePath = write('evidence.json', stableStringify(evidenceRecord))
    }
    for (const rel of sourceFiles) {
        copyTreeFile(root, rel, outDir)
    }
    for (const rel of tests.files) {
        copyTreeFile(root, rel, outDir)
    }
    for (const rel of supporting) {
        copyTreeFile(root, rel, outDir)
    }
    write('source/maintenance/index.generated.json', stableStringify(indexSubset))

    const paths = {
        directory: outDir,
        context: contextPath,
        manifest: manifestPath,
        evidence: evidencePath,
        source: path.join(outDir, 'source'),
    }
    return { paths, manifest, slug, bytes: totalBytes, files: fencedSource }
}

export const listModules = async ({ root = PRODUCT_ROOT, index: providedIndex } = {}) => {
    const index = providedIndex ?? (await buildIndex({ root }))
    return index.modules.map((m) => m.id)
}

if (isMainModule(import.meta.url, process.argv[1])) {
    const run = async () => {
        const args = parsePacketArgs(process.argv.slice(2))
        if (args.help) {
            console.log(
                'usage: node scripts/maintenance-packet.mjs --module ID | --setting S179|key | --file src/... [--out DIR] [--evidence FILE] [--max-bytes N] [--upstream sourceId=40hex] [--list]',
            )
            return
        }
        if (args.list) {
            const ids = await listModules()
            for (const id of ids) {
                console.log(id)
            }
            return
        }
        const result = await buildPacket({
            modules: args.modules,
            settings: args.settings,
            files: args.files,
            out: args.out,
            evidence: args.evidence,
            maxBytes: args.maxBytes,
            upstream: args.upstream,
        })
        console.log(result.paths.directory)
        console.log(result.paths.context)
        console.log(result.paths.manifest)
        if (result.paths.evidence) {
            console.log(result.paths.evidence)
        }
    }
    run().catch((err) => {
        console.error(err.message ?? err)
        process.exit(1)
    })
}
