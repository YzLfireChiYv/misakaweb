export type ReviewCategory = 'cleaning' | 'optimization' | 'support'

export interface ReviewEntry {
    key: string
    id: string
    names: string[]
    pages: string[]
    groups: string[]
    category: ReviewCategory
    rationale: string
    pack?: string
    packLabel?: string
    retention?: 'optional-retain'
    defaultOff?: boolean
}
