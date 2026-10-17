# Say So: Arkiv schema

Say So keeps every answer a person gives to an Indian app's consent request (yes or no) as Arkiv entities that the person creates and owns. Companies publish notices. Vendors (Data Processors under the DPDP Act) hold leases set to expire with the consent. When a person withdraws, each vendor is expected to delete its lease and sign a stop note, and how long that took is public. Six entity types carry this.

Code: [`shared/sayso.ts`](../shared/sayso.ts) (schema and queries), [`shared/actions.ts`](../shared/actions.ts) (what a person and a witness do), [`shared/robot.ts`](../shared/robot.ts) (what a vendor does), [`shared/cast.ts`](../shared/cast.ts) (the fictional companies and vendors).

Network: Tiramisu testnet (chain 7738577), `@arkiv-network/sdk` 0.8.1.

## Conventions

- Every entity carries `app = "sayso"` (str) and `kind` (str). Every query starts with both.
- Attribute names are lowercase snake_case (the node rejects uppercase; see friction.md).
- Addresses are stored as `addr`, references to other entities as `key`, numbers we range over as `u64`. Nothing we filter on lives in the payload.
- **Trust comes from `$creator`, never from an attribute.** The app knows the fictional companies' and vendors' wallet addresses (`shared/cast.ts`) and only reads parties, notices, leases and stop notes whose `$creator` is one of them, so a fake "rupeeleaf" party from another wallet is ignored. A consent counts only if the person's address created it and still owns it (`$owner = $creator`).
- **No personal data on Arkiv.** No names, phone numbers, emails, Aadhaar or PAN, plain or hashed. A person is a wallet address derived on their own device, a different one for each company. Each address gets its test gas from the company it consents to, at the person's first answer, so no shared faucet transaction links one person's addresses. The mapping from that address to a customer account stays in the company's own database. Notices list the kinds of data a company collects ("Mobile number"); they never contain the data.

## Entity types

| Kind | Created by | Owned by | Flags | Entity Expiration | Why that lifetime |
|---|---|---|---|---|---|
| `party` | the company or vendor itself | same | none | 365 days | A business re-publishes who it is every year |
| `notice` | the company | the company | `readonly`, `permissionlessExtension` | 8 years | Must outlive every consent given against it plus the 7-year record; terms cannot change after people agree; anyone may keep the proof alive |
| `consent` | the person | the person | `readonly`; permissionless extension **off** | the purpose's period: 10 minutes for a one-off credit check, 90 days for delivery, 180 days for SMS offers, 365 days for loan servicing | A consent lasts as long as its purpose; when the purpose ends the company must also erase the data (DPDP Act s.8(7)). Only the person can renew it (MeitY's consent management BRD, June 2025: "consent cannot be assumed or automatically extended") |
| `receipt` | the person | the person | `readonly`; permissionless extension **off** | 7 years | Modelled on the record a Consent Manager must keep for at least seven years of consents "given, denied or withdrawn" (DPDP Rules, First Schedule Part B, items 3 and 4(c)). It describes the person, so only the person can extend it, and as owner they can delete it. (Receipts written before 15:00 IST on 17 Oct were created with permissionless extension on.) |
| `lease` | the vendor | the vendor | none | the consent's expiry block (`ExpirationTime.atBlock`) | A vendor's lease is set to end exactly when the consent would. When the person renews, the vendor extends the lease to match. A withdrawal does not delete it by itself: the vendor must, and one that does not stays visible |
| `ceased` | the vendor | the vendor | `readonly`, `permissionlessExtension` | 7 years | The vendor's signed statement that it stopped processing (the duty in DPDP Act s.6(6)), kept as long as the receipt it answers |

## Attributes

### party
| Attribute | Type | Meaning |
|---|---|---|
| `role` | str | `fiduciary` (company) or `processor` (vendor) |
| `slug` | str | short name, e.g. `rupeeleaf` (display only; trust is `$creator`) |

Payload (JSON): `{ name, blurb }`.

### notice
| Attribute | Type | Meaning |
|---|---|---|
| `purpose` | str | purpose code: `credit_check`, `loan_servicing`, `marketing`, `delivery` |
| `period_s` | u64 | how long a consent for this purpose lasts, in seconds |
| `processor` | addr | the vendor that will process data for this purpose |
| `version` | i32 | notice version (current: 2) |

Payload (JSON): `{ title, text, data_items[], hi: { title, text, data_items[] }, contact }`: the plain-language notice in English and Hindi (a notice must be available in English or an Eighth Schedule language, DPDP Act s.5(3)), with the itemised data and the specified purpose (Rule 3) and the company's contact for questions and complaints (a fictional `.example` address). The app adds the same rights text to every notice: how to withdraw, and that the person can complain to the Data Protection Board.

Notices are readonly, so a changed notice is a new entity with a higher `version`; the app shows the newest per company and purpose, and old consents keep pointing at the notice they agreed to.

### consent
| Attribute | Type | Meaning |
|---|---|---|
| `fiduciary` | addr | the company |
| `purpose` | str | purpose code |
| `notice` | key | the notice the person agreed to |
| `granted_ms` | u64 | when it was given, for display (the creation block is the authority) |

Payload: `{ notice_title }`. Expiry is the only clock: the app counts down from `$expiresAt`, so no stored end date can go stale after a renewal.

