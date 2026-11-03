declare module "@math" {
  export const summarize: (data: any) => any
  export const percent: (part: number, whole: number) => string
  export const MODE_NAMES: Record<string, string>
  export const LANG_NAMES: Record<string, string>
  export const PLAN_NAMES: Record<string, string>
  export const METHOD_NAMES: Record<string, string>
}
