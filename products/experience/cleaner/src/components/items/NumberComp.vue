<template>
    <div class="my-1 flex items-center py-1 text-black">
        <div>
            <FeedbackBadge :code="feedbackCode" />
            {{ name }}
        </div>
        <input
            type="number"
            :step="step"
            v-model="currValue"
            @keydown.stop
            class="ml-auto block w-1/5 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm outline-hidden invalid:border-2 invalid:border-red-500 focus:border-gray-500 focus:invalid:border-red-500"
        />
        <div v-if="addonText" class="ml-2">{{ addonText }}</div>
    </div>
    <DescriptionComp class="pl-1" v-if="description?.length" :description="description"></DescriptionComp>
</template>

<script setup lang="ts">
import { INumberItem } from '@/types/item'
import { logger } from '@/utils/logger'
import { GM_setValue } from '@/storage/configStorage'
import { readItemValue } from '@/modules/configuration/effective'
import { watchThrottled } from '@vueuse/core'
import { ref } from 'vue'
import FeedbackBadge from '@/feedback/Badge.vue'
import { settingLabel } from '@/feedback'
import DescriptionComp from './DescriptionComp.vue'

const item = defineProps<INumberItem>()
const feedbackCode = settingLabel(item.id)

const currValue = ref(readItemValue(item))
let appliedValue = currValue.value

watchThrottled(
    currValue,
    (newValue) => {
        try {
            if (typeof newValue !== 'number' || !Number.isFinite(newValue)) return
            let value = newValue
            if (value !== item.disableValue) {
                value = Math.max(item.minValue, Math.min(item.maxValue, value))
                if (item.decimals != null) value = Number(value.toFixed(item.decimals))
            }
            if (value !== newValue) currValue.value = value
            if (value === appliedValue) return

            GM_setValue(item.id, value)
            appliedValue = value
            const disabled = value === item.disableValue
            if (!item.noStyle) document.documentElement.toggleAttribute(item.attrName ?? item.id, !disabled)
            if (!disabled || item.applyDisabledValue) {
                item.fn(value)?.catch((err) => logger.error(`NumberComp ${item.id} error`, err))
            }
        } catch (err) {
            logger.error(`NumberComp ${item.id} error`, err)
        }
    },
    { throttle: 250, trailing: true },
)
</script>
