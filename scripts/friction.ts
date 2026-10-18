// Re-runs the issues in arkiv/friction.md against the live Tiramisu testnet and the installed SDK, and
// prints for each one what we expected, what happens today, and a verdict. It is a report, not a test:
// it exits 0 whatever it finds. Reads only; nothing is written to the chain and no gas is spent.
// Run: npm run friction   (or: npx tsx --env-file-if-exists=.env scripts/friction.ts)
// With ARKIV_KEY in .env, most reads use the keyed endpoint; the quota check (item 1) always goes
// anonymous and makes at most 5 queries, so it never hammers the public RPC. The key is never printed.
import { createPublicClient, createWalletClient, ExpirationTime, isValidAttributeName, stringToPayload } from "@arkiv-network/sdk"
import { addr, u64 } from "@arkiv-network/sdk/attr"
import { tiramisu } from "@arkiv-network/sdk/chains"
import * as Q from "@arkiv-network/sdk/query"
import { and, eq, exists, gte, ne, or, render } from "@arkiv-network/sdk/query"
import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { http, toFunctionSelector, type Address } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { APP, pub, RPC, useRpc } from "../shared/sayso"

const t0 = Date.now()
const KEY = process.env.ARKIV_KEY
const rpc = KEY ? `${RPC}/${KEY}` : RPC
useRpc(rpc)
const MIRROR: Address = "0x822BB671e6Ce0F2b69A500344764D9fedE31E725"
const ROOT = resolve(import.meta.dirname, "..")
const SDK = join(ROOT, "node_modules/@arkiv-network/sdk")
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Anything printed passes through here, so the access key never reaches the terminal (viem puts the URL in errors).
const clean = (x: unknown) => {
  const s = x instanceof Error ? x.message : typeof x === "string" ? x : JSON.stringify(x, (_, v) => (typeof v === "bigint" ? v.toString() : v))
  return (KEY ? s.split(KEY).join("<key>") : s).replace(/\s+/g, " ").trim()
}
const short = (x: unknown, n = 220) => {
  const s = clean(x)
  return s.length > n ? s.slice(0, n) + "…" : s
}

type Verdict = "still reproduces" | "fixed" | "could not run" | "not triggered" | "partly reproduces"
type Result = { verdict: Verdict; actual: string[]; note?: string }
const results: { id: string; title: string; verdict: Verdict }[] = []

async function check(id: string, title: string, expected: string, run: () => Promise<Result>) {
  console.log(`\n#${id} ${title}`)
  console.log(`  expected: ${expected}`)
  let r: Result
  const s = Date.now()
  try {
    r = await run()
  } catch (e) {
    r = { verdict: "could not run", actual: [`the check itself threw: ${short(e, 300)}`] }
  }
  for (const line of r.actual) console.log(`  actual:   ${clean(line)}`)
  if (r.note) console.log(`  note:     ${clean(r.note)}`)
  console.log(`  verdict:  ${r.verdict.toUpperCase()}   (${((Date.now() - s) / 1000).toFixed(1)} s)`)
  results.push({ id, title, verdict: r.verdict })
}

// Raw JSON-RPC, to see what the node itself says (status, headers, body) without the SDK in between.
async function raw(url: string, method: string, params: unknown[]) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  })
  const text = await res.text()
  let body: { result?: unknown; error?: { code?: number; message?: string } | string; message?: string } = {}
  try {
    body = JSON.parse(text)
  } catch {}
  return { status: res.status, headers: res.headers, body, text }
}
const rawQuery = (url: string, q: string, select: object = { key: true }, limit = 1) =>
  raw(url, "arkiv_query", [q, { select, limit: `0x${limit.toString(16)}` }])
const nodeError = (b: Awaited<ReturnType<typeof raw>>["body"]) =>
  typeof b.error === "object" ? `${b.error.code}: ${b.error.message}` : String(b.error ?? "")

