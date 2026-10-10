<template>
    <div id="panel-harness">
        <p id="panel-open">{{ ruleStore.isShow ? 'open' : 'closed' }}</p>
        <p id="close-count">{{ closeCount }}</p>
        <button id="open-panel" type="button" @click="ruleStore.show()">open</button>
        <button id="hide-panel" type="button" @click="ruleStore.hide()">hide</button>
        <button id="toggle-panel" type="button" @click="ruleStore.toggle()">toggle-m06-like</button>
        <PanelComp
            v-show="ruleStore.isShow"
            v-bind="{
                title: 'bilibili 页面净化大师',
                widthPercent: 28,
                heightPercent: 85,
                minWidth: 360,
                minHeight: 600,
                closeAction: 'panel-close-rule',
            }"
            @close="onClose"
        >
            <div id="panel-body">settings body</div>
        </PanelComp>
        <SideBtnView />
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import PanelComp from '../../src/components/PanelComp.vue'
import SideBtnView from '../../src/views/SideBtnView.vue'
import { useRulePanelStore, useSideBtnStore } from '../../src/stores/view'

const ruleStore = useRulePanelStore()
const sideBtnStore = useSideBtnStore()
const closeCount = ref(0)

const onClose = () => {
    closeCount.value += 1
    ruleStore.hide()
}

onMounted(() => {
    sideBtnStore.show()
})
</script>
