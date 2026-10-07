import { GM_xmlhttpRequest } from '$'
import { md5 } from '@/utils/md5'
import { logger } from '@/utils/logger'

export type VideoStat = {
    view: number
    like: number
    favorite: number
}

const NAV_URL = 'https://api.bilibili.com/x/web-interface/nav'
const VIEW_URL = 'https://api.bilibili.com/x/web-interface/view'
const MIXIN_TAB = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12,
    38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
    36, 20, 34, 44, 52,
]

const cache = new Map<string, { stat: VideoStat | null; at: number }>()
const pending = new Map<string, Promise<VideoStat | null>>()
let wbiKey = ''
let wbiAt = 0
let wbiTask: Promise<string> | null = null

const SUCCESS_TTL = 10 * 60 * 1000
const FAIL_TTL = 20 * 1000
const WBI_TTL = 30 * 60 * 1000

type GmResponse = {
    status: number
    responseText?: string
}

const gmGet = (url: string) =>
    new Promise<GmResponse>((resolve, reject) => {
        GM_xmlhttpRequest({
            method: 'GET',
            url,
            timeout: 8000,
            headers: {
                Referer: 'https://www.bilibili.com/',
                Origin: 'https://www.bilibili.com',
            },
            onload: (response) => resolve(response as GmResponse),
            onerror: () => reject(new Error('view request failed')),
            ontimeout: () => reject(new Error('view request timeout')),
        })
    })

const mixinKey = (raw: string) => MIXIN_TAB.map((index) => raw[index] ?? '').join('').slice(0, 32)

const keyFromUrl = (url: string) => url.split('/').pop()?.split('.')[0] ?? ''

const loadWbiKey = async (): Promise<string> => {
    if (wbiKey && Date.now() - wbiAt < WBI_TTL) {
        return wbiKey
    }
    if (wbiTask) {
        return wbiTask
    }
    wbiTask = (async () => {
        const response = await gmGet(NAV_URL)
        const json = JSON.parse(response.responseText || '{}') as {
            data?: { wbi_img?: { img_url?: string; sub_url?: string } }
        }
        const img = json.data?.wbi_img?.img_url ?? ''
        const sub = json.data?.wbi_img?.sub_url ?? ''
        const key = mixinKey(keyFromUrl(img) + keyFromUrl(sub))
        if (key.length < 32) {
            throw new Error('wbi key missing')
        }
        wbiKey = key
        wbiAt = Date.now()
        return key
    })().finally(() => {
        wbiTask = null
    })
    return wbiTask
}

const signQuery = (bvid: string, key: string) => {
    const params: Record<string, string> = {
        bvid,
        wts: String(Math.round(Date.now() / 1000)),
    }
    const query = Object.keys(params)
        .sort()
        .map((name) => `${encodeURIComponent(name)}=${encodeURIComponent(params[name].replace(/[!'()*]/g, ''))}`)
        .join('&')
    return `${query}&w_rid=${md5(query + key)}`
}

const readStat = (json: { code?: number; data?: { stat?: { view?: number; like?: number; favorite?: number } } }) => {
    const stat = json.data?.stat
    if (json.code !== 0 || !stat) {
        return null
    }
    if (typeof stat.view !== 'number' || typeof stat.like !== 'number' || typeof stat.favorite !== 'number') {
        return null
    }
    return { view: stat.view, like: stat.like, favorite: stat.favorite }
}

const requestStat = async (bvid: string): Promise<VideoStat | null> => {
    const plain = await gmGet(`${VIEW_URL}?bvid=${encodeURIComponent(bvid)}`)
    const plainJson = JSON.parse(plain.responseText || '{}') as { code?: number; data?: { stat?: VideoStat } }
    if (plainJson.code === 0) {
        return readStat(plainJson)
    }
    if (plainJson.code !== -352 && plainJson.code !== -403) {
        logger.debug(`view api bvid=${bvid} code=${plainJson.code}`)
        return null
    }
    const key = await loadWbiKey()
    const signed = await gmGet(`${VIEW_URL}?${signQuery(bvid, key)}`)
    return readStat(JSON.parse(signed.responseText || '{}'))
}

/** 按 BV 取播放、点赞、收藏。失败返回 null，调用方不据此藏卡。 */
export const fetchVideoStat = (bvid: string): Promise<VideoStat | null> => {
    const hit = cache.get(bvid)
    if (hit) {
        const ttl = hit.stat ? SUCCESS_TTL : FAIL_TTL
        if (Date.now() - hit.at < ttl) {
            return Promise.resolve(hit.stat)
        }
    }
    const running = pending.get(bvid)
    if (running) {
        return running
    }
    const task = requestStat(bvid)
        .then((stat) => {
            cache.set(bvid, { stat, at: Date.now() })
            return stat
        })
        .catch((err) => {
            logger.debug(`view api bvid=${bvid}`, err)
            cache.set(bvid, { stat: null, at: Date.now() })
            return null
        })
        .finally(() => {
            pending.delete(bvid)
        })
    pending.set(bvid, task)
    return task
}
