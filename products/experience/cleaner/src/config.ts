import { GM_getValue } from '@/storage/configStorage'

export default {
    isDebugMode: GM_getValue('debug-mode') === true || import.meta.env.DEV,
    filterVisitSign: 'bili-cleaner-filtered', // 标记视频过滤器检测过的视频
    filterHideSign: 'bili-cleaner-hide', // 标记视频过滤器隐藏的视频
}
