// What a person does with their consents. Each action is one atomic Arkiv batch: the consent and
// its receipt land together or not at all.
import { ExpirationTime, type createWalletClient } from "@arkiv-network/sdk"
import { consentCreate, pub, receiptCreate, type Consent, type Notice } from "./sayso"

type Wallet = ReturnType<typeof createWalletClient>

/** Grant one consent per notice, each with its receipt, in a single transaction. */
export async function grant(wallet: Wallet, notices: Notice[]) {
  // The receipts must point at consent keys that do not exist yet, so predict them.
  const slots = await pub.predictEntityKeys({ owner: wallet.account!.address, count: notices.length })
  return wallet.executeBatch({
    creates: [
      ...notices.map((n, i) => ({ ...consentCreate(n, n.periodSeconds), salt: slots[i].salt })),
      ...notices.map((n, i) =>
        receiptCreate({ action: "granted", consent: slots[i].key, fiduciary: n.fiduciary, purpose: n.purpose, processor: n.processor }),
      ),
    ],
  })
}

/** Withdraw: delete the consent and write the withdrawal receipt, together. */
export async function withdraw(wallet: Wallet, c: Consent, processor: Notice["processor"]) {
  return wallet.executeBatch({
    deletes: [{ entityKey: c.key }],
    creates: [receiptCreate({ action: "withdrawn", consent: c.key, fiduciary: c.fiduciary, purpose: c.purpose, processor })],
  })
}

/** Renew for another full period. Only the owner can, because consents are created without permissionless extension. */
export async function renew(wallet: Wallet, c: Consent, n: Notice) {
  return wallet.executeBatch({
    extensions: [{ entityKey: c.key, expires: ExpirationTime.fromSeconds(n.periodSeconds) }],
    creates: [receiptCreate({ action: "renewed", consent: c.key, fiduciary: c.fiduciary, purpose: c.purpose, processor: n.processor })],
  })
}
