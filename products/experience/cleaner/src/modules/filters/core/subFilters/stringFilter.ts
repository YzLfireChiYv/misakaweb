import type { ISubFilter, SelectorResult } from '@/types/filter'

export class StringFilter implements ISubFilter {
    isEnable = false
    private strSet = new Set<string>()

    enable(): void {
        this.isEnable = true
    }

    disable(): void {
        this.isEnable = false
    }

    addParam(value: string): void {
        value = value.trim()
        value && this.strSet.add(value)
    }

    setParam(value: string[]): void {
        this.strSet = new Set(value.map((v) => v.trim()).filter((v) => v))
    }

    matches(value: SelectorResult): boolean {
        return this.isEnable && typeof value === 'string' && this.strSet.has(value.trim())
    }
}
