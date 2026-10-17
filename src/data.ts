// Loads one person's picture from Arkiv: what they consented to, what they withdrew, and what each
// vendor is doing about it. Each refresh is a single Arkiv query; nothing is cached server side.
import type { Address, Hex } from "viem"
import { FIDUCIARIES, isCompany, isVendor, NOTICES, PROCESSORS } from "../shared/cast"
import { getDirectory, getPerson, useRpc, type Ceased, type Consent, type Lease, type Notice, type Party, type Receipt } from "../shared/sayso"

export type Status = "using" | "pending" | "stopped" | "ignoring" | "released" | "ended" | "denied"

export type Item = {
  slug: string
  address: Address
  consent: Hex
  purpose: string
  processor: Address
  granted: Receipt
  withdrawn?: Receipt
  live?: Consent
  lease?: Lease
  ceased?: Ceased
  status: Status
}

export type World = { parties: Party[]; notices: Record<string, Notice[]> }

// The public RPC limits anonymous reads per IP. If this visitor's network has used its share,
// switch reads to our relay (same queries, sent with Say So's access key) and say so on screen.
export let relayed = false
const listeners = new Set<() => void>()
export const onRelay = (fn: () => void) => (listeners.add(fn), () => void listeners.delete(fn))

export async function read<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    const m = String((e as Error).message)
    if (!/429|rate|quota|Too Many|COST_LIMITED|limit/i.test(m)) throw e
    // Reads already in flight when the first one failed retry once through the relay too.
    if (!relayed) {
      relayed = true
      useRpc(`${location.origin}/api/rpc`)
      listeners.forEach((l) => l())
    }
    return fn()
  }
}

export const TRUSTED = [...FIDUCIARIES, ...PROCESSORS].map((p) => p.address)

export async function loadWorld(): Promise<World> {
  const d = await read(() => getDirectory(TRUSTED))
  const notices: Record<string, Notice[]> = {}
  for (const slug of Object.keys(NOTICES)) {
    const p = d.parties.find((x) => x.slug === slug && x.role === "fiduciary")
    if (!p) continue
    const order = NOTICES[slug as keyof typeof NOTICES].map((n) => n.purpose)
    // A notice counts only if the company's own wallet wrote it.
    // Keep the newest version of each purpose's notice (notices are readonly, so updates are new entities).
    const newest = new Map<string, Notice>()
    for (const n of d.notices.filter((n) => n.fiduciary.toLowerCase() === p.address.toLowerCase())) {
      const cur = newest.get(n.purpose)
      if (!cur || n.createdAt > cur.createdAt) newest.set(n.purpose, n)
    }
    notices[slug] = [...newest.values()].sort((a, b) => order.indexOf(a.purpose) - order.indexOf(b.purpose))
  }
  return { parties: d.parties, notices }
}

const lk = (h: string) => h.toLowerCase()

export async function loadPerson(addresses: Record<string, Address>): Promise<Item[]> {
  const snap = await read(() => getPerson(Object.values(addresses)))
  const out: Item[] = []
  for (const [slug, address] of Object.entries(addresses)) {
    const a = lk(address)
    const receipts = snap.receipts.filter((r) => lk(r.creator) === a)
    for (const g of receipts.filter((r) => r.action === "granted" && isCompany(r.fiduciary))) {
      const k = lk(g.consent)
      const withdrawn = receipts.find((r) => r.action === "withdrawn" && lk(r.consent) === k)
      const live = snap.consents.find((c) => lk(c.key) === k)
      // A lease or stop note counts only if a known vendor's own wallet wrote it.
      const lease = snap.leases.find((l) => lk(l.consent) === k && isVendor(l.creator))
      const ce = snap.ceased.find((c) => lk(c.consent) === k && isVendor(c.creator))
      const status: Status = live ? (lease ? "using" : "pending") : withdrawn ? (ce ? "stopped" : lease ? "ignoring" : "released") : "ended"
      out.push({ slug, address, consent: g.consent, purpose: g.purpose, processor: g.processor, granted: g, withdrawn, live, lease, ceased: ce, status })
    }
    // A "no" is an answer too; it shows in the person's history.
    for (const d of receipts.filter((r) => r.action === "denied" && isCompany(r.fiduciary))) {
      out.push({ slug, address, consent: d.notice, purpose: d.purpose, processor: d.processor, granted: d, status: "denied" })
    }
  }
  return out.sort((a, b) => Number(b.granted.createdAt - a.granted.createdAt))
}
