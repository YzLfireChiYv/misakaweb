<template>
    <div class="py-1 text-black">
        <div v-if="formCode" class="mb-1">
            <FeedbackBadge :code="formCode" />
        </div>
        <div
            class="grid items-center gap-x-3 gap-y-2"
            :class="formCode ? 'grid-cols-[auto_minmax(0,1fr)]' : 'grid-cols-[4.5rem_minmax(0,1fr)]'"
        >
            <div class="text-right whitespace-nowrap">
                <FeedbackBadge :code="urlCode" />
                链接
            </div>
            <input
                v-model="url"
                type="url"
                autocomplete="url"
                spellcheck="false"
                placeholder="https://example.com/dav/目录/"
                @keydown.stop
                class="block w-full min-w-0 rounded-md border border-gray-300 bg-white p-1.5 text-sm outline-hidden focus:border-gray-500"
            />
            <div class="text-right whitespace-nowrap">
                <FeedbackBadge :code="userCode" />
                账号
            </div>
            <input
                v-model="user"
                type="text"
                autocomplete="username"
                @keydown.stop
                class="block w-full min-w-0 rounded-md border border-gray-300 bg-white p-1.5 text-sm outline-hidden focus:border-gray-500"
            />
            <div class="text-right whitespace-nowrap">
                <FeedbackBadge :code="passwordCode" />
                密码
            </div>
            <input
                v-model="password"
                type="password"
                autocomplete="current-password"
                @keydown.stop
                class="block w-full min-w-0 rounded-md border border-gray-300 bg-white p-1.5 text-sm outline-hidden focus:border-gray-500"
            />
            <div></div>
            <div class="flex min-w-0 items-center gap-2">
                <button
                    type="button"
                    class="inline-flex shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-blue-900 outline-hidden disabled:opacity-50"
                    :disabled="busy"
                    @click="onVerify"
                >
                    <FeedbackBadge :code="verifyCode" />
                    {{ busy ? '验证中' : '验证' }}
                </button>
                <span class="min-w-0 text-sm" :class="statusClass">{{ status }}</span>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { IWebdavItem } from '@/types/item'
import { logger } from '@/utils/logger'
import { GM_getValue, GM_setValue } from '@/storage/configStorage'
import { watchThrottled } from '@vueuse/core'
import { computed, ref } from 'vue'
import FeedbackBadge from '@/feedback/Badge.vue'
import { actionLabel, settingLabel } from '@/feedback'

const item = defineProps<IWebdavItem>()
const formCode = settingLabel(item.id)
const urlCode = settingLabel(item.urlId)
const userCode = settingLabel(item.userId)
const passwordCode = settingLabel(item.passwordId)
const verifyCode = actionLabel('webdav-verify')

const readText = (key: string) => {
    const value = GM_getValue(key, '')
    return typeof value === 'string' ? value : ''
}

const url = ref(readText(item.urlId))
const user = ref(readText(item.userId))
const password = ref(readText(item.passwordId))
const status = ref('')
const busy = ref(false)

const statusClass = computed(() => {
    if (status.value === '已连通') {
        return 'text-green-700'
    }
    if (!status.value || status.value === '正在验证') {
        return 'text-gray-600'
    }
    return 'text-orange-900'
})

const save = () => {
    GM_setValue(item.urlId, url.value)
    GM_setValue(item.userId, user.value)
    GM_setValue(item.passwordId, password.value)
}

watchThrottled(
    () => `${url.value}\n${user.value}\n${password.value}`,
    () => {
        try {
            save()
            item.onEdit()
        } catch (err) {
            logger.error(`WebdavComp ${item.id} error`, err)
        }
    },
    { throttle: 250, trailing: true },
)

const onVerify = async () => {
    const nextUrl = url.value.trim()
    const nextUser = user.value.trim()
    url.value = nextUrl
    user.value = nextUser
    save()
    busy.value = true
    status.value = '正在验证'
    try {
        status.value = await item.verify(nextUrl, nextUser, password.value)
    } catch (err) {
        logger.error(`WebdavComp ${item.id} verify error`, err)
        status.value = '没有连上'
    } finally {
        busy.value = false
    }
}
</script>
