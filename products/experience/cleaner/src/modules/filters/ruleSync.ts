import {
    GM_addValueChangeListener,
    GM_deleteValue,
    GM_getValue,
    GM_setValue,
    GM_xmlhttpRequest,
} from '$'
import { Group } from '@/types/collection'
import { logger } from '@/utils/logger'
import { RULE_FIELDS, exportRulePack, planRuleImport } from './rulePack'

const SYNC_KEYS = {
    enabled: 'biliweb-sync-enabled',
    url: 'biliweb-sync-url',
    user: 'biliweb-sync-user',
    password: 'biliweb-sync-password',
    stamp: 'biliweb-rules-stamp',
}

const STAMP_NAME = 'bili-rules.stamp'
const PACK_NAME = 'bili-rules.pack'

let watchInstalled = false
let syncing: Promise<void> | null = null
let suppressDepth = 0
let suppressUntil = 0
let editTimer = 0

type GmResponse = {
    status: number
    response?: unknown
    responseText?: string
}

const readText = (key: string) => {
    const value = GM_getValue(key, '')
    return typeof value === 'string' ? value.trim() : ''
}

const syncEnabled = () => Boolean(GM_getValue(SYNC_KEYS.enabled, false))

const canSync = () => syncEnabled() && readText(SYNC_KEYS.url) !== '' && readText(SYNC_KEYS.user) !== ''

const basicAuth = (user: string, password: string) => {
    const bytes = new TextEncoder().encode(`${user}:${password}`)
    let binary = ''
    const size = 0x8000
    for (let index = 0; index < bytes.length; index += size) {
        binary += String.fromCharCode(...bytes.subarray(index, index + size))
    }
    return `Basic ${btoa(binary)}`
}

const joinUrl = (base: string, name: string) => `${base.replace(/\/+$/, '')}/${name}`

const bytesToBinary = (bytes: Uint8Array) => {
    let binary = ''
    const size = 0x8000
    for (let index = 0; index < bytes.length; index += size) {
        binary += String.fromCharCode(...bytes.subarray(index, index + size))
    }
    return binary
}

const gmRequest = (details: {
    method: string
    url: string
    headers: Record<string, string>
    data?: string
    binary?: boolean
    responseType?: 'arraybuffer' | 'text'
}) =>
    new Promise<GmResponse>((resolve, reject) => {
        GM_xmlhttpRequest({
            method: details.method,
            url: details.url,
            headers: details.headers,
            data: details.data,
            binary: details.binary,
            responseType: details.responseType,
            timeout: 20000,
            onload: (response) => resolve(response as GmResponse),
            onerror: () => reject(new Error(`${details.method} ${details.url} failed`)),
            ontimeout: () => reject(new Error(`${details.method} ${details.url} timeout`)),
        })
    })

const authHeaders = () => ({
    Authorization: basicAuth(readText(SYNC_KEYS.user), GM_getValue(SYNC_KEYS.password, '') as string),
})

const localStamp = () => {
    const value = GM_getValue(SYNC_KEYS.stamp, 0)
    return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

const blobBytes = (bytes: Uint8Array) =>
    new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer])

const gzipText = async (text: string) => {
    if (typeof CompressionStream !== 'function') {
        return { bytes: new TextEncoder().encode(text), gzip: false }
    }
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
    const buffer = await new Response(stream).arrayBuffer()
    return { bytes: new Uint8Array(buffer), gzip: true }
}

const gunzipOrText = async (bytes: Uint8Array) => {
    const gzip = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b
    if (!gzip) {
        return new TextDecoder().decode(bytes)
    }
    const stream = blobBytes(bytes).stream().pipeThrough(new DecompressionStream('gzip'))
    return new Response(stream).text()
}

const fetchStamp = async (base: string): Promise<number | null> => {
    const response = await gmRequest({
        method: 'GET',
        url: joinUrl(base, STAMP_NAME),
        headers: authHeaders(),
    })
    if (response.status === 404) {
        return null
    }
    if (response.status !== 200) {
        throw new Error(`stamp status ${response.status}`)
    }
    const text = (response.responseText || '').trim()
    if (!/^\d+$/.test(text)) {
        throw new Error('stamp invalid')
    }
    return Number(text)
}

const fetchPack = async (base: string) => {
    const response = await gmRequest({
        method: 'GET',
        url: joinUrl(base, PACK_NAME),
        headers: authHeaders(),
        responseType: 'arraybuffer',
    })
    if (response.status === 404) {
        return null
    }
    if (response.status !== 200) {
        throw new Error(`pack status ${response.status}`)
    }
    const raw = response.response
    const bytes = raw instanceof ArrayBuffer ? new Uint8Array(raw) : new Uint8Array()
    if (!bytes.length) {
        throw new Error('pack empty')
    }
    return JSON.parse(await gunzipOrText(bytes)) as unknown
}

const putFile = async (url: string, data: string, contentType: string, binary = false) => {
    const response = await gmRequest({
        method: 'PUT',
        url,
        headers: { ...authHeaders(), 'Content-Type': contentType },
        data,
        binary,
    })
    if (response.status === 200 || response.status === 201 || response.status === 204) {
        return
    }
    throw new Error(`put status ${response.status}`)
}

