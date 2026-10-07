/** Every backend path used by the app, defined once. Relative to API_BASE_URL (…/api/v1). */
export const ENDPOINTS = {
  mobileConfig: '/auth/mobile-config',
  otpRequest: '/auth/otp/request',
  otpVerify: '/auth/otp/verify',
  refresh: '/auth/refresh',
  logout: '/auth/logout',
  me: '/auth/me',
  attachments: '/attachments',
  syncPull: '/sync/pull',
  syncPush: '/sync/push',
  syncStatus: '/sync/status',
} as const;
