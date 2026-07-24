'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import posthog from 'posthog-js';

/**
 * Analytics + monitoring (Green belt). Three layers, all safe to ship:
 *  - Vercel Analytics + Speed Insights: zero-config page + Core Web Vitals on Vercel.
 *  - PostHog: product/usage analytics (autocapture + explicit events via lib/track) and
 *    exception capture. Only initializes when NEXT_PUBLIC_POSTHOG_KEY is set, so local dev
 *    and forks stay clean and the build never depends on a key.
 */
const PH_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const PH_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

let inited = false;

export function AnalyticsProvider() {
  const pathname = usePathname();

  // Init once, on the client, only when a key is configured.
  useEffect(() => {
    if (!PH_KEY || inited || typeof window === 'undefined') return;
    posthog.init(PH_KEY, {
      api_host: PH_HOST,
      capture_pageview: false, // we send pageviews on route change below
      capture_pageleave: true,
      autocapture: true,
      person_profiles: 'identified_only',
    });
    inited = true;
  }, []);

  // Manual pageview on every App Router navigation.
  useEffect(() => {
    if (PH_KEY && inited && typeof window !== 'undefined') {
      posthog.capture('$pageview', { $current_url: window.location.href });
    }
  }, [pathname]);

  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
