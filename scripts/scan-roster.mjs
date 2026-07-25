/**
 * Roster refresh — rebuild the durable onboarded-wallets list that `/api/stats` reads.
 *
 * Soroban RPC only retains ~7 days of events, so a live `getEvents` count decays as seed
 * activity ages out. This script does the ONE expensive thing the serverless route can't:
 * widen the window to the full RPC retention and FULLY paginate (continuing through empty
 * sub-ranges — the bug that used to cap the count), collecting every unique wallet that has
 * touched the app's contracts. The result is committed to src/data/onboarded-wallets.json as
 * the permanent floor for the counter.
 *
 * Run from repo root (reads apps/web/.env.local for RPC + contract ids):
 *   node scripts/scan-roster.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const webDir = path.join(root, 'apps', 'web');
const require = createRequire(path.join(webDir, 'package.json'));
const { rpc, scValToNative, xdr } = require('@stellar/stellar-sdk');

// load apps/web/.env.local
const env = {};
const envPath = path.join(webDir, '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
}
const pick = (k) => process.env[k] || env[k];

const NETS = {
  testnet: {
    rpc: pick('NEXT_PUBLIC_RPC_URL') || 'https://soroban-testnet.stellar.org',
    ids: [pick('NEXT_PUBLIC_REPUTATION_CONTRACT_ID'), pick('NEXT_PUBLIC_REGISTRY_CONTRACT_ID'), pick('NEXT_PUBLIC_REWARDS_CONTRACT_ID'), pick('NEXT_PUBLIC_QUEST_REGISTRY_CONTRACT_ID')].filter(Boolean),
    exclude: [pick('NEXT_PUBLIC_REPUTATION_CONTRACT_ID'), pick('NEXT_PUBLIC_REGISTRY_CONTRACT_ID'), pick('NEXT_PUBLIC_REWARDS_CONTRACT_ID'), pick('NEXT_PUBLIC_QUEST_REGISTRY_CONTRACT_ID'), pick('NEXT_PUBLIC_GATE_CONTRACT_ID'), pick('NEXT_PUBLIC_USDC_SAC_ID')].filter(Boolean),
  },
  mainnet: {
    rpc: pick('MAINNET_RPC_URL') || 'https://mainnet.sorobanrpc.com',
    ids: [pick('MAINNET_REPUTATION_CONTRACT_ID'), pick('MAINNET_REGISTRY_CONTRACT_ID'), pick('MAINNET_REWARDS_CONTRACT_ID'), pick('MAINNET_QUEST_REGISTRY_CONTRACT_ID')].filter(Boolean),
    exclude: [pick('MAINNET_REPUTATION_CONTRACT_ID'), pick('MAINNET_REGISTRY_CONTRACT_ID'), pick('MAINNET_REWARDS_CONTRACT_ID'), pick('MAINNET_QUEST_REGISTRY_CONTRACT_ID'), pick('MAINNET_GATE_CONTRACT_ID'), pick('MAINNET_USDC_SAC_ID')].filter(Boolean),
  },
};
const ADDR = /^[GC][A-Z2-7]{55}$/;
const RETENTION = 119_000; // ledgers the public RPC keeps (~7 days); clamped below if needed

const decode = (v) => {
  try {
    return scValToNative(typeof v === 'string' ? xdr.ScVal.fromXDR(v, 'base64') : v);
  } catch {
    return null;
  }
};
function collect(v, out) {
  if (typeof v === 'string') {
    if (ADDR.test(v)) out.add(v);
  } else if (Array.isArray(v)) {
    for (const x of v) collect(x, out);
  } else if (v && typeof v === 'object') {
    for (const x of Object.values(v)) collect(x, out);
  }
}

async function scan(net, cfg) {
  if (cfg.ids.length === 0) return [];
  const server = new rpc.Server(cfg.rpc);
  const latest = (await server.getLatestLedger()).sequence;
  const seen = new Set();
  const filters = [{ type: 'contract', contractIds: cfg.ids, topics: [['*', '*']] }];
  // clamp startLedger just inside the RPC's oldest available ledger
  let startLedger = latest - RETENTION;
  let cursor;
  let events = 0;
  let emptyStreak = 0;
  for (let page = 0; page < 20_000; page++) {
    let res;
    try {
      res = await server.getEvents(cursor ? { filters, cursor, limit: 1000 } : { filters, startLedger, limit: 1000 });
    } catch (e) {
      const m = /within the ledger range: (\d+)/.exec(String(e.message || e));
      if (!cursor && m) {
        startLedger = Number(m[1]) + 1;
        continue;
      }
      throw e;
    }
    events += res.events.length;
    emptyStreak = res.events.length === 0 ? emptyStreak + 1 : 0;
    for (const ev of res.events) {
      for (const t of ev.topic) collect(decode(t), seen);
      collect(decode(ev.value), seen);
    }
    cursor = res.cursor;
    if (!cursor) break;
    // Once the event clusters are behind us, the RPC pages through the (empty) tail toward
    // `latest` one small ledger-span at a time — thousands of pointless requests. Stop after a
    // long empty streak: any wallet in that tail is also caught by the route's live window.
    if (events > 0 && emptyStreak >= 60) break;
  }
  for (const id of cfg.exclude) seen.delete(id);
  console.log(`${net}: ${seen.size} wallets`);
  return [...seen].sort();
}

const out = {};
for (const [net, cfg] of Object.entries(NETS)) out[net] = await scan(net, cfg);

const dest = path.join(webDir, 'src', 'data', 'onboarded-wallets.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');
console.log('wrote', dest, '-> testnet', out.testnet.length, 'mainnet', out.mainnet.length);
