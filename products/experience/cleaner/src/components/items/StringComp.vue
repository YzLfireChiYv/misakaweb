<template>
    <div class="mt-1 mb-0.5 flex items-center py-1 text-black">
        <div>
            <FeedbackBadge :code="feedbackCode" />
            {{ name }}
        </div>
        <input
            :type="inputType || 'text'"
            v-model="currValue"
            @keydown.stop
            class="ml-4 block flex-1 rounded-md border border-gray-300 bg-white p-1.5 text-sm outline-hidden invalid:border-red-500 focus:border-gray-500 focus:invalid:border-red-500"
        />
    </div>
    <DescriptionComp v-if="description?.length" :description="description"></DescriptionComp>
</template>

<script setup lang="ts">
import { IStringItem } from '@/types/item'
import { logger } from '@/utils/logger'
import { GM_getValue, GM_setValue } from '@/storage/configStorage'
import { watchThrottled } from '@vueuse/core'
import { ref } from 'vue'
import FeedbackBadge from '@/feedback/Badge.vue'
import { settingLabel } from '@/feedback'
import DescriptionComp from './DescriptionComp.vue'

const item = defineProps<IStringItem>()
const feedbackCode = settingLabel(item.id)

const currValue = ref(GM_getValue(item.id, item.defaultValue))

watchThrottled(
    currValue,
    (newValue, oldValue) => {
        try {
            // 样式生效、失效
            if (oldValue === item.disableValue) {
                if (!item.noStyle) {
                    document.documentElement.setAttribute(item.attrName ?? item.id, '')
                }
            }
            if (newValue === item.disableValue) {
                if (!item.noStyle) {
                    document.documentElement.removeAttribute(item.attrName ?? item.id)
                }
            } else if (currValue.value !== oldValue) {
                item.fn(currValue.value)?.catch((err) => {
                    throw err
                })
            }
            GM_setValue(item.id, currValue.value)
        } catch (err) {
            logger.error(`StringComp ${item.id} error`, err)
        }
    },
    { throttle: 250, trailing: true },
)
</script>
