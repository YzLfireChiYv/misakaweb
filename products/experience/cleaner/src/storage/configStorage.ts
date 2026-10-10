/** Single boundary for persisted product settings/rules. Existing GM keys remain
 * unchanged; future sync journals and migrations attach here, not in page code.
 * Transient DOM state and API caches are not configuration merely because saved.
 */
import {
    GM_getValue as rawGet,
    GM_setValue as rawSet,
    GM_deleteValue as rawDelete,
    GM_listValues as rawList,
    GM_addValueChangeListener as rawListen,
    GM_removeValueChangeListener as rawUnlisten,
} from '$'

// Preserve the manager API's generic overloads and synchronous behavior.
export const GM_getValue: typeof rawGet = (...args: any[]) => (rawGet as any)(...args)
export const GM_setValue: typeof rawSet = (...args: any[]) => (rawSet as any)(...args)
export const GM_deleteValue: typeof rawDelete = (...args: any[]) => (rawDelete as any)(...args)
export const GM_listValues: typeof rawList = () => rawList()
export const GM_addValueChangeListener: typeof rawListen = (...args: any[]) => (rawListen as any)(...args)
export const GM_removeValueChangeListener: typeof rawUnlisten = (...args: any[]) => (rawUnlisten as any)(...args)
export type { GmValueListenerId } from 'vite-plugin-monkey/dist/client'

/** Device-only browser settings share an access boundary, but never join the
 * user-rule sync scope. Lazy access keeps imports independent of page storage.
 */
export const deviceStorage = {
    getItem: (key: string) => window.localStorage.getItem(key),
    setItem: (key: string, value: string) => window.localStorage.setItem(key, value),
    removeItem: (key: string) => window.localStorage.removeItem(key),
}
