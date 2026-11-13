import type { ISubFilter, SelectorResult } from '@/types/filter'

export class BooleanFilter implements ISubFilter {
    isEnable = false

    enable(): void {
        this.isEnable = true
    }

    disable(): void {
        this.isEnable = false
    }

    matches(value: SelectorResult): boolean {
        return this.isEnable && value === true
    }
}
