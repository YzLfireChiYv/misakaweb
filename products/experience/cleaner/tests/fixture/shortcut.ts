import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ShortcutHarness from './ShortcutHarness.vue'
import './panel.css'
import { __gmStore } from '../gm-mock'
import { SHORTCUT_PREFERENCE_KEY } from '../../src/modules/shortcut/preference'

try {
    if (!localStorage.getItem('bili-cleaner-side-btn-pos')) {
        localStorage.setItem('bili-cleaner-side-btn-pos', JSON.stringify({ right: 10, bottom: 180 }))
    }
} catch {
    // ignore
}

const preset = sessionStorage.getItem('shortcut-preset')
if (preset) {
    try {
        __gmStore.set(SHORTCUT_PREFERENCE_KEY, JSON.parse(preset))
    } catch {
        __gmStore.set(SHORTCUT_PREFERENCE_KEY, preset)
    }
}

const app = createApp(ShortcutHarness)
app.use(createPinia())
app.mount('#app')

const searchBtn = document.getElementById('search-btn')
searchBtn?.addEventListener('click', () => {
    const el = document.getElementById('search-clicks')
    if (el) {
        el.textContent = String(Number(el.textContent || '0') + 1)
    }
})

const form = document.getElementById('nav-searchform')
form?.addEventListener('submit', (event) => {
    event.preventDefault()
    const el = document.getElementById('search-submits')
    if (el) {
        el.textContent = String(Number(el.textContent || '0') + 1)
    }
})
