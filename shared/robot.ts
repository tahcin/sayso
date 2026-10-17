// A processor's duty loop. Each processor serves one or more (company, purpose) pairs.
// 1. Take a lease on every live consent it serves (the lease dies with the consent).
// 2. For every lease whose consent was withdrawn, delete the lease and post a signed "ceased"
//    entity in one atomic batch. A dishonest processor skips step 2; the cease board shows it.
import { ExpirationTime, type createWalletClient } from "@arkiv-network/sdk"
import type { Address } from "viem"
import {
  ceasedCreate,
  getConsentsFor,
  getLeasesBy,
  getNotices,
  getWithdrawalsSince,
  leaseCreate,
  pub,
  type Lease,
  type Notice,
} from "./sayso"

type Wallet = ReturnType<typeof createWalletClient>

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export type RobotReport = { processor: Address; leased: number; ceased: number; extended?: number; error?: string }

export async function runProcessor(wallet: Wallet, fiduciaries: Address[], honest: boolean): Promise<RobotReport> {
  const me = wallet.account!.address
  const report: RobotReport = { processor: me, leased: 0, ceased: 0 }
  try {
    const served: Notice[] = []
    for (const f of fiduciaries) served.push(...(await getNotices(f)).filter((n) => n.processor.toLowerCase() === me.toLowerCase()))

    const leases = await getLeasesBy(me)
    const leasedConsents = new Set(leases.map((l) => l.consent.toLowerCase()))

    const live = (await Promise.all(served.map((n) => getConsentsFor(n.fiduciary, n.purpose)))).flat()
    const liveKeys = new Set(live.map((c) => c.key.toLowerCase()))
    // Skip consents that expire within a minute; a lease on them would be gone before it lands.
    const head = (await pub.getBlockTiming()).currentBlock
    const toLease = live.filter((c) => !leasedConsents.has(c.key.toLowerCase()) && c.expiresAt > head + 30n)

    const orphaned: Lease[] = leases.filter((l) => !liveKeys.has(l.consent.toLowerCase()))
    const withdrawals = orphaned.length ? await getWithdrawalsSince(Date.now() - WINDOW_MS) : []
    const byConsent = new Map(withdrawals.map((r) => [r.consent.toLowerCase(), r]))
    const toCease = honest
      ? orphaned.flatMap((l) => {
          const r = byConsent.get(l.consent.toLowerCase())
          return r ? [{ lease: l, receipt: r }] : []
        })
      : []

    // Lifetime Extension as a lease: when the person renews a consent, the lease follows it.
    const byKey = new Map(live.map((c) => [c.key.toLowerCase(), c]))
    const toExtend = leases.flatMap((l) => {
      const c = byKey.get(l.consent.toLowerCase())
      return c && c.expiresAt > l.expiresAt ? [{ entityKey: l.key, expires: ExpirationTime.atBlock(c.expiresAt) }] : []
    })

    if (!toLease.length && !toCease.length && !toExtend.length) return report
    // Leases and acks for this round land together.
    await wallet.executeBatch({
      creates: [...toLease.map(leaseCreate), ...toCease.map(ceasedCreate)],
      deletes: toCease.map((x) => ({ entityKey: x.lease.key })),
      extensions: toExtend,
    })
    report.leased = toLease.length
    report.ceased = toCease.length
    report.extended = toExtend.length
  } catch (e) {
    report.error = (e as Error).message.split("\n")[0]
  }
  return report
}
