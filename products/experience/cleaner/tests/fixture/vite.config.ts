import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

const labels = process.env.FIXTURE_LABELS !== 'off'

export default defineConfig({
    plugins: [vue(), tailwindcss()],
    root: fileURLToPath(new URL('.', import.meta.url)),
    define: {
        'import.meta.env.VITE_FEEDBACK_LABELS': JSON.stringify(labels ? 'true' : ''),
    },
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('../../src', import.meta.url)),
            '@feedback-index': fileURLToPath(
                new URL(
                    labels ? '../../src/feedback/id-index.generated.ts' : '../../src/feedback/id-index.empty.ts',
                    import.meta.url,
                ),
            ),
            $: fileURLToPath(new URL('../gm-mock.ts', import.meta.url)),
            'vite-plugin-monkey/dist/client': fileURLToPath(new URL('../gm-mock.ts', import.meta.url)),
        },
    },
    server: {
        host: '127.0.0.1',
        port: 4177,
        strictPort: true,
    },
})
