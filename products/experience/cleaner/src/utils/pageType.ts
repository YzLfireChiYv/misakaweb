const currPage = (): string => {
    const href = location.href
    const host = location.host
    const pathname = location.pathname
    if (href.startsWith('https://www.bilibili.com') && ['/index.html', '/'].includes(pathname)) {
        return 'homepage'
    }
    if (href.includes('bilibili.com/video/')) {
        return 'video'
    }
    if (href.includes('bilibili.com/v/popular/')) {
        return 'popular'
    }
    if (host === 'search.bilibili.com') {
        return 'search'
    }
    if (
        host === 't.bilibili.com' ||
        href.includes('bilibili.com/opus/') ||
        href.includes('bilibili.com/v/topic/detail')
    ) {
        return 'dynamic'
    }
    if (host === 'live.bilibili.com') {
        return 'live'
    }
    if (href.includes('bilibili.com/bangumi/play/')) {
        return 'bangumi'
    }
    if (href.includes('bilibili.com/list/')) {
        return 'playlist'
    }
    if (host === 'space.bilibili.com') {
        return 'space'
    }
    if (host === 'message.bilibili.com') {
        return 'message'
    }
    // 新版分区
    if (href.includes('bilibili.com/c/')) {
        return 'channel'
    }
    // 拜年祭等活动播放页
    if (/www\.bilibili\.com\/festival\//.test(href)) {
        return 'festival'
    }
    if (href.includes('bilibili.com/watchlater')) {
        return 'watchlater'
    }
    return ''
}

export const isPageHomepage = () => currPage() === 'homepage'
export const isPageVideo = () => currPage() === 'video'
export const isPagePopular = () => currPage() === 'popular'
export const isPageSearch = () => currPage() === 'search'
export const isPageDynamic = () => currPage() === 'dynamic'
export const isPageLive = () => currPage() === 'live'
export const isPageBangumi = () => currPage() === 'bangumi'
export const isPagePlaylist = () => currPage() === 'playlist'
export const isPageFestival = () => currPage() === 'festival'
export const isPageChannel = () => currPage() === 'channel'
export const isPageSpace = () => currPage() === 'space'
export const isPageWatchlater = () => currPage() === 'watchlater'
export const isPageMessage = () => currPage() === 'message'
