import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import monkey, { cdn } from 'vite-plugin-monkey'
import tailwindcss from '@tailwindcss/vite'
import tailwindShadowDOM from 'vite-plugin-tailwind-shadowdom'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        tailwindcss(),
        tailwindShadowDOM(),
        vue(),
        monkey({
            entry: 'src/main.ts',
            userscript: {
                name: 'bilibili 页面净化大师 体验版',
                namespace: 'https://github.com/YzLfireChiYv/biliweb',
                version: '0.1.1',
                description:
                    'biliweb 体验版。视频过滤末级可按接口播放量、点赞数、收藏数藏卡。规则仓库可用 WebDAV 按时间戳双向覆盖。代码与更新来自 YzLfireChiYv/biliweb，页面净化基底来自 festoney8/bilibili-cleaner 4.5.13。',
                author: 'festoney8, biliweb',
                homepage: 'https://github.com/YzLfireChiYv/biliweb',
                supportURL: 'https://github.com/YzLfireChiYv/biliweb/issues',
                license: 'MIT',
                connect: ['*'],
                downloadURL:
                    'https://raw.githubusercontent.com/YzLfireChiYv/biliweb/main/products/experience/bilibili-cleaner-experience.user.js',
                updateURL:
                    'https://raw.githubusercontent.com/YzLfireChiYv/biliweb/main/products/experience/bilibili-cleaner-experience.user.js',
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
                externalGlobals: {
                    vue: cdn.npmmirror('Vue', 'dist/vue.global.prod.js'),
                },
            },
        }),
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
    css: {
        postcss: './postcss.config.js',
    },
})
