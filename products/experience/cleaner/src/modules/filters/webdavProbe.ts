export type WebdavProbe = 'ok' | 'auth' | 'missing' | 'fallback' | 'fail'

/** PROPFIND 是常见的连通性检查。对方不支持该方法时，再用 GET 看鉴权是否被接受。 */
export const classifyWebdavStatus = (status: number, method: 'PROPFIND' | 'GET'): WebdavProbe => {
    if (status === 200 || status === 204 || status === 207) {
        return 'ok'
    }
    if (status === 401 || status === 403) {
        return 'auth'
    }
    if (status === 404) {
        return method === 'GET' ? 'ok' : 'missing'
    }
    if (method === 'PROPFIND' && (status === 405 || status === 501)) {
        return 'fallback'
    }
    return 'fail'
}

export const webdavProbeText = (probe: Exclude<WebdavProbe, 'fallback'>, status?: number) => {
    if (probe === 'ok') {
        return '已连通'
    }
    if (probe === 'auth') {
        return '账号或密码不对'
    }
    if (probe === 'missing') {
        return '目录不存在'
    }
    return status ? `没有连上（${status}）` : '没有连上'
}
