import { isDarkMode, toggleDarkMode } from '@/modules/rules/common/groups/theme'
import {
    useCommentFilterPanelStore,
    useDynamicFilterPanelStore,
    useRulePanelStore,
    useConfigurationPanelStore,
    useShortcutSettingsStore,
    useVideoFilterPanelStore,
} from '@/stores/view'
import { toRef, type Ref } from 'vue'

export type QuickAction = {
    text: string
    defaultHidden: boolean
    isValid: boolean
    actionKey: string
    run: () => void
}

/** Shared page-entry actions for the header dropdown and the floating stack. */
export const useQuickActions = (): Readonly<Ref<QuickAction[]>> => {
    const ruleStore = useRulePanelStore()
    const configurationStore = useConfigurationPanelStore()
    const videoStore = useVideoFilterPanelStore()
    const commentStore = useCommentFilterPanelStore()
    const dynamicStore = useDynamicFilterPanelStore()
    const shortcutStore = useShortcutSettingsStore()

    // Read the current page on each menu opening, including SPA navigation.
    return toRef(() => [
        ...(__PACK_APPEARANCE__ ? [{
            text: isDarkMode.value ? '日间模式' : '夜间模式',
            defaultHidden: true,
            isValid: true,
            actionKey: 'side-dark-mode',
            run: () => toggleDarkMode(),
        }] : []),
        {
            text: '动态过滤',
            defaultHidden: true,
            isValid: dynamicStore.isPageValid(),
            actionKey: 'side-dynamic-filter',
            run: () => dynamicStore.toggle(),
        },
        {
            text: '评论过滤',
            defaultHidden: true,
            isValid: commentStore.isPageValid(),
            actionKey: 'side-comment-filter',
            run: () => commentStore.toggle(),
        },
        {
            text: '视频过滤',
            defaultHidden: true,
            isValid: videoStore.isPageValid(),
            actionKey: 'side-video-filter',
            run: () => videoStore.toggle(),
        },
        {
            text: '快捷设置',
            defaultHidden: true,
            isValid: true,
            actionKey: 'side-shortcut-settings',
            run: () => shortcutStore.show(),
        },
        {
            text: '备份恢复',
            defaultHidden: true,
            isValid: true,
            actionKey: 'side-configuration',
            run: () => configurationStore.show(),
        },
        {
            text: '页面净化',
            defaultHidden: false,
            isValid: ruleStore.isPageValid(),
            actionKey: 'side-rule-panel',
            run: () => ruleStore.toggle(),
        },
    ])
}
