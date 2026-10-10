import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PanelHarness from './PanelHarness.vue'
import './panel.css'
import { __gmStore } from '../gm-mock'
import { SHORTCUT_PREFERENCE_KEY } from '../../src/modules/shortcut/preference'

try {
    localStorage.setItem('bili-cleaner-side-btn-show', 'true')
    if (!localStorage.getItem('bili-cleaner-side-btn-pos')) {
        localStorage.setItem('bili-cleaner-side-btn-pos', JSON.stringify({ right: 10, bottom: 180 }))
    }
} catch {
    // ignore
}

__gmStore.set(SHORTCUT_PREFERENCE_KEY, { enabled: true, location: 'floating' })

const app = createApp(PanelHarness)
app.use(createPinia())
app.mount('#app')
