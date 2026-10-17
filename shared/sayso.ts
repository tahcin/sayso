// Say So: the Arkiv schema, the queries the app runs, and the consent check.
// Every entity carries `app = "sayso"` and a `kind`. Attribute names are lowercase snake_case
// because the node rejects uppercase names (see arkiv/friction.md).
import { createPublicClient, ExpirationTime, jsonToPayload } from "@arkiv-network/sdk"
import { addr, key, u64 } from "@arkiv-network/sdk/attr"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { and, eq, gte, or, type Expression } from "@arkiv-network/sdk/query"
import { http, type Address, type Hex } from "viem"

export const APP = "sayso"
export const EXPLORER = "https://tiramisu.explorer.arkiv.network"
export const DATA_EXPLORER = "https://data.arkiv.network"

export type Kind = "party" | "notice" | "consent" | "receipt" | "lease" | "ceased"
export type Action = "granted" | "withdrawn" | "renewed"

// Lifetimes per entity type. Each follows a rule, not a default.
export const LIFETIME = {
  // A company re-publishes who it is every year.
  party: ExpirationTime.fromDays(365),
  // A notice must outlive every consent given against it plus the 7-year record duty.
  notice: ExpirationTime.fromYears(8),
  // Receipts and acks are the 7-year record (DPDP Rules, First Schedule Part B, item 4(c)).
  record: ExpirationTime.fromYears(7),
} as const

export const RPC = "https://rpc.tiramisu.db-chain.testnet.arkiv.network"

// Reads go straight to the public Arkiv RPC. A server holding an access key, or a browser that hit the
// anonymous read quota, can point every query at another endpoint with useRpc().
// No transport retries: a 429 from the quota should surface at once, not stall behind backoff.
export let pub = createPublicClient({ chain: tiramisu, transport: http(undefined, { retryCount: 0, timeout: 15000 }) })
export function useRpc(url: string) {
  pub = createPublicClient({ chain: tiramisu, transport: http(url, { retryCount: 0, timeout: 15000 }) })
}

const base = (kind: Kind) => and(eq("app", APP), eq("kind", kind))

// ---------- shapes read back from Arkiv ----------

export type Party = {
  key: Hex
  address: Address
  role: "fiduciary" | "processor"
  slug: string
  name: string
  blurb: string
}

export type Notice = {
  key: Hex
  fiduciary: Address
  purpose: string
  periodSeconds: number
  processor: Address
  title: string
  text: string
  dataItems: string[]
  createdAt: bigint
}

export type Consent = {
  key: Hex
  owner: Address
  creator: Address
  fiduciary: Address
  purpose: string
  notice: Hex
  grantedMs: number
  expiresAt: bigint
  createdAt: bigint
}

export type Receipt = {
  key: Hex
  creator: Address
  action: Action
  consent: Hex
  fiduciary: Address
  purpose: string
  processor: Address
  atMs: number
  createdAt: bigint
  expiresAt: bigint
}

export type Lease = {
  key: Hex
  creator: Address
  consent: Hex
  fiduciary: Address
  purpose: string
  principal: Address
  expiresAt: bigint
  createdAt: bigint
}

export type Ceased = {
  key: Hex
  creator: Address
  consent: Hex
  receipt: Hex
  processor: Address
  fiduciary: Address
  purpose: string
  principal: Address
  withdrawnBlock: bigint
  createdAt: bigint
}

type Raw = {
  key: Hex
  owner?: Hex
  creator?: Hex
  createdAt?: bigint
  expiresAt?: bigint
  attributes?: Readonly<Record<string, { type: string; value: unknown }>>
  toJson?: () => unknown
}

const s = (e: Raw, n: string) => String(e.attributes?.[n]?.value ?? "")
const n = (e: Raw, n: string) => Number(e.attributes?.[n]?.value ?? 0)
const b = (e: Raw, n: string) => BigInt((e.attributes?.[n]?.value as bigint | undefined) ?? 0n)

const ALL = { key: true, owner: true, creator: true, createdAt: true, expiresAt: true, attributes: true } as const

// Walks every page (the node caps a page at 200).
async function all(where: ReturnType<typeof and>, opts: { payload?: boolean; createdBy?: Address; ownedBy?: Address } = {}) {
  let q = pub.select(opts.payload ? { ...ALL, payload: true } : ALL).where(where).limit(200)
  if (opts.createdBy) q = q.createdBy(opts.createdBy)
  if (opts.ownedBy) q = q.ownedBy(opts.ownedBy)
  let page = await q.fetch()
  const out: Raw[] = [...(page.entities as unknown as Raw[])]
  while (page.hasNextPage()) {
    page = await page.next()
    out.push(...(page.entities as unknown as Raw[]))
  }
  return out
}

