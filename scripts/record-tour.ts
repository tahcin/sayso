// Records one real run for the guided tour on the home page: a fresh person answers Rupeeleaf, the
// vendors lease, the person withdraws two purposes, and the honest vendor signs. Prints the transaction
// hashes and entity keys the tour links to, so every chapter of the replay points at a real record.
// Run: npx tsx --env-file=.env scripts/record-tour.ts
import { createWalletClient } from "@arkiv-network/sdk"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { http, type Address } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { answer, withdraw } from "../shared/actions"
import { getDirectory, getPerson, pub, RPC, useRpc } from "../shared/sayso"
import { FIDUCIARIES, PROCESSORS } from "../shared/cast"

const SITE = "https://sayso.tahcin.tech"
const rpc = process.env.ARKIV_KEY ? `${RPC}/${process.env.ARKIV_KEY}` : RPC
useRpc(rpc)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const post = (path: string, body: unknown = {}) =>
  fetch(SITE + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json())

const me = privateKeyToAccount(generatePrivateKey())
const wallet = createWalletClient({ chain: tiramisu, transport: http(rpc), account: me })
await post("/api/drip", { address: me.address, company: "rupeeleaf" })

const dir = await getDirectory([...FIDUCIARIES, ...PROCESSORS].map((p) => p.address))
const rupeeleaf = FIDUCIARIES[0].address.toLowerCase()
const newest = new Map<string, (typeof dir.notices)[number]>()
for (const n of dir.notices.filter((n) => n.fiduciary.toLowerCase() === rupeeleaf)) {
  const c = newest.get(n.purpose)
  if (!c || n.createdAt > c.createdAt) newest.set(n.purpose, n)
}
const notices = [...newest.values()]

const grant = await answer(wallet, notices, [])
await post("/api/tick")
let snap = await getPerson([me.address])
for (let i = 0; i < 12 && snap.leases.length < 3; i++) {
  await sleep(5000)
  snap = await getPerson([me.address])
}
const consent = (p: string) => snap.consents.find((c) => c.purpose === p)!
const ls = consent("loan_servicing")
const mk = consent("marketing")
const proc = (p: string) => notices.find((n) => n.purpose === p)!.processor as Address
const w1 = await withdraw(wallet, ls, proc("loan_servicing"))
const w2 = await withdraw(wallet, mk, proc("marketing"))
await post("/api/tick")
for (let i = 0; i < 12; i++) {
  await sleep(5000)
  snap = await getPerson([me.address])
  if (snap.ceased.some((c) => c.consent.toLowerCase() === ls.key.toLowerCase())) break
}
const stop = snap.ceased.find((c) => c.consent.toLowerCase() === ls.key.toLowerCase())
const pingLease = snap.leases.find((l) => l.consent.toLowerCase() === mk.key.toLowerCase())
const receipts = snap.receipts.filter((r) => r.action === "withdrawn")
const blockMs = (await pub.getBlockTiming()).blockDuration * 1000

console.log(
  JSON.stringify(
    {
      person: me.address,
      grantTx: grant.txHash,
      consents: snap.receipts.filter((r) => r.action === "granted").map((r) => ({ purpose: r.purpose, key: r.consent })),
      leases: snap.leases.map((l) => ({ vendor: l.creator, purpose: l.purpose, key: l.key })),
      withdrawLoanTx: w1.txHash,
      withdrawSmsTx: w2.txHash,
      stopNote: stop?.key,
      stopSeconds: stop ? (Number(stop.createdAt - receipts.find((r) => r.consent.toLowerCase() === ls.key.toLowerCase())!.createdAt) * blockMs) / 1000 : null,
      pingwaveLease: pingLease?.key,
    },
    null,
    2,
  ),
)
process.exit(0)
