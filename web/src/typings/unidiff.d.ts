declare module 'unidiff' {
  export function diffLines(oldStr: string, newStr: string, options?: { newlineIsToken?: boolean }): any[];
  export function formatLines(diff: any[], options?: { context?: number }): string;
} 