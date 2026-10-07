export type RuleKind = 'list' | 'number'

export type RuleField = {
    short: string
    gm: string
    kind: RuleKind
    /** 键不存在时过滤器自己用的默认值。与默认值相同的数字不写入简略包。 */
    absent: string[] | number
}

/** 规则仓库。页面开关、净化开关、WebDAV 连接不在这里。 */
export const RULE_FIELDS: RuleField[] = [
    { short: 'tb', gm: 'global-title-keyword-filter-value', kind: 'list', absent: [] },
    { short: 'ub', gm: 'global-uploader-filter-value', kind: 'list', absent: [] },
    { short: 'uk', gm: 'global-uploader-keyword-filter-value', kind: 'list', absent: [] },
    { short: 'bb', gm: 'global-bvid-filter-value', kind: 'list', absent: [] },
    { short: 'tw', gm: 'global-title-keyword-whitelist-filter-value', kind: 'list', absent: [] },
    { short: 'uw', gm: 'global-uploader-whitelist-filter-value', kind: 'list', absent: [] },
    { short: 'ck', gm: 'global-content-keyword-filter-value', kind: 'list', absent: [] },
    { short: 'cw', gm: 'global-content-keyword-whitelist-filter-value', kind: 'list', absent: [] },
    { short: 'aa', gm: 'global-article-author-filter-value', kind: 'list', absent: [] },
    { short: 'ak', gm: 'global-article-author-keyword-filter-value', kind: 'list', absent: [] },
    { short: 'at', gm: 'global-article-title-keyword-filter-value', kind: 'list', absent: [] },
    { short: 'aw', gm: 'global-article-author-whitelist-filter-value', kind: 'list', absent: [] },
    { short: 'atw', gm: 'global-article-title-keyword-whitelist-filter-value', kind: 'list', absent: [] },
    { short: 'cu', gm: 'global-comment-username-filter-value', kind: 'list', absent: [] },
    { short: 'cuk', gm: 'global-comment-username-keyword-filter-value', kind: 'list', absent: [] },
    { short: 'cc', gm: 'global-comment-content-filter-value', kind: 'list', absent: [] },
    { short: 'd', gm: 'global-duration-filter-value', kind: 'number', absent: 0 },
    { short: 'pv', gm: 'global-views-filter-value', kind: 'number', absent: 0 },
    { short: 'pd', gm: 'global-pubdate-filter-value', kind: 'number', absent: 0 },
    { short: 'q', gm: 'global-quality-filter-value', kind: 'number', absent: 0 },
    { short: 'cl', gm: 'global-comment-level-filter-value', kind: 'number', absent: 0 },
    { short: 'rv', gm: 'search-relativity-threshold-value', kind: 'number', absent: 15 },
    { short: 'lk', gm: 'biliweb-stat-like-min', kind: 'number', absent: 0 },
    { short: 'fv', gm: 'biliweb-stat-fav-min', kind: 'number', absent: 0 },
    { short: 'av', gm: 'biliweb-stat-view-min', kind: 'number', absent: 0 },
]

export type RuleWrite = {
    gm: string
    /** undefined 表示删掉该键，让过滤器回到 absent。 */
    value: string[] | number | undefined
}

const isStringList = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every((item) => typeof item === 'string')

const sameList = (left: string[], right: string[]) =>
    left.length === right.length && left.every((item, index) => item === right[index])

export const exportRulePack = (read: (gm: string) => unknown): Record<string, string[] | number> => {
    const pack: Record<string, string[] | number> = {}
    for (const field of RULE_FIELDS) {
        const raw = read(field.gm)
        if (raw == null) {
            continue
        }
        if (field.kind === 'list') {
            if (!isStringList(raw) || raw.length === 0) {
                continue
            }
            pack[field.short] = raw
            continue
        }
        if (typeof raw !== 'number' || !Number.isFinite(raw) || raw === field.absent) {
            continue
        }
        pack[field.short] = raw
    }
    return pack
}

/** 简略包不合法时返回 null，调用方应放弃这次覆盖。 */
export const planRuleImport = (
    pack: unknown,
    read: (gm: string) => unknown,
): RuleWrite[] | null => {
    if (pack === null || typeof pack !== 'object' || Array.isArray(pack)) {
        return null
    }
    const record = pack as Record<string, unknown>
    const known = new Set(RULE_FIELDS.map((field) => field.short))
    for (const key of Object.keys(record)) {
        if (!known.has(key)) {
            return null
        }
    }
    const writes: RuleWrite[] = []
    for (const field of RULE_FIELDS) {
        const incoming = record[field.short]
        const current = read(field.gm)
        if (incoming == null) {
            const alreadyAbsent =
                current == null ||
                (field.kind === 'list' && isStringList(current) && current.length === 0) ||
                (field.kind === 'number' && current === field.absent)
            if (!alreadyAbsent && current != null) {
                writes.push({ gm: field.gm, value: undefined })
            }
            continue
        }
        if (field.kind === 'list') {
            if (!isStringList(incoming)) {
                return null
            }
            if (!isStringList(current) || !sameList(current, incoming)) {
                writes.push({ gm: field.gm, value: incoming })
            }
            continue
        }
        if (typeof incoming !== 'number' || !Number.isFinite(incoming)) {
            return null
        }
        if (current !== incoming) {
            writes.push({ gm: field.gm, value: incoming })
        }
    }
    return writes
}