console.log(`Say So friction repro · ${new Date().toISOString()} · SDK ${JSON.parse(readFileSync(join(SDK, "package.json"), "utf8")).version} · Node ${process.version}`)
console.log(`reads: ${KEY ? "access key (keyed endpoint)" : "anonymous (no ARKIV_KEY)"}; item 1 always anonymous`)

// ---------- 1 ----------
await check(
  "1",
  "Anonymous read quota: undocumented budget, 429 hidden behind viem retries",
  "a stated anonymous budget, and a clear, immediate error with Retry-After when it runs out",
  async () => {
    const actual: string[] = []
    let hit: Awaited<ReturnType<typeof raw>> | undefined
    let calls = 0
    for (; calls < 5 && !hit; ) {
      calls++
      const r = await rawQuery(RPC, `app = str('${APP}')`)
      if (calls === 1) {
        const h = (n: string) => r.headers.get(n) ?? "absent"
        actual.push(`first anonymous arkiv_query: HTTP ${r.status}, arkiv-cost=${h("arkiv-cost")}, ratelimit=${h("ratelimit")}`)
      }
      if (r.status === 429) hit = r
    }
    if (!hit) return { verdict: "not triggered", actual: [...actual, `no 429 in ${calls} anonymous queries from this IP (we stop at 5 on purpose)`], note: "the quota needs ~100 queries in a window; not forced here" }
    actual.push(`HTTP 429 after ${calls} call(s): retry-after=${hit.headers.get("retry-after")}, ratelimit=${hit.headers.get("ratelimit")}, body=${short(hit.text, 300)}`)
    // Same query through the SDK with viem's default retries: does it surface the node's sentence, and how fast?
    const viaSdk = createPublicClient({ chain: tiramisu, transport: http(RPC, { retryCount: 0 }) })
    const s = Date.now()
    try {
      await viaSdk.query(`app = str('${APP}')`, { select: { key: true }, limit: 1 })
      actual.push("SDK query succeeded")
    } catch (e) {
      const m = clean(e)
      actual.push(`SDK (retryCount 0) threw in ${Date.now() - s} ms; message ${m.includes("hub.arkiv.network") ? "includes" : "drops"} the "get an API key" sentence: ${short(m)}`)
    }
    return { verdict: "still reproduces", actual, note: "viem default-retry stall not re-timed, to avoid more anonymous calls" }
  },
)

