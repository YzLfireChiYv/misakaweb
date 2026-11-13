import { unsafeWindow } from '$'
import { logger } from '@/utils/logger'

class FetchHook {
    private installed?: { original: typeof fetch; wrapped: typeof fetch }

    // 根据input和init对input进行预处理
    private preFnArr: ((input: RequestInfo | URL, init: RequestInit | undefined) => RequestInfo | URL)[] = []
    // 根据input,init,resp做返回resp前的后处理, 如克隆resp
    private postFnArr: ((
        input: RequestInfo | URL,
        init: RequestInit | undefined,
        resp?: Response,
    ) => Response | void | Promise<Response | void>)[] = []

    private ensureInstalled() {
        if (this.installed) return
        try {
            this.installed = this.hook()
        } catch (err) {
            logger.error('hook fetch error', err)
        }
    }

    private restoreIfIdle() {
        if (this.preFnArr.length || this.postFnArr.length || !this.installed) return
        const { original, wrapped } = this.installed
        // Another script may have wrapped ours since installation.
        if (unsafeWindow.fetch !== wrapped) return
        unsafeWindow.fetch = original
        this.installed = undefined
    }

    addPreFn(fn: (input: RequestInfo | URL, init: RequestInit | undefined) => RequestInfo | URL) {
        this.ensureInstalled()
        this.preFnArr.push(fn)
        return () => {
            this.preFnArr = this.preFnArr.filter((entry) => entry !== fn)
            this.restoreIfIdle()
        }
    }

    addPostFn(
        fn: (
            input: RequestInfo | URL,
            init: RequestInit | undefined,
            resp?: Response,
        ) => Response | void | Promise<Response | void>,
    ) {
        this.ensureInstalled()
        this.postFnArr.push(fn)
        return () => {
            this.postFnArr = this.postFnArr.filter((entry) => entry !== fn)
            this.restoreIfIdle()
        }
    }

    private hook() {
        const origFetch = unsafeWindow.fetch
        const wrapped: typeof fetch = async (input, init?) => {
            try {
                // 预处理
                this.preFnArr.forEach((fn) => {
                    input = fn(input, init)
                })
            } catch {
                return origFetch.call(unsafeWindow, input, init)
            }
            // 获取resp
            let resp = await origFetch.call(unsafeWindow, input, init)
            if (this.postFnArr.length === 0) return resp
            const origResp = resp
            try {
                // 后处理
                for (const fn of this.postFnArr) {
                    const ans = await fn(input, init, resp)
                    if (ans) {
                        resp = ans
                    }
                }
            } catch (err) {
                logger.error('fetch hook postFnArr', err)
                return origResp
            }
            return resp
        }
        unsafeWindow.fetch = wrapped
        return { original: origFetch, wrapped }
    }
}

const fetchHook = new FetchHook()
export default fetchHook
