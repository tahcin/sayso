# Say So: Arkiv schema

Say So keeps every consent a person gives an Indian app as an Arkiv entity that the person creates and owns. Companies publish notices, vendors (Data Processors under the DPDP Act) hold leases that can never outlive the consent, and when a person withdraws, each vendor deletes its lease and signs a stop note. Six entity types carry this. Code: [`shared/sayso.ts`](../shared/sayso.ts) (schema and queries), [`shared/actions.ts`](../shared/actions.ts) (what a person does), [`shared/robot.ts`](../shared/robot.ts) (what a vendor does).

Network: Tiramisu testnet (chain 7738577), `@arkiv-network/sdk` 0.8.1.

## Conventions

- Every entity carries `app = "sayso"` (str) and `kind` (str). Every query starts with both.
- Attribute names are lowercase snake_case (the node rejects uppercase; see friction.md).
- Addresses are stored as `addr`, references to other entities as `key`, times and numbers we range over as `u64`. Nothing we filter on lives in the payload.
- **Trust comes from `$creator`, never from an attribute.** A notice counts only if the company's wallet created it; a consent only if the person's address created it and still owns it; a lease or stop note only if the named vendor's wallet created it.
- **No personal data on Arkiv.** No names, phone numbers, emails, Aadhaar or PAN, plain or hashed. A person is a wallet address derived on their own device, a different one for each company, so nobody reading Arkiv can link one person across companies. The mapping from that address to a customer account stays in the company's own database. Notices list the data items a company collects ("Mobile number"); they never contain the data.

## Entity types

| Kind | Created by | Owned by | Flags | Entity Expiration | Why that lifetime |
|---|---|---|---|---|---|
| `party` | the company or vendor itself | same | none | 365 days | A business re-publishes who it is every year |
| `notice` | the company | the company | `readonly`, `permissionlessExtension` | 8 years | Must outlive every consent given against it plus the 7-year record duty; terms cannot change after people agree; anyone may keep the proof alive |
| `consent` | the person | the person | `readonly`; permissionless extension **off** | the purpose's period: 10 minutes for a one-off credit check, 90 days for delivery, 180 days for SMS offers, 365 days for loan servicing | Consent lasts exactly as long as its purpose (DPDP Act s.8(7)). Only the person can renew it (MeitY's consent BRD: "consent cannot be assumed or automatically extended") |
| `receipt` | the person | the person | `readonly`, `permissionlessExtension` | 7 years | The record of consents given and withdrawn (DPDP Rules, First Schedule Part B, items 3 and 4(c)); anyone may extend it so the proof survives |
| `lease` | the vendor | the vendor | none | exactly the consent's expiry block (`ExpirationTime.atBlock`) | A vendor's permission can never outlive the person's. When the person renews, the vendor extends its lease to match |
| `ceased` | the vendor | the vendor | `readonly`, `permissionlessExtension` | 7 years | The vendor's signed statement that it stopped (DPDP Act s.6(6)), kept as long as the receipt it answers |

## Attributes

### party
| Attribute | Type | Meaning |
|---|---|---|
| `role` | str | `fiduciary` (company) or `processor` (vendor) |
| `slug` | str | short name, e.g. `rupeeleaf` |

Payload (JSON): `{ name, blurb }`.

### notice
| Attribute | Type | Meaning |
|---|---|---|
| `purpose` | str | purpose code: `credit_check`, `loan_servicing`, `marketing`, `delivery` |
| `period_s` | u64 | how long a consent for this purpose lasts, in seconds |
| `processor` | addr | the vendor that will process data for this purpose |

Payload (JSON): `{ title, text, data_items[] }`, the plain-language notice the person reads (DPDP Rules, Rule 3: itemised data and the specified purpose).

### consent
| Attribute | Type | Meaning |
|---|---|---|
| `fiduciary` | addr | the company |
| `purpose` | str | purpose code |
| `notice` | key | the notice the person agreed to |
| `granted_ms` | u64 | when it was given (the creation block is the authority; this is for display) |

Payload: `{ notice_title }`. Expiry is the only clock: the app shows a countdown from `$expiresAt`, so no stored end date can go stale after a renewal.

### receipt
| Attribute | Type | Meaning |
|---|---|---|
| `action` | str | `granted`, `withdrawn` or `renewed` |
| `consent` | key | the consent it is about |
| `fiduciary` | addr | the company |
| `purpose` | str | purpose code |
| `processor` | addr | the vendor named in the notice |
| `at_ms` | u64 | when, for range queries |

