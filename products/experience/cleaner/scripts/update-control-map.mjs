/**
 * Walk product setting sources, assign stable S/M/B identifiers, and write
 * control-map.json plus the compact runtime index.
 *
 * IDs come from persisted keys (and a small fixed action/menu catalog),
 * never from visible or panel-open order. Existing IDs are kept; new keys
 * append at the end.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'src')
const MODULES = path.join(SRC, 'modules')
const MAP_PATH = path.join(SRC, 'feedback', 'control-map.json')
const INDEX_PATH = path.join(SRC, 'feedback', 'id-index.generated.ts')
const FIXED_PATH = path.join(SRC, 'feedback', 'fixed-controls.json')

const RULE_PAGES = {
    homepage: ['homepage'],
    video: ['video', 'playlist'],
    festival: ['festival'],
    bangumi: ['bangumi'],
    dynamic: ['dynamic'],
    live: ['live'],
    popular: ['popular'],
    channel: ['channel'],
    space: ['space'],
    search: ['search'],
    watchlater: ['watchlater'],
    comment: ['video', 'bangumi', 'dynamic', 'space', 'playlist', 'festival'],
    common: ['*'],
    debug: ['space'],
}

const FILTER_FILE_META = {
    'filters/variety/video/pages/homepage.ts': {
        pages: ['homepage'],
        panel: 'video-filter',
    },
    'filters/variety/video/pages/video.ts': {
        pages: ['video', 'playlist'],
        panel: 'video-filter',
    },
    'filters/variety/video/pages/popular.ts': {
        pages: ['popular'],
        panel: 'video-filter',
    },
    'filters/variety/video/pages/channel.ts': {
        pages: ['channel'],
        panel: 'video-filter',
    },
    'filters/variety/video/pages/search.ts': {
        pages: ['search'],
        panel: 'video-filter',
    },
    'filters/variety/video/pages/space.ts': {
        pages: ['space'],
        panel: 'video-filter',
    },
    'filters/variety/comment/pages/common.ts': {
        pages: ['video', 'bangumi', 'dynamic', 'space', 'playlist', 'festival'],
        panel: 'comment-filter',
    },
    'filters/variety/dynamic/pages/dynamic.ts': {
        pages: ['dynamic'],
        panel: 'dynamic-filter',
    },
    'filters/variety/dynamic/pages/space.ts': {
        pages: ['space'],
        panel: 'dynamic-filter',
    },
    'filters/variety/article/pages/searchArticle.ts': {
        pages: ['search'],
        panel: 'article-filter',
    },
}

const STAT_GATE_PAGES = ['homepage', 'video', 'playlist', 'popular', 'channel', 'search', 'space']
const RULE_SYNC_PAGES = [
    'homepage',
    'video',
    'playlist',
    'popular',
    'channel',
    'search',
    'space',
    'dynamic',
    'bangumi',
    'festival',
]
const RULE_SYNC_PANELS = ['video-filter', 'comment-filter', 'dynamic-filter', 'article-filter']

const ITEM_TYPES = new Set(['switch', 'number', 'string', 'list', 'editor', 'webdav'])

const walkFiles = (dir, acc = []) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            walkFiles(full, acc)
        } else if (entry.isFile() && entry.name.endsWith('.ts')) {
            acc.push(full)
        }
    }
    return acc
}

const parseFile = (file) => {
    const text = fs.readFileSync(file, 'utf8')
    return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
}

const objectProp = (obj, name) => obj.properties.find((p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === name)

const readStringObject = (expr) => {
    if (!expr || !ts.isObjectLiteralExpression(expr)) {
        return null
    }
    const out = {}
    for (const prop of expr.properties) {
        if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) {
            continue
        }
        if (ts.isStringLiteral(prop.initializer)) {
            out[prop.name.text] = prop.initializer.text
        } else if (ts.isObjectLiteralExpression(prop.initializer)) {
            const nested = readStringObject(prop.initializer)
            if (nested) {
                out[prop.name.text] = nested
            }
        }
    }
    return out
}

const resolvePath = (root, parts) => {
    let cur = root
    for (const part of parts) {
        if (cur == null || typeof cur !== 'object') {
            return undefined
        }
        cur = cur[part]
    }
    return typeof cur === 'string' ? cur : undefined
}

const propertyPath = (expr) => {
    const parts = []
    let cur = expr
    while (ts.isPropertyAccessExpression(cur)) {
        parts.unshift(cur.name.text)
        cur = cur.expression
    }
    if (ts.isIdentifier(cur)) {
        parts.unshift(cur.text)
        return parts
    }
    return null
}

const evalString = (expr, locals, globals) => {
    if (!expr) {
        return undefined
    }
    if (ts.isAsExpression(expr) || ts.isParenthesizedExpression(expr)) {
        return evalString(expr.expression, locals, globals)
    }
    if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
        return expr.text
    }
    if (ts.isIdentifier(expr)) {
        const value = locals[expr.text] ?? globals[expr.text]
        return typeof value === 'string' ? value : undefined
    }
    if (ts.isPropertyAccessExpression(expr)) {
        const parts = propertyPath(expr)
        if (!parts) {
            return undefined
        }
        const [rootName, ...rest] = parts
        const root = locals[rootName] ?? globals[rootName]
        return resolvePath(root, rest)
    }
    return undefined
}

const collectConstTables = (sf) => {
    const tables = {}
    const visit = (node) => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
            const obj = readStringObject(node.initializer)
            if (obj && Object.keys(obj).length) {
                tables[node.name.text] = obj
            }
        }
        ts.forEachChild(node, visit)
    }
    visit(sf)
    return tables
}

const readItemFromObject = (obj, locals, globals) => {
    const typeProp = objectProp(obj, 'type')
    const idProp = objectProp(obj, 'id')
    if (!typeProp || !idProp) {
        return null
    }
    const type = evalString(typeProp.initializer, locals, globals)
    if (!ITEM_TYPES.has(type)) {
        return null
    }
    const id = evalString(idProp.initializer, locals, globals)
    if (!id) {
        return null
    }
    const nameProp = objectProp(obj, 'name')
    const name = evalString(nameProp?.initializer, locals, globals) ?? ''
    const item = { type, id, name }
    if (type === 'webdav') {
        item.urlId = evalString(objectProp(obj, 'urlId')?.initializer, locals, globals)
        item.userId = evalString(objectProp(obj, 'userId')?.initializer, locals, globals)
        item.passwordId = evalString(objectProp(obj, 'passwordId')?.initializer, locals, globals)
    }
    return item
}

const nearestGroupName = (node) => {
    let cur = node.parent
    while (cur) {
        if (ts.isObjectLiteralExpression(cur)) {
            const nameProp = objectProp(cur, 'name')
            const itemsProp = objectProp(cur, 'items')
            if (nameProp && itemsProp && ts.isStringLiteral(nameProp.initializer)) {
                return nameProp.initializer.text
            }
        }
        cur = cur.parent
    }
    return ''
}

const locateFile = (file) => {
    const rel = path.relative(MODULES, file).replaceAll('\\', '/')
    if (rel === 'touch/index.ts') {
        return { rel, kind: 'rule', panel: 'rule', pages: ['video', 'playlist'] }
    }
    if (rel.startsWith('rules/')) {
        const pageKey = rel.split('/')[1]
        return {
            rel,
            kind: 'rule',
            panel: 'rule',
            pages: RULE_PAGES[pageKey] ?? [pageKey],
        }
    }
    if (FILTER_FILE_META[rel]) {
        return { rel, kind: 'filter', ...FILTER_FILE_META[rel] }
    }
    if (rel === 'filters/variety/video/statGate.ts') {
        return { rel, kind: 'statGate', panel: 'video-filter', pages: STAT_GATE_PAGES }
    }
    if (rel === 'filters/ruleSync.ts') {
        return { rel, kind: 'ruleSync', panel: 'filter-sync', pages: RULE_SYNC_PAGES }
    }
    return { rel, kind: 'other', panel: '', pages: [] }
}

const collectFromCall = (node, locals, globals) => {
    if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression)) {
        return null
    }
    const fn = node.expression.text
    if (!['switchItem', 'numberItem', 'rateItem'].includes(fn)) {
        return null
    }
    const id = evalString(node.arguments[0], locals, globals)
    const name = evalString(node.arguments[1], locals, globals) ?? ''
    if (!id) {
        return null
    }
    const type = fn === 'switchItem' ? 'switch' : 'number'
    return { type, id, name }
}

const identifierGroupMap = (files) => {
    const map = new Map()
    for (const file of files) {
        const sf = parseFile(file)
        const visit = (node) => {
            if (ts.isObjectLiteralExpression(node)) {
                const nameProp = objectProp(node, 'name')
                const itemsProp = objectProp(node, 'items')
                if (
                    nameProp &&
                    itemsProp &&
                    ts.isStringLiteral(nameProp.initializer) &&
                    ts.isIdentifier(itemsProp.initializer)
                ) {
                    map.set(itemsProp.initializer.text, nameProp.initializer.text)
                }
            }
            ts.forEachChild(node, visit)
        }
        visit(sf)
    }
    return map
}

const exportedArrayName = (sf, node) => {
    let cur = node
    while (cur) {
        if (ts.isVariableDeclaration(cur) && ts.isIdentifier(cur.name) && ts.isArrayLiteralExpression(cur.initializer)) {
            return cur.name.text
        }
        cur = cur.parent
    }
    return ''
}

export const collectOccurrences = () => {
    const files = walkFiles(MODULES)
    const globals = {}
    for (const file of files) {
        const tables = collectConstTables(parseFile(file))
        if (tables.STAT_KEYS) {
            globals.STAT_KEYS = tables.STAT_KEYS
        }
        if (tables.SYNC_KEYS) {
            globals.SYNC_KEYS = tables.SYNC_KEYS
        }
    }
    const groupByIdent = identifierGroupMap(files)
    const occurrences = []

    for (const file of files) {
        const loc = locateFile(file)
        if (loc.kind === 'other') {
            continue
        }
        const sf = parseFile(file)
        const locals = collectConstTables(sf)

        const visit = (node) => {
            if (ts.isObjectLiteralExpression(node)) {
                const item = readItemFromObject(node, locals, globals)
                if (item) {
                    const arrayName = exportedArrayName(sf, node)
                    const group = nearestGroupName(node) || (arrayName ? groupByIdent.get(arrayName) ?? '' : '')
                    occurrences.push({
                        ...item,
                        group,
                        file: loc.rel,
                        panel: loc.panel,
                        pages: loc.pages,
                    })
                    if (item.type === 'webdav') {
                        const fields = [
                            { id: item.urlId, name: '链接', type: 'webdav-field' },
                            { id: item.userId, name: '账号', type: 'webdav-field' },
                            { id: item.passwordId, name: '密码', type: 'webdav-field' },
                        ]
                        for (const field of fields) {
                            if (!field.id) {
                                continue
                            }
                            occurrences.push({
                                ...field,
                                group,
                                file: loc.rel,
                                panel: loc.panel,
                                pages: loc.pages,
                            })
                        }
                    }
                }
            }
            const called = collectFromCall(node, locals, globals)
            if (called) {
                occurrences.push({
                    ...called,
                    group: nearestGroupName(node) || '接口数据过滤',
                    file: loc.rel,
                    panel: loc.panel,
                    pages: loc.pages,
                })
            }
            ts.forEachChild(node, visit)
        }
        visit(sf)
    }

    // ruleSync is pushed onto every filter except the header-only one.
    const syncOcc = occurrences.filter((o) => o.file === 'filters/ruleSync.ts')
    for (const occ of syncOcc) {
        for (const panel of RULE_SYNC_PANELS) {
            occurrences.push({ ...occ, panel, pages: RULE_SYNC_PAGES })
        }
    }

    return occurrences
}

const mergeSettings = (occurrences) => {
    const byKey = new Map()
    for (const occ of occurrences) {
        let entry = byKey.get(occ.id)
        if (!entry) {
            entry = {
                key: occ.id,
                type: occ.type,
                names: [],
                pages: [],
                panels: [],
                groups: [],
            }
            byKey.set(occ.id, entry)
        }
        if (occ.name && !entry.names.includes(occ.name)) {
            entry.names.push(occ.name)
        }
        for (const page of occ.pages) {
            if (!entry.pages.includes(page)) {
                entry.pages.push(page)
            }
        }
        if (occ.panel && !entry.panels.includes(occ.panel)) {
            entry.panels.push(occ.panel)
        }
        if (occ.group && !entry.groups.includes(occ.group)) {
            entry.groups.push(occ.group)
        }
        if (entry.type === 'webdav-field' && occ.type !== 'webdav-field') {
            entry.type = occ.type
        }
    }
    return [...byKey.values()]
}

const nextId = (existing, prefix, width) => {
    let max = 0
    for (const id of existing) {
        if (!id.startsWith(prefix)) {
            continue
        }
        const n = Number(id.slice(prefix.length))
        if (Number.isInteger(n) && n > max) {
            max = n
        }
    }
    const n = max + 1
    return `${prefix}${String(n).padStart(width, '0')}`
}

const assignStable = (entries, previous, prefix, width) => {
    const incoming = new Map(entries.map((entry) => [entry.key, entry]))
    const out = []
    const used = new Set()
    for (const row of previous ?? []) {
        const fresh = incoming.get(row.key)
        out.push({ id: row.id, ...(fresh ?? { ...row, retired: true }) })
        used.add(row.id)
        incoming.delete(row.key)
    }
    const fresh = [...incoming.values()].sort((a, b) => a.key.localeCompare(b.key))
    if (!(previous ?? []).length) {
        fresh.sort((a, b) => a.key.localeCompare(b.key))
    }
    for (const entry of fresh) {
        const id = nextId(used, prefix, width)
        used.add(id)
        out.push({ id, ...entry })
    }
    return out
}

const loadJson = (file, fallback) => {
    if (!fs.existsSync(file)) {
        return fallback
    }
    return JSON.parse(fs.readFileSync(file, 'utf8'))
}

const writeIndex = (settings, menus, actions) => {
    const toRecord = (rows) => Object.fromEntries(rows.map((row) => [row.key, row.id]))
    const body = `/** Generated by scripts/update-control-map.mjs. Do not edit by hand. */
