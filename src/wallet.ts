// The person's keys live only in this browser. One seed, one address per company, so no two
// companies (and nobody reading Arkiv) can link the same person across companies.
import { createWalletClient } from "@arkiv-network/sdk"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { http } from "viem"
import { english, generateMnemonic, mnemonicToAccount } from "viem/accounts"

const SEED_KEY = "sayso.seed.v1"

function loadSeed(): string {
  try {
    const s = localStorage.getItem(SEED_KEY)
    if (s) return s
    const fresh = generateMnemonic(english)
    localStorage.setItem(SEED_KEY, fresh)
    return fresh
  } catch {
    // Private windows can block storage; the session still works, it just will not persist.
    return generateMnemonic(english)
  }
}

let seed = loadSeed()

/** Index of the derived address for each company. */
// "witness" signs only Lifetime Extensions of public records on the cease board.
export const SLOT: Record<string, number> = { rupeeleaf: 0, bazaarline: 1, witness: 7 }

export const accountFor = (slug: string) => mnemonicToAccount(seed, { addressIndex: SLOT[slug] ?? 9 })
export const walletFor = (slug: string) => createWalletClient({ chain: tiramisu, transport: http(), account: accountFor(slug) })

export function resetIdentity() {
  seed = generateMnemonic(english)
  try {
    localStorage.setItem(SEED_KEY, seed)
  } catch {
    /* storage blocked */
  }
}

/** Ask the company the person is about to consent to for a little test gas (sent once, to a nearly empty address). */
export async function ensureGas(address: string, company: string) {
  const r = await fetch("/api/drip", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address, company }) })
  if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? `drip failed (${r.status})`)
  return r.json()
}

/** Wake the processors now instead of waiting for their next minute. */
export const poke = () => fetch("/api/tick", { method: "POST" }).catch(() => undefined)
