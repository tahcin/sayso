// One-time setup: fund the fictional companies' wallets and have each publish itself and its notices.
// Run: npx tsx --env-file=.env scripts/seed.ts
import { createWalletClient } from "@arkiv-network/sdk"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { formatEther, http, parseEther, type Hex } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { FIDUCIARIES, NOTICES, PROCESSORS } from "../shared/cast"
import { getNotices, getParties, noticeCreate, partyCreate, pub } from "../shared/sayso"

const keyOf = (slug: string) => process.env[`KEY_${slug.toUpperCase()}`] as Hex
const acct = (slug: string) => privateKeyToAccount(keyOf(slug))
const wallet = (slug: string) => createWalletClient({ chain: tiramisu, transport: http(), account: acct(slug) })

const drip = createWalletClient({ chain: tiramisu, transport: http(), account: privateKeyToAccount(process.env.KEY_DRIP as Hex) })
console.log("drip", drip.account.address, formatEther(await pub.getBalance({ address: drip.account.address })), "GLM")

const everyone = [...FIDUCIARIES.map((f) => f.slug), ...PROCESSORS.map((p) => p.slug)]
for (const slug of everyone) {
  const a = acct(slug).address
  const bal = await pub.getBalance({ address: a })
  if (bal < parseEther("0.2")) {
    const tx = await drip.sendTransaction({ to: a, value: parseEther("0.5") })
    await pub.waitForTransactionReceipt({ hash: tx })
    console.log("funded", slug, a)
  } else console.log("has gas", slug, a, formatEther(bal))
}

const existing = await getParties()
for (const f of FIDUCIARIES) {
  if (!existing.some((p) => p.slug === f.slug && p.address === acct(f.slug).address))
    console.log("party", f.slug, (await wallet(f.slug).createEntity(partyCreate("fiduciary", f.slug, f.name, f.blurb))).txHash)
}
for (const p of PROCESSORS) {
  if (!existing.some((x) => x.slug === p.slug && x.address === acct(p.slug).address))
    console.log("party", p.slug, (await wallet(p.slug).createEntity(partyCreate("processor", p.slug, p.name, p.blurb))).txHash)
}

for (const f of FIDUCIARIES) {
  const have = await getNotices(acct(f.slug).address)
  const missing = NOTICES[f.slug].filter((n) => !have.some((h) => h.purpose === n.purpose))
  if (!missing.length) continue
  // All of a company's notices land together or not at all.
  const r = await wallet(f.slug).executeBatch({
    creates: missing.map((n) => noticeCreate({ ...n, processor: acct(n.processor).address })),
  })
  console.log("notices", f.slug, missing.map((m) => m.purpose).join(","), r.txHash)
}

for (const slug of everyone) console.log(slug.padEnd(12), acct(slug).address)
