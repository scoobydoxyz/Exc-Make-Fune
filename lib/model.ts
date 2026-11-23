// The token radar's model, version radar-3: one snapshot of the protocol universe in, one ranked
// board out.
//
// The board ranks EVERY rankable pre-token protocol in the snapshot (the watchlist is the floor,
// never a ceiling), so the early rows below the watchlist floor are found by the same rule as the
// watchlist rows. A protocol is pre-token when its record carries no token (no market cap, no
// CoinGecko id, no symbol); the snapshot's live-token protocols are kept apart and shown as the
// market's own values, never mixed into the ranked board.
//
// A protocol is rankable when it records no token AND it is not a wrapped/staked/bridged product
// of a token that already trades: its category is not CEX, Bridge, Canonical Bridge, Liquid
// Staking, Liquid Restaking or Restaked BTC; its name carries no whole word wrapped / staked /
// staking (any case); its name does not start with an exchange name (Binance, Coinbase, Bybit,
// Kraken, Bitget, OKX, Bitfinex, Gemini); and its name does not end in a version marker
// (a space followed by V2, v2, 2.0 or the like). The rule is derived from the snapshot's own
// watchlist rule, applied to every protocol, so no protocol name is ever special-cased.
//
// Implied value follows only from the snapshot's own figures:
//
//   base         = tvl_usd x BASE_MULTIPLE                     (0.25)
//   growth       = clamp(change_7d, -60, 120) per cent
//   growthMult   = 1 + (growth / 100) x GROWTH_WEIGHT          (0.5)
//   maturity     = 0.6 + min(age_days, 1095) / 1095 x 0.4      (age unknown: 365 days)
//   chainMult    = 1 + 0.03 x min(max(chains - 1, 0), 4)       (1.00-1.12: more chains, more reach)
//   categoryMult = 0.95 + 0.10 x (category TVL / largest category TVL)
//                  over the rankable pre-token set; a null category scores 1.0
//   share        = tvl_usd / rankable pre-token TVL of its own category
//                  (a null category has no share; a category with a single rankable
//                  protocol has share 1.0 by construction)
//   shareMult    = 0.90 + 0.20 x share                         (0.90-1.10)
//                  a null category scores 1.0, and a single-protocol category scores
//                  1.0 too: dominance with no rival inside the category means nothing
//   implied      = max(1, round(base x growthMult x maturity x chainMult x categoryMult x shareMult))
//
// The category multiplier is computed from the snapshot itself: categories that already hold the
// most pre-token value get a small premium (up to 1.05), thin ones a small discount (down to 0.95),
// so the model rewards being where the pre-token capital already is without ever naming a
// category by hand. The share multiplier is computed the same way, but inside the category: a
// protocol that holds most of its own category's pre-token TVL gets a premium (up to 1.10), a
// small fish in a crowded category a discount (down to 0.90), so the model now rewards dominance
// within a category, not just the category's size. Every multiplier is rounded to 4 decimals in
// the row's breakdown.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  base_multiple: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  chain_step: number;
  chain_max_extra: number;
  category_floor: number;
  category_range: number;
  share_floor: number;
  share_range: number;
}

