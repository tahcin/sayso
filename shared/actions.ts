// What a person does with their consents. Each action is one atomic Arkiv batch: the consent and
// its receipt land together or not at all.
import { ExpirationTime, type createWalletClient } from "@arkiv-network/sdk"
import type { Hex } from "viem"
import { consentCreate, declarationCreate, pub, receiptCreate, type Consent, type Declaration, type Dla, type Notice } from "./sayso"

type Wallet = ReturnType<typeof createWalletClient>

/**
 * Answer a company's request in a single transaction: one consent and one "granted" receipt for each
 * notice the person ticked, and one "denied" receipt for each notice they left unticked.
 */
export async function answer(wallet: Wallet, yes: Notice[], no: Notice[]) {
  // The granted receipts must point at consent keys that do not exist yet, so predict them.
  const slots = yes.length ? await pub.predictEntityKeys({ owner: wallet.account!.address, count: yes.length }) : []
  return wallet.executeBatch({
    creates: [
      ...yes.map((n, i) => ({ ...consentCreate(n, n.periodSeconds), salt: slots[i].salt })),
      ...yes.map((n, i) => receiptCreate({ action: "granted", consent: slots[i].key, notice: n.key, fiduciary: n.fiduciary, purpose: n.purpose, processor: n.processor })),
      ...no.map((n) => receiptCreate({ action: "denied", notice: n.key, fiduciary: n.fiduciary, purpose: n.purpose, processor: n.processor })),
    ],
  })
}

/** Withdraw: delete the consent and write the withdrawal receipt, together. */
export async function withdraw(wallet: Wallet, c: Consent, processor: Notice["processor"]) {
  return wallet.executeBatch({
    deletes: [{ entityKey: c.key }],
    creates: [receiptCreate({ action: "withdrawn", consent: c.key, notice: c.notice, fiduciary: c.fiduciary, purpose: c.purpose, processor })],
  })
}

/** Renew for another full period. Only the owner can, because consents are created without permissionless extension. */
export async function renew(wallet: Wallet, c: Consent, n: Notice) {
  return wallet.executeBatch({
    extensions: [{ entityKey: c.key, expires: ExpirationTime.fromSeconds(n.periodSeconds) }],
    creates: [receiptCreate({ action: "renewed", consent: c.key, notice: c.notice, fiduciary: c.fiduciary, purpose: c.purpose, processor: n.processor })],
  })
}

/**
 * Anyone can keep a vendor's stop note alive. Stop notes are the vendor's public statement, created
 * with permissionless extension, so a person, an auditor or a stranger can push their expiry out and
 * nobody but the vendor could delete them. (The person's own receipts are not extendable by others.)
 */
export async function preserve(wallet: Wallet, keys: Hex[]) {
  return wallet.executeBatch({ extensions: keys.map((entityKey) => ({ entityKey, expires: ExpirationTime.fromYears(8) })) })
}

/**
 * Record, from an address used for this record only, that they withdrew consent from a real company. For a loan app
 * picked from RBI's directory, `dla` is the mirrored entry, so the record also names the regulated lender.
 */
export async function declare(wallet: Wallet, company: string, purpose: string, dla?: Dla) {
  return wallet.createEntity(declarationCreate({ company, purpose, dla }))
}

/** The person can delete their own record (they own it, so readonly does not stop them). */
export async function removeDeclaration(wallet: Wallet, d: Declaration) {
  return wallet.executeBatch({ deletes: [{ entityKey: d.key }] })
}

/** Keep a record for eight years from now. Only its owner can, since it is created without permissionless extension. */
export async function keepDeclaration(wallet: Wallet, d: Declaration) {
  return wallet.executeBatch({ extensions: [{ entityKey: d.key, expires: ExpirationTime.fromYears(8) }] })
}
