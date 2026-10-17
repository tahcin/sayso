// Cloudflare Worker: serves the app, gives new browser wallets a little test gas, and runs the
// fictional processors' duty loop on a 1-minute cron (and right after a withdrawal, via /api/tick).
// It stores nothing: every fact lives in Arkiv.
import { createWalletClient } from "@arkiv-network/sdk"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { http, isAddress, parseEther, type Address, type Hex } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { FIDUCIARIES, PROCESSORS } from "../shared/cast"
import { runVendors } from "../shared/robot"
import { pub, RPC, useRpc } from "../shared/sayso"

type Env = { ASSETS: Fetcher } & Record<string, string>

let rpcUrl = RPC
const wallet = (key: string) => createWalletClient({ chain: tiramisu, transport: http(rpcUrl), account: privateKeyToAccount(key as Hex) })

// Test gas only: enough for a few dozen consents, sent once to an empty address.
const DRIP = parseEther("0.01")
const DRIP_FLOOR = parseEther("0.003")

async function dripOne(env: Env, to: Address) {
  const bal = await pub.getBalance({ address: to })
  if (bal >= DRIP_FLOOR) return { to, sent: false }
  // Two visitors at once can race for the drip wallet's nonce; back off and retry.
  for (let attempt = 0; ; attempt++) {
    try {
      const hash = await wallet(env.KEY_DRIP).sendTransaction({ to, value: DRIP })
      await pub.waitForTransactionReceipt({ hash })
      return { to, sent: true, hash }
    } catch (e) {
      if (attempt >= 3) throw e
      await new Promise((r) => setTimeout(r, 1500 + Math.random() * 2500))
    }
  }
}

async function drip(env: Env, addresses: Address[]) {
  const out = []
  for (const a of addresses) out.push(await dripOne(env, a))
  return out
}

async function tick(env: Env) {
  const fids = FIDUCIARIES.map((f) => privateKeyToAccount(env[`KEY_${f.slug.toUpperCase()}`] as Hex).address)
  return runVendors(PROCESSORS.map((p) => ({ wallet: wallet(env[`KEY_${p.slug.toUpperCase()}`]), honest: p.honest })), fids)
}

// Read-only relay for browsers whose IP has used up Arkiv's anonymous read quota. It forwards a
// fixed list of read methods with our access key; it cannot write and it stores nothing.
const READS = new Set(["arkiv_query", "arkiv_getBlockTiming", "arkiv_getEntityCount", "eth_blockNumber", "eth_chainId", "eth_getBalance", "eth_getTransactionCount", "eth_getTransactionReceipt", "eth_call", "eth_getBlockByNumber"])

async function relay(env: Env, req: Request) {
  const body = (await req.json().catch(() => null)) as { method?: string } | { method?: string }[] | null
  const calls = Array.isArray(body) ? body : body ? [body] : []
  if (!calls.length || calls.length > 20 || !calls.every((c) => c && READS.has(String(c.method)))) return json({ error: "read methods only" }, 400)
  const r = await fetch(env.ARKIV_KEY ? `${RPC}/${env.ARKIV_KEY}` : RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
  return new Response(r.body, { status: r.status, headers: { "content-type": "application/json" } })
}

function keyed(env: Env) {
  if (!env.ARKIV_KEY) return
  rpcUrl = `${RPC}/${env.ARKIV_KEY}`
  useRpc(rpcUrl)
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, (_, v) => (typeof v === "bigint" ? v.toString() : v)), {
    status,
    headers: { "content-type": "application/json" },
  })

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    keyed(env)
    const url = new URL(req.url)
    if (url.pathname === "/api/rpc" && req.method === "POST") return relay(env, req)
    if (url.pathname === "/api/drip" && req.method === "POST") {
      const { addresses } = (await req.json().catch(() => ({}))) as { addresses?: string[] }
      const list = (addresses ?? []).slice(0, 4)
      if (!list.length || !list.every((a) => isAddress(a))) return json({ error: "addresses required" }, 400)
      try {
        return json(await drip(env, list as Address[]))
      } catch (e) {
        return json({ error: (e as Error).message.split("\n")[0] }, 502)
      }
    }
    if (url.pathname === "/api/tick" && req.method === "POST") {
      // Run in the background so the page is not held open for a 10-second write.
      ctx.waitUntil(tick(env).then((r) => console.log(JSON.stringify(r))))
      return json({ started: true })
    }
    if (url.pathname === "/api/tick" && req.method === "GET") return json(await tick(env))
    return env.ASSETS.fetch(req)
  },
  async scheduled(_: ScheduledController, env: Env, ctx: ExecutionContext) {
    keyed(env)
    ctx.waitUntil(tick(env).then((r) => console.log(JSON.stringify(r))))
  },
} satisfies ExportedHandler<Env>