// ---------- 2 ----------
await check(
  "2",
  "Uppercase attribute names pass the SDK, the node rejects them, and the error contradicts itself",
  "SDK rejects `entityType` before sending (or the node accepts it); the node's charset text matches the rule",
  async () => {
    const sdkOk = isValidAttributeName("entityType")
    const actual = [`SDK isValidAttributeName("entityType") = ${sdkOk}`]
    // An unfunded throwaway key fails before the node's checks show (the SDK reports "Execution error
    // without revert data"). So we let the SDK build the transaction, catch its eth_estimateGas request,
    // and replay it as a fee-less eth_call, which needs no balance and returns the engine's revert data.
    const attempt = async (attributes: Record<string, string>) => {
      let tx: Record<string, unknown> | undefined
      const w = createWalletClient({
        chain: tiramisu,
        account: privateKeyToAccount(generatePrivateKey()),
        transport: http(rpc, {
          retryCount: 0,
          onFetchRequest: async (req) => {
            const m = JSON.parse(await req.clone().text()) as { method?: string; params?: Record<string, unknown>[] }
            if (m.method === "eth_estimateGas") tx = m.params?.[0]
          },
        }),
      })
      let sdkSays = "accepted"
      try {
        await w.createEntity({ payload: stringToPayload("x"), contentType: "text/plain", attributes, expires: ExpirationTime.fromMinutes(5) })
      } catch (e) {
        sdkSays = clean(e)
      }
      if (!tx) return { sdkSays, node: "no eth_estimateGas was sent" }
      const { gasPrice, maxFeePerGas, maxPriorityFeePerGas, ...bare } = tx
      void gasPrice, maxFeePerGas, maxPriorityFeePerGas
      const r = await raw(rpc, "eth_call", [bare, "latest"])
      const err = typeof r.body.error === "object" ? (r.body.error as { message?: string; data?: string }) : undefined
      return { sdkSays, node: err ? `${err.message} ${err.data ?? ""}` : `ok ${String(r.body.result).slice(0, 20)}` }
    }
    const sel = toFunctionSelector("Ident32InvalidByte(uint256,bytes1)")
    const upper = await attempt({ entityType: "doc" })
    const lower = await attempt({ entity_type: "doc" })
    actual.push(`SDK createEntity with an unfunded key, entityType: ${short(upper.sdkSays, 120)}`)
    actual.push(`node (fee-less eth_call), entityType: ${short(upper.node, 200)}`)
    actual.push(`node (fee-less eth_call), entity_type control: ${short(lower.node, 120)}`)
    const rejects = upper.node.includes(sel.slice(2)) && !lower.node.includes(sel.slice(2))
    if (rejects) {
      const pos = Number(BigInt("0x" + upper.node.split(sel.slice(2))[1].slice(0, 64)))
      actual.push(`revert is Ident32InvalidByte (${sel}): byte ${pos} = "${"entityType"[pos]}"`)
    }
    // The sentence the SDK builds from that revert is in its own source, so it can be read without gas.
    const charset = readFileSync(join(SDK, "dist/index.js"), "utf8").match(/const CHARSET = "(.*)";/)?.[1] ?? ""
    const contradicts = charset.includes('\\"A\\"-\\"Z\\"')
    actual.push(`SDK revert text for Ident32InvalidByte lists the charset as: ${charset.replace(/\\"/g, '"')}`)
    if (!sdkOk) return { verdict: "fixed", actual, note: "the SDK now rejects uppercase before sending" }
    if (rejects) return { verdict: "still reproduces", actual, note: contradicts ? "the SDK passes it, the node rejects it, and the message still lists A-Z as allowed" : "the charset text no longer lists A-Z" }
    if (!/Ident32/.test(upper.node) && !lower.node.startsWith("ok")) return { verdict: "could not run", actual, note: "needs a funded key, see friction.md steps" }
    return { verdict: "fixed", actual, note: "the node accepted the uppercase name" }
  },
)

// ---------- 3 ----------
await check(
  "3",
  "The node explains unsupported operators; the SDK throws that explanation away",
  "QueryError carries the node's text (e.g. \"write NOT (attr = value)\"); ne/exists/hasType deprecated or working",
  async () => {
    const actual: string[] = []
    const r = await rawQuery(rpc, `app = str('${APP}') AND kind != str('party')`)
    const nodeMsg = nodeError(r.body)
    actual.push(`raw JSON-RPC (!=): HTTP ${r.status}, ${short(nodeMsg)}`)
    let sdkMsg = ""
    try {
      await pub.select({ key: true }).where(eq("app", APP), ne("kind", "party")).limit(1).fetch()
      sdkMsg = "query succeeded"
    } catch (e) {
      sdkMsg = clean(e)
    }
    actual.push(`SDK ne(): ${short(sdkMsg)}`)
    let ex = ""
    try {
      await pub.select({ key: true }).where(eq("app", APP), exists("kind")).limit(1).fetch()
      ex = "query succeeded"
    } catch (e) {
      ex = clean(e)
    }
    actual.push(`SDK exists(): ${short(ex, 160)}`)
    if (sdkMsg === "query succeeded") return { verdict: "fixed", actual, note: "ne() now works on the node" }
    const lost = /NOT/.test(nodeMsg) && !/write NOT|not part of the query language/i.test(sdkMsg)
    return lost ? { verdict: "still reproduces", actual } : { verdict: "fixed", actual, note: "the SDK message now carries the node's explanation" }
  },
)

