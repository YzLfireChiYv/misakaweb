<template>
    <div class="text-base">
        <RulePanelView></RulePanelView>
        <VideoFilterPanelView></VideoFilterPanelView>
        <CommentFilterPanelView></CommentFilterPanelView>
        <DynamicFilterPanelView></DynamicFilterPanelView>
        <ContextMenuView></ContextMenuView>
        <SideBtnView></SideBtnView>
        <HeaderShortcutView></HeaderShortcutView>
        <ShortcutSettingsPanelView></ShortcutSettingsPanelView>
        <ArticleFilterPanelView></ArticleFilterPanelView>
    </div>
</template>
<script setup lang="ts">
import CommentFilterPanelView from './views/CommentFilterPanelView.vue'
import ContextMenuView from './views/ContextMenuView.vue'
import DynamicFilterPanelView from './views/DynamicFilterPanelView.vue'
import RulePanelView from './views/RulePanelView.vue'
import ArticleFilterPanelView from './views/ArticleFilterPanelView.vue'
import HeaderShortcutView from './views/HeaderShortcutView.vue'
import ShortcutSettingsPanelView from './views/ShortcutSettingsPanelView.vue'
import SideBtnView from './views/SideBtnView.vue'
import VideoFilterPanelView from './views/VideoFilterPanelView.vue'
</script>
