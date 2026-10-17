// The vendors' duty loop. Each vendor serves the (company, purpose) pairs whose notice names it.
// 1. Take a lease on every live consent it serves. The lease expires at the consent's block.
// 2. When a consent is renewed, extend the lease to match (Lifetime Extension follows the person).
// 3. When a consent is withdrawn, delete the lease and post a signed "ceased" note, atomically.
// A dishonest vendor skips step 3, and the cease board shows it.
import { ExpirationTime, type createWalletClient } from "@arkiv-network/sdk"
import { ceasedCreate, getDuty, leaseCreate, pub, type Snapshot } from "./sayso"

type Wallet = ReturnType<typeof createWalletClient>
export type Vendor = { wallet: Wallet; honest: boolean }
export type RobotReport = { processor: string; leased: number; extended: number; ceased: number; error?: string }

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const lk = (s: string) => s.toLowerCase()

export async function runVendors(vendors: Vendor[], fiduciaries: string[]): Promise<RobotReport[]> {
  // One read for every vendor this round.
  const [snap, timing] = await Promise.all([getDuty(Date.now() - WINDOW_MS), pub.getBlockTiming()])
  return Promise.all(vendors.map((v) => runOne(v, snap, timing.currentBlock, new Set(fiduciaries.map(lk)))))
}

async function runOne({ wallet, honest }: Vendor, snap: Snapshot, head: bigint, fiduciaries: Set<string>): Promise<RobotReport> {
  const me = lk(wallet.account!.address)
  const report: RobotReport = { processor: wallet.account!.address, leased: 0, extended: 0, ceased: 0 }
  try {
    // Only notices from known companies count; trust comes from the notice's $creator.
    const served = snap.notices.filter((n) => lk(n.processor) === me && fiduciaries.has(lk(n.fiduciary)))
    const isServed = (f: string, p: string) => served.some((n) => lk(n.fiduciary) === lk(f) && n.purpose === p)

    const live = snap.consents.filter((c) => isServed(c.fiduciary, c.purpose))
    const liveByKey = new Map(live.map((c) => [lk(c.key), c]))
    const mine = snap.leases.filter((l) => lk(l.creator) === me)
    const leased = new Set(mine.map((l) => lk(l.consent)))

    // Skip consents about to expire; a lease on them would be gone before it landed.
    const toLease = live.filter((c) => !leased.has(lk(c.key)) && c.expiresAt > head + 30n)
    const toExtend = mine.flatMap((l) => {
      const c = liveByKey.get(lk(l.consent))
      return c && c.expiresAt > l.expiresAt ? [{ entityKey: l.key, expires: ExpirationTime.atBlock(c.expiresAt) }] : []
    })
    const withdrawn = new Map(snap.receipts.map((r) => [lk(r.consent), r]))
    const toCease = honest
      ? mine.flatMap((l) => {
          const r = !liveByKey.has(lk(l.consent)) && withdrawn.get(lk(l.consent))
          return r ? [{ lease: l, receipt: r }] : []
        })
      : []

    if (!toLease.length && !toExtend.length && !toCease.length) return report
    // Everything this vendor does this round lands in one transaction.
    await wallet.executeBatch({
      creates: [...toLease.map(leaseCreate), ...toCease.map(ceasedCreate)],
      deletes: toCease.map((x) => ({ entityKey: x.lease.key })),
      extensions: toExtend,
    })
    report.leased = toLease.length
    report.extended = toExtend.length
    report.ceased = toCease.length
  } catch (e) {
    report.error = (e as Error).message.split("\n")[0]
  }
  return report
}
