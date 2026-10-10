const store = new Map<string, unknown>()
const listeners = new Map<number, { key: string; fn: (...args: unknown[]) => void }>()
let nextListener = 1

export const GM_getValue = (key: string, defaultValue?: unknown) => (store.has(key) ? store.get(key) : defaultValue)

export const GM_setValue = (key: string, value: unknown) => {
    const oldValue = store.has(key) ? store.get(key) : undefined
    store.set(key, value)
    for (const entry of listeners.values()) {
        if (entry.key === key) {
            entry.fn(key, oldValue, value, false)
        }
    }
}

export const GM_deleteValue = (key: string) => {
    store.delete(key)
}

export const GM_listValues = () => [...store.keys()]

export const GM_registerMenuCommand = () => 0

export const GM_addValueChangeListener = (key: string, fn: (...args: unknown[]) => void) => {
    const id = nextListener++
    listeners.set(id, { key, fn })
    return id
}

export const GM_removeValueChangeListener = (id: number) => {
    listeners.delete(id)
}

export const GM_xmlhttpRequest = () => ({ abort() {} })

export const __gmStore = store

export const __gmReset = () => {
    store.clear()
    listeners.clear()
}

export const monkeyWindow = globalThis as typeof globalThis & { [key: string]: unknown }