export const toParty = (e: Raw): Party => {
  const j = (e.toJson?.() ?? {}) as { name?: string; blurb?: string }
  return {
    key: e.key,
    address: e.creator as Address,
    role: s(e, "role") as Party["role"],
    slug: s(e, "slug"),
    name: j.name ?? s(e, "slug"),
    blurb: j.blurb ?? "",
  }
}

export const toNotice = (e: Raw): Notice => {
  const j = (e.toJson?.() ?? {}) as { title?: string; text?: string; data_items?: string[] }
  return {
    key: e.key,
    fiduciary: e.creator as Address,
    purpose: s(e, "purpose"),
    periodSeconds: Number(b(e, "period_s")),
    processor: s(e, "processor") as Address,
    title: j.title ?? s(e, "purpose"),
    text: j.text ?? "",
    dataItems: j.data_items ?? [],
    createdAt: e.createdAt ?? 0n,
  }
}

export const toConsent = (e: Raw): Consent => ({
  key: e.key,
  owner: e.owner as Address,
  creator: e.creator as Address,
  fiduciary: s(e, "fiduciary") as Address,
  purpose: s(e, "purpose"),
  notice: s(e, "notice") as Hex,
  grantedMs: Number(b(e, "granted_ms")),
  expiresAt: e.expiresAt ?? 0n,
  createdAt: e.createdAt ?? 0n,
})

export const toReceipt = (e: Raw): Receipt => ({
  key: e.key,
  creator: e.creator as Address,
  action: s(e, "action") as Action,
  consent: s(e, "consent") as Hex,
  fiduciary: s(e, "fiduciary") as Address,
  purpose: s(e, "purpose"),
  processor: s(e, "processor") as Address,
  atMs: Number(b(e, "at_ms")),
  createdAt: e.createdAt ?? 0n,
  expiresAt: e.expiresAt ?? 0n,
})

export const toLease = (e: Raw): Lease => ({
  key: e.key,
  creator: e.creator as Address,
  consent: s(e, "consent") as Hex,
  fiduciary: s(e, "fiduciary") as Address,
  purpose: s(e, "purpose"),
  principal: s(e, "principal") as Address,
  expiresAt: e.expiresAt ?? 0n,
  createdAt: e.createdAt ?? 0n,
})

export const toCeased = (e: Raw): Ceased => ({
  key: e.key,
  creator: e.creator as Address,
  consent: s(e, "consent") as Hex,
  receipt: s(e, "receipt") as Hex,
  processor: s(e, "processor") as Address,
  fiduciary: s(e, "fiduciary") as Address,
  purpose: s(e, "purpose"),
  principal: s(e, "principal") as Address,
  withdrawnBlock: b(e, "withdrawn_block"),
  createdAt: e.createdAt ?? 0n,
})

// ---------- queries ----------

const lc = (a: string) => a.toLowerCase()

/** Companies and processors, each published by its own wallet. */
export async function getParties(): Promise<Party[]> {
  return (await all(base("party"), { payload: true })).map(toParty)
}

/** Notices published by a company. Trust comes from $creator, so we filter with createdBy. */
export async function getNotices(fiduciary: Address): Promise<Notice[]> {
  return (await all(base("notice"), { payload: true, createdBy: fiduciary })).map(toNotice)
}

/** Live consents a person's address holds. A consent counts only if it created and still owns it. */
export async function getConsentsOf(principal: Address): Promise<Consent[]> {
  const rows = await all(base("consent"), { ownedBy: principal, createdBy: principal })
  return rows.map(toConsent)
}

/** Live consents given to one company for one purpose (what a processor serves). */
export async function getConsentsFor(fiduciary: Address, purpose: string): Promise<Consent[]> {
  const rows = await all(and(base("consent"), eq("fiduciary", addr(fiduciary)), eq("purpose", purpose)))
  // Same rule as the gate: the person who created it must still own it.
  return rows.map(toConsent).filter((c) => lc(c.owner) === lc(c.creator))
}

export async function getReceiptsOf(principal: Address): Promise<Receipt[]> {
  return (await all(base("receipt"), { createdBy: principal })).map(toReceipt)
}

