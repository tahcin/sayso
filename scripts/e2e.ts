// End-to-end run of the whole Say So flow against Tiramisu, from a fresh person wallet.
// Run: npx tsx scripts/e2e.ts [https://sayso.tahcin.tech]
// 1. new person wallet gets test gas  2. consents to all three Rupeeleaf purposes in one batch
// 3. processors take leases  4. person withdraws "marketing"  5. honest processors post "ceased";
// Pingwave keeps its lease  6. the consent gate answers for each purpose.
import { createWalletClient } from "@arkiv-network/sdk"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { http, type Address } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import {
  consentCreate,
  getCeasedFor,
  getConsentsOf,
  getLeasesOnConsent,
  getNotices,
  getParties,
  hasLiveConsent,
  RPC,
  useRpc,
} from "../shared/sayso"
import { answer, withdraw } from "../shared/actions"

const SITE = process.argv[2] ?? "https://sayso.tahcin.tech"
const rpc = process.env.ARKIV_KEY ? `${RPC}/${process.env.ARKIV_KEY}` : RPC
useRpc(rpc)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const post = (path: string, body: unknown = {}) =>
  fetch(SITE + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json())

const me = privateKeyToAccount(generatePrivateKey())
const wallet = createWalletClient({ chain: tiramisu, transport: http(rpc), account: me })
console.log("person address", me.address)
console.log("drip", await post("/api/drip", { address: me.address, company: "rupeeleaf" }))

const parties = await getParties()
const rupeeleaf = parties.find((p) => p.slug === "rupeeleaf")!.address
const name = (a: Address) => parties.find((p) => p.address.toLowerCase() === a.toLowerCase())?.name ?? a
// Notices are readonly, so updates are new versions: keep the newest per purpose, as the app does.
const newest = new Map<string, Awaited<ReturnType<typeof getNotices>>[number]>()
for (const n of await getNotices(rupeeleaf)) {
  const cur = newest.get(n.purpose)
  if (!cur || n.createdAt > cur.createdAt) newest.set(n.purpose, n)
}
const notices = [...newest.values()]
console.log("notices", notices.map((n) => `${n.purpose} -> ${name(n.processor)}`).join(", "))

// Grant: three consents and their three receipts in one atomic batch.
const g = await answer(wallet, notices, [])
console.log("granted", g.txHash)
const consents = await getConsentsOf(me.address)
console.log("live consents", consents.map((c) => c.purpose))

await post("/api/tick")
await sleep(20000)
for (const c of consents) console.log("leases on", c.purpose, (await getLeasesOnConsent(c.key)).map((l) => name(l.creator)))

const mk = consents.find((c) => c.purpose === "marketing")!
const ls = consents.find((c) => c.purpose === "loan_servicing")!
const proc = (c: typeof mk) => notices.find((n) => n.purpose === c.purpose)!.processor
const w = await withdraw(wallet, mk, proc(mk))
await withdraw(wallet, ls, proc(ls))
console.log("withdrew marketing and loan_servicing", w.txHash)
await post("/api/tick")
await sleep(20000)
console.log("ceased on marketing", (await getCeasedFor(mk.key)).map((c) => name(c.creator)))
console.log("leases still on marketing", (await getLeasesOnConsent(mk.key)).map((l) => name(l.creator)))
console.log("ceased on loan_servicing", (await getCeasedFor(ls.key)).map((c) => name(c.creator)))
console.log("leases still on loan_servicing", (await getLeasesOnConsent(ls.key)).map((l) => name(l.creator)))
for (const n of notices) console.log("gate", n.purpose, await hasLiveConsent(me.address, rupeeleaf, n.purpose))
