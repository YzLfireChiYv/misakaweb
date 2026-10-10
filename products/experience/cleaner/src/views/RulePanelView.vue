<template>
    <PanelComp
        v-bind="{ title: FEEDBACK_LABELS ? 'MisakaWeb · 净化与优化取舍' : 'bilibili 页面净化大师', widthPercent: FEEDBACK_LABELS ? 36 : 28, heightPercent: 85, minWidth: FEEDBACK_LABELS ? 440 : 360, minHeight: 600, closeAction: 'panel-close-rule' }"
        v-show="store.isShow"
        @close="store.hide"
    >
        <p class="mb-2 rounded border border-blue-200 bg-blue-50 p-2 text-sm text-gray-800" :data-build-profile="buildProfile">
            MisakaWeb · {{ buildLabel }} · {{ scriptVersion }}。净化与过滤全部保留；包含的优化仍可逐项开关。
        </p>
        <div v-if="review" class="mb-3 rounded-lg border border-blue-200 bg-blue-50 p-2 text-sm text-gray-800" data-review-toolbar>
            <p>净化全部保留。标记只记录取舍，不影响当前功能开关；未标记的优化仍待定。</p>
            <div class="my-2 flex flex-wrap gap-2" role="tablist" aria-label="功能类别">
                <button v-for="tab in tabs" :key="tab.key" type="button" role="tab" :aria-selected="category === tab.key"
                    class="rounded border px-2 py-1" :class="category === tab.key ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-400 bg-white'"
                    @click="selectCategory(tab.key)"><FeedbackBadge :code="actionLabel('review-category-' + tab.key)" />{{ tab.name }}（{{ counts[tab.key] }}）</button>
            </div>
            <div class="my-2 flex flex-wrap gap-2" aria-label="查看范围">
                <button type="button" :aria-pressed="scope === 'page'" class="rounded border border-gray-400 px-2 py-1" @click="scope = 'page'">
                    <FeedbackBadge :code="actionLabel('review-scope-page')" />当前页面
                </button>
                <button type="button" :aria-pressed="scope === 'all'" class="rounded border border-gray-400 px-2 py-1" @click="scope = 'all'">
                    <FeedbackBadge :code="actionLabel('review-scope-all')" />全站清单
                </button>
                <button type="button" class="rounded border border-blue-600 bg-white px-2 py-1 text-blue-800" :disabled="review.readOnly.value" @click="review.download">
                    <FeedbackBadge :code="actionLabel('review-export')" />导出取舍反馈
                </button>
            </div>
            <button type="button" class="mb-2 rounded border border-gray-400 bg-white px-2 py-1" @click="exportDiagnostic">
                <FeedbackBadge :code="actionLabel('maintenance-export-diagnostic')" />导出维护诊断
            </button>
            <p v-if="diagnosticError" role="alert" class="mb-2 text-red-700">{{ diagnosticError }}</p>
            <input v-model="query" type="search" aria-label="搜索功能名称或编号" placeholder="搜索名称、编号（如 S205）" @keydown.stop
                class="w-full rounded border border-gray-400 bg-white px-2 py-1" />
            <label v-if="category === 'optimization'" class="mt-2 block">
                <FeedbackBadge :code="actionLabel('review-pack-filter')" />优化功能组
                <select v-model="packFilter" aria-label="优化功能组" class="ml-2 rounded border border-gray-400 bg-white px-2 py-1" @keydown.stop>
                    <option value="">全部功能组</option>
                    <option v-for="pack in packOptions" :key="pack.id" :value="pack.id">{{ pack.label }}（{{ pack.count }}）</option>
                </select>
            </label>
            <label v-if="category === 'optimization'" class="mt-2 flex items-center gap-2"><input v-model="onlyMarked" type="checkbox" />只看已标记删除</label>
            <p class="mt-2">{{ scope === 'all' ? '全站清单用于集中取舍；切回当前页面可操作原功能设置。' : '这里保留原功能开关，可边测试效果边标记。' }}</p>
            <p class="mt-1">已标记删除 {{ markedCount }} 项；同一配置跨页面共用标记。</p>
            <p v-if="review.readOnly.value" role="alert" class="mt-2 text-red-700">标记格式无法读取，已停止写入，请使用支持该格式的版本。</p>
            <p v-if="review.error.value" role="alert" class="mt-2 text-red-700">{{ review.error.value }}</p>
        </div>
        <div v-if="review && scope === 'all'" data-review-catalog>
            <div v-for="entry in visibleEntries" :key="entry.key" class="mb-3 rounded border border-gray-200 p-2 text-sm text-gray-800">
                <div><FeedbackBadge :code="entry.id" />{{ entry.names.join(' / ') }}</div>
                <p v-if="entry.packLabel" class="mt-1 text-xs font-bold text-blue-700">功能组：{{ entry.packLabel }}</p>
                <p class="mt-1 text-xs text-gray-500">{{ entry.pages.map(pageName).join('、') }} · {{ entry.groups.join(' / ') }}</p>
                <OptimizationReviewRow :entry="entry" :store="review" />
            </div>
        </div>
        <template v-else>
        <div v-for="rule in displayedRules" :key="rule.name">
            <div v-for="group in rule.groups" :key="group.name">
                <DisclosureComp v-bind="{ title: group.name, isFold: group.fold, isSpecial: rule.isSpecial }">
                    <div v-for="item in group.items" :key="item.id">
                        <SwitchComp v-if="item.type === 'switch'" v-bind="item"></SwitchComp>
                        <NumberComp v-else-if="item.type === 'number'" v-bind="item"></NumberComp>
                        <StringComp v-else-if="item.type === 'string'" v-bind="item"></StringComp>
                        <WebdavComp v-else-if="item.type === 'webdav'" v-bind="item"></WebdavComp>
                        <EditorComp v-else-if="item.type === 'editor'" v-bind="item" @edit="handleEdit"></EditorComp>
                        <ListComp v-else-if="item.type === 'list'" v-bind="item"></ListComp>
                        <OptimizationReviewRow v-if="review && catalogByKey.has(item.id)" :entry="catalogByKey.get(item.id)!" :store="review" />
                    </div>
                </DisclosureComp>
            </div>
        </div>
        <DisclosureComp v-if="review && currentActionEntries.length" title="右键菜单（无独立设置开关）">
            <div v-for="entry in currentActionEntries" :key="entry.key" class="text-sm text-gray-800">
                <FeedbackBadge :code="entry.id" />{{ entry.names.join(' / ') }}
                <OptimizationReviewRow :entry="entry" :store="review" />
            </div>
        </DisclosureComp>
        </template>
        <p v-if="review && !visibleEntries.length" class="p-4 text-sm text-gray-600">当前类别或搜索没有匹配项。可切换全站清单或清空搜索。</p>
        <EditorDialog ref="editorDialogRef"></EditorDialog>
    </PanelComp>
