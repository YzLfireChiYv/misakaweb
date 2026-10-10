import { GM_getValue } from '@/storage/configStorage'
import type { Item } from '@/types/item'
import { TouchGestureController } from './controller'
import { clamp } from './gesture-math'

function numericSetting(id: string, fallback: number, min: number, max: number) {
    const value = GM_getValue<number>(id, fallback)
    return typeof value === 'number' && Number.isFinite(value) ? clamp(value || fallback, min, max) : fallback
}

const controller = new TouchGestureController(() => ({
    minDistance: numericSetting('misakaweb-gesture-min-distance', 10, 4, 40),
    seekScale: numericSetting('misakaweb-gesture-seek-scale', 1, 0.1, 3),
    vertical: GM_getValue<boolean>('misakaweb-gesture-vertical', false) === true,
}))

export const touchItems: Item[] = [
    {
        type: 'switch',
        id: 'misakaweb-player-gestures',
        name: '播放器触摸手势',
        description: [
            '普通视频页：左右滑动预览进度，松开跳转，多指触摸取消',
            '从画面上、中、下部开始，分别使用精细、中速、快速调节；不额外请求视频数据',
            '来自 Evolved 手势逻辑，使用 MisakaWeb 设置和提示；平板请使用桌面网站模式',
        ],
        defaultEnable: false,
        noStyle: true,
        enableFnRunAt: 'document-end',
        enableFn: () => controller.enable(),
        disableFn: () => controller.disable(),
    },
    {
        type: 'number',
        id: 'misakaweb-gesture-min-distance',
        name: '触摸手势最小滑动距离',
        minValue: 4,
        maxValue: 40,
        step: 1,
        defaultValue: 10,
        disableValue: 0,
        addonText: '像素',
        noStyle: true,
        fn: () => {},
    },
    {
        type: 'number',
        id: 'misakaweb-gesture-seek-scale',
        name: '触摸进度调节倍率',
        minValue: 0.1,
        maxValue: 3,
        step: 0.1,
        decimals: 1,
        defaultValue: 1,
        disableValue: 0,
        noStyle: true,
        fn: () => {},
    },
    {
        type: 'switch',
        id: 'misakaweb-gesture-vertical',
        name: '触摸上下滑动调节亮度和音量',
        description: [
            '需要先开启播放器触摸手势；画面左侧调亮度，右侧调音量，松开应用',
            '调节视频画面亮度，不是设备屏幕亮度；部分平板浏览器限制音量控制',
        ],
        defaultEnable: false,
        noStyle: true,
    },
]