### lease
| Attribute | Type | Meaning |
|---|---|---|
| `consent` | key | the consent it runs under |
| `fiduciary` | addr | the company |
| `purpose` | str | purpose code |
| `principal` | addr | the person's address for that company |

### ceased
| Attribute | Type | Meaning |
|---|---|---|
| `consent` | key | the withdrawn consent |
| `receipt` | key | the withdrawal receipt it answers |
| `processor` | addr | the vendor (must equal `$creator`) |
| `fiduciary` | addr | the company |
| `purpose` | str | purpose code |
| `principal` | addr | the person's address |
| `withdrawn_block` | u64 | block of the withdrawal receipt |
| `at_ms` | u64 | when, for range queries |

Time to stop is `$createdAt(ceased) − $createdAt(receipt)`, counted in blocks, so neither side can backdate it.

## Writes (all atomic)

| Action | Who | Batch |
|---|---|---|
| Publish notices | company | `executeBatch` of all its notices |
| Give consent | person | one `executeBatch`: N consents + N `granted` receipts. The receipts reference consent keys that do not exist yet, so the keys come from `predictEntityKeys` and each consent carries the predicted `salt` |
| Withdraw | person | one `executeBatch`: delete the consent + create a `withdrawn` receipt |
| Renew | person | one `executeBatch`: `extensions` on the consent + a `renewed` receipt |
| Vendor round | each vendor | one `executeBatch`: new leases, lease extensions to match renewed consents, and for each withdrawal a lease delete + a `ceased` note |

## Queries the app runs

Anonymous reads share a cost quota per IP (about 100 queries an hour, see friction.md), so each screen asks one compound question. Exact strings, as sent to `arkiv_query`:

**The consent check** (any developer, before any job): `hasLiveConsent(customer, company, purpose)`
```
app = str('sayso') AND kind = str('consent') AND fiduciary = addr(<company>)
  AND purpose = str('<purpose>') AND $owner = addr(<customer>) AND $creator = addr(<customer>)
```
Limit 1. A withdrawn or expired consent is simply not returned, so there is no revocation list to sync.

**Directory** (companies, vendors, notices), once per page load:
```
app = str('sayso') AND (kind = str('party') OR kind = str('notice'))
```

**One person's picture** (My consents and the vendor cards), on load, on relevant WebSocket events, and every 2 minutes as a fallback:
```
app = str('sayso') AND (
     (kind = str('consent') AND (($owner = addr(A1) AND $creator = addr(A1)) OR ($owner = addr(A2) AND $creator = addr(A2))))
  OR (kind = str('receipt') AND ($creator = addr(A1) OR $creator = addr(A2)))
  OR ((kind = str('lease') OR kind = str('ceased')) AND (principal = addr(A1) OR principal = addr(A2))))
```

**Vendor round** (Worker, every minute and right after a withdrawal), one read for all four vendors:
```
app = str('sayso') AND (kind = str('notice') OR kind = str('consent') OR kind = str('lease')
  OR (kind = str('receipt') AND action = str('withdrawn') AND at_ms >= u64(<now - 7 days>)))
```
Then, per vendor: notices whose `processor` is the vendor and whose `$creator` is a known company; live consents whose `$owner == $creator`; its own leases by `$creator`.

**Cease board**, every minute and on vendor events:
```
app = str('sayso') AND (kind = str('party') OR kind = str('lease')
  OR (kind = str('receipt') AND action = str('withdrawn') AND at_ms >= u64(<since>))
  OR (kind = str('ceased') AND at_ms >= u64(<since>)))
```

Pagination: every read walks `cursor` until it is empty (page size 200). There is no server-side sort; the app sorts by `$createdAt` on the client.

## Live events

The page opens one `watchEntityEvents` subscription over a WebSocket transport with no `fromBlock`. The stream is chain-wide, so the page filters on the client: an event refreshes the person's view only if its owner is one of the person's addresses or a known vendor, or its entity key is one of the person's consents or leases.

## What deliberately stays off Arkiv

- Personal data of any kind, and the data being processed.
- The link between a wallet address and a customer account (each company's own database).
- The person's seed phrase (their device only).
- Wallet keys of the fictional companies and vendors (Worker secrets).
- Anything secret, including our RPC access key.