export const settingsByKey: Record<string, string> = ${JSON.stringify(toRecord(settings), null, 4)}
export const menusByKey: Record<string, string> = ${JSON.stringify(toRecord(menus), null, 4)}
export const actionsByKey: Record<string, string> = ${JSON.stringify(toRecord(actions), null, 4)}
`
    fs.writeFileSync(INDEX_PATH, body)
}

const panelTitle = {
    rule: '页面净化',
    'video-filter': '视频过滤',
    'comment-filter': '评论过滤',
    'dynamic-filter': '动态过滤',
    'article-filter': '专栏过滤',
    'filter-sync': '规则仓库同步',
    editor: '编辑器',
    'side-btn': '快捷按钮',
    'context-menu': '右键菜单',
    'script-manager': '脚本管理器菜单',
    'shortcut-settings': '快捷开关设置',
}

export const buildMap = () => {
    const occurrences = collectOccurrences()
    const settings = mergeSettings(occurrences)
    const fixed = loadJson(FIXED_PATH, { menus: [], actions: [], settings: [] })
    const previous = loadJson(MAP_PATH, { settings: [], menus: [], actions: [] })
    const extraSettings = (fixed.settings ?? []).map((row) => ({
        key: row.key,
        ...(row.storage ? { storage: row.storage } : {}),
        type: row.type ?? 'switch',
        names: row.name ? [row.name] : (row.names ?? []),
        pages: row.pages ?? ['*'],
        panels: row.panel ? [row.panel] : (row.panels ?? []),
        groups: row.group ? [row.group] : (row.groups ?? []),
    }))

    const settingRows = assignStable([...settings, ...extraSettings], previous.settings, 'S', 3)
    const menuRows = assignStable(fixed.menus, previous.menus, 'M', 2)
    const actionRows = assignStable(fixed.actions, previous.actions, 'B', 2)

    const map = {
        scheme: {
            settings: 'S### from persisted GM key or composite control id',
            menus: 'M## script-manager commands',
            actions: 'B## fixed UI actions and stable context-menu classes',
        },
        note: 'IDs are assigned from keys. The same persisted key reuses the same S ID across pages. Include the page URL in feedback when page-specific implementations differ.',
        generatedAt: '2026-10-10',
        counts: {
            settings: settingRows.length,
            menus: menuRows.length,
            actions: actionRows.length,
        },
        settings: settingRows,
        menus: menuRows,
        actions: actionRows,
    }
    return { map, occurrences }
}

const mdEscape = (value) => String(value ?? '').replaceAll('|', '\\|')

export const toMarkdown = (map) => {
    const lines = [
        '# MisakaWeb 反馈控件编号',
        '',
        '这是控件对照表，不是网页。在 B 站页面上使用反馈测试脚本，把看到的编号写进反馈。标准正式构建不显示编号。',
        '',
        `- 设置：\`${map.scheme.settings}\``,
        `- 菜单：\`${map.scheme.menus}\``,
        `- 动作：\`${map.scheme.actions}\``,
        '',
        map.note,
        '',
        `生成日期：${map.generatedAt}。设置 ${map.counts.settings}，菜单 ${map.counts.menus}，动作 ${map.counts.actions}。`,
        '',
        '## 脚本管理器菜单',
        '',
        '| 编号 | 键 | 中文 | 适用页面 |',
        '| --- | --- | --- | --- |',
    ]
    for (const row of map.menus) {
        lines.push(`| ${row.id} | \`${row.key}\` | ${mdEscape(row.name)} | ${row.pages.join(', ')} |`)
    }
    lines.push('', '## 固定界面动作', '', '| 编号 | 键 | 中文 | 面板 | 适用页面 |', '| --- | --- | --- | --- | --- |')
    for (const row of map.actions) {
        lines.push(
            `| ${row.id} | \`${row.key}\` | ${mdEscape(row.name)} | ${panelTitle[row.panel] ?? row.panel} | ${row.pages.join(', ')} |`,
        )
    }
    lines.push('', '## 设置项', '', '| 编号 | 键 | 类型 | 中文 | 面板 | 分组 | 适用页面 |', '| --- | --- | --- | --- | --- | --- | --- |')
    for (const row of map.settings) {
        lines.push(
            `| ${row.id} | \`${row.key}\` | ${row.type} | ${mdEscape(row.names.join(' / '))} | ${(row.panels ?? []).map((p) => panelTitle[p] ?? p).join(', ')} | ${(row.groups ?? []).join(' / ')} | ${(row.pages ?? []).join(', ')} |`,
        )
    }
    lines.push('')
    return lines.join('\n')
}