// ---------- 4 ----------
await check(
  "4",
  "ownedBy()/createdBy() cannot sit inside OR groups; the $owner/$creator predicate is undocumented",
  "a helper such as owner(a)/creator(a) that composes inside or()",
  async () => {
    const A = MIRROR
    const expr = or(and(eq("kind", "consent"), eq("$owner", addr(A))), and(eq("kind", "dla"), eq("$creator", addr(A))))
    const text = render(expr)
    const page = await pub.select({ key: true }).where(eq("app", APP), expr).limit(1).fetch()
    const helpers = ["owner", "creator", "ownedBy", "createdBy"].filter((n) => n in Q)
    const actual = [
      `render() prints: ${short(text, 160)}`,
      `the node runs it: ${page.entities.length} entity on the first page`,
      `predicate helpers exported from /query: ${helpers.length ? helpers.join(", ") : "none"}`,
    ]
    return { verdict: helpers.length ? "fixed" : "still reproduces", actual, note: "the workaround eq(\"$owner\", addr(a)) works; the docs gap is not checked by script" }
  },
)

// ---------- 4b ----------
await check(
  "4b",
  "The SDK refuses $createdAt filters that the node supports",
  "gte(\"$createdAt\", u64(…)) builds and runs, since the node filters on it",
  async () => {
    const actual: string[] = []
    let sdk = ""
    try {
      await pub.select({ key: true }).where(and(eq("app", APP), gte("$createdAt", u64(688000n)))).limit(1).fetch()
      sdk = "built and ran"
    } catch (e) {
      sdk = `${(e as Error).name}: ${clean(e)}`
    }
    actual.push(`SDK builder: ${short(sdk)}`)
    const far = await rawQuery(rpc, `app = str('${APP}') AND $createdAt >= u64(99999999)`)
    // A one-block window around a live sayso entity: every row must come from that block.
    const probe = await rawQuery(rpc, `app = str('${APP}')`, { key: true, createdAt: true }, 1)
    const c = Number(((probe.body.result as { data?: { createdAt?: string }[] })?.data ?? [])[0]?.createdAt ?? 0)
    const win = await rawQuery(rpc, `app = str('${APP}') AND $createdAt >= u64(${c}) AND $createdAt < u64(${c + 1})`, { key: true, createdAt: true }, 50)
    const rows = ((win.body.result as { data?: { createdAt?: string }[] })?.data ?? []).map((d) => Number(d.createdAt))
    const farRows = ((far.body.result as { data?: unknown[] })?.data ?? []).length
    actual.push(`node, $createdAt >= 99999999: HTTP ${far.status}, ${farRows} rows ${far.body.error ? nodeError(far.body) : ""}`)
    actual.push(`node, ${c} <= $createdAt < ${c + 1}: ${rows.length} rows, createdAt in [${[...new Set(rows)].join(", ")}]`)
    const nodeOk = !far.body.error && farRows === 0 && rows.length > 0 && rows.every((b) => b === c)
    if (sdk === "built and ran") return { verdict: "fixed", actual }
    return nodeOk ? { verdict: "still reproduces", actual } : { verdict: "could not run", actual, note: "the node's own answer changed; re-check by hand" }
  },
)

// ---------- 5 ----------
await check(
  "5",
  "predictEntityKeys is on the public client, not the wallet client",
  "wallet.predictEntityKeys exists and defaults owner to the wallet's account",
  async () => {
    const w = createWalletClient({ chain: tiramisu, transport: http(rpc), account: privateKeyToAccount(generatePrivateKey()) })
    const onWallet = typeof (w as unknown as Record<string, unknown>).predictEntityKeys
    const onPublic = typeof (pub as unknown as Record<string, unknown>).predictEntityKeys
    return { verdict: onWallet === "function" ? "fixed" : "still reproduces", actual: [`typeof wallet.predictEntityKeys = ${onWallet}; typeof public.predictEntityKeys = ${onPublic}`] }
  },
)

