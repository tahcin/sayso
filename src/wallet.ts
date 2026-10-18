// The person's keys live only in this browser. One seed, one address per company and one per "Any app"
// record, so no two companies (and nobody reading Arkiv) can link the same person across companies.
import { createWalletClient } from "@arkiv-network/sdk"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { http, toHex, type Hex } from "viem"
import { keyToFragment, recordKey } from "../shared/seal"
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
// "self" wrote the person's "Any app" records before each one got its own address; it is still read
// so those older records stay visible and manageable.
export const SLOT: Record<string, number> = { rupeeleaf: 0, bazaarline: 1, self: 5, witness: 7 }

/**
 * Each "Any app" record is written from its own address, "decl:0", "decl:1", ... on a separate branch of
 * the same seed (BIP-44 account 1). A lender who follows the link in a letter sees only that one record,
 * not every other company the person withdrew from. The recovery phrase still recovers all of them.
 */
export const declSlug = (i: number) => `decl:${i}`
const declIndex = (slug: string) => (/^decl:\d+$/.test(slug) ? Number(slug.slice(5)) : null)

export const accountFor = (slug: string) => {
  const d = declIndex(slug)
  return d === null ? mnemonicToAccount(seed, { addressIndex: SLOT[slug] ?? 9 }) : mnemonicToAccount(seed, { accountIndex: 1, addressIndex: d })
}
/** The key that seals one "Any app" record, derived from that record's own address (shared/seal.ts). */
export const recordKeyFor = (slug: string) => recordKey(toHex(accountFor(slug).getHdKey().privateKey!))
/** The link a letter carries: our record page, with the key after "#" so it never reaches a server. */
export const recordUrl = (key: Hex, k: Uint8Array) => `${location.origin}/r/${key}#k=${keyToFragment(k)}`
export const walletFor = (slug: string) => createWalletClient({ chain: tiramisu, transport: http(), account: accountFor(slug) })

// How many record addresses this identity has used, so the next record gets a fresh one. Only a hint:
// after a restore in another browser the app finds the used addresses on Arkiv and raises it.
const countKey = () => `sayso.decls.v1.${mnemonicToAccount(seed, { accountIndex: 1, addressIndex: 0 }).address.toLowerCase()}`
export function loadDeclCount() {
  try {
    const n = Number(localStorage.getItem(countKey()))
    return Number.isInteger(n) && n > 0 ? n : 0
  } catch {
    return 0
  }
}
export function saveDeclCount(n: number) {
  try {
    localStorage.setItem(countKey(), String(n))
  } catch {
    /* storage blocked */
  }
}

/** The recovery phrase, so a person can keep it and withdraw later from another browser. */
export const recoveryPhrase = () => seed

/** Restore from a saved phrase. Returns false if it is not a valid 12-word phrase. */
export function restoreIdentity(phrase: string) {
  const words = phrase.trim().toLowerCase().split(/\s+/)
  if (words.length !== 12) return false
  try {
    mnemonicToAccount(words.join(" "))
  } catch {
    return false
  }
  seed = words.join(" ")
  try {
    localStorage.setItem(SEED_KEY, seed)
  } catch {
    /* storage blocked */
  }
  return true
}

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
  // A funding transfer normally lands in a few seconds; give up after a minute so the screen never spins forever.
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 60000)
  const r = await fetch("/api/drip", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address, company }), signal: ctl.signal })
    .catch((e) => {
      throw new Error(ctl.signal.aborted ? "Test gas is taking too long to arrive. Please try again." : (e as Error).message)
    })
    .finally(() => clearTimeout(t))
  if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? `drip failed (${r.status})`)
  return r.json()
}

/** Wake the processors now instead of waiting for their next minute. */
export const poke = () => fetch("/api/tick", { method: "POST" }).catch(() => undefined)
