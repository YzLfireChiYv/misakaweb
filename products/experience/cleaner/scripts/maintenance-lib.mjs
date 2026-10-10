/**
 * Shared helpers for the maintenance index and webpage-AI packet tools.
 * Node APIs only. Relative posix paths in records. No network.
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

export const SCHEMA_VERSION = 1
export const DEFAULT_MAX_BYTES = 600000
export const MAX_MAX_BYTES = 4 * 1024 * 1024
export const SOURCE_EXTS = ['.ts', '.vue', '.scss', '.css', '.js', '.json']
export const MATCHING_PATH_NOTE =
    'Path match is a correspondence clue, not proof of authorship or semantic equivalence. Normalized hashes detect textual divergence; changed does not automatically mean a deliberate local patch.'

const VIRTUAL_MODULES = new Set(['$', 'vite-plugin-monkey/dist/client'])
const SKIP_DIR_NAMES = new Set(['node_modules', 'dist', '.git', '.tmp'])
const BLOCKED_SOURCE_SEGMENTS = ['/onedrive/', '/.git/', '/node_modules/', '/refs/', '/private/']

export const productRootFromScript = (scriptUrl) => path.resolve(path.dirname(fileURLToPath(scriptUrl)), '..')

export const toPosix = (value) => String(value ?? '').replaceAll('\\', '/')

export const posixRel = (root, abs) => toPosix(path.relative(root, abs))

export const normalizeLf = (text) => String(text ?? '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')

export const sha256Normalized = (text) => createHash('sha256').update(normalizeLf(text), 'utf8').digest('hex')

export const sha256Bytes = (buf) => createHash('sha256').update(buf).digest('hex')

export const stableStringify = (value) => {
    const walk = (v) => {
        if (Array.isArray(v)) {
            return v.map(walk)
        }
        if (v && typeof v === 'object') {
            const out = {}
            for (const key of Object.keys(v).sort()) {
                out[key] = walk(v[key])
            }
            return out
        }
        return v
    }
    return `${JSON.stringify(walk(value), null, 2)}\n`
}

export const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))

export const fileExists = (file) => {
    try {
        return fs.statSync(file).isFile()
    } catch {
        return false
    }
}

export const dirExists = (dir) => {
    try {
        return fs.statSync(dir).isDirectory()
    } catch {
        return false
    }
}

export const tryRealpath = (target) => {
    try {
        return fs.realpathSync(target)
    } catch {
        return path.resolve(target)
    }
}

export const isInsideDir = (child, parent) => {
    const c = path.resolve(child)
    const p = path.resolve(parent)
    const rel = path.relative(p, c)
    return rel === '' || (rel.length > 0 && !rel.startsWith('..') && !path.isAbsolute(rel))
}

export const isBlockedSourceAbs = (abs) => {
    const n = `/${toPosix(abs).toLowerCase()}/`
    if (BLOCKED_SOURCE_SEGMENTS.some((seg) => n.includes(seg))) {
        return true
    }
    return false
}

export const findGitRoot = (start) => {
    let cur = path.resolve(start)
    while (true) {
        if (fs.existsSync(path.join(cur, '.git'))) {
            return cur
        }
        const parent = path.dirname(cur)
        if (parent === cur) {
            return null
        }
        cur = parent
    }
}

export const publicFilePath = (root, file) => {
    const real = tryRealpath(file)
    if (!isInsideDir(real, path.resolve(root)) || isBlockedSourceAbs(real)) throw new Error('metadata/source file escapes public product tree')
    return real
}

export const loadRegistry = (root) => {
    const file = path.join(root, 'maintenance', 'registry.json')
    if (!fileExists(file)) {
        throw new Error('maintenance/registry.json is required')
    }
    const registry = readJson(publicFilePath(root,file))
    if (!registry || registry.schemaVersion !== 1 || !Array.isArray(registry.modules) || !Array.isArray(registry.files)) {
        throw new Error('unsupported maintenance/registry.json')
    }
    return registry
}

export const loadPackageJson = (root) => {
    const file = path.join(root, 'package.json')
    if (!fileExists(file)) {
        throw new Error('package.json is required')
    }
    return readJson(publicFilePath(root,file))
}

export const packageVersions = (pkg) => {
    const versions = {}
    for (const [name, version] of Object.entries(pkg.devDependencies ?? {})) {
        versions[name] = version
    }
    for (const [name, version] of Object.entries(pkg.optionalDependencies ?? {})) {
        versions[name] = version
    }
    for (const [name, version] of Object.entries(pkg.dependencies ?? {})) {
        versions[name] = version
    }
    return versions
}

export const moduleIdsForPath = (rel, modules) => {
    const posix = toPosix(rel)
    const ids = []
    for (const mod of modules ?? []) {
        const match = (mod.paths ?? []).some((p) => posix === p || (p.endsWith('/') && posix.startsWith(p)))
        if (match) {
            ids.push(mod.id)
        }
    }
    return ids
}

export const walkSourceFiles = (root) => {
    const src = path.join(root, 'src')
    const out = []
    if (!dirExists(src)) {
        return out
    }
    const visited = new Set()
    const visit = (dir) => {
        const realDir = tryRealpath(dir)
        if(visited.has(realDir)) return
        visited.add(realDir)
        let entries
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true })
        } catch {
            return
        }
        for (const entry of entries) {
            const full = path.join(dir, entry.name)
            if (entry.isSymbolicLink?.()) {
                let st
                try {
                    st = fs.statSync(full)
                } catch {
                    continue
                }
                if (st.isDirectory()) {
                    if (SKIP_DIR_NAMES.has(entry.name)) {
                        continue
                    }
                    const real = tryRealpath(full)
                    if (!isInsideDir(real, src) || isBlockedSourceAbs(real)) {
                        continue
                    }
                    visit(full)
                } else if (st.isFile()) {
                    considerFile(full)
                }
                continue
            }
            if (entry.isDirectory()) {
                if (SKIP_DIR_NAMES.has(entry.name)) {
                    continue
                }
                visit(full)
                continue
            }
            if (entry.isFile()) {
                considerFile(full)
            }
        }
    }
    const considerFile = (full) => {
        const ext = path.extname(full).toLowerCase()
        if (!SOURCE_EXTS.includes(ext)) {
            return
        }
        const real = tryRealpath(full)
        if (!isInsideDir(real, src) || isBlockedSourceAbs(real)) {
            return
        }
        out.push({ abs: real, rel: posixRel(root, full) })
    }
    visit(src)
    out.sort((a, b) => a.rel.localeCompare(b.rel))
    return out
}

export const readSourceText = (root, rel) => {
    const abs = path.resolve(root, rel)
    const srcRoot = path.join(root, 'src')
    const real = tryRealpath(abs)
    if (!isInsideDir(real, srcRoot) || isBlockedSourceAbs(real)) {
        throw new Error(`refusing to read source outside src/: ${rel}`)
    }
    return fs.readFileSync(real, 'utf8')
}

const stripQuery = (spec) => {
    const text = String(spec)
    const q = text.indexOf('?')
    return q === -1 ? text : text.slice(0, q)
}

const scopedPackageName = (spec) => {
    if (spec.startsWith('@')) {
        const parts = spec.split('/')
        return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : spec
    }
    return spec.split('/')[0]
}

const candidateFiles = (base, forScss) => {
    const names = []
    const push = (v) => {
        if (v && !names.includes(v)) {
            names.push(v)
        }
    }
    push(base)
    if (forScss) {
        const dir = path.posix.dirname(base)
        const name = path.posix.basename(base)
        push(`${base}.scss`)
        push(`${base}.css`)
        if (!name.startsWith('_')) {
            push(path.posix.join(dir, `_${name}.scss`))
        }
        push(path.posix.join(base, 'index.scss'))
        push(path.posix.join(base, '_index.scss'))
        push(path.posix.join(base, 'index.css'))
        return names
    }
    for (const ext of SOURCE_EXTS) {
        if (!base.endsWith(ext)) {
            push(`${base}${ext}`)
        }
    }
    for (const ext of SOURCE_EXTS) {
        push(path.posix.join(base, `index${ext}`))
    }
    return names
}

const aliasTarget = (root, name) => {
    const generated = name === '@feedback-index' ? 'src/feedback/id-index.generated.ts' : 'src/feedback/review-catalog.generated.ts'
    const empty = name === '@feedback-index' ? 'src/feedback/id-index.empty.ts' : 'src/feedback/review-catalog.empty.ts'
    if (fileExists(path.join(root, generated))) {
        return generated
    }
    if (fileExists(path.join(root, empty))) {
        return empty
    }
    return generated
}

export const resolveSpecifier = (root, fromRel, specifier, { scss = false } = {}) => {
    const raw = stripQuery(specifier)
    if (!raw) {
        return { kind: 'unresolved', reason: 'empty', specifier }
    }
    if (raw.startsWith('sass:')) {
        return { kind: 'builtin', specifier: raw }
    }
    if (raw === '@feedback-index' || raw === '@review-catalog') {
        return { kind: 'internal', path: aliasTarget(root, raw), specifier: raw }
    }
    if (VIRTUAL_MODULES.has(raw) || VIRTUAL_MODULES.has(scopedPackageName(raw))) {
        return { kind: 'unresolved', reason: 'virtual-module', specifier: raw }
    }
    let base
    if (raw.startsWith('@/')) {
        base = path.posix.join('src', raw.slice(2))
    } else if (raw.startsWith('./') || raw.startsWith('../')) {
        base = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), raw))
    } else if (raw.startsWith('/')) {
        return { kind: 'unresolved', reason: 'absolute', specifier: raw }
    } else {
        const name = scopedPackageName(raw)
        return { kind: 'external', name, specifier: raw }
    }
    if (base === '.' || base === '..' || base.startsWith('../') || path.posix.isAbsolute(base)) {
        return { kind: 'unresolved', reason: 'escaped', specifier: raw }
    }
    if (base !== 'src' && !base.startsWith('src/')) {
        return { kind: 'unresolved', reason: 'escaped', specifier: raw }
    }
    for (const candidate of candidateFiles(base, scss)) {
        const abs = path.join(root, candidate)
        if (!fileExists(abs)) {
            continue
        }
        const real = tryRealpath(abs)
        if (!isInsideDir(real, path.join(root, 'src')) || isBlockedSourceAbs(real)) {
            return { kind: 'unresolved', reason: 'blocked', specifier: raw }
        }
        return { kind: 'internal', path: toPosix(candidate), specifier: raw }
    }
    return { kind: 'unresolved', reason: 'missing', specifier: raw }
}

const vueBlocks = (text, tag) => {
    const blocks = []
    const re = new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)</${tag}>`, 'gi')
    let m
    while ((m = re.exec(text))) {
        blocks.push({ attrs: m[1] ?? '', content: m[2] ?? '' })
    }
    return blocks
}

const collectTsSpecifiers = (text, fileName) => {
    const kind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : fileName.endsWith('.js') ? ts.ScriptKind.JS : ts.ScriptKind.TS
    const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind)
    const specs = []
    const visit = (node) => {
        if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
            specs.push({ specifier: node.moduleSpecifier.text, dynamic: false })
        } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
            const arg = node.arguments[0]
            if (arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg))) {
                specs.push({ specifier: arg.text, dynamic: true })
            } else {
                specs.push({ specifier: null, dynamic: true, nonliteral: true })
            }
        }
        ts.forEachChild(node, visit)
    }
    visit(sf)
    return specs
}

const collectScssSpecifiers = (text) => {
    const specs = []
    const re = /@(?:use|forward)\s+(?:url\()?['"]([^'"]+)['"]/g
    let m
    while ((m = re.exec(text))) {
        specs.push({ specifier: m[1], dynamic: false, scss: true })
    }
    return specs
}

export const parseFileDependencies = (root, rel, text) => {
    const ext = path.posix.extname(rel).toLowerCase()
    const specs = []
    if (ext === '.vue') {
        for (const block of vueBlocks(text, 'script')) {
            specs.push(...collectTsSpecifiers(block.content, rel.replace(/\.vue$/i, '.ts')))
        }
        for (const block of vueBlocks(text, 'style')) {
            specs.push(...collectScssSpecifiers(block.content))
        }
    } else if (ext === '.scss' || ext === '.css') {
        specs.push(...collectScssSpecifiers(text))
    } else if (ext === '.ts' || ext === '.js') {
        specs.push(...collectTsSpecifiers(text, rel))
    }
    const imports = []
    const external = []
    const unresolved = []
    const seenImport = new Set()
    const seenExternal = new Set()
    for (const spec of specs) {
        if (spec.nonliteral) {
            unresolved.push({ from: rel, specifier: null, reason: 'nonliteral-dynamic' })
            continue
        }
        const resolved = resolveSpecifier(root, rel, spec.specifier, { scss: Boolean(spec.scss) })
        if (resolved.kind === 'internal') {
            if (!seenImport.has(resolved.path)) {
                seenImport.add(resolved.path)
                imports.push(resolved.path)
            }
        } else if (resolved.kind === 'external') {
            if (!seenExternal.has(resolved.name)) {
                seenExternal.add(resolved.name)
                external.push(resolved.name)
            }
        } else if (resolved.kind === 'builtin') {
            continue
        } else {
            unresolved.push({ from: rel, specifier: resolved.specifier, reason: resolved.reason ?? 'missing' })
        }
    }
    imports.sort()
    external.sort()
    unresolved.sort((a, b) => `${a.from}:${a.specifier}:${a.reason}`.localeCompare(`${b.from}:${b.specifier}:${b.reason}`))
    return { imports, external, unresolved }
}

export const upstreamFileUrl = (source, filePath) => {
    if (!source?.repository || !source.commit || !filePath) {
        return null
    }
    const repo = String(source.repository).replace(/\/$/, '')
    return `${repo}/blob/${source.commit}/${toPosix(filePath)}`
}

export const compareUrl = (source, otherSha) => {
    if (!source?.repository || !source.commit || !otherSha) {
        return null
    }
    const repo = String(source.repository).replace(/\/$/, '')
    return `${repo}/compare/${source.commit}...${otherSha}`
}

export const fileBaselineStatus = (sha, registryFile) => {
    const expected = registryFile?.upstream?.normalized_sha256
    if (!expected) {
        return 'no-baseline'
    }
    return sha === expected ? 'unchanged' : 'diverged'
}

export const loadControlMap = (root) => {
    const file = path.join(root, 'src/feedback/control-map.json')
    if (!fileExists(file)) {
        return { settings: [], menus: [], actions: [] }
    }
    const map = readJson(file)
    return {
        settings: Array.isArray(map.settings) ? map.settings : [],
        menus: Array.isArray(map.menus) ? map.menus : [],
        actions: Array.isArray(map.actions) ? map.actions : [],
    }
}

export const occurrenceToPath = (root, file) => {
    const rel = toPosix(file)
    if (rel.startsWith('src/')) {
        return rel
    }
    const candidates = [`src/modules/${rel}`, `src/${rel}`, rel]
    for (const candidate of candidates) {
        if (fileExists(path.join(root, candidate))) {
            return candidate
        }
    }
    return candidates[0]
}

const ITEM_CALLS = new Set(['switchItem', 'numberItem', 'rateItem'])

const definitionLineCache = new Map()
export const findKeyLines = (text, key) => {
    let definitions = definitionLineCache.get(text)
    if (!definitions) {
        const sf = ts.createSourceFile('occ.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
        definitions = new Map()
        const add = (node) => {
            const list = definitions.get(node.text) ?? []
            list.push(sf.getLineAndCharacterOfPosition(node.getStart()).line + 1)
            definitions.set(node.text,list)
        }
        const visit = (node) => {
            if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && node.name.text === 'id' &&
                (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer))) add(node.initializer)
            if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && ITEM_CALLS.has(node.expression.text)) {
                const arg = node.arguments[0]
                if (arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg))) add(arg)
            }
            ts.forEachChild(node,visit)
        }
        visit(sf)
        if (definitionLineCache.size >= 128) definitionLineCache.delete(definitionLineCache.keys().next().value)
        definitionLineCache.set(text,definitions)
    }
    const lines = definitions.get(key) ?? []
    if (lines.length) {
        return [...new Set(lines)]
    }
    const quoted = new RegExp(`(?:^|[^\\w-])${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^\\w-])`)
    const fallback = []
    const raw = normalizeLf(text).split('\n')
    raw.forEach((line, i) => {
        if (quoted.test(line)) {
            fallback.push(i + 1)
        }
    })
    return fallback
}

export async function loadOccurrences(root, override) {
    if (typeof override === 'function') {
        return override()
    }
    const mapFile = path.join(root, 'scripts/update-control-map.mjs')
    if (!fileExists(mapFile)) {
        return []
    }
    const mod = await import(pathToFileURL(mapFile).href)
    if (typeof mod.collectOccurrences !== 'function') {
        return []
    }
    const rows = mod.collectOccurrences()
    return Array.isArray(rows) ? rows : []
}

export const parseUpstreamFlag = (value) => {
    const text = String(value ?? '')
    const eq = text.indexOf('=')
    if (eq <= 0) {
        throw new Error('--upstream requires sourceId=40-hex-sha')
    }
    const sourceId = text.slice(0, eq)
    const sha = text.slice(eq + 1).toLowerCase()
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(sourceId)) {
        throw new Error(`invalid upstream source id: ${sourceId}`)
    }
    if (!/^[0-9a-f]{40}$/.test(sha)) {
        throw new Error('upstream commit must be a 40-character hex SHA')
    }
    return { sourceId, sha }
}

export const gitSnapshot = (cwd, relPaths = []) => {
    const run = (args) =>
        spawnSync('git', args, {
            cwd,
            encoding: 'utf8',
            windowsHide: true,
        })
    const head = run(['rev-parse', 'HEAD'])
    if (head.error || head.status !== 0) {
        return { available: false, head: null, dirty: [] }
    }
    const sha = String(head.stdout ?? '').trim()
    const prefix = toPosix(String(run(['rev-parse', '--show-prefix']).stdout ?? '').trim())
    const args = ['status', '--porcelain', '--untracked-files=all']
    const safePaths = relPaths.map((p) => toPosix(p)).filter((p) => p && !p.startsWith('-'))
    if (safePaths.length) {
        args.push('--', ...safePaths)
    }
    const st = run(args)
    if (st.error || st.status !== 0) {
        return { available: true, head: sha, dirty: [] }
    }
    const dirty = String(st.stdout ?? '')
        .split(/\r?\n/)
        .map((line) => line.trimEnd())
        .filter(Boolean)
        .map((line) => {
            const pathPart = line.length > 3 ? line.slice(3) : line
            let rel = toPosix(pathPart.split(' -> ').pop())
            if (prefix && rel.startsWith(prefix)) {
                rel = rel.slice(prefix.length)
            }
            return rel
        })
        .filter(Boolean)
        .sort()
    return { available: true, head: sha, dirty }
}

export async function loadValidateEvidence(root) {
    const file = publicFilePath(root,path.join(root, 'src/modules/maintenance/evidence.ts'))
    if (!fileExists(file)) {
        throw new Error('missing src/modules/maintenance/evidence.ts')
    }
    try {
        const href = pathToFileURL(file).href
        const mod = await import(href)
        if (typeof mod.validateEvidence === 'function') {
            return mod.validateEvidence
        }
    } catch {
        // Node CLI cannot import TypeScript; transpile the explicit product file.
    }
    const src = fs.readFileSync(publicFilePath(root,file), 'utf8')
    const { outputText } = ts.transpileModule(src, {
        compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
        },
        fileName: 'evidence.ts',
    })
    const href = `data:text/javascript;charset=utf-8,${encodeURIComponent(outputText)}`
    const mod = await import(href)
    if (typeof mod.validateEvidence !== 'function') {
        throw new Error('evidence validator missing export')
    }
    return mod.validateEvidence
}

const cloneSample = (sample) => ({
    tag: sample.tag,
    classes: [...sample.classes],
    visible: sample.visible,
    rect: {
        x: sample.rect.x,
        y: sample.rect.y,
        width: sample.rect.width,
        height: sample.rect.height,
    },
    childTags: [...sample.childTags],
    childClasses: sample.childClasses.map((row) => [...row]),
    shadowRoot: sample.shadowRoot,
    ...(sample.parentTag !== undefined ? { parentTag: sample.parentTag } : {}),
    ...(sample.parentClasses !== undefined ? { parentClasses: [...sample.parentClasses] } : {}),
    ...(sample.parentIsBody !== undefined ? { parentIsBody: sample.parentIsBody } : {}),
    ...(sample.attributeNames !== undefined ? { attributeNames: [...sample.attributeNames] } : {}),
})

export const rebuildEvidence = (valid) => ({
    format: valid.format,
    schemaVersion: valid.schemaVersion,
    scriptVersion: valid.scriptVersion,
    capturedAt: valid.capturedAt,
    pageType: valid.pageType,
    site: valid.site,
    scope: valid.scope,
    probes: valid.probes.map((probe) => ({
        id: probe.id,
        selector: probe.selector,
        count: probe.count,
        samples: probe.samples.map(cloneSample),
    })),
})

export const currentScriptVersion = (root) => {
    const releaseFile = path.join(root, 'config/release.json')
    if (fileExists(releaseFile)) {
        const release = readJson(publicFilePath(root,releaseFile))
        return release?.development?.version ?? release?.legacy?.version ?? null
    }
    return null
}

export const loadReleaseRecord = (root) => {
    const configFile = path.join(root, 'config/release.json')
    const manifestFile = path.resolve(root, '..', 'release-manifest.json')
    const record = {
        copiedUserscript: false,
        development: null,
        legacy: null,
        artifact: null,
    }
    if (fileExists(configFile)) {
        const release = readJson(publicFilePath(root,configFile))
        record.development = release.development
            ? { version: release.development.version, url: release.development.url }
            : null
        record.legacy = release.legacy ? { version: release.legacy.version, url: release.legacy.url } : null
    }
    if (fileExists(manifestFile) && isInsideDir(tryRealpath(manifestFile), path.resolve(root, '..'))) {
        const manifest = readJson(manifestFile)
        record.artifact = {
            version: manifest.version ?? null,
            sha256: manifest.sha256 ?? null,
            bytes: manifest.bytes ?? null,
            updateURL: manifest.updateURL ?? null,
            downloadURL: manifest.downloadURL ?? null,
            channel: manifest.channel ?? null,
            path: manifest.artifact ?? null,
        }
    }
    record.artifactMatchesConfiguredVersion = Boolean(record.artifact && record.development && record.artifact.version === record.development.version)
    return record
}

export const safeToken = (value) =>
    String(value ?? '')
        .replaceAll('\\', '/')
        .replace(/[^A-Za-z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'x'

export const packetSlug = (selectors) => {
    const parts = []
    for (const id of [...(selectors.modules ?? [])].sort()) {
        parts.push(`module-${safeToken(id)}`)
    }
    for (const id of [...(selectors.settings ?? [])].sort()) {
        parts.push(`setting-${safeToken(id)}`)
    }
    for (const file of [...(selectors.files ?? [])].sort()) {
        parts.push(`file-${safeToken(file.replaceAll('/', '-'))}`)
    }
    let slug = parts.join('_') || 'packet'
    if (slug.length > 120) {
        const hash = sha256Normalized(slug).slice(0, 16)
        slug = `${slug.slice(0, 80).replace(/-+$/, '')}-${hash}`
    }
    return slug
}

const PROTECTED_DIR_NAMES = ['src', 'tests', 'scripts', 'maintenance', 'config', 'dist']

export const assertAllowedOutputDir = (root, outDir, repoRoot = findGitRoot(root)) => {
    const resolved = path.resolve(outDir)
    if (fs.existsSync(resolved)) {
        throw new Error(`output exists, refuse overwrite: ${toPosix(posixRel(root, resolved) || resolved)}`)
    }
    let ancestor = path.dirname(resolved)
    while (!fs.existsSync(ancestor)) {
        const parent = path.dirname(ancestor)
        if (parent === ancestor) {
            break
        }
        ancestor = parent
    }
    const realAncestor = tryRealpath(ancestor)
    const remainder = path.relative(ancestor, resolved)
    if (!remainder || remainder.startsWith('..') || path.isAbsolute(remainder)) {
        throw new Error('output path traversal rejected')
    }
    const realOut = path.resolve(realAncestor, remainder)
    const tmpRoot = path.join(path.resolve(root), 'node_modules', '.tmp')
    const allowed = [tmpRoot]
    if (repoRoot) {
        const priv = path.join(repoRoot, 'private')
        if (dirExists(priv)) {
            allowed.push(priv)
        }
    }
    const ok = allowed.some((base) => {
        const realBase = fs.existsSync(base) ? tryRealpath(base) : path.resolve(base)
        return isInsideDir(realOut, realBase) || isInsideDir(realOut, path.resolve(base))
    })
    if (!ok) {
        throw new Error('output must remain under product node_modules/.tmp or repo private')
    }
    for (const name of PROTECTED_DIR_NAMES) {
        const protectedDir = path.join(root, name)
        if (isInsideDir(realOut, protectedDir)) {
            throw new Error(`output must not target protected directory ${name}/`)
        }
    }
    const normalizedOut = `/${toPosix(realOut).toLowerCase()}/`
    if (normalizedOut.includes('/onedrive/') || normalizedOut.includes('/.git/') || normalizedOut.includes('/refs/')) {
        throw new Error('output path is blocked')
    }
    return realOut
}

export const assertSrcSelector = (root, rel) => {
    const posix = toPosix(rel)
    if (!posix.startsWith('src/') || posix.includes('..') || posix.startsWith('/') || posix.includes('\\')) {
        throw new Error(`--file must be a product-relative src/... path: ${rel}`)
    }
    const abs = path.resolve(root, posix)
    if (!isInsideDir(abs, path.join(root, 'src'))) {
        throw new Error(`--file escapes src/: ${rel}`)
    }
    if (isBlockedSourceAbs(abs)) {
        throw new Error(`--file is blocked: ${rel}`)
    }
    if (!fileExists(abs)) {
        const real = tryRealpath(abs)
        if (!fileExists(real)) {
            throw new Error(`--file not found: ${posix}`)
        }
        if (!isInsideDir(real, path.join(root, 'src'))) {
            throw new Error(`--file symlink escapes src/: ${posix}`)
        }
    } else {
        const real = tryRealpath(abs)
        if (!isInsideDir(real, path.join(root, 'src')) || isBlockedSourceAbs(real)) {
            throw new Error(`--file symlink escapes src/: ${posix}`)
        }
    }
    return posix
}

export const readEvidenceFile = (root, evidencePath) => {
    if (!evidencePath) {
        return null
    }
    const abs = path.resolve(evidencePath)
    if (!fileExists(abs)) {
        throw new Error(`--evidence is not a file: ${evidencePath}`)
    }
    const real = tryRealpath(abs)
    if (!fs.statSync(real).isFile()) {
        throw new Error('--evidence must be a regular file')
    }
    const ext = path.extname(real).toLowerCase()
    if (ext && ext !== '.json') {
        throw new Error('--evidence accepts only structural diagnostic JSON')
    }
    const text = fs.readFileSync(real, 'utf8')
    let parsed
    try {
        parsed = JSON.parse(text)
    } catch {
        throw new Error('--evidence is not valid JSON')
    }
    return parsed
}

export const fence = (lang, content) => {
    let ticks = '```'
    const body = normalizeLf(content)
    while (body.includes(ticks)) {
        ticks += '`'
    }
    const suffix = body.endsWith('\n') ? body : `${body}\n`
    return `${ticks}${lang}\n${suffix}${ticks}`
}

export const langFor = (rel) => {
    const ext = path.posix.extname(rel).toLowerCase()
    return { '.ts': 'ts', '.js': 'js', '.vue': 'vue', '.scss': 'scss', '.css': 'css', '.json': 'json' }[ext] ?? ''
}

export const isMainModule = (scriptUrl, argv1) => {
    if (!argv1) {
        return false
    }
    try {
        return pathToFileURL(path.resolve(argv1)).href === scriptUrl
    } catch {
        return false
    }
}

export const parseMaxBytes = (value) => {
    const n = Number(value)
    if (!Number.isInteger(n) || n <= 0 || n > MAX_MAX_BYTES) {
        throw new Error(`--max-bytes must be a positive integer up to ${MAX_MAX_BYTES}`)
    }
    return n
}

export const defaultPacketDir = (root, slug) => path.join(root, 'node_modules', '.tmp', 'maintenance-packets', slug)
