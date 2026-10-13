/** Sign-in calls (OTP) and the mobile config check. */
import { request } from './client';
import { ENDPOINTS } from './endpoints';
import { deviceInfo, setTokens, setUser, type SessionUser } from './session';
import { accessFrom, type Access, type Role } from '../lib/permissions';

export interface MobileConfig {
  minimumAppVersion: string;
  latestAppVersion: string;
  apiVersion: string;
  otpLength: number;
  otpResendSeconds: number;
  syncIntervalMinutes: number;
  maxUploadBytes: number;
  features: Record<string, boolean>;
}

export interface Company {
  tenantId: string;
  name: string;
  role: Role;
}

/** Login / OTP result and `/auth/me`: the access block (permissions, fieldAccess, …) sits beside the user. */
interface AuthResult extends Partial<Access> {
  user: { id: string; name: string; phone: string; role: Role };
  tenant: { id: string; name: string };
  accessToken?: string;
  refreshToken?: string;
}

/** The person who just signed in plus their permissions (kept in the encrypted local database, not SecureStore). */
export type SignedIn = SessionUser & { access: Access | null };

/** Short timeout: app start waits for it (offline the app opens anyway). */
export const getMobileConfig = () => request<MobileConfig>(ENDPOINTS.mobileConfig, { auth: false, timeoutMs: 4000 });

export const requestOtp = (phone: string) => request<{ sent: true; expiresIn: number; resendAfter: number; emailed?: boolean }>(ENDPOINTS.otpRequest, { method: 'POST', auth: false, body: { phone, purpose: 'LOGIN' } });

/** Signs in; a phone that belongs to several companies gets MULTIPLE_COMPANIES (details.companies). */
export async function verifyOtp(phone: string, code: string, tenantId?: string): Promise<SignedIn> {
  const device = await deviceInfo();
  const res = await request<AuthResult>(ENDPOINTS.otpVerify, { method: 'POST', auth: false, body: { phone, code, client: 'mobile', device, ...(tenantId ? { tenantId } : {}) } });
  return keepSession(res);
}

/**
 * Phone + password (set by the Thekedar, or when accepting the invite) — for when the SMS
 * code doesn't arrive. Same MULTIPLE_COMPANIES answer as the code.
 */
export async function passwordLogin(phone: string, password: string, tenantId?: string): Promise<SignedIn> {
  const device = await deviceInfo();
  const res = await request<AuthResult>(ENDPOINTS.login, { method: 'POST', auth: false, body: { login: phone, password, client: 'mobile', device, ...(tenantId ? { tenantId } : {}) } });
  return keepSession(res);
}

async function keepSession(res: AuthResult): Promise<SignedIn> {
  if (!res.accessToken || !res.refreshToken) throw new Error('No tokens in the sign-in response');
  await setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
  const user: SessionUser = { id: res.user.id, name: res.user.name, phone: res.user.phone, role: res.user.role, tenantId: res.tenant.id, tenantName: res.tenant.name };
  await setUser(user);
  return { ...user, access: accessFrom(res) };
}

/** The current permissions (app start, when online; changes apply without a new login). */
export const getMe = () => request<AuthResult>(ENDPOINTS.me, { timeoutMs: 8000 });

export const serverLogout = () => request<{ loggedOut: true }>(ENDPOINTS.logout, { method: 'POST' });

/** "1.2.10" < "1.10.0" */
export function versionLess(a: string, b: string): boolean {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}