</template>

<script setup lang="ts">
import DisclosureComp from '@/components/DisclosureComp.vue'
import EditorDialog from '@/components/EditorDialog.vue'
import EditorComp from '@/components/items/EditorComp.vue'
import ListComp from '@/components/items/ListComp.vue'
import NumberComp from '@/components/items/NumberComp.vue'
import StringComp from '@/components/items/StringComp.vue'
import SwitchComp from '@/components/items/SwitchComp.vue'
import WebdavComp from '@/components/items/WebdavComp.vue'
import PanelComp from '@/components/PanelComp.vue'
import { rules } from '@/modules/rules'
import { useRulePanelStore } from '@/stores/view'
import { IEditorItem } from '@/types/item'
import { computed, ref } from 'vue'
import { FEEDBACK_LABELS, actionLabel } from '@/feedback'
import FeedbackBadge from '@/feedback/Badge.vue'
import OptimizationReviewRow from '@/feedback/OptimizationReviewRow.vue'
import { useReviewStore, categoryFor } from '@/feedback/review-store'
import { reviewCatalog } from '@review-catalog'
import type { ReviewCategory, ReviewEntry } from '@/feedback/review-types'
import { downloadMaintenanceDiagnostic } from '@/modules/maintenance/diagnostics'

const store = useRulePanelStore()
const buildProfile = __BUILD_PROFILE__
const buildLabel = __BUILD_LABEL__
const scriptVersion = __SCRIPT_VERSION__
const editorDialogRef = ref<InstanceType<typeof EditorDialog> | null>(null)