// ---------- 6 ----------
await check(
  "6",
  "predictEntityKeys is an eth_call to a contract; no list of RPC methods per SDK action",
  "an arkiv_* method, or docs that list eth_call and the contract",
  async () => {
    const seen: string[] = []
    const c = createPublicClient({
      chain: tiramisu,
      transport: http(rpc, {
        retryCount: 0,
        onFetchRequest: async (req) => {
          const b = JSON.parse(await req.clone().text()) as { method: string; params?: { to?: string }[] } | { method: string; params?: { to?: string }[] }[]
          for (const m of Array.isArray(b) ? b : [b]) seen.push(m.method + (m.params?.[0]?.to ? ` to ${m.params[0].to}` : ""))
        },
      }),
    })
    const owner = privateKeyToAccount(generatePrivateKey()).address
    const keys = await c.predictEntityKeys({ owner, count: 1 })
    const usesCall = seen.some((s) => s.startsWith("eth_call"))
    return {
      verdict: usesCall ? "still reproduces" : "fixed",
      actual: [`predictEntityKeys({ count: 1 }) returned ${keys.length} key; JSON-RPC methods sent: ${seen.join(", ")}`],
      note: "whether the docs now list the methods is not checked by script",
    }
  },
)

// ---------- 7 ----------
await check(
  "7",
  "watchEntityEvents has no server-side filter and no expiry event",
  "filter options (owner/creator/keys) on watchEntityEvents, and an EntityExpired event",
  async () => {
    const dts = readFileSync(join(SDK, "dist/index.d.ts"), "utf8") + readFileSync(join(SDK, "dist/index-DaNeJUw8.d.ts"), "utf8")
    const block = dts.match(/type WatchEntityEventsParameters = \{([\s\S]*?)\n\};/)?.[1] ?? ""
    const params = [...block.matchAll(/^\s{2}(\w+)\?:/gm)].map((m) => m[1])
    const filters = params.filter((p) => !p.startsWith("on") && /owner|creator|key|filter|attribute/i.test(p))
    const expiry = /EntityExpired|onEntityExpired/.test(dts)
    // Watch the chain for 10 s and see how much of it is ours.
    let total = 0
    let ours = 0
    const owners = new Set<string>()
    const unwatch = pub.watchEntityEvents({
      onEvent: (e) => {
        total++
        const o = "owner" in e ? String(e.owner) : "newOwner" in e ? String(e.newOwner) : ""
        owners.add(o.toLowerCase())
        if (o.toLowerCase() === MIRROR.toLowerCase()) ours++
      },
      onError: () => {},
    })
    await sleep(10000)
    unwatch()
    const actual = [
      `WatchEntityEventsParameters: ${params.join(", ")}`,
      `filter parameters: ${filters.length ? filters.join(", ") : "none"}; expiry event in types: ${expiry ? "yes" : "no"}`,
      `10 s live watch: ${total} events from ${owners.size} owners delivered, ${ours} from our mirror wallet`,
    ]
    if (filters.length && expiry) return { verdict: "fixed", actual }
    return { verdict: filters.length || expiry ? "partly reproduces" : "still reproduces", actual }
  },
)

// ---------- 8 ----------
await check(
  "8",
  "Access key setup: undocumented registration step, quota numbers that disagree",
  "the doc's /api-keys link works; an unregistered session gets a 401 that says why",
  async () => {
    const r = await fetch("https://hub.arkiv.network/api-keys", { redirect: "manual" })
    const k = await fetch("https://hub.arkiv.network/api/keys")
    const body = (await k.text()).slice(0, 120)
    return {
      verdict: "could not run",
      actual: [
        `GET /api-keys: HTTP ${r.status}${r.headers.get("location") ? ` -> ${r.headers.get("location")}` : ""}`,
        `GET /api/keys with no session: HTTP ${k.status} ${body}`,
      ],
      note: "the registration 401 and the usage percentage need a signed-in fresh wallet in a browser; see friction.md steps",
    }
  },
)

