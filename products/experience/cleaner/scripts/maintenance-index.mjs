/**
 * Deterministic product source index for maintenance packets.
 * Hashes use normalized LF. No absolute paths or timestamps.
 */
import fs from 'node:fs'
import path from 'node:path'
import {
    SCHEMA_VERSION,
    MATCHING_PATH_NOTE,
    fileBaselineStatus,
    findKeyLines,
    isMainModule,
    loadControlMap,
    loadOccurrences,
    loadPackageJson,
    loadRegistry,
    moduleIdsForPath,
    occurrenceToPath,
    packageVersions,
    parseFileDependencies,
    posixRel,
    productRootFromScript,
    sha256Normalized,
    stableStringify,
    toPosix,
    upstreamFileUrl,
    walkSourceFiles,
} from './maintenance-lib.mjs'

const PRODUCT_ROOT = productRootFromScript(import.meta.url)
export const INDEX_REL = 'maintenance/index.generated.json'

const sourceById = (registry) => {
    const map = new Map()
    for (const source of registry.sources ?? []) {
        map.set(source.id, source)
    }
    return map
}

const registryFileMap = (registry) => {
    const map = new Map()
    for (const row of registry.files ?? []) {
        map.set(toPosix(row.file), row)
    }
    return map
}

const buildSettings = (root, controlMap, occurrences, texts) => {
    const byKey = new Map()
    const addOcc = (key, rec) => {
        if (!key) {
            return
        }
        let entry = byKey.get(key)
        if (!entry) {
            entry = { key, occurrences: [] }
            byKey.set(key, entry)
        }
        const sig = `${rec.path}:${rec.line}`
        if (!entry.occurrences.some((o) => `${o.path}:${o.line}` === sig)) {
            entry.occurrences.push(rec)
        }
    }
    for (const row of occurrences) {
        const key = row.id
        const rel = occurrenceToPath(root, row.file)
        const text = texts.get(rel) ?? (fs.existsSync(path.join(root, rel)) ? fs.readFileSync(path.join(root, rel), 'utf8') : '')
        const lines = text ? findKeyLines(text, key) : []
        if (lines.length) {
            for (const line of lines) {
                addOcc(key, { path: rel, line, panel: row.panel ?? '', group: row.group ?? '' })
            }
        } else {
            addOcc(key, { path: rel, line: null, panel: row.panel ?? '', group: row.group ?? '' })
        }
    }
    // CSS effects and generic renderer references do not necessarily import their declarations.
    // Keep these literal references as well as declaration locations; never index generated tables.
    const controls = ['settings','menus','actions'].flatMap(kind => controlMap[kind] ?? [])
    const keys = new Set([...byKey.keys(), ...controls.map(row => row.key)])
    const bindings = new Map()
    for(const row of controls) if(row.storage?.key) {
        const list=bindings.get(row.storage.key) ?? []
        list.push(row.key);bindings.set(row.storage.key,list)
    }
    const patterns=[...new Set([...keys,...bindings.keys()])].sort((a,b)=>b.length-a.length).map(key=>key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))
    const references=new RegExp(`(?:^|[^\\w-])(${patterns.join('|')})(?=$|[^\\w-])`,'g')
    for (const [rel,text] of texts) {
        if (rel.includes('.generated.') || rel.startsWith('src/feedback/')) continue
        text.replaceAll('\r\n','\n').split('\n').forEach((line,index)=>{
            references.lastIndex=0
            for(const match of line.matchAll(references)){
                const key=match[1]
                if(keys.has(key))addOcc(key,{path:rel,line:index+1,relation:'literal-reference'})
                for(const target of bindings.get(key) ?? [])addOcc(target,{path:rel,line:index+1,relation:'storage-binding'})
            }
        })
    }
    for (const [key,entry] of byKey) for (const occurrence of [...entry.occurrences]) {
        if (!occurrence.path.endsWith('.ts')) continue
        const style = occurrence.path.replace(/\.ts$/,'.scss')
        if (texts.has(style) && !entry.occurrences.some(o=>o.path===style)) addOcc(key,{path:style,line:null,relation:'companion-style-by-filename'})
    }
    const rows = []
    const seenKeys = new Set()
    const pushRow = (id, key, extra = {}) => {
        const occ = byKey.get(key)
        const occurrencesFor = (occ?.occurrences ?? [])
            .map((o) => ({
                group: o.group || undefined,
                line: o.line,
                panel: o.panel || undefined,
                path: o.path,
                ...(o.relation ? { relation:o.relation } : {}),
            }))
            .sort((a, b) => a.path.localeCompare(b.path) || (a.line ?? 0) - (b.line ?? 0))
        rows.push({
            id,
            key,
            occurrences: occurrencesFor,
            type: extra.type,
            names: extra.names,
            kind: extra.kind,
        })
        seenKeys.add(key)
    }
    for (const kind of ['settings', 'menus', 'actions']) {
        for (const row of controlMap[kind] ?? []) {
            pushRow(row.id, row.key, {
                type: row.type,
                names: row.names ?? (row.name ? [row.name] : []),
                kind: kind === 'settings' ? 'setting' : kind === 'menus' ? 'menu' : 'action',
            })
        }
    }
    const leftover = [...byKey.keys()].filter((k) => !seenKeys.has(k)).sort()
    for (const key of leftover) {
        pushRow(key, key, { kind: 'setting' })
    }
    rows.sort((a, b) => a.id.localeCompare(b.id))
    return rows.map((row) => {
        const out = { id: row.id, key: row.key, occurrences: row.occurrences }
        if (row.kind) {
            out.kind = row.kind
        }
        if (row.type) {
            out.type = row.type
        }
        if (row.names?.length) {
            out.names = row.names
        }
        return out
    })
}

