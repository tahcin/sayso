# Friction report

What we hit building Say So on Arkiv, 17 October 2026. Every item below happened to us; the scripts and commits that show it are linked. We also list the paths that worked, with numbers, because a smooth path is worth knowing too.

**Versions:** `@arkiv-network/sdk` 0.8.1 (npm `latest`, pulls `viem` 2.57.7), Node 26.11.1, macOS 27 on Apple M1, TypeScript 7.0.2, Vite 8.3.4, Cloudflare Workers (`nodejs_compat`, compatibility date 2026-10-01), Tiramisu testnet (chain 7738577), blocks around 679,000 to 690,000.

Time to first entity: under 2 hours (SDK spike in the morning; the first Say So entities, the companies' `party` records, landed at about 11:30 IST).

## The one thing to fix first

**Publish the anonymous read quota and make it visible in the SDK** (item 1). It cost us the most time, it is invisible until it bites, and it will bite every hackathon demo that refreshes a page.

## Issues

### 1. Anonymous reads hit an undocumented cost quota; viem's default retries then stall the page
- **Surface:** public RPC, TypeScript SDK reads, docs (Access Keys page).
- **Expected:** the docs say the public RPC "works without [a key], at the default rate limit". We expected that limit to be stated, and a clear error when we hit it.
- **Actual:** after roughly 100 `arkiv_query` calls from one IP in a few minutes (a 40-query probe plus our page refreshing every 30 s), every query returned HTTP 429 with `ratelimit: limit=10000, remaining=0, reset=2655` and `retry-after: 2655`, about 44 minutes, and the JSON-RPC detail `ANON_COST_LIMITED`. Each query costs 100 units (`arkiv-cost: 100`), so the anonymous budget is about 100 queries per IP per window. At the same moment `eth_blockNumber` from the same IP showed `ratelimit: limit=600, remaining=599, reset=60`, so there are two buckets (requests and cost), and plain `eth_*` calls kept working while every query failed. Our Cloudflare Worker's egress IP hit the same wall from a one-minute cron.
  - The 429 body is plain JSON, not a JSON-RPC error: `{"error":"ANON_COST_LIMITED","message":"unauthenticated query budget exhausted; get an API key at https://hub.arkiv.network for a monthly quota"}`. That message is exactly what a developer needs, but through the SDK it arrives as `HTTP request failed. Status: 429 … Details: "ANON_COST_LIMITED"`, without the sentence that says to get a key.
  - The SDK's default `http()` transport retries the 429, so our page did not show an error; it sat on "Reading…" for over a minute. Only `http(url, { retryCount: 0 })` surfaced the 429 at once.
- **Repro:** run `arkiv_query` 100+ times from one IP within a few minutes, then `curl -s -D - https://rpc.tiramisu.db-chain.testnet.arkiv.network -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"arkiv_query","params":["app = str('sayso')",{"select":{"key":true},"limit":"0x1"}]}'` and read the headers.
- **What fixed it for us:** a free access key (1,000,000 credits a month) used server side only; one compound query per screen instead of eight; refreshing on WebSocket events instead of a timer; and a read-only relay in our Worker that a browser switches to when its IP is limited (`src/data.ts`, `worker/index.ts`).
- **Suggested fix:** state the anonymous budget (units per window, cost per method) on the Access Keys page; have the SDK raise a typed `QuotaExceededError` with `retryAfter` instead of letting viem retry; expose `Arkiv-Cost` and `Arkiv-Quota-Used-Percent` on query results.

### 2. Uppercase attribute names pass the SDK, the node rejects them, and the error contradicts itself
- **Surface:** SDK `createEntity`, docs cookbook.
- **Expected:** the SDK rejects `entityType` before sending, or the node accepts it. The Leaderboard cookbook (docs.arkiv.network/cookbook/leaderboard) uses camelCase names 13 times, and the SDK's own JSDoc examples use `testKey`.
- **Actual:** the transaction fails at gas estimation with `EntityMutationError: Transaction failed: an attribute name holds "T" (0x54) at byte 6, which is outside the name charset ("A"-"Z", "a"-"z", "0"-"9", ".", "-" and "_", with a letter first)`. The message lists "A"-"Z" as allowed while rejecting "T".
- **Repro:** `wallet.createEntity({ payload: stringToPayload("x"), contentType: "text/plain", attributes: { entityType: "doc" }, expires: ExpirationTime.fromMinutes(5) })`.
- **Suggested fix:** make `validateAttributeName` match the node (lowercase), correct the charset text, update the cookbook and JSDoc. We use lowercase snake_case everywhere because of this.

### 3. The node explains unsupported operators clearly; the SDK throws that explanation away
- **Surface:** `@arkiv-network/sdk/query` (`ne`, `exists`, `hasType`), viem error mapping.
- **Expected:** if an exported combinator is unsupported, the error says so.
- **Actual:** the node does say so. Sent as raw JSON-RPC, `kind != str('party')` returns code -32002 with `"!= is not part of the query language — write NOT (attr = value) for the complement"`; `EXISTS(kind)` returns `"exists(…) is not supported — the index has no per-attribute presence set in this version"`; `TYPEOF(kind) = str` returns `"typeof(…) is not supported — a value predicate already asserts the attribute's type"`. Through the SDK the same queries throw `QueryError: Query rejected (type, -32002): Requested resource not available..`, which is viem's generic label for code -32002, so the node's helpful text (and the `NOT (…)` workaround it suggests) never reaches the developer. Meanwhile `ne`, `exists` and `hasType` are still exported from the query module.
- **Repro:** `publicClient.select({ key: true }).where(eq("app", "sayso"), ne("kind", "party")).fetch()`, then the same query as raw JSON-RPC: `curl -s https://rpc.tiramisu.db-chain.testnet.arkiv.network -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"arkiv_query","params":["app = str(\u0027sayso\u0027) AND kind != str(\u0027party\u0027)",{"select":{"key":true},"limit":"0x1"}]}'`.
- **Effect on our design:** we wanted "withdrawals no vendor has answered" as one query; we join withdrawals, stop notes and leases on the client instead.
- **Suggested fix:** pass `error.data.message` through in `QueryError`; mark `ne`, `exists` and `hasType` deprecated (or have `ne` compile to `NOT (a = v)`, which the node accepts).

### 4. `ownedBy()` / `createdBy()` cannot be used inside OR groups, and the alternative is undocumented
- **Surface:** SDK query builder, docs (Querying Data).
- **Expected:** a documented way to say "(consents I own) OR (receipts I wrote) OR (leases about me)" in one query. We need this because of item 1: one query per screen, not four.
- **Actual:** `ownedBy()` and `createdBy()` apply to the whole query. We first wrote the query as a raw string with `$owner = addr(…)` inside OR groups, which the node accepts. Later we found that `eq("$owner", addr(a))` and `eq("$creator", addr(a))` also work as ordinary builder predicates (`render()` prints `$owner = addr(0x…)`), but the docs and types only show `ownedBy()`.
- **Repro:** `render(or(and(eq("kind","consent"), eq("$owner", addr(A))), and(eq("kind","receipt"), eq("$creator", addr(A)))))`. See `getPerson` in `shared/sayso.ts`.
- **Suggested fix:** document `$owner`, `$creator`, `$createdAt` and `$expiresAt` as predicates, ideally with helpers (`owner(a)`, `creator(a)`) that compose inside `or()`.

### 4b. The SDK refuses `$createdAt` filters that the node supports
- **Surface:** SDK query builder (`gte("$createdAt", …)`), rules repo AGENTS.md.
- **Expected:** the challenge's own AGENTS.md says "sort on the client, or range-filter on `$createdAt`". We wanted the cease board's time window on `$createdAt`, because that is set by the chain, while our `at_ms` attribute is set by whoever writes the receipt.
- **Actual:** the builder throws `InvalidPredicateError: "$createdAt" is returned in query results but carries no index, so it cannot be filtered on. Select it and filter the results in JavaScript instead.` (a hard-coded list `RESULT_ONLY_SYSTEM_ATTRIBUTES` in `dist/query-*.js`). The node accepts the same filter and applies it: as raw JSON-RPC, `app = str('sayso') AND $createdAt >= u64(99999999)` returns `[]`, and `$createdAt >= u64(688000) AND $createdAt < u64(688010)` returns only entities created at block 688009.
- **Repro:** `pub.select({ key: true }).where(and(eq("app", "sayso"), gte("$createdAt", u64(688000n)))).fetch()` throws; `pub.query("app = str('sayso') AND $createdAt >= u64(688000)")` works.
- **What we did:** `getBoard` in `shared/sayso.ts` renders the typed expression with `render()` and appends the `$createdAt` clause as text.
- **Suggested fix:** drop `$createdAt` (and probably `$expiresAt`) from the SDK's result-only list, or tell us which system attributes the node really indexes.

### 5. `predictEntityKeys` is on the public client, not the wallet client
- **Surface:** SDK types.
- **Expected:** `wallet.predictEntityKeys(...)`, since it exists to build that wallet's next batch (we use it so a consent and the receipt pointing at it land in one `executeBatch`).
- **Actual:** `TS2339: Property 'predictEntityKeys' does not exist on type …` on the wallet client. It lives on the public client and takes `owner` explicitly.
- **Suggested fix:** add it to the wallet actions, defaulting `owner` to the wallet's account.

### 6. `predictEntityKeys` is an `eth_call` to a contract; nothing lists which RPC methods each SDK action needs
- **Surface:** SDK, RPC, docs.
- **Expected:** a list of the JSON-RPC methods the SDK uses, so a proxy can allow exactly those.
- **Actual:** our read relay allowed `arkiv_*` and a few `eth_*` methods and rejected `eth_call`. Giving consent then failed with `HTTP request failed. Status: 400 … "read methods only"` because `predictEntityKeys` calls `entityNonce(address)` on `0x4400000000000000000000000000000000000044` through `eth_call`. Nothing in the docs mentions this contract or the method.
- **Repro:** route a public client through a proxy that blocks `eth_call`, then call `predictEntityKeys({ owner, count: 1 })`.
- **Suggested fix:** a short "RPC methods used" table per SDK action in the docs (it would also help anyone writing an access-key proxy, which the Access Keys page recommends).

### 7. `watchEntityEvents` has no server-side filter and no expiry event
- **Surface:** WebSocket entity events.
- **Expected:** watch only my app's entities (by owner, creator or attribute), and learn when one expires.
- **Actual:** the watcher delivers every entity event on the chain: in our spike 91 events in about 45 s, of which 14 were ours; on our live page the ticker counts about 250 chain events in a few minutes. There is no event for expiry (the `EntityEvent` union has Created, Patched, ExpiryExtended, OwnershipTransferred and Deleted). `EntityDeleted` carries only the key and owner.
- **Effect on our design:** every browser tab receives all chain traffic and filters it; we keep a set of the person's consent and lease keys to recognise deletes; a consent that expires on its own (our 10-minute credit check) only shows as ended on the next refresh, computed from `$expiresAt`.
- **Suggested fix:** `owner` / `creator` / `entityKeys` filters (log topics), and an `EntityExpired` event or a documented way to watch expiries.

### 8. Access key setup: an undocumented registration step, and quota numbers that disagree
- **Surface:** Arkiv Hub (hub.arkiv.network), docs (Access Keys).
- **Expected:** following the doc (connect wallet, sign, select network, solve captcha, Generate) gives a key.
- **Actual:** the doc's link `hub.arkiv.network/api-keys` redirects to `/access-keys`. After signing in, the keys API answered `{"error":"Unauthorized"}` until a separate registration step was done ("One more thing … Add your email so we can reach you…"); the error does not say why. After one 100-unit query the Hub reported "quota used 1%" against a 1,000,000-credit monthly quota (100 of 1,000,000 is 0.01%), and `used: 200` with `requests: 0, calls: 0, lastUsedAt: null`. The page does warn that counts are sampled and may lag. Reloading the page drops back to "You need a connected wallet…" although the server session is valid.
- **Repro:** open `https://hub.arkiv.network/api-keys` (lands on `/access-keys`), sign in with a fresh wallet, and call `GET https://hub.arkiv.network/api/keys` from that tab before registering: `401 {"error":"Unauthorized"}`. Register, generate a key, run one `arkiv_query` with `X-API-KEY`, then read `GET /api/keys` again for the usage numbers.
- **Suggested fix:** mention registration in the doc; make the 401 say "complete registration"; reconcile the percentage with the credit count.

### 9. Node 25+ prints `ExperimentalWarning: localStorage is not available`
- **Surface:** SDK debug logger.
- **Actual:** on the first SDK call, every Node 26 script prints `ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.` The trace points to `getDebugEnv`, which checks `"localStorage" in globalThis` when `DEBUG` is unset. We see it on every run of `scripts/seed.ts` and `scripts/e2e.ts`.
- **Suggested fix:** check `typeof window !== "undefined"` first.

### 10. A selection stored in a variable silently types results as `{}`
- **Surface:** SDK types for `select()`.
- **Actual:** `const sel = { owner: true, key: true }; (await c.select(sel)…fetch()).entities[0].owner` gives `TS2339: Property 'owner' does not exist on type '{}'`. We share one selection object across queries (`ALL` in `shared/sayso.ts`) and had to cast results.
- **Repro:** the snippet above with SDK 0.8.1 and TypeScript strict mode, or remove the `as unknown as Raw[]` cast in `all()` in `shared/sayso.ts`.
- **Suggested fix:** an overload that falls back to `FullEntity` for a widened `boolean` selection.

### 11. The `tiramisu` chain object has no `blockExplorers`
- **Expected:** `tiramisu.blockExplorers.default.url` = https://tiramisu.explorer.arkiv.network, so viem errors and wallet "add network" dialogs link the explorer.
- **Actual:** the field is absent; we hard-code explorer URLs in `shared/sayso.ts`.
- **Repro:** `node -e 'import("@arkiv-network/sdk/chains").then(m => console.log(m.tiramisu.blockExplorers))'` prints `undefined` (0.8.1).

### 12. Docs and README rough edges
- `docs.arkiv.network/llms.txt` has a literal `### Symbol(StarlightTypeDocSidebarGroupLabel)` heading with no links under it, so coding agents that read llms.txt never see the API reference.
- The SDK README says installing gives `^0.6.0`, mentions a `sample` folder that is not in the tarball, and recommends generating keys on a third-party site.
- `brotli-wasm` is a runtime dependency, but nothing in 0.8.1 imports `utils/compression.ts`.
- **Repro:** `curl -s https://docs.arkiv.network/llms.txt | grep -n "Symbol("` (line 23 on 17 Oct); `grep brotli node_modules/@arkiv-network/sdk/package.json` lists it, `grep -rl brotli node_modules/@arkiv-network/sdk/dist` finds nothing.

### 13. `page.next()` breaks a long walk when a new block lands between pages
- **Surface:** SDK query builder pagination (`QueryResult.next()`).
- **Expected:** the `QueryResult.blockNumber` JSDoc says `Every page of one walk reads the same block — the cursor is bound to it — so results cannot shift under a paginating reader`, so `while (page.hasNextPage()) page = await page.next()` should finish however many pages there are.
- **Actual:** walking our mirrored RBI apps (up to 9 pages of 200) failed partway with `QueryError` code -32005, `cursor belongs to a different query, block or select — start a new page-through`. `next()` re-sends the first request with the new cursor but without the block the first page was read at, so once a new block lands the node sees a cursor from an older block. Short walks usually finish inside one block, which hides it.
- **Repro:** with 0.8.1, create more than 400 entities under one attribute, then `let p = await pub.select({ key: true }).where(eq("kind", "dla")).limit(200).fetch(); while (p.hasNextPage()) p = await p.next()` while blocks are being produced (Tiramisu makes one every 2 s).
- **What we did:** pin the walk before the first fetch: `const head = (await pub.getBlockTiming()).currentBlock` and `.atBlock(head)` on the builder (`all()` in `shared/sayso.ts`).
- **Suggested fix:** have `fetchPage` pass the first page's `blockNumber` as `atBlock` on every following page, which is what the JSDoc already promises.

### 14. `entity.toJson()` throws when the payload was not selected
- **Surface:** SDK `Entity` (`toJson()`).
- **Expected:** an entity read without `payload: true` returns `undefined` from `toJson()` (or the type says payload may be absent), so one mapper can serve queries with and without payloads.
- **Actual:** `Error: Entity has no payload — the query did not select it. Use select({ payload: true }).` Our mirror sync reads all 1,749 apps without payloads to keep the read small, and the shared `toDla` mapper crashed on the first entity.
- **Repro:** `const p = await pub.select({ key: true, attributes: true }).where(eq("app", "sayso")).limit(1).fetch(); p.entities[0].toJson()` (0.8.1).
- **What we did:** guard on `e.payload` before calling `toJson()` (`toDla` in `shared/sayso.ts`).
- **Suggested fix:** return `undefined`, or add `tryJson()`; the message itself is clear, it is the throw that surprises.

## Paths that worked (tested, with numbers)

- **Atomic batches carried the whole design.** Giving consent is one `executeBatch` of N consents plus N receipts whose `consent` attribute points at keys predicted with `predictEntityKeys` and the matching `salt`. The keys matched every time. Withdraw (delete + create), renew (extension + create) and a vendor round (creates + deletes + extensions) are each one transaction.
- **`ExpirationTime.atBlock()` for leases.** A vendor's lease expires at exactly the consent's `$expiresAt` block, and `extensions` with `atBlock(newExpiry)` keeps it in step after a renewal. No drift.
- **Creation flags behaved as documented.** `readonly` blocked patches; `permissionlessExtension: false` on consents means only the person can extend them; the owner could still delete a readonly entity.
- **Guard rails gave clear errors before any gas was spent:** shortening an expiry ("would shorten its life"), a patch by a non-owner ("is owned by 0x…, not 0x…"), a patch on a readonly entity, an expiry not a multiple of 2 s, a 129-byte string, a payload over 128 KiB.
- **Cloudflare Workers:** SDK 0.8.1 ran unchanged in a Worker with `nodejs_compat`, including `executeBatch`, `sendTransaction` and compound queries, on the first try.
- **Browser:** a Vite production build needed no polyfills. Reads with no wallet, writes from an HD-derived local account (`mnemonicToAccount`), and `watchEntityEvents` over `webSocket()` all worked.
- **Typed attributes and ranges:** `addr`, `key` and `u64` attributes round-tripped; `gte("at_ms", u64(…))` ranges and compound `and`/`or` queries returned in about 250 to 350 ms.
- **Costs:** a single create about 90,000 to 111,000 gas, a batch of 5 creates 477,000, extend, transfer or delete about 25,000 each, at 1 gwei. Lifetime does not change the fee: a 5-year entity cost the same gas as a 1-hour one.
- **Write latency:** 3.7 to 11 s from call to receipt, independent of the client's `pollingInterval`.
- **Explorers:** the block explorer lists an address's transactions with decoded Arkiv operations (CREATE, UPDATE, EXTEND, TRANSFER, DELETE), and `data.arkiv.network/owner/<address>` lists live entities, which is what we point judges to.