// ---------- 9 ----------
await check(
  "9",
  "Node 25+ prints ExperimentalWarning: localStorage is not available",
  "no warning on the first SDK call in a plain Node script",
  async () => {
    // A fresh Node process, as a user's script would be; one cheap eth_* read (not a query).
    const code = `const { createPublicClient } = await import("@arkiv-network/sdk"); const { tiramisu } = await import("@arkiv-network/sdk/chains"); const { http } = await import("viem"); await createPublicClient({ chain: tiramisu, transport: http() }).getBlockTiming(); process.stdout.write("ok")`
    const env = { ...process.env }
    delete env.DEBUG
    delete env.NODE_OPTIONS
    const p = spawnSync(process.execPath, ["--input-type=module", "-e", code], { cwd: ROOT, env, encoding: "utf8", timeout: 30000 })
    const stderr = p.stderr ?? ""
    const stdout = p.stdout ?? ""
    const warned = /localStorage is not available/.test(stderr)
    return {
      verdict: stdout.includes("ok") ? (warned ? "still reproduces" : "fixed") : "could not run",
      actual: [warned ? `stderr: ${short(stderr.split("\n").find((l) => l.includes("localStorage")) ?? "", 160)}` : `no localStorage warning on stderr (${process.version})`],
    }
  },
)