export async function buildIndex({ root = PRODUCT_ROOT, collectOccurrences } = {}) {
    const registry = loadRegistry(root)
    const pkg = loadPackageJson(root)
    const versions = packageVersions(pkg)
    const filesByPath = registryFileMap(registry)
    const sources = sourceById(registry)
    const walked = walkSourceFiles(root)
    const texts = new Map()
    const fileRecords = []
    const unresolved = []
    const externalSet = new Map()

    for (const item of walked) {
        const text = fs.readFileSync(item.abs, 'utf8')
        texts.set(item.rel, text)
        const sha = sha256Normalized(text)
        const registered = filesByPath.get(item.rel)
        const modules = moduleIdsForPath(item.rel, registry.modules)
        const status = fileBaselineStatus(sha, registered)
        const provenance = registered?.provenance ?? 'unverified'
        const deps = parseFileDependencies(root, item.rel, text)
        for (const u of deps.unresolved) {
            unresolved.push(u)
        }
        for (const name of deps.external) {
            if (!externalSet.has(name)) {
                externalSet.set(name, versions[name] ?? null)
            }
        }
        const upstreamRaw = registered?.upstream ?? null
        let upstream = null
        if (upstreamRaw) {
            const src = sources.get(upstreamRaw.source)
            upstream = {
                caution: registry.matching_path_note ?? MATCHING_PATH_NOTE,
                commit: src?.commit ?? null,
                normalizedSha256: upstreamRaw.normalized_sha256,
                path: toPosix(upstreamRaw.path),
                pathMatch: provenance.includes('matching-path'),
                repository: src?.repository ?? null,
                source: upstreamRaw.source,
                url: src ? upstreamFileUrl(src, upstreamRaw.path) : null,
            }
        }
        fileRecords.push({
            external: deps.external.map((name) => ({ name, version: versions[name] ?? null })),
            imports: deps.imports,
            modules,
            path: item.rel,
            provenance,
            sha256: sha,
            status,
            unresolved: deps.unresolved,
            upstream,
        })
    }

    const occurrences = await loadOccurrences(root, collectOccurrences)
    const controlMap = loadControlMap(root)
    const settings = buildSettings(root, controlMap, occurrences, texts)

    unresolved.sort((a, b) => `${a.from}:${a.specifier}:${a.reason}`.localeCompare(`${b.from}:${b.specifier}:${b.reason}`))
    const external = [...externalSet.entries()]
        .map(([name, version]) => ({ name, version }))
        .sort((a, b) => a.name.localeCompare(b.name))

    return {
        schemaVersion: SCHEMA_VERSION,
        matchingPathNote: registry.matching_path_note ?? MATCHING_PATH_NOTE,
        sources: (registry.sources ?? []).map((s) => ({
            candidatePaths: s.candidate_paths ?? undefined,
            commit: s.commit,
            id: s.id,
            relationship: s.relationship,
            repository: s.repository,
        })),
        modules: (registry.modules ?? []).map((m) => ({
            id: m.id,
            label: m.label,
            liveVerification: m.live_verification,
            paths: m.paths,
            recommendedChecks: m.recommended_checks,
        })),
        files: fileRecords,
        settings,
        external,
        unresolved: uniqueUnresolved(unresolved),
        counts: {
            diverged: fileRecords.filter((f) => f.status === 'diverged').length,
            files: fileRecords.length,
            noBaseline: fileRecords.filter((f) => f.status === 'no-baseline').length,
            controls: settings.length,
            settings: settings.filter(row=>row.kind==='setting').length,
            menus: settings.filter(row=>row.kind==='menu').length,
            actions: settings.filter(row=>row.kind==='action').length,
            unchanged: fileRecords.filter((f) => f.status === 'unchanged').length,
            unresolved: uniqueUnresolved(unresolved).length,
        },
    }
}

const uniqueUnresolved = (rows) => {
    const seen = new Set()
    const out = []
    for (const row of rows) {
        const sig = `${row.from}|${row.specifier}|${row.reason}`
        if (seen.has(sig)) {
            continue
        }
        seen.add(sig)
        out.push(row)
    }
    return out
}

export const indexPath = (root = PRODUCT_ROOT) => path.join(root, INDEX_REL)

export async function writeIndex({ root = PRODUCT_ROOT, check = false, collectOccurrences } = {}) {
    const index = await buildIndex({ root, collectOccurrences })
    const text = stableStringify(index)
    const dest = indexPath(root)
    if (check) {
        if (!fs.existsSync(dest)) {
            throw new Error(`missing ${INDEX_REL}`)
        }
        const existing = fs.readFileSync(dest, 'utf8')
        if (stableStringify(JSON.parse(existing)) !== text) {
            throw new Error(`${INDEX_REL} is stale`)
        }
        return { dest, index, stale: false, wrote: false }
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.writeFileSync(dest, text)
    return { dest, index, stale: false, wrote: true }
}

const parseArgs = (argv) => {
    if (argv.some(arg=>!['--check','--help','--'].includes(arg))) throw new Error('Unknown argument; use --check or --help.')
    return { check:argv.includes('--check'),help:argv.includes('--help') }
}

if (isMainModule(import.meta.url, process.argv[1])) {
    let args
    try { args = parseArgs(process.argv.slice(2)) }
    catch(error) { console.error(error.message);process.exit(1) }
    if(args.help){ console.log('node scripts/maintenance-index.mjs [--check]');process.exit(0) }
    writeIndex({ check: args.check }).then((result) => {
        if (args.check) {
            console.log('maintenance index check ok', result.index.counts)
        } else {
            console.log('wrote', posixRel(PRODUCT_ROOT, result.dest), result.index.counts.files, 'files')
        }
    }).catch((err) => {
        console.error(err.message ?? err)
        process.exit(1)
    })
}
