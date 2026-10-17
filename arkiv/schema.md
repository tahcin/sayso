# Say So: Arkiv schema

Say So keeps every answer a person gives to an Indian app's consent request (yes or no) as Arkiv entities that the person creates and owns. Companies publish notices. Vendors (Data Processors under the DPDP Act) hold leases set to expire with the consent. When a person withdraws, each vendor is expected to delete its lease and sign a stop note, and how long that took is public. A mirror wallet also publishes RBI's directory of digital lending apps, so a borrower can withdraw from a real, regulated loan app today. Eight entity types carry this.

Code: [`shared/sayso.ts`](../shared/sayso.ts) (schema and queries), [`shared/actions.ts`](../shared/actions.ts) (what a person and a witness do), [`shared/robot.ts`](../shared/robot.ts) (what a vendor does), [`shared/cast.ts`](../shared/cast.ts) (the fictional companies and vendors, and the mirror's address), [`scripts/fetch-dla.py`](../scripts/fetch-dla.py) (rebuilds the RBI snapshot in `data/`, minimal fields only), [`scripts/mirror-dla.ts`](../scripts/mirror-dla.ts) (the directory sync).

Network: Tiramisu testnet (chain 7738577), `@arkiv-network/sdk` 0.8.1.

## Conventions

- Every entity carries `app = "sayso"` (str) and `kind` (str). Every query starts with both.
- Attribute names are lowercase snake_case (the node rejects uppercase; see friction.md).
- Addresses are stored as `addr`, references to other entities as `key`, numbers we range over as `u64`. Nothing we filter on lives in the payload.
- **Trust comes from `$creator`, never from an attribute.** The app knows the fictional companies' and vendors' wallet addresses (`shared/cast.ts`) and only reads parties, notices, leases and stop notes whose `$creator` is one of them, so a fake "rupeeleaf" party from another wallet is ignored. A consent counts only if the person's address created it and still owns it (`$owner = $creator`).
- **No personal data on Arkiv.** No names, phone numbers, emails, Aadhaar or PAN, plain or hashed. A person is a wallet address derived on their own device, a different one for each company, and a fresh one for each "Any app" record (BIP-44 account 1, address 0, 1, 2, ... of the same seed), so a lender who follows a letter's link sees only that record and cannot link the person's other withdrawals. Records made before that change came from one shared "self" address and are still read. Each address gets its test gas from the company it consents to, at the person's first answer, so no shared faucet transaction links one person's addresses. The mapping from that address to a customer account stays in the company's own database. Still disclosed, not hidden: purpose codes are plaintext so vendors and the consent check can query them; leases and stop notes carry `principal` (the person's address for that company, already public as the consent's owner); in the demo one Worker holds all four fictional vendors' keys; and the person's view reads all their addresses in one query, so whoever serves it could link them. Notices list the kinds of data a company collects ("Mobile number"); they never contain the data. The RBI mirror carries only app name, lender, lender type and app link; the grievance officers' names, emails and phone numbers in RBI's directory are never put on Arkiv.

## Entity types

| Kind | Created by | Owned by | Flags | Entity Expiration | Why that lifetime |
|---|---|---|---|---|---|
| `party` | the company or vendor itself | same | none | 365 days | A business re-publishes who it is every year |
| `notice` | the company | the company | `readonly`, `permissionlessExtension` | 8 years | Must outlive every consent given against it plus the 7-year record; terms cannot change after people agree; anyone may keep the proof alive |
| `consent` | the person | the person | `readonly`; permissionless extension **off** | the purpose's period: 10 minutes for a one-off credit check, 90 days for delivery, 180 days for SMS offers, 365 days for loan servicing | A consent lasts as long as its purpose; when the purpose ends the company must also erase the data (DPDP Act s.8(7)). Only the person can renew it (MeitY's Business Requirement Document for Consent Management under the DPDP Act, June 2025, section 4.1.4: "Consent cannot be assumed. The Data Principal must actively agree to the renewal." [PDF](https://d38ibwa0xdgwxx.cloudfront.net/whatsnew-docs/8d5409f5-d26c-4697-b10e-5f6fb2d583ef.pdf)) |
| `receipt` | the person | the person | `readonly`; permissionless extension **off** | 7 years | Modelled on the record a Consent Manager must keep for at least seven years of consents "given, denied or withdrawn" (DPDP Rules, 2025, [G.S.R. 846(E)](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf), First Schedule Part B, items 3 and 4(c)). Seven years is the lifetime set on the entity, on Tiramisu testnet. It describes the person, so only the person can extend it, no company or vendor can change it, and as owner the person can delete it. (Receipts written before 14:40 IST on 17 Oct were created with permissionless extension on.) |
| `lease` | the vendor | the vendor | none | the consent's expiry block (`ExpirationTime.atBlock`) | A vendor's lease is set to end exactly when the consent would. When the person renews, the vendor extends the lease to match. A withdrawal does not delete it by itself: the vendor must, and one that does not stays visible |
| `ceased` | the vendor | the vendor | `readonly`, `permissionlessExtension` | 7 years | The vendor's signed statement that it stopped processing (the duty in DPDP Act s.6(6)), kept as long as the receipt it answers |
| `declaration` | the person, from a fresh address for each record | the person | `readonly`; permissionless extension **off** | 7 years | The person's own timestamped proof that they withdrew consent from a real company outside the demo (the "Any app" tab). Same 7-year lifetime as a receipt; the company cannot change it, only the person can extend or delete it |
| `dla` | the RBI mirror wallet | the mirror | `readonly`; permissionless extension **off** | 30 days, renewed by the sync while RBI still lists the app | One app and lender pair from RBI's directory of digital lending apps. Absence on Arkiv must mean "not in RBI's directory", so a delisted app has to die on its own; with permissionless extension on, anyone could keep it alive |

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

### declaration
| Attribute | Type | Meaning |
|---|---|---|
| `action` | str | `withdrawn` |
| `company` | str | a company from the fixed list, a loan app picked from the RBI mirror, or `Another company`. Nothing the person types is written: a name typed for "another company" only goes into their message |
| `purpose` | str | for a company from the list or "Another company": `marketing_calls`, `sharing_partners`, `personalised_ads`, `contacts_photos` or `other`; for a loan app from the RBI mirror: `beyond_loan` (using data for anything beyond the loan), `third_party_sharing`, `phone_access` (contacts, photos and call logs) or `marketing_calls` |
| `at_ms` | u64 | when, for display (the creation block is the authority) |
| `dla` | key | only for a loan app picked from the directory: the mirror's `dla` entity it was picked from |
| `lender` | str | only with `dla`: the regulated lender behind that app, as RBI lists it |

The app then drafts a withdrawal message for the person to send to the company, quoting the record's link. For a loan app from the directory the letter goes to the lender's Grievance Redressal Officer and cites paras 13(2) and 13(4) (and 13(1) for phone access) of the RBI Credit Facilities Directions, 2025 that apply to that lender (NBFC or commercial bank), with escalation to RBI under para 12(4) after 30 days. Small finance, urban co-operative, rural co-operative, regional rural and local area banks each have their own Credit Facilities Directions of 28 November 2025 with the same paragraph numbers; for rural co-operative banks the 30-day escalation in 12(4) goes to NABARD or RBI's Customer Education and Protection Cell instead of CMS. The README's "Rules the letter cites" table quotes each paragraph and links RBI's text. The message itself never touches Arkiv.

### dla
| Attribute | Type | Meaning |
|---|---|---|
| `app_name` | str | the app's name as RBI lists it (`app` is taken by the namespace) |
| `app_lc` | str | the same, lowercased, for prefix search |
| `lender` | str | the regulated lender (NBFC, bank or housing finance company) as RBI lists it |
| `lender_lc` | str | the same, lowercased |
| `lender_type` | str | `NBFC`, `BANK` or `HOUSING FINANCE COMPANY` |
| `source` | str | `rbi_dla` |
| `snapshot` | str | date of the RBI snapshot, e.g. `2026-10-17` |

Payload (JSON): `{ app, lender, lender_type, url }`, where `url` is the app link RBI lists.

The snapshot of 17 October 2026 has 1,749 unique app and lender pairs from 461 lenders (1,485 NBFC rows, 261 bank, 3 housing finance). It is published as RBI lists it, including a few junk rows (app names `0` to `5` and `NA`), and one app often has several lenders, each its own entity. Trust is `$creator`: only entities written by the mirror wallet `0x822BB671e6Ce0F2b69A500344764D9fedE31E725` count.

**Lifetime and renewal.** `scripts/mirror-dla.ts` reads every `dla` the mirror has written, compares it with the latest snapshot and then creates apps that are missing, extends apps still listed once they have under 25 days left (by `DLA_LIFETIME`, 30 days), and leaves apps RBI no longer lists alone, so they expire within 30 days. Every create and extension stays on chain, so the mirror's history can be audited.

## Writes (all atomic, one transaction each)

| Action | Who | Batch |
|---|---|---|
| Publish notices | company | all its notices in one `executeBatch` |
| Answer a request | person | for each ticked purpose a consent plus a `granted` receipt, and for each unticked purpose a `denied` receipt. The granted receipts reference consent keys that do not exist yet, so the keys come from `predictEntityKeys` and each consent carries the predicted `salt` |
| Withdraw | person | delete the consent + create a `withdrawn` receipt |
| Renew | person | `extensions` on the consent + a `renewed` receipt |
| Vendor round | each vendor | new leases, lease extensions to match renewed consents, and for each withdrawal a lease delete + a `ceased` note |
| Record a real withdrawal | person (a fresh address for this record, funded by the house wallet) | one `declaration` |
| Keep longer | anyone (a "witness" address in the visitor's browser) | `extensions` on a vendor's stop note to 8 years from now. Possible only because stop notes are created with `permissionlessExtension`; only the vendor could delete one |
| Sync the RBI directory | the mirror (`scripts/mirror-dla.ts`) | creates in batches of 40 per `executeBatch`, then `extensions` in batches of 40. Publishing the last 189 apps cost about 0.024 test GLM |

## Queries the app runs

Anonymous reads share a cost quota per IP (about 100 queries an hour, see friction.md), so each screen asks one compound question. Built with the SDK's typed query builder; shown here as the text it renders.

**The consent check** (any developer, before any job), `hasLiveConsent(customer, company, purpose)`, limit 1:
```
app = str('sayso') AND kind = str('consent') AND fiduciary = addr(<company>)
  AND purpose = str('<purpose>') AND $owner = addr(<customer>) AND $creator = addr(<customer>)
```
A withdrawn or expired consent is simply not returned, so there is no revocation list to sync.

**Loan app search** ("Any app", as the person types two or more letters), `searchDla`, limit 8, with payload:
```
app = str('sayso') AND kind = str('dla') AND $creator = addr(0x822BB671e6Ce0F2b69A500344764D9fedE31E725)
  AND (app_lc STARTSWITH str('<typed>') OR lender_lc STARTSWITH str('<typed>'))
```
The app groups results by app name and lists each lender. An app that is not returned is not in RBI's directory, and the person is pointed to sachet.rbi.org.in or the 1930 cyber-fraud helpline.

**Directory** (companies, vendors, notices), once per page load:
```
app = str('sayso') AND (kind = str('party') OR kind = str('notice'))
  AND ($creator = addr(<cast 1>) OR … OR $creator = addr(<cast 6>))
```

**One person's picture** (My consents and the vendor cards), on load, on relevant WebSocket events, and every 2 minutes as a fallback:
```
app = str('sayso') AND (
     (kind = str('consent') AND (($owner = addr(A1) AND $creator = addr(A1)) OR ($owner = addr(A2) AND $creator = addr(A2))))
  OR ((kind = str('receipt') OR kind = str('declaration')) AND ($creator = addr(A1) OR $creator = addr(A2) OR $creator = addr(D0) OR … OR $creator = addr(S)))
  OR ((kind = str('lease') OR kind = str('ceased')) AND (principal = addr(A1) OR principal = addr(A2))))
```
Leases and stop notes are then kept only if their `$creator` is a known vendor.

**Vendor round** (Worker, every 5 minutes and right after a withdrawal), one read for all four vendors:
```
app = str('sayso') AND (kind = str('notice') OR kind = str('consent') OR kind = str('lease')
  OR (kind = str('receipt') AND action = str('withdrawn') AND at_ms >= u64(<now - 7 days>)))
```
Then, per vendor: notices whose `processor` is the vendor and whose `$creator` is a known company; live consents whose `$owner = $creator`; its own leases by `$creator`.

**Cease board**, every minute while the page is open and on vendor events:
```
app = str('sayso') AND ((kind = str('receipt') AND action = str('withdrawn')) OR kind = str('consent')
  OR ((kind = str('lease') OR kind = str('ceased')) AND ($creator = addr(<vendor 1>) OR … )))
  AND $createdAt >= u64(<block 7 days ago>)
```
The window is a block range on `$createdAt`, which no writer can set. The SDK builder refuses `$createdAt` filters although the node applies them (friction.md, item 4b), so that clause is appended as text. A withdrawal appears on the board only if the named vendor's own wallet wrote a lease or a stop note about that consent and that person, the consent is really gone, it is the first withdrawal receipt for that consent, and any stop note came after it. Receipts from strangers, fake withdrawals of live consents and duplicates cannot change a vendor's score. The vendors apply the same rule: a withdrawal counts only if the person the lease is about wrote it.

Pagination: every read walks `cursor` until it is empty (page size 200). Walks over the builder are pinned to one block with `.atBlock()`, because a cursor is bound to its block (friction.md, item 13). There is no server-side sort; the app sorts by `$createdAt` on the client.

## Live events

The page opens one `watchEntityEvents` subscription over a WebSocket transport with no `fromBlock`. The stream is chain-wide, so the page filters on the client: an event refreshes the person's view only if its owner is one of the person's addresses or a known vendor, or its entity key is one of the person's consents or leases.

## What deliberately stays off Arkiv

- Personal data of any kind, and the data being processed.
- The link between a wallet address and a customer account (each company's own database).
- The person's seed phrase (their device only).
- From RBI's directory: grievance officers' names, emails and phone numbers. We mirror only app, lender, lender type and app link.
- Wallet keys of the fictional companies and vendors, and our RPC access key (Worker secrets). For the demo, one Cloudflare Worker runs all four vendors' duty loops with their own keys; in real use each vendor would run its own.

## Entities from the build

Entities written before 13:30 IST on 17 October 2026 come from earlier drafts of this schema while we built it (for example consents whose receipts were written in a separate transaction, and stop notes without `principal`). They carry the same `app` and `kind`, and the app's views ignore them where fields are missing; the board starts at that time.
