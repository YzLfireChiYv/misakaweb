export interface StructuralSample {
    tag: string
    classes: string[]
    visible: boolean
    rect: { x: number; y: number; width: number; height: number }
    childTags: string[]
    childClasses: string[][]
    shadowRoot: boolean
    parentTag?: string
    parentClasses?: string[]
    parentIsBody?: boolean
    attributeNames?: string[]
}
export interface MaintenanceEvidence {
    format: 'misakaweb-structural-diagnostic'
    schemaVersion: 1
    scriptVersion: string
    capturedAt: string
    pageType: string
    site: string
    scope: 'structure-only; no text, URLs, storage, cookies or account data'
    probes: { id: string; selector: string; count: number; samples: StructuralSample[] }[]
}

const object = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const exactKeys = (v: Record<string, unknown>, keys: string[]) => {
    if (Object.keys(v).some(k => !keys.includes(k))) throw new Error('Diagnostic contains unsupported fields; raw storage/HTML/network dumps are not accepted.')
}
const safeToken = (v: unknown, max = 120): v is string => typeof v === 'string' && v.length <= max && /^[\w.\- :#>[\]="']*$/.test(v)
const strings = (v: unknown, max: number) => Array.isArray(v) && v.length <= max && v.every(x => typeof x === 'string' && /^[a-zA-Z_][\w-]{0,79}$/.test(x))

/** Reject unknown fields; never silently accept an arbitrary backup or browser dump. */
export const validateEvidence = (value: unknown): MaintenanceEvidence => {
    if (!object(value)) throw new Error('Expected structural diagnostic object.')
    exactKeys(value, ['format','schemaVersion','scriptVersion','capturedAt','pageType','site','scope','probes'])
    if (value.format !== 'misakaweb-structural-diagnostic' || value.schemaVersion !== 1 ||
        value.scope !== 'structure-only; no text, URLs, storage, cookies or account data') throw new Error('Unsupported diagnostic format.')
    if (typeof value.scriptVersion !== 'string' || !/^\d+(\.\d+){2,3}$/.test(value.scriptVersion)) throw new Error('Invalid script version.')
    if (typeof value.capturedAt !== 'string' || !/^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(value.capturedAt) || !Number.isFinite(Date.parse(value.capturedAt))) throw new Error('Invalid capture date.')
    if (!safeToken(value.pageType, 40) || typeof value.site !== 'string' || !/^(?:[a-z0-9-]+\.)*bilibili\.com$/.test(value.site)) throw new Error('Invalid diagnostic page metadata.')
    if (!Array.isArray(value.probes) || value.probes.length > 40) throw new Error('Invalid diagnostic probes.')
    const ids = new Set<string>()
    for (const probe of value.probes) {
        if (!object(probe)) throw new Error('Invalid probe.')
        exactKeys(probe, ['id','selector','count','samples'])
        if (!safeToken(probe.id, 80) || !safeToken(probe.selector, 180) || !Number.isInteger(probe.count) || Number(probe.count) < 0 || Number(probe.count) > 100000 || !Array.isArray(probe.samples) || probe.samples.length > 3) throw new Error('Invalid structural probe.')
        if (ids.has(probe.id) || probe.samples.length > Number(probe.count)) throw new Error('Inconsistent structural probe.')
        ids.add(probe.id)
        for (const sample of probe.samples) {
            if (!object(sample)) throw new Error('Invalid sample.')
            exactKeys(sample, ['tag','classes','visible','rect','childTags','childClasses','shadowRoot','parentTag','parentClasses','parentIsBody','attributeNames'])
            if (!safeToken(sample.tag, 60) || !strings(sample.classes, 12) || !strings(sample.childTags, 12) ||
                !Array.isArray(sample.childClasses) || sample.childClasses.length > 12 || !sample.childClasses.every(v => strings(v, 12)) ||
                typeof sample.visible !== 'boolean' || typeof sample.shadowRoot !== 'boolean' || !object(sample.rect)) throw new Error('Invalid structural sample.')
            exactKeys(sample.rect, ['x','y','width','height'])
            const rect = sample.rect
            if (!['x','y','width','height'].every(k => typeof rect[k] === 'number' && Number.isFinite(rect[k]) && Math.abs(Number(rect[k])) < 1000000)) throw new Error('Invalid rectangle.')
            if (Number(rect.width) < 0 || Number(rect.height) < 0 || (sample.childTags as unknown[]).length !== sample.childClasses.length) throw new Error('Inconsistent structural sample.')
            if (sample.parentTag !== undefined && !safeToken(sample.parentTag, 60)) throw new Error('Invalid parent tag.')
            if (sample.parentClasses !== undefined && !strings(sample.parentClasses, 12)) throw new Error('Invalid parent classes.')
            if (sample.parentIsBody !== undefined && typeof sample.parentIsBody !== 'boolean') throw new Error('Invalid parent location.')
            if (sample.attributeNames !== undefined && !strings(sample.attributeNames, 32)) throw new Error('Invalid attribute names.')
        }
    }
    return value as unknown as MaintenanceEvidence
}