const isCheck = process.argv.includes('--check')
const mdOut = process.argv.find((a) => a.startsWith('--md='))?.slice(5)

const invokedDirectly = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
if (invokedDirectly) {
    const { map } = buildMap()
    if (isCheck) {
        const existing = loadJson(MAP_PATH, null)
        if (!existing) {
            console.error('control-map.json missing')
            process.exit(1)
        }
        const oldIds = new Map(existing.settings.map((r) => [r.key, r.id]))
        for (const row of map.settings) {
            if (oldIds.has(row.key) && oldIds.get(row.key) !== row.id) {
                console.error(`renumbered ${row.key}: ${oldIds.get(row.key)} -> ${row.id}`)
                process.exit(1)
            }
        }
        const oldKeys = new Set(existing.settings.map((r) => r.key))
        const missing = map.settings.filter((r) => !oldKeys.has(r.key))
        if (missing.length) {
            console.error(`map missing ${missing.length} keys, e.g. ${missing[0].key}`)
            process.exit(1)
        }
        console.log('control map check ok', map.counts)
    } else {
        fs.writeFileSync(MAP_PATH, JSON.stringify(map, null, 4) + '\n')
        writeIndex(map.settings, map.menus, map.actions)
        if (mdOut) {
            fs.mkdirSync(path.dirname(mdOut), { recursive: true })
            fs.writeFileSync(mdOut, toMarkdown(map))
        }
        console.log('wrote', MAP_PATH)
        console.log('wrote', INDEX_PATH)
        console.log(JSON.stringify(map.counts))
    }
}