export const MODEL: ModelConstants = {
  base_multiple: 0.25,
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  chain_step: 0.03,
  chain_max_extra: 4,
  category_floor: 0.95,
  category_range: 0.1,
  share_floor: 0.9,
  share_range: 0.2,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-3';

/** The gate's board bounds: 100 to 4,000 rows, checked by boardIssue. */
export const BOARD_MIN_ROWS = 100;
export const BOARD_MAX_ROWS = 4000;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    base_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    chain_multiplier: number;
    category_multiplier: number;
    share_multiplier: number;
    category_share: number | null;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, farm plan included so the page renders board.json exactly. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  chain_multiplier: number;
  category_multiplier: number;
  share_multiplier: number;
  category_share: number | null;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Round to 4 decimals, so the breakdown the board carries is stable and readable. */
export const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/**
 * The category multipliers for this snapshot: the rankable pre-token TVL of each category,
 * scaled against the largest category, mapped to 0.95-1.05. A null category scores 1.0.
 */
export function categoryMultipliers(rankable: SnapshotProtocol[], model: ModelConstants): Map<string, number> {
  const catTvl = new Map<string, number>();
  for (const p of rankable) {
    if (p.category === null) continue;
    catTvl.set(p.category, (catTvl.get(p.category) ?? 0) + p.tvl_usd);
  }
  let maxCatTvl = 0;
  for (const v of catTvl.values()) if (v > maxCatTvl) maxCatTvl = v;
  const out = new Map<string, number>();
  for (const [cat, tvl] of catTvl) {
    out.set(cat, model.category_floor + model.category_range * (maxCatTvl > 0 ? tvl / maxCatTvl : 0));
  }
  return out;
}

/** One category's rankable pre-token TVL and how many rankable protocols share it. */
export interface CategoryShareStats {
  total_tvl: number;
  count: number;
}

/**
 * The rankable pre-token TVL and protocol count of every category, from the snapshot itself.
 * This is the denominator of the within-category share: a protocol's share is its own TVL
 * divided by its category's total here.
 */
export function categoryShareStats(rankable: SnapshotProtocol[]): Map<string, CategoryShareStats> {
  const out = new Map<string, CategoryShareStats>();
  for (const p of rankable) {
    if (p.category === null) continue;
    const cur = out.get(p.category) ?? { total_tvl: 0, count: 0 };
    cur.total_tvl += p.tvl_usd;
    cur.count += 1;
    out.set(p.category, cur);
  }
  return out;
}

/**
 * One protocol's share of its own category's rankable pre-token TVL, and the multiplier that
 * share earns: 0.90 + 0.20 x share. A null category has no share and scores 1.0, and a
 * category with a single rankable protocol scores 1.0 too, since dominance with no rival
 * inside the category means nothing.
 */
export function shareMultiplier(
  protocol: SnapshotProtocol,
  stats: Map<string, CategoryShareStats>,
  model: ModelConstants,
): { share: number | null; multiplier: number } {
  if (protocol.category === null) return { share: null, multiplier: 1 };
  const stat = stats.get(protocol.category);
  if (stat === undefined || stat.total_tvl <= 0) return { share: null, multiplier: 1 };
  const share = protocol.tvl_usd / stat.total_tvl;
  if (stat.count <= 1) return { share, multiplier: 1 };
  return { share, multiplier: model.share_floor + model.share_range * share };
}

/** The six multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  categoryMult: number,
  shareMult: number = 1,
): { implied: number; growthPct: number; growthMult: number; maturityMult: number; chainMult: number; shareMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const chainCount = Math.min(Math.max(protocol.chains.length - 1, 0), model.chain_max_extra);
  const chainMult = 1 + model.chain_step * chainCount;
  const base = protocol.tvl_usd * model.base_multiple;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult * chainMult * categoryMult * shareMult));
  return { implied, growthPct, growthMult, maturityMult, chainMult, shareMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A whole word wrapped, staked or staking in a name: a wrapped/staked product of a token that trades. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** Exchange names a protocol name must not start with. */
const EXCHANGES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/** Categories that are a wrapped, staked or bridged product of a token that already trades. */
const EXCLUDED_CATEGORIES = new Set(['CEX', 'Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC']);

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: pre-token, not an exchange, not a wrapped/staked/
 * bridged product, not a versioned pool. The same rule that built the watchlist, applied to every
 * protocol, so the watchlist rows pass it by definition and the early rows are found by it.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  for (const ex of EXCHANGES) if (p.name.startsWith(ex)) return false;
  if (VERSIONED.test(p.name)) return false;
  return true;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const rankable = snapshot.protocols.filter(isRankable);
  // Deterministic order before scoring: slug ascending, so equal implied values break ties the same way.
  rankable.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const catMults = categoryMultipliers(rankable, model);
  // The share denominators come from this same rankable set, so a protocol's share is always
  // its slice of the category the board itself ranks.
  const shareStats = categoryShareStats(rankable);
  const scored = rankable.map((p) => {
    const categoryMult = p.category === null ? 1 : (catMults.get(p.category) ?? 1);
    const { share, multiplier: shareMult } = shareMultiplier(p, shareStats, model);
    const s = impliedValue(p, snapshot.as_of, model, categoryMult, shareMult);
    return { p, categoryMult, share, shareMult, ...s };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      base_multiple: model.base_multiple,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      chain_multiplier: round4(s.chainMult),
      category_multiplier: round4(s.categoryMult),
      share_multiplier: round4(s.shareMult),
      category_share: s.share === null ? null : round4(s.share),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The gas a transaction on a chain costs, in the words the plan states. */
function gasFor(chain: string): string {
  if (chain === 'Ethereum') return 'about $8 of gas';
  if (chain === 'Solana') return 'under $0.10 of gas';
  return 'about $2 of gas';
}

/**
 * The category's one action, in the words a farmer can follow. The most specific categories are
 * checked first, so a Yield Aggregator is not mistaken for a plain yield pool and a Basis Trading
 * desk is not mistaken for a generic derivatives venue; anything unrecognised falls through to
 * the plain deposit at the end.
 */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the vault shares.`;
  if (c.includes('aggregator')) return `Deposit $${capital} into a ${name} vault on ${chain} and let it route the funds across its strategies.`;
  if (c.includes('leveraged farm')) return `Deposit $${capital} into ${name} on ${chain} and open one small leveraged position against it.`;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('liquidity manager')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('yield') || c.includes('farm')) return `Deposit $${capital} into a ${name} yield strategy on ${chain} and keep the position open.`;
  if (c.includes('bridge') || c.includes('cross chain')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token.`;
  if (c.includes('basis')) return `Deposit $${capital} of USDC into ${name}'s basis position on ${chain} and keep it open.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}, then leave it to settle.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield-bearing asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active.`;
  if (c.includes('liquid')) return `Deposit $${capital} of the staking asset through ${name} on ${chain} and hold the receipt.`;
  if (c.includes('anchor') || c.includes('decentralized btc')) return `Mint $${capital} of the BTC-backed asset through ${name} on ${chain} and hold it.`;
  if (c.includes('cedefi')) return `Deposit $${capital} of USDC into a ${name} vault on ${chain} and keep the vault shares.`;
  if (c.includes('index')) return `Buy $${capital} of the ${name} index token on ${chain} and hold it.`;
  if (c.includes('payment') || c.includes('crypto card')) return `Pay $${capital} through ${name} on ${chain} for a real purchase and keep the receipt.`;
  if (c.includes('otc')) return `Place one small $${capital} order on ${name} on ${chain} and let it settle.`;
  if (c.includes('governance')) return `Lock $${capital} through ${name} on ${chain} and vote on one live proposal.`;
  if (c === 'chain') return `Bridge $${capital} of USDC onto the chain through ${name}'s own rails and use it in an app on that chain.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/**
 * The category's small weekly action: the same kind of activity as the main action, at a
 * smaller size, repeated every week so the wallet shows steady use rather than a single burst.
 * The weekly amount is a fifth of the main position, at least $10.
 */
function weeklyActionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  const weekly = Math.max(10, Math.round(capital / 5));
  if (c.includes('curator') || c.includes('allocator')) return `Each week, deposit a small $${weekly} into a second ${name} vault on ${chain}, so the wallet shows a curator spreading across vaults.`;
  if (c.includes('aggregator')) return `Each week, move a small $${weekly} into a different ${name} strategy on ${chain}, so the wallet shows the aggregator being used, not parked.`;
  if (c.includes('leveraged farm')) return `Each week, top up the ${name} position with a small $${weekly} and rebalance the leverage on ${chain}.`;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Each week, borrow a small amount against the ${name} supply on ${chain} and repay it the same week, so the wallet shows borrowing as well as supplying.`;
  if (c.includes('dex') || c.includes('liquidity manager')) return `Each week, swap a small $${weekly} through ${name}'s main pool on ${chain}, so the wallet shows trading as well as liquidity.`;
  if (c.includes('yield') || c.includes('farm')) return `Each week, add a small $${weekly} to the ${name} yield position on ${chain} instead of leaving it untouched.`;
  if (c.includes('bridge') || c.includes('cross chain')) return `Each week, bridge a small $${weekly} back across ${name}, so the wallet shows two-way use rather than a one-way transfer.`;
  if (c.includes('staking') || c.includes('restak')) return `Each week, restake the rewards ${name} paid out on ${chain} instead of withdrawing them.`;
  if (c.includes('basis')) return `Each week, check the ${name} basis position on ${chain} and top it up with a small $${weekly} while the basis holds.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return `Each week, open and close one small hedged position on ${name} on ${chain}, then leave the margin in place.`;
  if (c.includes('prediction')) return `Each week, place one small market position on ${name} and let it settle before the next one.`;
  if (c.includes('stable')) return `Each week, mint or redeem a small $${weekly} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Each week, buy a small $${weekly} more of the yield-bearing asset from ${name} on ${chain}.`;
  if (c.includes('insurance')) return `Each week, check the ${name} cover on ${chain} and top it up with a small $${weekly} if the policy is about to lapse.`;
  if (c.includes('liquid')) return `Each week, add a small $${weekly} of the staking asset through ${name} on ${chain} and hold the new receipt.`;
  if (c.includes('anchor') || c.includes('decentralized btc')) return `Each week, mint a small $${weekly} more of the BTC-backed asset through ${name} on ${chain}.`;
  if (c.includes('cedefi')) return `Each week, add a small $${weekly} to the ${name} vault on ${chain}.`;
  if (c.includes('index')) return `Each week, add a small $${weekly} to the ${name} index position on ${chain}.`;
  if (c.includes('payment') || c.includes('crypto card')) return `Each week, make one small real payment through ${name} on ${chain} and keep the receipt.`;
  if (c.includes('otc')) return `Each week, place one more small order on ${name} on ${chain} and let it settle.`;
  if (c.includes('governance')) return `Each week, vote on one live proposal through ${name} on ${chain}.`;
  if (c === 'chain') return `Each week, use one app on the chain through ${name} on ${chain}, so the wallet shows real activity there.`;
  return `Each week, make one small qualifying action on ${name} on ${chain}, such as a deposit or a swap, so the wallet shows steady use rather than a single burst.`;
}

/**
 * The growth-aware step: what the protocol's own 7-day TVL change says about how bold the
 * position should be. A rise above 10% means activity is climbing, a fall below 10% means
 * start smaller, and anything in between — or no change reported — means a steady position.
 */
function growthStep(p: SnapshotProtocol, capital: number): FarmStep {
  const g = p.change_7d;
  if (g === null) {
    return {
      text: `No 7-day TVL change is reported for ${p.name}, so treat the trend as flat: a steady $${capital} position is right, and do not over-commit before the next snapshot.`,
      cost: 'no extra cost',
      time: '5 minutes to check',
    };
  }
  if (g > 10) {
    return {
      text: `TVL grew ${g.toFixed(1)}% in the last 7 days, so activity on ${p.name} is rising: set up the position now while the protocol is gaining users, and keep the full $${capital} in place.`,
      cost: 'no extra cost',
      time: '5 minutes to check',
    };
  }
  if (g < -10) {
    return {
      text: `TVL fell ${Math.abs(g).toFixed(1)}% in the last 7 days, so start ${p.name} with a smaller position than planned, and add more only if the trend turns back up.`,
      cost: 'no extra cost',
      time: '5 minutes to check',
    };
  }
  const direction = g >= 0 ? `rose ${g.toFixed(1)}%` : `eased ${Math.abs(g).toFixed(1)}% lower`;
  return {
    text: `TVL ${direction} in the last 7 days, so the trend on ${p.name} is relatively flat: a steady $${capital} position is right, and do not over-commit before the next snapshot.`,
    cost: 'no extra cost',
    time: '5 minutes to check',
  };
}

/**
 * A protocol's farm plan: nine steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age, 7-day change), never from a
 * hand-written list of names: the same function writes every row's plan, and the numbers in it
 * come from that row. Step 1 sets up a fresh wallet, step 2 is the category's main action,
 * step 3 is the category's small weekly action, step 4 repeats the action on a second chain
 * (or a second, smaller position on the same chain), step 5 is the age-based hold, step 6 reads
 * the 7-day TVL trend, and steps 7-9 claim, log and re-check.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const gas = gasFor(chain);
  const weekly = weeklyActionFor(p, capital, chain);
  const small = Math.max(10, Math.round(capital / 2));
  const multiChain: FarmStep =
    p.chains.length > 1
      ? {
          text: `Use ${p.name} on ${p.chains[1]} as well: ${actionFor(p, small, p.chains[1]!)} A second-chain position shows the wallet is active wherever the protocol runs.`,
          cost: `$${small} of capital and ${gasFor(p.chains[1]!)}`,
          time: '15 minutes',
        }
      : {
          text: `Repeat the main action on ${chain} with a smaller $${small} position, so the wallet shows a second position on the same chain instead of one lump sum.`,
          cost: `$${small} of capital and ${gas}`,
          time: '15 minutes',
        };
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline on paper, never in a screenshot or a chat.`,
      cost: 'nothing to set up, and the first transaction costs ' + gas,
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and ${gas}`,
      time: '15 minutes to set up',
    },
    {
      text: weekly,
      cost: gas + ' a week',
      time: '10 minutes a week',
    },
    multiChain,
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot of the protocol's users.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    growthStep(p, capital),
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes; never pay a fee to claim and never follow a link from a stranger.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet address, the dates and every transaction hash in a farm log so you can repeat the position, prove the activity, or unwind it cleanly.`,
      cost: 'nothing but the log',
      time: '5 minutes after each action',
    },
    {
      text: `Once a month, re-check the protocol's own eligibility page and announcements to see whether the rules changed, and adjust the position before the next snapshot.`,
      cost: 'no fee to check',
      time: '10 minutes a month',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, farm plan included so the page renders board.json exactly. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    chain_multiplier: row.model.chain_multiplier,
    category_multiplier: row.model.category_multiplier,
    share_multiplier: row.model.share_multiplier,
    category_share: row.model.category_share,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < BOARD_MIN_ROWS || board.length > BOARD_MAX_ROWS) return `the board has ${board.length} rows, outside the gate's ${BOARD_MIN_ROWS} to ${BOARD_MAX_ROWS}`;
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.trim().length < 20 || s.trim().length > 600) return `${r.slug} has a farm step of ${s.trim().length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
