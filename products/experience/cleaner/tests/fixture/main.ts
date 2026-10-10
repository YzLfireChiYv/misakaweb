import { createApp, h } from 'vue'
import SwitchComp from '../../src/components/items/SwitchComp.vue'
import NumberComp from '../../src/components/items/NumberComp.vue'
import EditorComp from '../../src/components/items/EditorComp.vue'
import WebdavComp from '../../src/components/items/WebdavComp.vue'
import FeedbackBadge from '../../src/feedback/Badge.vue'
import { actionLabel, settingLabel } from '../../src/feedback'

const App = {
    setup() {
        return () =>
            h('div', { class: 'space-y-3' }, [
                h('p', { id: 'fixture-flag' }, settingLabel('homepage-hide-banner') ? 'feedback-on' : 'feedback-off'),
                h(SwitchComp, {
                    type: 'switch',
                    id: 'homepage-hide-banner',
                    name: '隐藏 横幅banner',
                }),
                h(NumberComp, {
                    type: 'number',
                    id: 'biliweb-stat-like-min',
                    name: '最低点赞数',
                    minValue: 0,
                    maxValue: 99,
                    step: 1,
                    defaultValue: 0,
                    disableValue: -1,
                    fn: () => {},
                }),
                h(EditorComp, {
                    type: 'editor',
                    id: 'global-uploader-filter-value',
                    name: '编辑 UP主黑名单',
                    editorTitle: 'UP主黑名单',
                    saveFn: () => {},
                }),
                h(WebdavComp, {
                    type: 'webdav',
                    id: 'biliweb-sync-form',
                    name: 'WebDAV',
                    urlId: 'biliweb-sync-url',
                    userId: 'biliweb-sync-user',
                    passwordId: 'biliweb-sync-password',
                    onEdit: () => {},
                    verify: async () => '已连通',
                }),
                h(
                    'button',
                    {
                        type: 'button',
                        class: 'relative h-10 w-10 border',
                        id: 'side-sample',
                    },
                    [h(FeedbackBadge, { code: actionLabel('side-rule-panel'), compact: true }), '页面净化'],
                ),
            ])
    },
}

createApp(App).mount('#app')
