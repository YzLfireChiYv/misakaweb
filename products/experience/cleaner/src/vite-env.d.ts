/// <reference types="vite/client" />
/// <reference types="vite-plugin-monkey/client" />
/// <reference types="vite-plugin-monkey/style" />
//// <reference types="vite-plugin-monkey/global" />

declare const __SCRIPT_VERSION__: string
declare const __PACK_APPEARANCE__: boolean
declare const __PACK_PLAYBACK__: boolean
declare const __PACK_LINKS__: boolean
declare const __BUILD_PROFILE__: string
declare const __BUILD_LABEL__: string

declare module '*.vue' {
    import type { DefineComponent } from 'vue'
    const component: DefineComponent<{}, {}, any>
    export default component
}

interface ImportMetaEnv {
    readonly VITE_FEEDBACK_LABELS?: string
}

declare module '@feedback-index' {
    export const settingsByKey: Record<string, string>
    export const menusByKey: Record<string, string>
    export const actionsByKey: Record<string, string>
}
