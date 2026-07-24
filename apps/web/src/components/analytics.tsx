'use client';

import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

/**
 * Analytics + monitoring (Green belt). Vercel Analytics (page views + custom events via
 * lib/track) and Speed Insights (Core Web Vitals). Zero-config on Vercel — no keys, no
 * standing backend, and it shows up in the project's Analytics dashboard.
 */
export function AnalyticsProvider() {
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
