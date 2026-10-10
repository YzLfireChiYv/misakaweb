import { GM_registerMenuCommand } from '$'
import { withMenuId } from '@/feedback'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { loadModules } from './modules'
import { toggleDarkMode } from './modules/rules/common/groups/theme'
import {
    useArticleFilterPanelStore,
    useCommentFilterPanelStore,
    useDynamicFilterPanelStore,
    useRulePanelStore,
    useShortcutSettingsStore,
    useVideoFilterPanelStore,
} from './stores/view'
import css from './style.css?style'
import { waitForBody } from './utils/init'
import { logger } from '@/utils/logger'
import { isPageLive } from './utils/pageType'
import { migrate } from './utils/storage'

// 首页重定向，避免过滤视频失效
const redirect = () => {
    if (location.host === 'www.bilibili.com' && location.pathname === '/index.html') {
        window.location.replace('https://www.bilibili.com/')
    }
}

const main = () => {
    // 创建插件面板用shadowDOM节点
    const wrap = document.createElement('div')
    wrap.id = 'bili-cleaner'
    const root = wrap.attachShadow({ mode: 'open' })
    root.append(css)
    waitForBody().then(() => document.body.appendChild(wrap))

    // 创建插件面板
    const app = createApp(App as any)
    app.config.errorHandler = (err, vm, info) => {
        logger.error('Vue:', err)
        logger.error('Component:', vm)
        logger.error('Info:', info)
    }

    const pinia = createPinia()
    app.use(pinia)

    app.mount(
        (() => {
            const node = document.createElement('div')
            root.appendChild(node)
            return node
        })(),
    )
}

const menu = () => {
    // skip live page iframe
    if (isPageLive() && self !== top) {
        return
    }
    const ruleStore = useRulePanelStore()
    const videoStore = useVideoFilterPanelStore()
    const commentStore = useCommentFilterPanelStore()
    const dynamicStore = useDynamicFilterPanelStore()
    const articleStore = useArticleFilterPanelStore()
    const shortcutSettingsStore = useShortcutSettingsStore()

    GM_registerMenuCommand(withMenuId('menu-rule-panel', '✅ 页面净化优化'), () => {
        ruleStore.toggle()
    })
    if (videoStore.isPageValid()) {
        GM_registerMenuCommand(withMenuId('menu-video-filter', '✅ 视频过滤设置'), () => {
            videoStore.toggle()
        })
    } else {
        GM_registerMenuCommand(withMenuId('menu-video-filter', '🚫 视频过滤设置'), () => {
            alert('[bilibili-cleaner] 本页面不支持视频过滤')
        })
    }

    if (commentStore.isPageValid()) {
        GM_registerMenuCommand(withMenuId('menu-comment-filter', '✅ 评论过滤设置'), () => {
            commentStore.toggle()
        })
    } else {
        GM_registerMenuCommand(withMenuId('menu-comment-filter', '🚫 评论过滤设置'), () => {
            alert('[bilibili-cleaner] 本页面不支持评论过滤')
        })
    }
    if (dynamicStore.isPageValid()) {
        GM_registerMenuCommand(withMenuId('menu-dynamic-filter', '✅ 动态过滤设置'), () => {
            dynamicStore.toggle()
        })
    } else {
        GM_registerMenuCommand(withMenuId('menu-dynamic-filter', '🚫 动态过滤设置'), () => {
            alert('[bilibili-cleaner] 本页面不支持动态过滤')
        })
    }

    if (articleStore.isPageValid()) {
        GM_registerMenuCommand(withMenuId('menu-article-filter', '✅ 专栏过滤设置'), () => {
            articleStore.toggle()
        })
    } else {
        GM_registerMenuCommand(withMenuId('menu-article-filter', '🚫 专栏过滤设置'), () => {
            alert('[bilibili-cleaner] 本页面不支持专栏过滤')
        })
    }

    if (__PACK_APPEARANCE__) GM_registerMenuCommand(withMenuId('menu-dark-mode', '⚡ 夜间模式开关'), () => {
        toggleDarkMode()
    })
    GM_registerMenuCommand(withMenuId('menu-side-btn', '⚙ 快捷开关设置'), () => {
        shortcutSettingsStore.show()
    })
    GM_registerMenuCommand(withMenuId('menu-feedback', '💬 问题反馈'), () => {
        window.open('https://github.com/YzLfireChiYv/misakaweb/issues', '_blank')
    })
}

logger.info(`mode: ${import.meta.env.MODE}, url: ${location.href}`)

// 存储升级逻辑
await migrate().catch((err) => {
    logger.error('Storage key migration failed', err)
})

// 加载模块、主逻辑、菜单
for (const fn of [redirect, loadModules, main, menu]) {
    try {
        fn()
    } catch (err) {
        logger.error(`main.ts ${fn.name} error`, err)
    }
}
