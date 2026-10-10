import vue from '@vitejs/plugin-vue'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import monkey, { cdn } from 'vite-plugin-monkey'
import tailwindcss from '@tailwindcss/vite'
import tailwindShadowDOM from 'vite-plugin-tailwind-shadowdom'

const release = JSON.parse(fs.readFileSync(new URL('./config/release.json', import.meta.url), 'utf8'))

const copyFeedbackArtifact = () => ({
    name: 'copy-feedback-artifact',
    closeBundle() {
        const from = path.resolve('dist/misakaweb-feedback-test.user.js')
        const to = path.resolve('../misakaweb-feedback-test.user.js')
        if (fs.existsSync(from)) {
            fs.copyFileSync(from, to)
        }
    },
})

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    const isFeedback = mode === 'feedback-test'
    const channel = isFeedback ? release.development : release.legacy
    const feedbackIndex = isFeedback
        ? fileURLToPath(new URL('./src/feedback/id-index.generated.ts', import.meta.url))
        : fileURLToPath(new URL('./src/feedback/id-index.empty.ts', import.meta.url))

    return {
        define: { __SCRIPT_VERSION__: JSON.stringify(channel.version) },
        plugins: [
            tailwindcss(),
            tailwindShadowDOM(),
            vue(),
            monkey({
                entry: 'src/main.ts',
                userscript: {
                    name: 'MisakaWeb',
                    namespace: 'https://github.com/YzLfireChiYv/misakaweb',
                    version: channel.version,
                    description: isFeedback
                        ? '大量借用社区上游项目。反馈测试编号版，开发分组。'
                        : '大量借用社区上游项目。',
                    author: 'festoney8, MisakaWeb',
                    homepage: 'https://github.com/YzLfireChiYv/misakaweb',
                    supportURL: 'https://github.com/YzLfireChiYv/misakaweb/issues',
                    license: 'MIT',
                    connect: ['*'],
                    downloadURL: channel.url,
                    updateURL: channel.url,
                    match: ['*://*.bilibili.com/*'],
                    exclude: [
                        '*://message.bilibili.com/pages/nav/header_sync',
                        '*://message.bilibili.com/pages/nav/index_new_pc_sync',
                        '*://data.bilibili.com/*',
                        '*://cm.bilibili.com/*',
                        '*://shop.bilibili.com/*',
                        '*://link.bilibili.com/*',
                        '*://passport.bilibili.com/*',
                        '*://api.bilibili.com/*',
                        '*://api.*.bilibili.com/*',
                        '*://*.chat.bilibili.com/*',
                        '*://member.bilibili.com/*',
                        '*://www.bilibili.com/tensou/*',
                        '*://www.bilibili.com/correspond/*',
                        '*://live.bilibili.com/p/html/*',
                        '*://live.bilibili.com/live-room-play-game-together',
                        '*://www.bilibili.com/blackboard/comment-detail.html*',
                        '*://www.bilibili.com/blackboard/newplayer.html*',
                        '*://www.bilibili.com/appeal/*',
                        '*://www.bilibili.com/toy/*',
                        '*://www.bilibili.com/btoy/*',
                    ],
                    icon: 'https://www.bilibili.com/favicon.ico',
                    'run-at': 'document-start',
                },
                build: {
                    fileName: isFeedback ? 'misakaweb-feedback-test.user.js' : 'misakaweb.user.js',
                    externalGlobals: {
                        vue: cdn.npmmirror('Vue', 'dist/vue.global.prod.js'),
                    },
                },
            }),
            ...(isFeedback ? [copyFeedbackArtifact()] : []),
        ],
        resolve: {
            alias: {
                '@': fileURLToPath(new URL('./src', import.meta.url)),
                '@feedback-index': feedbackIndex,
                '@review-catalog': fileURLToPath(new URL(isFeedback ? './src/feedback/review-catalog.generated.ts' : './src/feedback/review-catalog.empty.ts', import.meta.url)),
            },
        },
        css: {
            postcss: './postcss.config.js',
        },
    }
})
