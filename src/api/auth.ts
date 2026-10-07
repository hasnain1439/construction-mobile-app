/** Sign-in calls (OTP) and the mobile config check. */
import { request } from './client';
import { ENDPOINTS } from './endpoints';
import { deviceInfo, setTokens, setUser, type SessionUser } from './session';
import type { Role } from '../lib/permissions';

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

interface AuthResult {
  user: { id: string; name: string; phone: string; role: Role };
  tenant: { id: string; name: string };
  accessToken?: string;
  refreshToken?: string;
}

/** Short timeout: app start waits for it (offline the app opens anyway). */
export const getMobileConfig = () => request<MobileConfig>(ENDPOINTS.mobileConfig, { auth: false, timeoutMs: 4000 });

export const requestOtp = (phone: string) => request<{ sent: true; expiresIn: number; resendAfter: number }>(ENDPOINTS.otpRequest, { method: 'POST', auth: false, body: { phone, purpose: 'LOGIN' } });

/** Signs in; a phone that belongs to several companies gets MULTIPLE_COMPANIES (details.companies). */
export async function verifyOtp(phone: string, code: string, tenantId?: string): Promise<SessionUser> {
  const device = await deviceInfo();
  const res = await request<AuthResult>(ENDPOINTS.otpVerify, { method: 'POST', auth: false, body: { phone, code, client: 'mobile', device, ...(tenantId ? { tenantId } : {}) } });
  if (!res.accessToken || !res.refreshToken) throw new Error('No tokens in the sign-in response');
  await setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
  const user: SessionUser = { id: res.user.id, name: res.user.name, phone: res.user.phone, role: res.user.role, tenantId: res.tenant.id, tenantName: res.tenant.name };
  await setUser(user);
  return user;
}

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
