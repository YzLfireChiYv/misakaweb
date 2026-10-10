/** Stable action keys for dynamic context menus. Match on the template, never on the live username/bvid. */
const RULES: { prefix?: string; exact?: string; key: string }[] = [
    { prefix: '屏蔽UP主：', key: 'ctx-block-uploader' },
    { exact: '将UP主加入白名单', key: 'ctx-whitelist-uploader' },
    { exact: '复制主页链接', key: 'ctx-copy-space-url' },
    { prefix: '屏蔽视频 ', key: 'ctx-block-bvid' },
    { exact: '复制视频链接', key: 'ctx-copy-video-url' },
    { prefix: '屏蔽用户：', key: 'ctx-block-comment-user' },
    { prefix: '隐藏用户动态：', key: 'ctx-hide-dyn-uploader' },
    { prefix: '屏蔽专栏作者：', key: 'ctx-block-article-author' },
    { exact: '将专栏作者加入白名单', key: 'ctx-whitelist-article-author' },
]

export const contextActionKey = (name: string): string => {
    for (const rule of RULES) {
        if (rule.exact && name === rule.exact) {
            return rule.key
        }
        if (rule.prefix && name.startsWith(rule.prefix)) {
            return rule.key
        }
    }
    return ''
}
