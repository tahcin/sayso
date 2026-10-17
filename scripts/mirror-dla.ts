// Mirrors RBI's public directory of digital lending apps onto Arkiv, from the dated snapshot in data/.
// New apps are created, apps still listed get their 30-day lifetime renewed, and apps RBI no longer lists
// are left alone, so they expire on their own: absence on Arkiv means "not in RBI's directory".
// Only minimal facts are published (app, lender, lender type, app link); grievance officers' details are not.
// Run: npx tsx --env-file=.env scripts/mirror-dla.ts [data/rbi-dla-YYYY-MM-DD.json]
import { createWalletClient } from "@arkiv-network/sdk"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { readFileSync } from "node:fs"
import { http, type Hex } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { DLA_LIFETIME, dlaCreate, getAllDla, pub, RPC, useRpc } from "../shared/sayso"

const file = process.argv[2] ?? "data/rbi-dla-2026-10-17.json"
const snap = JSON.parse(readFileSync(file, "utf8")) as { snapshot: string; rows: { app: string; lender: string; lenderType: string; url: string }[] }
const rpc = process.env.ARKIV_KEY ? `${RPC}/${process.env.ARKIV_KEY}` : RPC
useRpc(rpc)
const mirror = createWalletClient({ chain: tiramisu, transport: http(rpc), account: privateKeyToAccount(process.env.KEY_MIRROR as Hex) })

const k = (app: string, lender: string) => `${app.toLowerCase()}|${lender.toLowerCase()}`
const existing = await getAllDla(mirror.account.address)
const have = new Map(existing.map((d) => [k(d.app, d.lender), d]))
const head = (await pub.getBlockTiming()).currentBlock
const RENEW_BELOW = BigInt((25 * 24 * 3600) / 2) // renew anything with under 25 days left

const creates = snap.rows.filter((r) => !have.has(k(r.app, r.lender)))
const renew = snap.rows.map((r) => have.get(k(r.app, r.lender))).filter((d): d is NonNullable<typeof d> => !!d && d.expiresAt - head < RENEW_BELOW)
const gone = existing.filter((d) => !snap.rows.some((r) => k(r.app, r.lender) === k(d.app, d.lender)))
console.log(`snapshot ${snap.snapshot}: ${snap.rows.length} apps · on Arkiv ${existing.length} · create ${creates.length} · renew ${renew.length} · left to expire ${gone.length}`)

if (process.env.DRY) process.exit(0)
const BATCH = 40
for (let i = 0; i < creates.length; i += BATCH) {
  const r = await mirror.executeBatch({ creates: creates.slice(i, i + BATCH).map((x) => dlaCreate(x, snap.snapshot)) })
  console.log(`created ${Math.min(i + BATCH, creates.length)}/${creates.length}`, r.txHash)
}
for (let i = 0; i < renew.length; i += BATCH) {
  const r = await mirror.executeBatch({ extensions: renew.slice(i, i + BATCH).map((d) => ({ entityKey: d.key, expires: DLA_LIFETIME })) })
  console.log(`renewed ${Math.min(i + BATCH, renew.length)}/${renew.length}`, r.txHash)
}
process.exit(0)
