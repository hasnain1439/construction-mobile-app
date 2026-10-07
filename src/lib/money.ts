/**
 * Money is paisa strings from the API. Only cash and wages are ever shown in this app.
 * "Rs 27,75,000" (South Asian grouping).
 */
export function toPaisa(v: string | number | bigint | null | undefined): bigint {
  if (v === null || v === undefined || v === '') return 0n;
  try {
    return BigInt(v);
  } catch {
    return 0n;
  }
}

export function groupSouthAsian(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

export function formatPKR(paisa: string | number | bigint | null | undefined): string {
  const p = toPaisa(paisa);
  const neg = p < 0n;
  const abs = neg ? -p : p;
  const whole = groupSouthAsian((abs / 100n).toString());
  const frac = abs % 100n;
  return `${neg ? '−' : ''}Rs ${whole}${frac ? `.${frac.toString().padStart(2, '0')}` : ''}`;
}

/** "1,500" / "1500.50" typed by the user → paisa string (null when not a positive amount). */
export function rupeesToPaisa(input: string): string | null {
  const clean = input.replace(/[,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const [r, f = ''] = clean.split('.');
  const paisa = BigInt(r!) * 100n + BigInt((f + '00').slice(0, 2));
  return paisa > 0n ? paisa.toString() : null;
}

export const sumPaisa = (values: (string | null | undefined)[]) => values.reduce((s, v) => s + toPaisa(v), 0n).toString();
