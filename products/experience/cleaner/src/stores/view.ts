import {
    isPageBangumi,
    isPageChannel,
    isPageDynamic,
    isPageFestival,
    isPageHomepage,
    isPagePlaylist,
    isPagePopular,
    isPageSearch,
    isPageSpace,
    isPageVideo,
} from '@/utils/pageType'
import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 控制几种view的显示/隐藏状态
 */

export const useRulePanelStore = defineStore('RulePanel', () => {
    const isShow = ref(false)
    const show = () => {
        isShow.value = true
    }
    const hide = () => {
        isShow.value = false
    }
    const toggle = () => {
        isShow.value = !isShow.value
    }
    const isPageValid = () => true
    return { isShow, show, hide, toggle, isPageValid }
})

export const useConfigurationPanelStore = defineStore('ConfigurationPanel', () => {
    const isShow = ref(false)
    const openToken = ref(0)
    const show = () => { openToken.value++; isShow.value = true }
    const hide = () => { isShow.value = false }
    return { isShow, openToken, show, hide }
})

export const useVideoFilterPanelStore = defineStore('VideoFilterPanel', () => {
    const isShow = ref(false)
    const show = () => {
        isShow.value = true
    }
    const hide = () => {
        isShow.value = false
    }
    const toggle = () => {
        isShow.value = !isShow.value
    }
    const isPageValid = () => {
        return (
            isPageHomepage() ||
            isPageVideo() ||
            isPagePlaylist() ||
            isPagePopular() ||
            isPageChannel() ||
            isPageSearch() ||
            isPageSpace()
        )
    }
    return { isShow, show, hide, toggle, isPageValid }
})

export const useCommentFilterPanelStore = defineStore('CommentFilterPanel', () => {
    const isShow = ref(false)
    const show = () => {
        isShow.value = true
    }
    const hide = () => {
        isShow.value = false
    }
    const toggle = () => {
        isShow.value = !isShow.value
    }
    const isPageValid = () => {
        return (
            isPageVideo() || isPageBangumi() || isPageDynamic() || isPageSpace() || isPagePlaylist() || isPageFestival()
        )
    }
    return { isShow, show, hide, toggle, isPageValid }
})

export const useDynamicFilterPanelStore = defineStore('DynamicFilterPanel', () => {
    const isShow = ref(false)
    const show = () => {
        isShow.value = true
    }
    const hide = () => {
        isShow.value = false
    }
    const toggle = () => {
        isShow.value = !isShow.value
    }
    const isPageValid = () => {
        return isPageDynamic() || isPageSpace()
    }
    return { isShow, show, hide, toggle, isPageValid }
})

/**
 * Legacy floating-button visibility store. The localStorage key
 * `bili-cleaner-side-btn-show` is retained in the browser and is no longer
 * read or written here; page entry visibility comes from GM shortcut prefs.
 */
export const useSideBtnStore = defineStore('SideBtn', () => {
    const isShow = ref(false)
    const show = () => {
        isShow.value = true
    }
    const hide = () => {
        isShow.value = false
    }
    const toggle = () => {
        isShow.value = !isShow.value
    }
    return { isShow, show, hide, toggle }
})

export const useShortcutSettingsStore = defineStore('ShortcutSettings', () => {
    const isShow = ref(false)
    const openToken = ref(0)
    const show = () => {
        openToken.value += 1
        isShow.value = true
    }
    const hide = () => {
        isShow.value = false
    }
    return { isShow, openToken, show, hide }
})

export const useArticleFilterPanelStore = defineStore('ArticleFilterPanel', () => {
    const isShow = ref(false)
    const show = () => {
        isShow.value = true
    }
    const hide = () => {
        isShow.value = false
    }
    const toggle = () => {
        isShow.value = !isShow.value
    }
    const isPageValid = () => isPageSearch()
    return { isShow, show, hide, toggle, isPageValid }
})