const ensureDir = async (base: string) => {
    const response = await gmRequest({
        method: 'MKCOL',
        url: base,
        headers: authHeaders(),
    })
    if ([201, 204, 301, 405, 409].includes(response.status)) {
        return
    }
    logger.debug(`mkcol status ${response.status}`)
}

const upload = async (base: string, stamp: number) => {
    const pack = exportRulePack((key) => GM_getValue(key, undefined))
    const encoded = await gzipText(JSON.stringify(pack))
    const body = bytesToBinary(encoded.bytes)
    const type = encoded.gzip ? 'application/gzip' : 'application/json'
    try {
        await putFile(joinUrl(base, PACK_NAME), body, type, true)
    } catch (err) {
        await ensureDir(base)
        await putFile(joinUrl(base, PACK_NAME), body, type, true)
        logger.debug('webdav retry put after mkcol', err)
    }
    await putFile(joinUrl(base, STAMP_NAME), String(stamp), 'text/plain')
}

const applyRemote = (pack: unknown, stamp: number) => {
    const writes = planRuleImport(pack, (key) => GM_getValue(key, undefined))
    if (!writes) {
        throw new Error('pack schema rejected')
    }
    suppressDepth++
    suppressUntil = Date.now() + 2000
    try {
        for (const write of writes) {
            if (write.value === undefined) {
                GM_deleteValue(write.gm)
            } else {
                GM_setValue(write.gm, write.value)
            }
        }
        GM_setValue(SYNC_KEYS.stamp, stamp)
    } finally {
        suppressDepth--
    }
    return writes.length > 0
}

const syncOnce = async () => {
    if (!canSync()) {
        return
    }
    const base = readText(SYNC_KEYS.url)
    const local = localStamp()
    const remote = await fetchStamp(base)
    if (remote == null) {
        if (local > 0) {
            await upload(base, local)
            logger.info(`规则仓库已上传，时间戳 ${local}`)
        }
        return
    }
    if (remote === local) {
        return
    }
    if (remote > local) {
        const pack = await fetchPack(base)
        if (pack == null) {
            throw new Error('stamp exists but pack is missing')
        }
        const changed = applyRemote(pack, remote)
        logger.info(`规则仓库已按远端时间戳 ${remote} 覆盖`)
        if (changed) {
            location.reload()
        }
        return
    }
    await upload(base, local)
    logger.info(`规则仓库已按本地时间戳 ${local} 覆盖远端`)
}

export const syncRulesNow = () => {
    if (syncing) {
        return syncing
    }
    syncing = syncOnce()
        .catch((err) => {
            logger.error('规则仓库同步失败', err)
        })
        .finally(() => {
            syncing = null
        })
    return syncing
}

const scheduleFromEdit = () => {
    if (suppressDepth > 0 || Date.now() < suppressUntil) {
        return
    }
    GM_setValue(SYNC_KEYS.stamp, Date.now())
    window.clearTimeout(editTimer)
    editTimer = window.setTimeout(() => {
        void syncRulesNow()
    }, 800)
}

export const installRuleWatch = () => {
    if (watchInstalled) {
        return
    }
    watchInstalled = true
    for (const field of RULE_FIELDS) {
        GM_addValueChangeListener(field.gm, () => {
            scheduleFromEdit()
        })
    }
}

const touchSync = () => {
    if (syncEnabled()) {
        void syncRulesNow()
    }
}

export const ruleSyncGroup = (): Group => ({
    name: '规则仓库同步',
    fold: true,
    items: [
        {
            type: 'switch',
            id: SYNC_KEYS.enabled,
            name: '启用 WebDAV 同步',
            description: [
                '只同步规则仓库：黑白名单和各项阈值。',
                '页面开关、净化开关、这里的链接和密码留在本机。',
                '本地时间戳和 bili-rules.stamp 谁更晚，谁覆盖另一边。',
            ],
            noStyle: true,
            enableFn: () => {
                if (!canSync()) {
                    logger.info('规则同步已打开，链接或账号还是空的')
                    return
                }
                void syncRulesNow()
            },
            disableFn: () => {},
        },
        {
            type: 'string',
            id: SYNC_KEYS.url,
            name: 'WebDAV 链接',
            description: ['目录地址。脚本在其中写入 bili-rules.stamp 和 bili-rules.pack。'],
            defaultValue: '',
            disableValue: '',
            noStyle: true,
            fn: () => {
                touchSync()
            },
        },
        {
            type: 'string',
            id: SYNC_KEYS.user,
            name: '账号',
            defaultValue: '',
            disableValue: '',
            noStyle: true,
            fn: () => {
                touchSync()
            },
        },
        {
            type: 'string',
            id: SYNC_KEYS.password,
            name: '密码',
            inputType: 'password',
            defaultValue: '',
            disableValue: '',
            noStyle: true,
            fn: () => {
                touchSync()
            },
        },
    ],
})
