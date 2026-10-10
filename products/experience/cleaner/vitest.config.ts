import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import { readFileSync } from 'node:fs'
import { classificationFor } from './scripts/pack-build.mjs'

const release = JSON.parse(readFileSync(new URL('./config/release.json', import.meta.url), 'utf8'))

export default defineConfig({
    plugins: [vue()],
    define: {
        'import.meta.env.VITE_FEEDBACK_LABELS': JSON.stringify('true'),
        __SCRIPT_VERSION__: JSON.stringify(release.development.version),
        __PACK_APPEARANCE__: true,
        __PACK_PLAYBACK__: true,
        __PACK_LINKS__: true,
        __BUILD_PROFILE__: JSON.stringify('development'),
        __BUILD_LABEL__: JSON.stringify('开发测试版（完整能力）'),
        __SETTING_SECTIONS__: JSON.stringify(classificationFor(null)),
    },
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
            '@feedback-index': fileURLToPath(new URL('./src/feedback/id-index.generated.ts', import.meta.url)),
            '@review-catalog': fileURLToPath(new URL('./src/feedback/review-catalog.generated.ts', import.meta.url)),
            $: fileURLToPath(new URL('./tests/gm-mock.ts', import.meta.url)),
            'vite-plugin-monkey/dist/client': fileURLToPath(new URL('./tests/gm-mock.ts', import.meta.url)),
        },
    },
    test: {
        environment: 'jsdom',
        include: ['tests/**/*.test.ts'],
    },
})