### receipt
| Attribute | Type | Meaning |
|---|---|---|
| `action` | str | `granted`, `denied`, `withdrawn` or `renewed` |
| `consent` | key | the consent it is about (absent on `denied`, where no consent exists) |
| `notice` | key | the notice that was answered |
| `fiduciary` | addr | the company |
| `purpose` | str | purpose code |
| `processor` | addr | the vendor named in the notice |
| `at_ms` | u64 | when, for display |

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
| `at_ms` | u64 | when, for display |

Time to the stop note is `$createdAt(ceased) − $createdAt(receipt)` in blocks, so neither side can backdate it. It measures when the vendor signed, which is the vendor's own statement that it stopped.

## Writes (all atomic, one transaction each)

| Action | Who | Batch |
|---|---|---|
| Publish notices | company | all its notices in one `executeBatch` |
| Answer a request | person | for each ticked purpose a consent plus a `granted` receipt, and for each unticked purpose a `denied` receipt. The granted receipts reference consent keys that do not exist yet, so the keys come from `predictEntityKeys` and each consent carries the predicted `salt` |
| Withdraw | person | delete the consent + create a `withdrawn` receipt |
| Renew | person | `extensions` on the consent + a `renewed` receipt |
| Vendor round | each vendor | new leases, lease extensions to match renewed consents, and for each withdrawal a lease delete + a `ceased` note |
| Keep longer | anyone (a "witness" address in the visitor's browser) | `extensions` on a vendor's stop note to 8 years from now. Possible only because stop notes are created with `permissionlessExtension`; only the vendor could delete one |

## Queries the app runs

Anonymous reads share a cost quota per IP (about 100 queries an hour, see friction.md), so each screen asks one compound question. Built with the SDK's typed query builder; shown here as the text it renders.

**The consent check** (any developer, before any job), `hasLiveConsent(customer, company, purpose)`, limit 1:
```
app = str('sayso') AND kind = str('consent') AND fiduciary = addr(<company>)
  AND purpose = str('<purpose>') AND $owner = addr(<customer>) AND $creator = addr(<customer>)
```
A withdrawn or expired consent is simply not returned, so there is no revocation list to sync.

**Directory** (companies, vendors, notices), once per page load:
```
app = str('sayso') AND (kind = str('party') OR kind = str('notice'))
  AND ($creator = addr(<cast 1>) OR … OR $creator = addr(<cast 6>))
```

**One person's picture** (My consents and the vendor cards), on load, on relevant WebSocket events, and every 2 minutes as a fallback:
```
app = str('sayso') AND (
     (kind = str('consent') AND (($owner = addr(A1) AND $creator = addr(A1)) OR ($owner = addr(A2) AND $creator = addr(A2))))
  OR (kind = str('receipt') AND ($creator = addr(A1) OR $creator = addr(A2)))
  OR ((kind = str('lease') OR kind = str('ceased')) AND (principal = addr(A1) OR principal = addr(A2))))
```
Leases and stop notes are then kept only if their `$creator` is a known vendor.

**Vendor round** (Worker, every 5 minutes and right after a withdrawal), one read for all four vendors:
```
app = str('sayso') AND (kind = str('notice') OR kind = str('consent') OR kind = str('lease')
  OR (kind = str('receipt') AND action = str('withdrawn') AND at_ms >= u64(<now - 7 days>)))
```
Then, per vendor: notices whose `processor` is the vendor and whose `$creator` is a known company; live consents whose `$owner = $creator`; its own leases by `$creator`.

**Cease board**, every minute and on vendor events:
```
app = str('sayso') AND ((kind = str('receipt') AND action = str('withdrawn')) OR kind = str('consent')
  OR ((kind = str('lease') OR kind = str('ceased')) AND ($creator = addr(<vendor 1>) OR … )))
  AND $createdAt >= u64(<block 7 days ago>)
```
The window is a block range on `$createdAt`, which no writer can set. The SDK builder refuses `$createdAt` filters although the node applies them (friction.md, item 4b), so that clause is appended as text. A withdrawal appears on the board only if the named vendor's own wallet wrote a lease or a stop note about that consent and that person, the consent is really gone, it is the first withdrawal receipt for that consent, and any stop note came after it. Receipts from strangers, fake withdrawals of live consents and duplicates cannot change a vendor's score. The vendors apply the same rule: a withdrawal counts only if the person the lease is about wrote it.

Pagination: every read walks `cursor` until it is empty (page size 200). There is no server-side sort; the app sorts by `$createdAt` on the client.

## Live events

The page opens one `watchEntityEvents` subscription over a WebSocket transport with no `fromBlock`. The stream is chain-wide, so the page filters on the client: an event refreshes the person's view only if its owner is one of the person's addresses or a known vendor, or its entity key is one of the person's consents or leases.

## What deliberately stays off Arkiv

- Personal data of any kind, and the data being processed.
- The link between a wallet address and a customer account (each company's own database).
- The person's seed phrase (their device only).
- Wallet keys of the fictional companies and vendors, and our RPC access key (Worker secrets). For the demo, one Cloudflare Worker runs all four vendors' duty loops with their own keys; in real use each vendor would run its own.

## Entities from the build

Entities written before 13:30 IST on 17 October 2026 come from earlier drafts of this schema while we built it (for example consents whose receipts were written in a separate transaction, and stop notes without `principal`). They carry the same `app` and `kind`, and the app's views ignore them where fields are missing; the board starts at that time.