const handleEdit = (item: IEditorItem) => {
    editorDialogRef.value?.openEditor(item)
}

// Ordinary build never opens review storage/listeners; its catalog alias is empty.
const review = FEEDBACK_LABELS ? useReviewStore() : null
const category = ref<ReviewCategory>('cleaning')
const scope = ref<'page' | 'all'>('page')
const query = ref('')
const onlyMarked = ref(false)
const diagnosticError = ref('')
const exportDiagnostic = () => {
    diagnosticError.value = ''
    try { downloadMaintenanceDiagnostic() }
    catch { diagnosticError.value = '诊断导出失败，请重试。不会导出设置、名单或账号数据。' }
}
const packFilter = ref('')
const tabs: { key: ReviewCategory; name: string }[] = [
    { key: 'cleaning', name: '净化' }, { key: 'optimization', name: '优化' }, { key: 'support', name: '公共设置' },
]
const catalogByKey = new Map(reviewCatalog.map(entry => [entry.key, entry]))
const activeRules = computed(() => rules.filter(rule => rule.checkFn()))
const activeKeys = computed(() => new Set(activeRules.value.flatMap(rule => rule.groups.flatMap(group => group.items.map(item => item.id)))))
const activePages = computed(() => new Set(activeRules.value.map(rule => rule.name)))
const inScope = (entry: ReviewEntry) => scope.value === 'all' || activeKeys.value.has(entry.key) ||
    (entry.id.startsWith('B') && entry.pages.some(page => activePages.value.has(page)))
const matches = (entry: ReviewEntry) => [entry.id, entry.key, entry.packLabel ?? '', ...entry.names, ...entry.groups].join(' ').toLowerCase().includes(query.value.trim().toLowerCase())
const selected = (entry: ReviewEntry) => review && categoryFor(entry, review.state.value) === category.value && matches(entry) &&
    (category.value !== 'optimization' || !packFilter.value || (entry.pack ?? 'classification-overrides') === packFilter.value) &&
    (!onlyMarked.value || Boolean(review.state.value.decisions[entry.key]?.remove))
const visibleEntries = computed(() => reviewCatalog.filter(entry => inScope(entry) && selected(entry)))
const counts = computed(() => {
    const result = { cleaning: 0, optimization: 0, support: 0 }
    if (review) for (const entry of reviewCatalog) if (inScope(entry)) result[categoryFor(entry, review.state.value)]++
    return result
})
const markedCount = computed(() => review ? Object.values(review.state.value.decisions).filter(d => d.remove).length : 0)
const displayedRules = computed(() => !review ? activeRules.value : activeRules.value.map(rule => ({
    ...rule, groups: rule.groups.map(group => ({ ...group, items: group.items.filter(item => {
        const entry = catalogByKey.get(item.id)
        return entry ? selected(entry) : category.value === 'support'
    }) })).filter(group => group.items.length),
})).filter(rule => rule.groups.length))
const currentActionEntries = computed(() => visibleEntries.value.filter(entry => entry.id.startsWith('B')))
const packOptions = computed(() => {
    const options = new Map<string, { id: string; label: string; count: number }>()
    if (review) for (const entry of reviewCatalog) {
        if (!inScope(entry) || categoryFor(entry, review.state.value) !== 'optimization') continue
        const id = entry.pack ?? 'classification-overrides'
        const item = options.get(id) ?? { id, label: entry.packLabel ?? '用户改归优化', count: 0 }
        item.count++
        options.set(id, item)
    }
    return [...options.values()]
})
const selectCategory = (next: ReviewCategory) => { category.value = next; onlyMarked.value = false; packFilter.value = '' }
const pageNames: Record<string, string> = { homepage: '首页', video: '视频页', playlist: '播放列表', bangumi: '番剧页', live: '直播', dynamic: '动态', space: '用户空间', popular: '热门', channel: '分区', search: '搜索', watchlater: '稍后再看', common: '全站', comment: '评论区', debug: '全站调试', festival: '活动页' }
const pageName = (key: string) => pageNames[key] ?? key
</script>
