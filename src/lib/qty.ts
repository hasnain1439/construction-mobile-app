/** 12.5 → "12.5", 3 decimals at most; null → "—". */
export const qty = (n: number | null | undefined) => (n === null || n === undefined ? '—' : String(Math.round(n * 1000) / 1000));
