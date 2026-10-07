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
                name: 'MisakaWeb',
                namespace: 'https://github.com/YzLfireChiYv/misakaweb',
                version: '0.1.4',
                description: '大量借用社区上游项目。',
                author: 'festoney8, MisakaWeb',
                homepage: 'https://github.com/YzLfireChiYv/misakaweb',
                supportURL: 'https://github.com/YzLfireChiYv/misakaweb/issues',
                license: 'MIT',
                connect: ['*'],
                downloadURL:
                    'https://raw.githubusercontent.com/YzLfireChiYv/misakaweb/main/products/experience/misakaweb.user.js',
                updateURL:
                    'https://raw.githubusercontent.com/YzLfireChiYv/misakaweb/main/products/experience/misakaweb.user.js',
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