// ---------- 10 ----------
await check(
  "10",
  "A selection stored in a variable types results as {}",
  "`const sel = { owner: true, key: true }` then `.entities[0].owner` type-checks",
  async () => {
    const dir = mkdtempSync(join(tmpdir(), "sayso-friction-"))
    try {
      symlinkSync(join(ROOT, "node_modules"), join(dir, "node_modules"))
      writeFileSync(
        join(dir, "a.ts"),
        `import { createPublicClient } from "@arkiv-network/sdk"\nimport { tiramisu } from "@arkiv-network/sdk/chains"\nimport { http } from "viem"\nconst c = createPublicClient({ chain: tiramisu, transport: http() })\nconst sel = { owner: true, key: true }\nexport const f = async () => (await c.select(sel).fetch()).entities[0].owner\n`,
      )
      const tsc = join(ROOT, "node_modules/.bin/tsc")
      const args = ["--noEmit", "--strict", "--skipLibCheck", "--target", "es2022", "--module", "esnext", "--moduleResolution", "bundler", "--types", "node", "a.ts"]
      const p = spawnSync(tsc, args, { cwd: dir, encoding: "utf8", timeout: 60000 })
      const out = (p.stdout + p.stderr).trim()
      if (p.error) return { verdict: "could not run", actual: [`tsc did not start: ${short(p.error)}`] }
      const line = out.split("\n").find((l) => /TS\d+/.test(l)) ?? out
      return { verdict: p.status === 0 ? "fixed" : /TS2339/.test(out) ? "still reproduces" : "could not run", actual: [p.status === 0 ? "tsc: no errors" : `tsc: ${short(line.replace(dir, ""), 200)}`] }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  },
)

// ---------- 11 ----------
await check("11", "The tiramisu chain object has no blockExplorers", "tiramisu.blockExplorers.default.url = https://tiramisu.explorer.arkiv.network", async () => {
  const be = (tiramisu as { blockExplorers?: { default?: { url?: string } } }).blockExplorers
  return { verdict: be?.default?.url ? "fixed" : "still reproduces", actual: [`tiramisu.blockExplorers = ${be ? JSON.stringify(be) : "undefined"}`] }
})

// ---------- 12 ----------
await check(
  "12",
  "Docs and README rough edges (llms.txt, README version, unused brotli-wasm)",
  "llms.txt has no Symbol( heading; README says 0.8; no unused runtime dependency",
  async () => {
    const actual: string[] = []
    let bad = 0
    try {
      const llms = await (await fetch("https://docs.arkiv.network/llms.txt")).text()
      const lines = llms.split("\n").map((l, i) => [i + 1, l] as const).filter(([, l]) => l.includes("Symbol("))
      actual.push(`llms.txt: ${lines.length ? `"Symbol(" on line ${lines.map(([i]) => i).join(", ")}` : "no Symbol( heading"}`)
      if (lines.length) bad++
    } catch (e) {
      actual.push(`llms.txt: fetch failed (${short(e, 80)})`)
    }
    const readme = readFileSync(join(SDK, "README.md"), "utf8")
    const v06 = readme.includes("^0.6.0")
    const sample = /\bsample\b/.test(readme)
    actual.push(`SDK README: mentions ^0.6.0: ${v06}; mentions a sample folder: ${sample}`)
    if (v06 || sample) bad++
    const pkg = JSON.parse(readFileSync(join(SDK, "package.json"), "utf8")) as { dependencies?: Record<string, string> }
    const dep = !!pkg.dependencies?.["brotli-wasm"]
    const used = spawnSync("grep", ["-rl", "brotli", join(SDK, "dist")], { encoding: "utf8" }).stdout ?? ""
    actual.push(`brotli-wasm in dependencies: ${dep}; dist files mentioning brotli: ${used.trim() ? used.trim().split("\n").length : 0}`)
    if (dep && !used.trim()) bad++
    return { verdict: bad === 3 ? "still reproduces" : bad ? "partly reproduces" : "fixed", actual }
  },
)

// ---------- 13 ----------
await check(
  "13",
  "page.next() loses the block a walk started at",
  "a long walk with page.next() finishes even when a new block lands between pages (as the JSDoc promises)",
  async () => {
    // Our RBI mirror's dla entities span several pages of 200. Wait 2.5 s (over one 2 s block) before the
    // second page so a new block has certainly landed, which is the condition the issue is about.
    const where = and(eq("app", APP), eq("kind", "dla"))
    const walk = async (pin: boolean) => {
      let q = pub.select({ key: true }).where(where).createdBy(MIRROR).limit(200)
      if (pin) q = q.atBlock((await pub.getBlockTiming()).currentBlock)
      let p = await q.fetch()
      const start = p.blockNumber
      let n = p.entities.length
      let pages = 1
      try {
        await sleep(2500)
        while (p.hasNextPage()) {
          p = await p.next()
          n += p.entities.length
          pages++
        }
        return `finished: ${pages} pages, ${n} entities, first page at block ${start}`
      } catch (e) {
        const k = (e as { kind?: string }).kind
        return `failed on page ${pages + 1}${k ? ` (QueryError kind ${k})` : ""}: ${short(clean(e).split(". Query:")[0], 160)}`
      }
    }
    const loose = await walk(false)
    const pinned = await walk(true)
    const actual = [`page.next() walk, no atBlock: ${loose}`, `same walk pinned with atBlock(head): ${pinned}`]
    if (loose.startsWith("finished: 1 pages")) return { verdict: "could not run", actual, note: "only one page of dla entities, so there is no next()" }
    return { verdict: loose.startsWith("failed") ? "still reproduces" : "fixed", actual }
  },
)

// ---------- 14 ----------
await check("14", "entity.toJson() throws when the payload was not selected", "toJson() returns undefined (or the type says payload may be absent)", async () => {
  const p = await pub.select({ key: true, attributes: true }).where(eq("app", APP)).limit(1).fetch()
  const e = p.entities[0]
  if (!e) return { verdict: "could not run", actual: ["no sayso entity found"] }
  try {
    const j = (e as unknown as { toJson: () => unknown }).toJson()
    return { verdict: "fixed", actual: [`toJson() returned ${short(j, 80)}`] }
  } catch (err) {
    return { verdict: "still reproduces", actual: [`toJson() threw: ${short(err, 160)}`] }
  }
})

// ---------- summary ----------
const secs = ((Date.now() - t0) / 1000).toFixed(1)
console.log(`\nSummary · run ${new Date().toISOString()} · ${secs} s`)
const w = Math.max(...results.map((r) => r.title.length))
for (const r of results) console.log(`  ${r.id.padEnd(3)} ${r.title.padEnd(Math.min(w, 70)).slice(0, 70)}  ${r.verdict}`)
process.exit(0)
