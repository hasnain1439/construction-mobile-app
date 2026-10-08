/**
 * The sign-in in progress while the user picks a company (MULTIPLE_COMPANIES). Kept in
 * memory only — never in route params or storage, so a password never leaves this screen flow.
 */
export type PendingLogin = { mode: 'code'; phone: string; code: string } | { mode: 'password'; phone: string; password: string };

let pending: PendingLogin | null = null;

export const setPendingLogin = (p: PendingLogin) => {
  pending = p;
};
export const takePendingLogin = () => pending;
export const clearPendingLogin = () => {
  pending = null;
};
