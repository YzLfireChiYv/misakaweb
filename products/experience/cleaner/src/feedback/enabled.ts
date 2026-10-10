/** Compile-time flag. Standard builds replace this with false and drop label lookups. */
export const FEEDBACK_LABELS = import.meta.env.VITE_FEEDBACK_LABELS === 'true'