/** Withdrawals since a time, for the public cease board. `at_ms` is u64 so it takes a range. */
export async function getWithdrawalsSince(sinceMs: number): Promise<Receipt[]> {
  const rows = await all(and(base("receipt"), eq("action", "withdrawn"), gte("at_ms", u64(BigInt(sinceMs)))))
  return rows.map(toReceipt)
}

export async function getLeasesBy(processor: Address): Promise<Lease[]> {
  return (await all(base("lease"), { createdBy: processor })).map(toLease)
}

export async function getLeasesOnConsent(consent: Hex): Promise<Lease[]> {
  return (await all(and(base("lease"), eq("consent", key(consent))))).map(toLease)
}

export async function getCeasedBy(processor: Address): Promise<Ceased[]> {
  return (await all(base("ceased"), { createdBy: processor })).map(toCeased)
}

/** Every lease a processor holds on one person's address (live ones only). */
export async function getLeasesOnPrincipal(principal: Address): Promise<Lease[]> {
  return (await all(and(base("lease"), eq("principal", addr(principal))))).map(toLease)
}

/** Every signed "we stopped" a processor posted for one person's address. */
export async function getCeasedOnPrincipal(principal: Address): Promise<Ceased[]> {
  return (await all(and(base("ceased"), eq("principal", addr(principal))))).map(toCeased)
}

export async function getCeasedSince(sinceMs: number): Promise<Ceased[]> {
  return (await all(and(base("ceased"), gte("at_ms", u64(BigInt(sinceMs)))))).map(toCeased)
}

export async function getCeasedFor(consent: Hex): Promise<Ceased[]> {
  return (await all(and(base("ceased"), eq("consent", key(consent))))).map(toCeased)
}

/**
 * The consent gate. Call it before any job touches a person's data.
 * True only if the person's own address created a consent for this company and purpose,
 * still owns it, and it has not expired. A withdrawn or expired consent simply is not there.
 */
export async function hasLiveConsent(principal: Address, fiduciary: Address, purpose: string): Promise<boolean> {
  const page = await pub
    .select({ key: true })
    .where(and(base("consent"), eq("fiduciary", addr(fiduciary)), eq("purpose", purpose)))
    .ownedBy(principal)
    .createdBy(principal)
    .limit(1)
    .fetch()
  return page.entities.length > 0
}

// ---------- write shapes (used by the browser, the seed script and the processors) ----------

export const partyCreate = (role: Party["role"], slug: string, name: string, blurb: string) => ({
  payload: jsonToPayload({ name, blurb }),
  contentType: "application/json" as const,
  attributes: { app: APP, kind: "party", role, slug },
  expires: LIFETIME.party,
})

export const noticeCreate = (o: {
  purpose: string
  periodSeconds: number
  processor: Address
  title: string
  text: string
  dataItems: string[]
}) => ({
  payload: jsonToPayload({ title: o.title, text: o.text, data_items: o.dataItems }),
  contentType: "application/json" as const,
  attributes: {
    app: APP,
    kind: "notice",
    purpose: o.purpose,
    period_s: u64(BigInt(o.periodSeconds)),
    processor: addr(o.processor),
  },
  expires: LIFETIME.notice,
  // Terms cannot change after people consent to them; anyone may keep the proof alive.
  flags: { readonly: true, permissionlessExtension: true },
})

/** Consent lives exactly as long as its purpose. Only the person can extend it. */
export const consentCreate = (n: Notice, lifetimeSeconds: number) => {
  const now = Date.now()
  return {
    payload: jsonToPayload({ notice_title: n.title }),
    contentType: "application/json" as const,
    attributes: {
      app: APP,
      kind: "consent",
      fiduciary: addr(n.fiduciary),
      purpose: n.purpose,
      notice: key(n.key),
      granted_ms: u64(BigInt(now)),
    },
    expires: ExpirationTime.fromSeconds(lifetimeSeconds),
    flags: { readonly: true, permissionlessExtension: false },
  }
}

export const receiptCreate = (o: { action: Action; consent: Hex; fiduciary: Address; purpose: string; processor: Address }) => ({
  payload: jsonToPayload({}),
  contentType: "application/json" as const,
  attributes: {
    app: APP,
    kind: "receipt",
    action: o.action,
    consent: key(o.consent),
    fiduciary: addr(o.fiduciary),
    purpose: o.purpose,
    processor: addr(o.processor),
    at_ms: u64(BigInt(Date.now())),
  },
  expires: LIFETIME.record,
  flags: { readonly: true, permissionlessExtension: true },
})

