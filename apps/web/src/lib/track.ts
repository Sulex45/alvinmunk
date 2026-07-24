/**
 * Thin analytics helper. Wraps PostHog so feature code can fire product events and report
 * errors without importing or null-checking the SDK everywhere. Every call is a safe no-op
 * when PostHog is not initialized (no key set, SSR, or a fork), so instrumenting a call site
 * never risks a crash.
 */
import posthog from 'posthog-js';

function ready(): boolean {
  return typeof window !== 'undefined' && Boolean((posthog as { __loaded?: boolean }).__loaded);
}

/** Fire a product/usage event, e.g. track('vouch_minted', { hasNote: true }). */
export function track(event: string, props?: Record<string, unknown>): void {
  try {
    if (ready()) posthog.capture(event, props);
  } catch {
    /* analytics must never break a user flow */
  }
}

/** Tie subsequent events to a stable id (the wallet address) for retention/funnels. */
export function identify(id: string, props?: Record<string, unknown>): void {
  try {
    if (ready()) posthog.identify(id, props);
  } catch {
    /* no-op */
  }
}

/** Report a caught error to monitoring (PostHog error tracking). */
export function trackError(error: unknown, context?: Record<string, unknown>): void {
  try {
    if (!ready()) return;
    const err = error instanceof Error ? error : new Error(String(error));
    const ph = posthog as { captureException?: (e: Error, p?: Record<string, unknown>) => void };
    if (ph.captureException) ph.captureException(err, context);
    else posthog.capture('$exception', { message: err.message, ...context });
  } catch {
    /* no-op */
  }
}
