'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useWallet } from '@/components/wallet/wallet-provider';
import { normalizeHandle, type Profile } from '@/lib/profile';
import { humanizeError } from '@/lib/utils';
import { track, identify, trackError } from '@/lib/track';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * One-field onboarding, right on the landing hero. Type a handle, tap once, and we silently
 * provision a wallet (Face ID / dev), fund it, write genesis, and stamp the handle on-chain,
 * then drop you into the app. Returning users just get a shortcut into their app.
 *
 * NOTE: the heavy chain (registry → contracts → wallet → stellar-sdk) is DYNAMICALLY imported
 * inside the handlers. Statically importing it into this client component would pull stellar-sdk
 * into the server-rendered landing page and break the client-reference (renders as undefined).
 */
export function LandingOnboard() {
  const { profile, connect, setProfile } = useWallet();
  const router = useRouter();
  const [handle, setHandle] = useState('');
  const [busy, setBusy] = useState(false);
  const [avail, setAvail] = useState<'idle' | 'checking' | 'free' | 'taken'>('idle');

  useEffect(() => {
    const h = normalizeHandle(handle);
    if (h.length < 3) return setAvail('idle');
    setAvail('checking');
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const { isHandleAvailable } = await import('@/lib/registry');
        const free = await isHandleAvailable(h);
        if (alive) setAvail(free ? 'free' : 'taken');
      } catch {
        if (alive) setAvail('idle');
      }
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [handle]);

  // Returning user: skip straight to the app.
  if (profile) {
    return (
      <Link href="/app" className="inline-flex">
        <Button variant="flow" size="lg">
          Open your app <ArrowRight className="size-4" />
        </Button>
      </Link>
    );
  }

  async function createProfile() {
    const h = normalizeHandle(handle);
    if (h.length < 3) return toast.error('Pick a handle — 3+ letters or numbers.');
    setBusy(true);
    try {
      const [{ recordGenesis }, { claimHandle, isHandleAvailable }] = await Promise.all([
        import('@/lib/genesis'),
        import('@/lib/registry'),
      ]);
      const w = await connect();
      if (!(await isHandleAvailable(h))) {
        toast.error(`@${h} is taken — pick another.`);
        return;
      }
      const tx = w.kind === 'passkey' ? undefined : await recordGenesis(w, h);
      await claimHandle(w, h);
      const p: Profile = { handle: h, address: w.address, createdAt: Date.now(), genesisTx: tx };
      setProfile(p);
      identify(w.address, { handle: h, walletKind: w.kind });
      track('profile_created', { walletKind: w.kind, from: 'landing' });
      toast.success(`You're in — @${h} stamped on-chain.`);
      router.push('/app');
    } catch (e) {
      console.error('🛑 landing onboard failed →', e);
      trackError(e, { flow: 'landing_onboard' });
      toast.error(humanizeError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="w-full max-w-md"
      onSubmit={(e) => {
        e.preventDefault();
        void createProfile();
      }}
    >
      <div className="glass flex items-center gap-2 rounded-full p-1.5">
        <span className="pl-3 text-lg text-muted-foreground">@</span>
        <Input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="pick your handle"
          aria-label="Handle"
          className="h-11 flex-1 border-0 bg-transparent focus-visible:ring-0"
        />
        <Button type="submit" variant="flow" size="md" disabled={busy || avail === 'taken'} className="shrink-0">
          {busy ? 'Creating…' : 'Start free'}
          {!busy && <ArrowRight className="size-4" />}
        </Button>
      </div>
      <p className="mt-2 h-4 pl-4 text-xs">
        {avail === 'checking' && <span className="text-muted-foreground">checking…</span>}
        {avail === 'free' && <span className="text-secondary">✓ @{normalizeHandle(handle)} is free</span>}
        {avail === 'taken' && <span className="text-destructive">@{normalizeHandle(handle)} is taken</span>}
        {avail === 'idle' && <span className="text-muted-foreground">no seed phrase · fees sponsored · one tap</span>}
      </p>
    </form>
  );
}
