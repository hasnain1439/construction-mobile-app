/**
 * Crash reporting. Completely off when EXPO_PUBLIC_SENTRY_DSN is empty: Sentry.init is never
 * called and every helper here is a no-op (wrapRoot returns the component unchanged).
 * No PII (sendDefaultPii false), no session replay, no screenshots / view hierarchy; every event
 * and breadcrumb goes through the scrubber.
 */
import * as Sentry from '@sentry/react-native';
import type { ComponentType } from 'react';
import { APP_VERSION } from '../../api/config';
import { scrubBreadcrumb, scrubEvent } from './scrub';

export interface SentryConfig {
  dsn: string;
  environment: string;
  /** Empty: the SDK uses the native `<bundle id>@<version>+<build>` (matches the EAS source-map upload). */
  release: string | undefined;
  tracesSampleRate: number;
}

export function readSentryEnv(): SentryConfig {
  const rate = Number.parseFloat(process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? '');
  return {
    dsn: (process.env.EXPO_PUBLIC_SENTRY_DSN ?? '').trim(),
    environment: (process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? '').trim() || (__DEV__ ? 'development' : 'production'),
    release: (process.env.EXPO_PUBLIC_SENTRY_RELEASE ?? '').trim() || undefined,
    tracesSampleRate: Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : 0.1,
  };
}

let enabled = false;

export const sentryEnabled = () => enabled;

/** Call once at app start (root layout, module scope). Returns whether Sentry is on. */
export function initSentry(cfg: SentryConfig = readSentryEnv()): boolean {
  if (enabled) return true;
  if (!cfg.dsn) return false;
  try {
    Sentry.init({
      dsn: cfg.dsn,
      environment: cfg.environment,
      ...(cfg.release ? { release: cfg.release } : {}),
      tracesSampleRate: cfg.tracesSampleRate,
      sendDefaultPii: false,
      attachScreenshot: false,
      attachViewHierarchy: false,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      beforeSend: (event) => scrubEvent(event),
      beforeSendTransaction: (event) => scrubEvent(event),
      beforeBreadcrumb: (crumb) => scrubBreadcrumb(crumb),
    });
    Sentry.setTag('app_version', APP_VERSION);
    enabled = true;
  } catch {
    enabled = false;
  }
  return enabled;
}

/** Sentry.wrap when on; the component itself when off. */
export function wrapRoot<P extends object>(component: ComponentType<P>): ComponentType<P> {
  return enabled ? (Sentry.wrap(component as ComponentType<Record<string, unknown>>) as unknown as ComponentType<P>) : component;
}

export function captureException(err: unknown, tags?: Record<string, string>): void {
  if (!enabled) return;
  try {
    Sentry.captureException(err, tags ? { tags } : undefined);
  } catch {
    // never throws
  }
}

/** Hashed user id only, plus the tenant as a tag. */
export function setSentryUser(hashedId: string, tenantId: string | null): void {
  if (!enabled) return;
  Sentry.setUser({ id: hashedId });
  Sentry.setTag('tenantId', tenantId ?? undefined);
}

export function clearSentryUser(): void {
  if (!enabled) return;
  Sentry.setUser(null);
  Sentry.setTag('tenantId', undefined);
}

/** Test helper. */
export function resetSentryForTests() {
  enabled = false;
}
