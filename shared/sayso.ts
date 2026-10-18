// Say So: the Arkiv schema, the queries the app runs, and the consent check.
// Every entity carries `app = "sayso"` and a `kind`. Attribute names are lowercase snake_case
// because the node rejects uppercase names (see arkiv/friction.md).
import { createPublicClient, ExpirationTime, jsonToPayload } from "@arkiv-network/sdk"
import { addr, i32, key, u64 } from "@arkiv-network/sdk/attr"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { and, eq, gte, or, render, startsWith, type Expression } from "@arkiv-network/sdk/query"
import { http, type Address, type Hex } from "viem"
import { isSealed, type Sealed } from "./seal"

export const APP = "sayso"
export const EXPLORER = "https://tiramisu.explorer.arkiv.network"
export const DATA_EXPLORER = "https://data.arkiv.network"

export type Kind = "party" | "notice" | "consent" | "receipt" | "lease" | "ceased" | "declaration" | "dla"
export type Action = "granted" | "denied" | "withdrawn" | "renewed"

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
  hi?: { title: string; text: string; dataItems: string[] }
  contact: string
  version: number
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
  notice: Hex
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

/** A person's own record about a real company outside the demo: "I withdrew X from Y at this time". */
export type Declaration = {
  key: Hex
  creator: Address
  action: "withdrawn"
  company: string
  /** Set when the company was picked from RBI's directory: the lender behind the app, and the mirror entity. */
  lender: string
  dla: Hex
  purpose: string
  atMs: number
  createdAt: bigint
  expiresAt: bigint
  /** Records since 18 Oct 2026 carry company, lender and purpose only inside an AES-GCM payload (shared/seal.ts). */
  sealed?: Sealed
  /** Set in the browser once opened: the link to give the company (our record page plus the key). */
  link?: string
}

/** What a sealed record holds. Readable only with the record's key. */
export type DeclarationBody = { company: string; purpose: string; lender?: string; dla?: Hex; at_ms: number }

/** One app from RBI's directory of digital lending apps, as mirrored on Arkiv. */
export type Dla = {
  key: Hex
  creator: Address
  app: string
  lender: string
  lenderType: string
  url: string
  snapshot: string
  expiresAt: bigint
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
  expiresAt: bigint
}

type Raw = {
  key: Hex
  owner?: Hex
  creator?: Hex
  createdAt?: bigint
  expiresAt?: bigint
  attributes?: Readonly<Record<string, { type: string; value: unknown }>>
  payload?: Uint8Array
  toJson?: () => unknown
}

const s = (e: Raw, n: string) => String(e.attributes?.[n]?.value ?? "")
const n = (e: Raw, n: string) => Number(e.attributes?.[n]?.value ?? 0)
const b = (e: Raw, n: string) => BigInt((e.attributes?.[n]?.value as bigint | undefined) ?? 0n)

const ALL = { key: true, owner: true, creator: true, createdAt: true, expiresAt: true, attributes: true } as const

