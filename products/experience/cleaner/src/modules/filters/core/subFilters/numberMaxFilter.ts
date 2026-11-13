import type { ISubFilter, SelectorResult } from '@/types/filter'

export class NumberMaxFilter implements ISubFilter {
    isEnable = false
    private threshold?: number

    enable(): void {
        this.isEnable = true
    }

    disable(): void {
        this.isEnable = false
    }

    setParam(value: number) {
        this.threshold = value
    }

    clearParam() {
        this.threshold = undefined
    }

    matches(value: SelectorResult): boolean {
        return this.isEnable && this.threshold !== undefined && typeof value === 'number' && value > this.threshold
    }
}
