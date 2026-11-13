import { readFileSync } from 'node:fs'

const { decisions } = JSON.parse(readFileSync(new URL('../catalog/default-decisions.json', import.meta.url), 'utf8'))

// Only confirmed values enter the bundle. Evidence and historical presets stay in the catalog.
export const productDefaults = Object.fromEntries(
    decisions
        .filter(({ status }) => status === 'confirmed')
        .map(({ key, field, value }) => [field ? `${key}.${field}` : key, value]),
)