// Walks every page (the node caps a page at 200).
async function all(where: ReturnType<typeof and>, opts: { payload?: boolean; createdBy?: Address; ownedBy?: Address } = {}) {
  // Pin the walk to one block: a cursor is bound to its block, and page.next() does not carry the
  // block over, so a new block between pages fails with "cursor belongs to a different ... block".
  const head = (await pub.getBlockTiming()).currentBlock
  let q = pub.select(opts.payload ? { ...ALL, payload: true } : ALL).where(where).limit(200).atBlock(head)
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
  const j = (e.toJson?.() ?? {}) as {
    title?: string
    text?: string
    data_items?: string[]
    hi?: { title: string; text: string; data_items: string[] }
    contact?: string
  }
  return {
    key: e.key,
    fiduciary: e.creator as Address,
    purpose: s(e, "purpose"),
    periodSeconds: Number(b(e, "period_s")),
    processor: s(e, "processor") as Address,
    title: j.title ?? s(e, "purpose"),
    text: j.text ?? "",
    dataItems: j.data_items ?? [],
    hi: j.hi ? { title: j.hi.title, text: j.hi.text, dataItems: j.hi.data_items } : undefined,
    contact: j.contact ?? "",
    version: n(e, "version") || 1,
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
  notice: s(e, "notice") as Hex,
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

export const toDeclaration = (e: Raw): Declaration => ({
  sealed: e.payload ? ((j) => (isSealed(j) ? j : undefined))(e.toJson?.()) : undefined,
  key: e.key,
  creator: e.creator as Address,
  action: "withdrawn",
  company: s(e, "company"),
  lender: s(e, "lender"),
  dla: s(e, "dla") as Hex,
  purpose: s(e, "purpose"),
  atMs: Number(b(e, "at_ms")),
  createdAt: e.createdAt ?? 0n,
  expiresAt: e.expiresAt ?? 0n,
})

export const toDla = (e: Raw): Dla => {
  // The sync reads without payloads, so the app link is only there when the query selected it.
  const j = (e.payload ? e.toJson?.() : {}) as { url?: string }
  return {
    key: e.key,
    creator: e.creator as Address,
    app: s(e, "app_name"),
    lender: s(e, "lender"),
    lenderType: s(e, "lender_type"),
    url: j.url ?? "",
    snapshot: s(e, "snapshot"),
    expiresAt: e.expiresAt ?? 0n,
  }
}

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
  expiresAt: e.expiresAt ?? 0n,
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

/**
 * A notice carries what Rule 3 of the DPDP Rules asks for: the itemised data, the specified purpose,
 * how to withdraw and whom to contact, in English and Hindi. The rights text itself is the same for
 * every notice and lives in the app; the payload holds what differs per company and purpose.
 */
export const noticeCreate = (o: {
  purpose: string
  periodSeconds: number
  processor: Address
  title: string
  text: string
  dataItems: string[]
  hi: { title: string; text: string; dataItems: string[] }
  contact: string
  version: number
}) => ({
  payload: jsonToPayload({
    title: o.title,
    text: o.text,
    data_items: o.dataItems,
    hi: { title: o.hi.title, text: o.hi.text, data_items: o.hi.dataItems },
    contact: o.contact,
  }),
  contentType: "application/json" as const,
  attributes: {
    app: APP,
    kind: "notice",
    purpose: o.purpose,
    period_s: u64(BigInt(o.periodSeconds)),
    processor: addr(o.processor),
    version: i32(o.version),
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

/**
 * Every answer leaves a record, including "no": the First Schedule (Part B, item 3) lists consents
 * "given, denied or withdrawn". A denied receipt has a notice but no consent. Receipts describe the
 * person, so only the person can extend them (and, as owner, delete them); expiry stays theirs.
 */
export const receiptCreate = (o: { action: Action; consent?: Hex; notice: Hex; fiduciary: Address; purpose: string; processor: Address }) => ({
  payload: jsonToPayload({}),
  contentType: "application/json" as const,
  attributes: {
    app: APP,
    kind: "receipt",
    action: o.action,
    ...(o.consent ? { consent: key(o.consent) } : {}),
    notice: key(o.notice),
    fiduciary: addr(o.fiduciary),
    purpose: o.purpose,
    processor: addr(o.processor),
    at_ms: u64(BigInt(Date.now())),
  },
  expires: LIFETIME.record,
  flags: { readonly: true, permissionlessExtension: false },
})

/** What a sealed record says, before sealing. A loan app from RBI's directory adds the lender and the mirror entity. */
export const declarationBody = (o: { company: string; purpose: string; dla?: Dla }): DeclarationBody => ({
  company: o.company,
  purpose: o.purpose,
  at_ms: Date.now(),
  ...(o.dla ? { dla: o.dla.key, lender: o.dla.lender } : {}),
})

/**
 * A person's own, timestamped record that they withdrew consent from a real company. In public it is
 * only "a Say So record, written at this block": company, lender and purpose sit in an AES-GCM payload
 * that the person and whoever gets their letter can open. The app blocks digits and "@" in company
 * names, so phone numbers and emails cannot slip in even there. The person picks how long it lasts,
 * and only they can extend or delete it.
 */
export const declarationCreate = (o: { sealed: Sealed; years: number }) => ({
  payload: jsonToPayload(o.sealed),
  contentType: "application/json" as const,
  attributes: { app: APP, kind: "declaration" },
  expires: ExpirationTime.fromYears(o.years),
  flags: { readonly: true, permissionlessExtension: false },
})

/** One record by key, with its payload, for the page a letter links to. */
export async function getDeclaration(k: Hex): Promise<Declaration | null> {
  const e = (await pub.getEntity(k)) as unknown as Raw
  return e && s(e, "kind") === "declaration" && s(e, "app") === APP ? toDeclaration(e) : null
}

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

async function allRaw(q: Expression | string, payload = false) {
  const select = { ...ALL, payload }
  const out: Raw[] = []
  let cursor: string | undefined
  let atBlock: bigint | undefined
  do {
    // Later pages read at the first page's block, which is the block their cursor is bound to.
    const page = await pub.query(q, { select, limit: 200, cursor, atBlock })
    out.push(...(page.entities as unknown as Raw[]))
    cursor = page.cursor
    atBlock = page.blockNumber
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
  declarations: Declaration[]
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
    declarations: of("declaration").map(toDeclaration),
  }
}

/** Every company, vendor and notice, in one query. */
export async function getDirectory(trusted: readonly string[]): Promise<Snapshot> {
  // Trust comes from $creator: only parties and notices written by the known wallets.
  const by = or(...trusted.map((a) => eq("$creator", addr(a as Address))))
  return sortOut(await allRaw(and(eq("app", APP), or(kindIs("party"), kindIs("notice")), by), true))
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
    or(
      and(kindIs("consent"), owns),
      and(or(kindIs("receipt"), kindIs("declaration")), wrote),
      and(or(kindIs("lease"), kindIs("ceased")), about),
    ),
  )
  // Payloads on: sealed records carry their content there. Everything else here has an empty payload.
  return sortOut(await allRaw(q, true))
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

/**
 * The public cease board, in one query. Times are block ranges on $createdAt, which no writer can
 * set, and leases and stop notes count only if a known vendor's wallet wrote them.
 */
export async function getBoard(sinceBlock: bigint, vendors: readonly string[]): Promise<Snapshot> {
  const byVendor = or(...vendors.map((a) => eq("$creator", addr(a as Address))))
  const kinds = and(
    eq("app", APP),
    or(and(kindIs("receipt"), eq("action", "withdrawn")), kindIs("consent"), and(or(kindIs("lease"), kindIs("ceased")), byVendor)),
  )
  // The node filters on $createdAt, but the SDK builder refuses it ("carries no index"), so this one
  // clause is appended as query text. See friction.md.
  const q = `${render(kinds)} AND $createdAt >= u64(${sinceBlock})`
  return sortOut(await allRaw(q))
}

// ---------- RBI's directory of digital lending apps, mirrored on Arkiv ----------

/**
 * A mirrored app lives 30 days. The sync renews every app still in RBI's list, so an app RBI drops simply
 * expires. Only the mirror can renew (permissionless extension off), or anyone could keep a delisted app alive.
 */
export const DLA_LIFETIME = ExpirationTime.fromDays(30)

export const dlaCreate = (r: { app: string; lender: string; lenderType: string; url: string }, snapshot: string) => ({
  payload: jsonToPayload({ app: r.app, lender: r.lender, lender_type: r.lenderType, url: r.url }),
  contentType: "application/json" as const,
  attributes: {
    app: APP,
    kind: "dla",
    source: "rbi_dla",
    snapshot,
    app_name: r.app,
    app_lc: r.app.toLowerCase(),
    lender: r.lender,
    lender_lc: r.lender.toLowerCase(),
    lender_type: r.lenderType,
  },
  expires: DLA_LIFETIME,
  flags: { readonly: true, permissionlessExtension: false },
})

/** Search the mirrored directory by the start of an app's or a lender's name, straight from Arkiv. */
export async function searchDla(text: string, mirror: Address, limit = 8): Promise<Dla[]> {
  const q = text.trim().toLowerCase()
  if (q.length < 2) return []
  const page = await pub
    .select({ ...ALL, payload: true })
    .where(and(eq("app", APP), kindIs("dla"), eq("$creator", addr(mirror)), or(startsWith("app_lc", q), startsWith("lender_lc", q))))
    .limit(limit)
    .fetch()
  return (page.entities as unknown as Raw[]).map(toDla)
}

/** Every mirrored app, for the sync. */
export async function getAllDla(mirror: Address): Promise<Dla[]> {
  return (await all(and(eq("app", APP), kindIs("dla")), { createdBy: mirror })).map(toDla)
}