/** A processor's lease can never outlive the consent it runs under. */
export const leaseCreate = (c: Consent) => ({
  payload: jsonToPayload({}),
  contentType: "application/json" as const,
  attributes: {
    app: APP,
    kind: "lease",
    consent: key(c.key),
    fiduciary: addr(c.fiduciary),
    purpose: c.purpose,
    principal: addr(c.owner),
  },
  expires: ExpirationTime.atBlock(c.expiresAt),
})

export const ceasedCreate = (o: { lease: Lease; receipt: Receipt }) => ({
  payload: jsonToPayload({}),
  contentType: "application/json" as const,
  attributes: {
    app: APP,
    kind: "ceased",
    consent: key(o.lease.consent),
    receipt: key(o.receipt.key),
    processor: addr(o.lease.creator),
    fiduciary: addr(o.lease.fiduciary),
    purpose: o.lease.purpose,
    principal: addr(o.lease.principal),
    withdrawn_block: u64(o.receipt.createdAt),
    at_ms: u64(BigInt(Date.now())),
  },
  expires: LIFETIME.record,
  flags: { readonly: true, permissionlessExtension: true },
})


// ---------- snapshots: one query instead of many ----------
// Anonymous reads share a cost quota per IP (about 100 queries an hour), so each screen asks one
// compound question and sorts the answer by kind on the client.

// Ownership inside OR groups: the builder's ownedBy()/createdBy() apply to the whole query, but
// eq("$owner", addr(...)) and eq("$creator", ...) work as ordinary predicates (see friction.md).
const kindIs = (k: Kind) => eq("kind", k)
const sinceMs = (ms: number) => gte("at_ms", u64(BigInt(ms)))

async function allRaw(q: Expression, payload = false) {
  const select = { ...ALL, payload }
  const out: Raw[] = []
  let cursor: string | undefined
  do {
    const page = await pub.query(q, { select, limit: 200, cursor })
    out.push(...(page.entities as unknown as Raw[]))
    cursor = page.cursor
  } while (cursor)
  return out
}

export type Snapshot = {
  parties: Party[]
  notices: Notice[]
  consents: Consent[]
  receipts: Receipt[]
  leases: Lease[]
  ceased: Ceased[]
}

function sortOut(rows: Raw[]): Snapshot {
  const of = (k: Kind) => rows.filter((e) => s(e, "kind") === k)
  return {
    parties: of("party").map(toParty),
    notices: of("notice").map(toNotice),
    consents: of("consent").map(toConsent),
    receipts: of("receipt").map(toReceipt),
    leases: of("lease").map(toLease),
    ceased: of("ceased").map(toCeased),
  }
}

/** Every company, vendor and notice, in one query. */
export async function getDirectory(): Promise<Snapshot> {
  return sortOut(await allRaw(and(eq("app", APP), or(kindIs("party"), kindIs("notice"))), true))
}

/**
 * Everything about one person's addresses, in one query: consents they created and still own,
 * receipts they wrote, and the leases and stop notes vendors wrote about them.
 */
export async function getPerson(addresses: Address[]): Promise<Snapshot> {
  const owns = or(...addresses.map((a) => and(eq("$owner", addr(a)), eq("$creator", addr(a)))))
  const wrote = or(...addresses.map((a) => eq("$creator", addr(a))))
  const about = or(...addresses.map((a) => eq("principal", addr(a))))
  const q = and(
    eq("app", APP),
    or(and(kindIs("consent"), owns), and(kindIs("receipt"), wrote), and(or(kindIs("lease"), kindIs("ceased")), about)),
  )
  return sortOut(await allRaw(q))
}

/** What the vendors need each round, in one query: notices, live consents, leases, recent withdrawals. */
export async function getDuty(since: number): Promise<Snapshot> {
  const q = and(
    eq("app", APP),
    or(kindIs("notice"), kindIs("consent"), kindIs("lease"), and(kindIs("receipt"), eq("action", "withdrawn"), sinceMs(since))),
  )
  const snap = sortOut(await allRaw(q, true))
  snap.consents = snap.consents.filter((c) => lc(c.owner) === lc(c.creator))
  return snap
}

/** The public cease board, in one query. */
export async function getBoard(since: number): Promise<Snapshot> {
  const q = and(
    eq("app", APP),
    or(
      kindIs("party"),
      kindIs("lease"),
      and(kindIs("receipt"), eq("action", "withdrawn"), sinceMs(since)),
      and(kindIs("ceased"), sinceMs(since)),
    ),
  )
  return sortOut(await allRaw(q, true))
}
