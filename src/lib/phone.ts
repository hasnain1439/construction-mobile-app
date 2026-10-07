/** Pakistani mobile numbers: "0321 1234567" / "321-1234567" / "+92 321 1234567" → "+923211234567". */
export function normalisePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  const local = digits.startsWith('92') ? digits.slice(2) : digits.startsWith('0') ? digits.slice(1) : digits;
  return /^3\d{9}$/.test(local) ? `+92${local}` : null;
}

/** "+923211234567" → "0321 1234567" */
export const displayPhone = (e164: string) => (e164.startsWith('+92') ? `0${e164.slice(3, 6)} ${e164.slice(6)}` : e164);
