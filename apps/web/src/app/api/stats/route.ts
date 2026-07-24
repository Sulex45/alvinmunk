import { NextResponse } from 'next/server';
import { rpc, scValToNative, xdr } from '@stellar/stellar-sdk';

/**
 * Live network stats — unique wallets that have interacted with the app's contracts, per
 * network. Read straight from Soroban RPC `getEvents` (no standing backend / indexer yet),
 * so the number is real and grows as people onboard. RPC keeps ~a day of events, so this is
 * "wallets active on-chain in the retention window"; the authoritative cumulative roster
 * lives in the onboarding sheet (docs/USER_FEEDBACK.md). A durable indexer (issue #12) makes
 * it fully cumulative.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const WINDOW = 9000; // ledgers (~a day); wider ranges return out-of-range on public RPC
const ADDR = /^[GC][A-Z2-7]{55}$/;

type NetKey = 'testnet' | 'mainnet';

const NETWORKS: Record<
  NetKey,
  { rpc: string; rep?: string; registry?: string; exclude?: (string | undefined)[] }
> = {
  testnet: {
    rpc: process.env.NEXT_PUBLIC_RPC_URL || 'https://soroban-testnet.stellar.org',
    rep: process.env.NEXT_PUBLIC_REPUTATION_CONTRACT_ID,
    registry: process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID,
    // The app's own contracts appear in event topics (e.g. the quest_registry as att_set
    // issuer); they are NOT users, so exclude them from the count.
    exclude: [
      process.env.NEXT_PUBLIC_REPUTATION_CONTRACT_ID,
      process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID,
      process.env.NEXT_PUBLIC_REWARDS_CONTRACT_ID,
      process.env.NEXT_PUBLIC_QUEST_REGISTRY_CONTRACT_ID,
      process.env.NEXT_PUBLIC_GATE_CONTRACT_ID,
      process.env.NEXT_PUBLIC_USDC_SAC_ID,
    ],
  },
  mainnet: {
    rpc: process.env.MAINNET_RPC_URL || 'https://mainnet.sorobanrpc.com',
    rep: process.env.MAINNET_REPUTATION_CONTRACT_ID,
    registry: process.env.MAINNET_REGISTRY_CONTRACT_ID,
    exclude: [
      process.env.MAINNET_REPUTATION_CONTRACT_ID,
      process.env.MAINNET_REGISTRY_CONTRACT_ID,
      process.env.MAINNET_REWARDS_CONTRACT_ID,
      process.env.MAINNET_QUEST_REGISTRY_CONTRACT_ID,
      process.env.MAINNET_GATE_CONTRACT_ID,
      process.env.MAINNET_USDC_SAC_ID,
    ],
  },
};

// Progress targets from the belt program: testnet 50 (Blue), mainnet 20 (Black).
const TARGET: Record<NetKey, number> = { testnet: 50, mainnet: 20 };

function collectAddrs(v: unknown, out: Set<string>): void {
  if (typeof v === 'string') {
    if (ADDR.test(v)) out.add(v);
  } else if (Array.isArray(v)) {
    for (const x of v) collectAddrs(x, out);
  } else if (v && typeof v === 'object') {
    for (const x of Object.values(v)) collectAddrs(x, out);
  }
}

function decode(v: xdr.ScVal | string): unknown {
  try {
    const sv = typeof v === 'string' ? xdr.ScVal.fromXDR(v, 'base64') : v;
    return scValToNative(sv);
  } catch {
    return null;
  }
}

async function statsFor(net: NetKey) {
  const cfg = NETWORKS[net];
  const ids = [cfg.rep, cfg.registry].filter(Boolean) as string[];
  if (ids.length === 0) {
    return { network: net, configured: false, users: 0, target: TARGET[net], addresses: [] as string[] };
  }
  const server = new rpc.Server(cfg.rpc);
  let latest = 0;
  try {
    latest = (await server.getLatestLedger()).sequence;
  } catch {
    return { network: net, configured: true, users: 0, target: TARGET[net], addresses: [], error: 'rpc' };
  }
  const startLedger = Math.max(1, latest - WINDOW);
  const seen = new Set<string>();
  try {
    const filters = [{ type: 'contract' as const, contractIds: ids, topics: [['*', '*']] }];
    let cursor: string | undefined;
    for (let page = 0; page < 10; page++) {
      const res = await server.getEvents(
        cursor ? { filters, cursor, limit: 1000 } : { filters, startLedger, limit: 1000 },
      );
      for (const ev of res.events) {
        for (const t of ev.topic as Array<xdr.ScVal | string>) collectAddrs(decode(t), seen);
        collectAddrs(decode(ev.value as xdr.ScVal | string), seen);
      }
      cursor = res.cursor;
      if (!cursor || res.events.length === 0) break;
    }
  } catch {
    /* return what we have */
  }
  // Drop the app's own contract addresses so only real user wallets are counted.
  for (const id of cfg.exclude ?? []) if (id) seen.delete(id);
  const addresses = [...seen];
  return {
    network: net,
    configured: true,
    users: addresses.length,
    target: TARGET[net],
    latestLedger: latest,
    addresses: addresses.slice(0, 300),
  };
}

export async function GET(req: Request) {
  const net = (new URL(req.url).searchParams.get('network') || 'testnet') as NetKey;
  if (net !== 'testnet' && net !== 'mainnet') {
    return NextResponse.json({ error: 'bad network' }, { status: 400 });
  }
  const data = await statsFor(net);
  return NextResponse.json(data, { headers: { 'cache-control': 'no-store' } });
}
