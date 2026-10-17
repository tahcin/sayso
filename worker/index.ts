// Cloudflare Worker: serves the app, gives new browser wallets a little test gas, and runs the
// fictional processors' duty loop on a 1-minute cron (and right after a withdrawal, via /api/tick).
// It stores nothing: every fact lives in Arkiv.
import { createWalletClient } from "@arkiv-network/sdk"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { http, isAddress, parseEther, type Address, type Hex } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { FIDUCIARIES, PROCESSORS } from "../shared/cast"
import { runProcessor } from "../shared/robot"
import { pub } from "../shared/sayso"

type Env = { ASSETS: Fetcher } & Record<string, string>

const wallet = (key: string) => createWalletClient({ chain: tiramisu, transport: http(), account: privateKeyToAccount(key as Hex) })

// Test gas only: enough for a few dozen consents, sent once to an empty address.
const DRIP = parseEther("0.01")
const DRIP_FLOOR = parseEther("0.003")

async function drip(env: Env, to: Address) {
  const bal = await pub.getBalance({ address: to })
  if (bal >= DRIP_FLOOR) return { sent: false, balance: bal.toString() }
  const hash = await wallet(env.KEY_DRIP).sendTransaction({ to, value: DRIP })
  await pub.waitForTransactionReceipt({ hash })
  return { sent: true, hash }
}

async function tick(env: Env) {
  const fids = FIDUCIARIES.map((f) => privateKeyToAccount(env[`KEY_${f.slug.toUpperCase()}`] as Hex).address)
  return Promise.all(PROCESSORS.map((p) => runProcessor(wallet(env[`KEY_${p.slug.toUpperCase()}`]), fids, p.honest)))
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, (_, v) => (typeof v === "bigint" ? v.toString() : v)), {
    status,
    headers: { "content-type": "application/json" },
  })

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(req.url)
    if (url.pathname === "/api/drip" && req.method === "POST") {
      const { address } = (await req.json().catch(() => ({}))) as { address?: string }
      if (!address || !isAddress(address)) return json({ error: "address required" }, 400)
      try {
        return json(await drip(env, address))
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
    ctx.waitUntil(tick(env).then((r) => console.log(JSON.stringify(r))))
  },
} satisfies ExportedHandler<Env>
