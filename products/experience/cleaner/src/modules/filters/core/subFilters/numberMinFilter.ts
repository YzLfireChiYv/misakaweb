import type { ISubFilter, SelectorResult } from '@/types/filter'

export class NumberMinFilter implements ISubFilter {
    isEnable = false
    private threshold = 0

    enable(): void {
        this.isEnable = true
    }

    disable(): void {
        this.isEnable = false
    }

    setParam(value: number) {
        this.threshold = value
    }

    matches(value: SelectorResult): boolean {
        return this.isEnable && typeof value === 'number' && value < this.threshold
    }
}
