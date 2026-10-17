// Cloudflare Worker: serves the app, gives new browser wallets a little test gas, and runs the
// fictional processors' duty loop on a 5-minute cron (and right after each person's write, via /api/tick).
// It stores nothing: every fact lives in Arkiv.
import { createWalletClient } from "@arkiv-network/sdk"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { http, isAddress, parseEther, type Address, type Hex } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { FIDUCIARIES, PROCESSORS } from "../shared/cast"
import { runVendors } from "../shared/robot"
import { pub, RPC, useRpc } from "../shared/sayso"

type Limiter = { limit: (o: { key: string }) => Promise<{ success: boolean }> }
type Env = { ASSETS: Fetcher; LIMITER: Limiter } & Record<string, string>

let rpcUrl = RPC
const wallet = (key: string) => createWalletClient({ chain: tiramisu, transport: http(rpcUrl), account: privateKeyToAccount(key as Hex) })

// Test gas only, enough for a few dozen consents. Each person's address is funded by the company it
// will consent to, at the moment of their first "Agree". A shared faucet wallet would fund all of a
// person's addresses together and let anyone link them across companies on the explorer.
// A slightly different amount each time, so two companies funding one person cannot be matched by value.
const drip_amount = () => parseEther("0.0025") + BigInt(Math.floor(Math.random() * 1e15))
const DRIP_FLOOR = parseEther("0.001")
const COMPANY_FLOOR = parseEther("0.1")
const COMPANY_TOPUP = parseEther("0.5")

async function send(key: string, to: Address, value: bigint) {
  // Two visitors at once can race for the sender's nonce; back off and retry.
  for (let attempt = 0; ; attempt++) {
    try {
      const hash = await wallet(key).sendTransaction({ to, value })
      await pub.waitForTransactionReceipt({ hash })
      return hash
    } catch (e) {
      if (attempt >= 3) throw e
      await new Promise((r) => setTimeout(r, 1500 + Math.random() * 2500))
    }
  }
}

async function drip(env: Env, to: Address, company: string) {
  const bal = await pub.getBalance({ address: to })
  if (bal >= DRIP_FLOOR) return { sent: false }
  return { sent: true, hash: await send(company === "witness" || company === "self" ? env.KEY_DRIP : env[`KEY_${company.toUpperCase()}`], to, drip_amount()) }
}

// The house wallet only ever tops up the fictional companies, never a person.
async function topUpCompanies(env: Env) {
  for (const f of FIDUCIARIES) {
    if ((await pub.getBalance({ address: f.address })) < COMPANY_FLOOR) await send(env.KEY_DRIP, f.address, COMPANY_TOPUP)
  }
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
    if (url.pathname.startsWith("/api/")) {
      // Per-IP limits so nobody can drain the test-gas wallets or keep the vendors busy.
      const ip = req.headers.get("cf-connecting-ip") ?? "anon"
      const { success } = await env.LIMITER.limit({ key: `${url.pathname}:${ip}` })
      if (!success) return json({ error: "too many requests, wait a minute" }, 429)
    }
    if (url.pathname === "/api/rpc" && req.method === "POST") return relay(env, req)
    if (url.pathname === "/api/drip" && req.method === "POST") {
      const { address, company } = (await req.json().catch(() => ({}))) as { address?: string; company?: string }
      if (!address || !isAddress(address)) return json({ error: "address required" }, 400)
      // "witness" is a visitor preserving public records on the cease board, funded by the house wallet.
      if (company !== "witness" && company !== "self" && !FIDUCIARIES.some((f) => f.slug === company)) return json({ error: "unknown company" }, 400)
      try {
        return json(await drip(env, address, company!))
      } catch (e) {
        return json({ error: (e as Error).message.split("\n")[0] }, 502)
      }
    }
    if (url.pathname === "/api/tick" && req.method === "POST") {
      // Run in the background so the page is not held open for a 10-second write.
      ctx.waitUntil(tick(env).then((r) => console.log(JSON.stringify(r))))
      return json({ started: true })
    }
    return env.ASSETS.fetch(req)
  },
  async scheduled(_: ScheduledController, env: Env, ctx: ExecutionContext) {
    keyed(env)
    ctx.waitUntil(tick(env).then((r) => console.log(JSON.stringify(r))))
    ctx.waitUntil(topUpCompanies(env).catch((e) => console.log("top-up", (e as Error).message)))
  },
} satisfies ExportedHandler<Env>
