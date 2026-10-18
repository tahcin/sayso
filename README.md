# Say So

**Your data moves only while you say so.**

Live: https://sayso.tahcin.tech

India's Digital Personal Data Protection Act, 2023 makes consent the main legal basis for processing personal data. Today the company that asks for your consent usually keeps the only record of it, and so do the vendors it passes your data to. When you withdraw, nobody outside can tell whether the lender, its credit bureau and its SMS vendor actually stopped.

- "52 out of the 53 analysed apps employ deceptive design practices", and "All e-commerce apps studied made it difficult for users to delete their accounts" ([ASCI Academy and Parallel HQ press release, 1 August 2024](https://www.ascionline.in/wp-content/uploads/2024/07/Press-Release.-Conscious-Patterns-25.07.24.docx.pdf)).
- 95% of people surveyed got unwanted commercial calls every day, and 96% of those on the Do Not Disturb list still got them ([LocalCircles via Business Today, Sept 2024](https://www.businesstoday.in/amp/technology/news/story/95-indians-continue-to-get-unwanted-calls-daily-despite-regulatory-interventions-survey-443922-2024-09-02)).
- Consent Managers, the new regulated role that will hold people's consents, can register from **13 November 2026**; the notice, consent and erasure duties of the DPDP Rules, 2025 apply from **13 May 2027**.

Say So keeps consent on [Arkiv](https://arkiv.network), the Web3 database:

- **You own the consent.** Your browser writes it from an address only you control, a different one for each company. It expires when its purpose ends. Only you can renew it. Withdrawing deletes it. Saying no is recorded too.
- **Vendors hold a lease set to end with your consent.** Before any job they check for a live consent. When you withdraw, the law requires them to stop (s.6(6)); in Say So a vendor shows it did by dropping its lease and signing a stop note.
- **Stopping is public.** How long each vendor took to sign is on the cease board for anyone to check, and so is the vendor that never answers.

No personal data goes to Arkiv: only wallet addresses, purpose codes and times. Everything runs on Arkiv's Tiramisu testnet.

## Works today for loan-app borrowers

The DPDP duties are still ahead, but borrowers already have these rights. RBI's Credit Facilities Directions, 2025 (for NBFCs, RBI/DOR/2025-26/347, and for commercial banks, RBI/DOR/2025-26/154, both 28 November 2025) say a lender's app must not access contacts, call logs or files and media (para 13(1)), the borrower can deny or revoke consent and ask for their data to be deleted (13(2)), the lender needs explicit consent before sharing with a third party (13(4)), and a complaint the lender leaves unanswered for 30 days can go to RBI (12(4)).

Say So mirrors RBI's directory of digital lending apps onto Arkiv: all 1,749 app and lender pairs from 461 lenders in the 17 October 2026 snapshot. In **Any app** a borrower searches for their loan app, sees the lender RBI lists behind it, records their withdrawal on Arkiv, and gets a letter in English or Hindi to that lender's Grievance Redressal Officer that cites the right paragraphs, explains the RBI escalation at cms.rbi.org.in after 30 days, and links to the Arkiv record. An app that is not in the directory may not be tied to any RBI-regulated lender, and Say So points the person to sachet.rbi.org.in or the 1930 helpline.

### Rules the letter cites

The letter picks the Directions by the kind of lender: RBI's directory says NBFC or bank, and for banks Say So infers the type (small finance, urban co-operative, rural co-operative, regional rural, local area or commercial) from the lender's name. All are RBI's entity-wise Credit Facilities Directions of 28 November 2025, in force today; each carries the digital lending rules as paras 12 and 13. Quotes are copied from RBI's own PDFs, fetched 17 October 2026.

| Lender | Directions | Para | Operative words |
|---|---|---|---|
| NBFC, including housing finance companies (para 3(1)(vii)) | Reserve Bank of India (Non-Banking Financial Companies – Credit Facilities) Directions, 2025, RBI/DOR/2025-26/347, 28 Nov 2025, updated 15 Jul 2026 ([page](https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=12957), [PDF](https://rbidocs.rbi.org.in/rdocs/notification/PDFs/347MD5CC21D3597C04354B67A42A1A4CB439C.PDF)) | 13(1) | "an NBFC shall also ensure that DLA of NBFC / LSP desist from accessing mobile phone resources like file and media, contact list, call logs, telephony functions, etc." |
| | | 13(2) | "The borrower shall be provided with an option to give or deny consent for use of specific data, restrict disclosure to third parties, data retention, revoke consent already granted to collect personal data and if required, make the NBFC / LSP delete / forget the data." |
| | | 13(4) | "Explicit consent of the borrower shall be taken before sharing personal information with any third party, except for cases where such sharing is required as per statutory or regulatory requirement." |
| | | 12(4) | "...or the borrower has not received any reply within 30 days of receipt of complaint by the NBFC, the said borrower can lodge a complaint over the Complaint Management System (CMS - https://cms.rbi.org.in/) portal..." |
| Commercial bank: public and private sector banks, foreign banks (para 3 excludes small finance, payments and local area banks) | Reserve Bank of India (Commercial Banks – Credit Facilities) Directions, 2025, RBI/DOR/2025-26/154, 28 Nov 2025, updated 1 Oct 2026 ([page](https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=13156), [PDF](https://rbidocs.rbi.org.in/rdocs/notification/PDFs/154MD.PDF)) | 13(1), 13(2), 13(4), 12(4) | The same words with "bank" for "NBFC": 13(1) "the bank shall also ensure that DLA of the bank / LSP desist from accessing mobile phone resources like file and media, contact list, call logs, telephony functions, etc."; 13(2) "...make the bank / LSP delete / forget the data."; 12(4) "...within 30 days of receipt of complaint by the bank, the said borrower can lodge a complaint over the Complaint Management System (CMS - https://cms.rbi.org.in/) portal..." |
| Small finance bank | Reserve Bank of India (Small Finance Banks – Credit Facilities) Directions, 2025, RBI/DOR/2025-26/185, 28 Nov 2025, updated 1 Oct 2026 ([page](https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=13124), [PDF](https://rbidocs.rbi.org.in/rdocs/notification/PDFs/185MD.PDF)) | 13(1), 13(2), 13(4), 12(4) | Word for word the commercial bank text above, including "make the bank / LSP delete / forget the data" and the CMS route after 30 days |
| Urban co-operative bank | Reserve Bank of India (Urban Co-operative Banks – Credit Facilities) Directions, 2025, RBI/DOR/2025-26/277, 28 Nov 2025, updated 1 Oct 2026 ([page](https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=13028), [PDF](https://rbidocs.rbi.org.in/rdocs/notification/PDFs/277MDFF00147367D64F02899A3A756CDA9093.PDF)) | 13(1), 13(2), 13(4), 12(4) | The same rules: 13(1) "a bank shall also ensure that DLA of bank/LSP desist from accessing mobile phone resources like file and media, contact list, call logs, telephony functions, etc."; 13(2) "...make the bank/LSP delete/ forget the data."; 13(4) as above; 12(4) "...within 30 days of receipt of complaint by the bank, the said borrower can lodge a complaint over the Complaint Management System (CMS - https://cms.rbi.org.in/) portal..." |
| Rural co-operative bank (state co-operative banks and district central co-operative banks) | Reserve Bank of India (Rural Co-operative Banks – Credit Facilities) Directions, 2025, RBI/DOR/2025-26/302, 28 Nov 2025, updated 1 Apr 2026 ([page](https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=13002), [PDF](https://rbidocs.rbi.org.in/rdocs/notification/PDFs/302MD9447AEE4C3A543AA970CAF17ECD0E440.PDF)) | 13(1), 13(2), 13(4), 12(4) | 13(1), 13(2) and 13(4) as for urban co-operative banks. **12(4) differs:** "...or the borrower has not received any reply within 30 days of receipt of complaint by the bank, the said borrower may lodge a complaint with NABARD or with the Customer Education and Protection Cell of RBI." There is no CMS route for these banks |
| Regional rural bank | Reserve Bank of India (Regional Rural Banks – Credit Facilities) Directions, 2025, RBI/DOR/2025-26/253, 28 Nov 2025, updated 1 Apr 2026 ([page](https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=13053), [PDF](https://rbidocs.rbi.org.in/rdocs/notification/PDFs/253MD.PDF)) | 13(1), 13(2), 13(4), 12(4) | The urban co-operative bank words (13(1) reads "DLA of the bank/LSP"), with the CMS route after 30 days. No regional rural bank is in the 17 Oct 2026 snapshot |
| Local area bank | Reserve Bank of India (Local Area Banks – Credit Facilities) Directions, 2025, RBI/DOR/2025-26/229, 28 Nov 2025, updated 1 Apr 2026 ([page](https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=13078), [PDF](https://rbidocs.rbi.org.in/rdocs/notification/PDFs/229MD.PDF)) | 13(1), 13(2), 13(4), 12(4) | As for commercial banks ("make the bank / LSP delete / forget the data"), with the CMS route after 30 days. No local area bank is in the snapshot |

Payments banks may not lend, and RBI's Master Directions index (checked 17 Oct 2026) lists no Credit Facilities Directions for them; none is in the directory. These Directions replaced the Reserve Bank of India (Digital Lending) Directions, 2025, which RBI repealed on 28 November 2025 ([RBI/2025-26/100](https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=13170)), so the letter never cites the repealed text.

**Data source and terms.** Source: RBI's directory of digital lending apps ("DLA's deployed by Regulated Entities", linked from rbi.org.in), snapshot 17 Oct 2026. Say So is not affiliated with or endorsed by RBI. RBI's website disclaimer says caching or framing its content needs permission, and we have not asked for it. So we keep to the minimum a borrower needs to find their lender (app name, lender, lender type, the app link RBI lists), never copy the grievance officers' names, emails or phone numbers, attribute RBI wherever the data appears, and link only to [RBI's home page](https://www.rbi.org.in) rather than framing its pages. If RBI asks, we take the mirror down.

The snapshot in `data/` is rebuilt by `python3 scripts/fetch-dla.py`, which reads RBI's public report and keeps only those four fields (the grievance officer columns are dropped while parsing). The data is as RBI lists it, including a few junk rows (app names `0` to `5` and `NA`). Each listing lasts 30 days. We re-sync by hand from RBI's report, and the mirror wallet renews only the apps RBI still lists, so an app RBI drops expires on its own, and nobody else can renew it (`scripts/mirror-dla.ts`, [`arkiv/schema.md`](arkiv/schema.md)).

Built for the Arkiv pre-Devcon global tour stop (Best Indian Use Case and Privacy tracks) by team Solus.

## Why Arkiv

| Built on… | What falls apart |
|---|---|
| The company's own database | The party that must prove consent (DPDP Act s.6(10)) holds the only proof and can edit it. The person has nothing of their own to show. |
| A Consent Manager's database | The Data Protection Board may "suspend or cancel the registration of such Consent Manager" (DPDP Rules, 2025, Rule 4(5)(a)), and its control can change hands with the Board's approval (First Schedule, Part B, item 13), while it must keep the record of consents "for at least seven years" (Part B, item 4(c)). The person's history goes with the operator. |
| A signed log on our own server | Signatures prove who wrote a line, but we decide what is served and what quietly disappears, and every vendor has to trust our API to learn about a withdrawal. |
| IPFS or Arweave | Consent must stop existing when its purpose ends. Permanent storage keeps it forever, and you cannot ask "which consents for this company and purpose are live right now". |
| A subgraph | Someone still runs the indexer and decides when a consent is gone. |
| **Arkiv** | The person's own address creates and owns each consent; Entity Expiration ends it with its purpose; only the person can renew it; vendors' leases are set to the same expiry block; any developer can check a live consent with one query and no key from us; and only the writer of a record can delete it. |

DPDP Rules, 2025: [G.S.R. 846(E), Gazette of India, 13 November 2025](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf).

What deliberately stays off Arkiv: all personal data and the data being processed, the link between an address and a customer account (the company's own database), seed phrases, and every key.

Two questions judges ask:

- **"A stop note is only the vendor's own word."** Yes, and that is the point. Today a vendor says nothing at all. A stop note is signed by the vendor's wallet and placed in a block nobody can backdate, so it is attributable to that vendor; silence is just as visible. Under the DPDP Act the company must make its processors stop (s.6(6)), so a missing note is a lead for an auditor or the Data Protection Board, and a false one is a signed false statement.
- **"If the person can delete their consent, who proves it existed?"** The entity can go, the history cannot. Every create, extend and delete is a transaction on chain, so the grant, the receipt and the withdrawal remain provable from their transactions after the entity is deleted or expires. What the person controls is whether the consent is *live*, which is exactly the permission the law gives them.
- **"How long do records last?"** Receipts, stop notes and Any app records are created with a 7-year lifetime, the period a Consent Manager must keep records; that is the expiry set on the entity, not a promise beyond it. No company or vendor can change a person's records; the person, as owner, can extend or delete them. This is Arkiv's Tiramisu testnet, so it shows the design rather than a production guarantee.

For the demo, one Cloudflare Worker holds the four fictional vendors' keys and runs their duty loops. In real use each vendor would run its own loop with its own key; nothing in the design depends on our Worker, which is why the vendor logic lives in `shared/robot.ts` and only reads Arkiv.

## Privacy

- **Nothing personal on chain:** only wallet addresses, purpose codes and times. Notices name the kinds of data ("Mobile number"), never the data.
- **One address per company:** derived on the person's device from one seed. Each address gets its test gas from the company it consents to, in a slightly different amount, so no shared faucet transaction ties a person's addresses together.
- **Expiry the person controls:** consents end with their purpose and only the person can renew them. Receipts can be extended only by the person, and as owner they can delete them. Only public statements can be extended by anyone: companies' notices (the terms people agreed to) and vendors' stop notes.
- **"Any app" writes nothing you type.** You pick the company from a list or a loan app from the RBI mirror (or "Another company") and a purpose; a name you type for another company only goes into your message. A loan app's record adds only a link to the mirror entity and the lender's name.
- **One fresh address per "Any app" record.** Each withdrawal record is written from its own address, derived from the same seed on a separate branch. A lender who follows the link in a letter sees that one record, not the other companies the person withdrew from. The recovery phrase still recovers all of them. (Records made before this change came from one shared "self" address and are still shown.)
- **Keys stay with you.** The 12-word recovery phrase is shown on request and can be restored in another browser, so losing a browser does not lock you out of withdrawing.
- **What is still visible, and why:**
  - Purpose codes are plaintext (that some address consented to "loan servicing" at Rupeeleaf), because vendors and the consent check must query by them. A production version would encrypt them for sensitive sectors.
  - Leases and stop notes carry `principal`, the person's address for that company (already public as the consent's owner), so the person's view finds them in one query.
  - In the demo one Cloudflare Worker holds all four fictional vendors' keys; in real use each vendor holds its own.
- **Known limits:** the page asks for all of a person's addresses in one query, so whoever serves that query (the public RPC, or our relay) could link them, as could anyone watching the browser's IP. One query per address over separate connections would close this.

## Try it in two minutes

1. Open https://sayso.tahcin.tech. The page makes a wallet in your browser; your keys never leave it. A guide points at each step and explains it; skip it any time.
2. On the **Rupeeleaf** tab (a fictional loan app), tick what you agree to and press **Agree**, or **Say no to all**. Rupeeleaf sends your address a little test gas, then one transaction writes every answer: a consent and a receipt for each yes, a receipt for each no.
3. Watch **Who is using your data**: within seconds each vendor takes a lease on your consent.
4. Open **My consents** and **Withdraw** "Loan servicing". Recoverly drops its lease and signs a stop note, usually within 10 seconds. Withdraw "SMS offers": Pingwave, the SMS vendor, never answers, and its clock keeps counting in red.
5. Open the **Cease board**: every withdrawal and each vendor's time to sign, read straight from Arkiv. Press **Keep longer** on a row to move that vendor's stop note to expire eight years from today, from your own browser, although you did not write it.
6. Open **Any app** to use it with a real company today: type a loan app's name (try "kreditbee") to search RBI's directory on Arkiv, or pick another company, choose what you are withdrawing, and press **Record my withdrawal**. You get a timestamped record on Arkiv's Tiramisu testnet, written from its own fresh address, which the company cannot change and only you can delete, and a ready letter that links to it; for a loan app it goes to the lender's grievance officer and cites RBI's rules.
7. The credit-check consent lasts 10 minutes. Leave it, and it ends on its own, and so does Ledgerlight's lease.

All companies and vendors are fictional and labelled as such.

## Check it without our app

Every fact on screen is an Arkiv entity on the Tiramisu testnet. Ask whether a person's address still consents to Rupeeleaf's SMS offers. Send it to our read-only relay first: after one run through the demo your IP has usually used Arkiv's anonymous read quota, and the public RPC then answers HTTP 429 (`ANON_COST_LIMITED`). The relay accepts read methods only and forwards the same JSON-RPC body unchanged to Tiramisu with our access key:

```bash
curl -s https://sayso.tahcin.tech/api/rpc -H 'content-type: application/json' --data @- <<'EOF'
{"jsonrpc": "2.0", "id": 1, "method": "arkiv_query", "params": [
  "app = str('sayso') AND kind = str('consent') AND fiduciary = addr(0xcc3F2990437ded5f3182335219bC30bbF64A6460) AND purpose = str('marketing') AND $owner = addr(<PERSON>) AND $creator = addr(<PERSON>)",
  {"select": {"key": true, "expiresAt": true}, "limit": "0x1"}]}
EOF
```

`<PERSON>` is the address shown next to "knows you as" in My consents. An empty `data` list means no live consent.

To skip our relay entirely, send the same body to the public RPC, `https://rpc.tiramisu.db-chain.testnet.arkiv.network`, from a network that has not used its anonymous quota.

Schema, lifetimes and every query: [`arkiv/schema.md`](arkiv/schema.md). What was hard: [`arkiv/friction.md`](arkiv/friction.md).

## Wallets that write entities

| Wallet | Role | Writes |
|---|---|---|
| `0xcc3F2990437ded5f3182335219bC30bbF64A6460` | Rupeeleaf (fictional lender) | party, notice |
| `0x08dEa599517ea7575b685Bc37807f312125B7991` | Bazaarline (fictional grocer) | party, notice |
| `0x7B6B8D2E5b82dE860048e6B9001d754b1fa89D3d` | Ledgerlight (fictional credit bureau) | party, lease, ceased |
| `0x28CF78c5975664052B830828ac51E2F85B0426c3` | Recoverly (fictional collections) | party, lease, ceased |
| `0xfe8c6C69e0c9f6aF951A68Ce0daE5cbA1E6f3bad` | Dakroute (fictional delivery) | party, lease, ceased |
| `0x90dB0Cd8619D2Ae921B51883947113Ff5614d9D9` | Pingwave (fictional SMS vendor that never stops) | party, lease |
| `0x822BB671e6Ce0F2b69A500344764D9fedE31E725` | Say So RBI mirror: publishes and renews RBI's directory of digital lending apps | dla |
| `0xf080E9D09411A66013f2b205314D6075B3cD4941` | House wallet: tops up the fictional companies and funds "Keep longer" witnesses and "Any app" records | no Say So entities, only GLM transfers (its earliest entities are our SDK spike's tests, written before the idea was picked) |
| each visitor's browser | the person: one address per company, a fresh address for each Any app record (older records came from one "self" address), and a separate witness address for Keep longer | consent, receipt, declaration; Lifetime Extensions |

Explorer: `https://tiramisu.explorer.arkiv.network/address/<wallet>`. Data explorer: `https://data.arkiv.network/owner/<wallet>`.

## How it is built

- `shared/sayso.ts`: entity types, lifetimes, attributes, queries and the `hasLiveConsent` check.
- `shared/actions.ts`: give, withdraw and renew, each one atomic `executeBatch`.
- `shared/robot.ts`: the vendors' duty loop (lease, extend, cease).
- `scripts/fetch-dla.py`: rebuilds the RBI directory snapshot in `data/` from RBI's public report, keeping only app, lender, lender type and app link.
- `scripts/mirror-dla.ts`: syncs that snapshot to Arkiv (create new apps, renew listed ones, let delisted ones expire).
- `worker/index.ts`: a Cloudflare Worker that serves the app, has each fictional company send a little test gas to a person's address at their first answer, runs the four fictional vendors' duty loops every 5 minutes (and right after a withdrawal), and relays reads for visitors whose IP has used Arkiv's anonymous read quota. It stores nothing. In real use each vendor would run its own loop with its own key; the demo runs all four in one place.
- `src/`: the React app. Reads go straight from the browser to Arkiv; live updates come over a WebSocket subscription.

## Run it yourself

Needs Node 22+.

```bash
npm install
npm run dev          # http://localhost:5173, uses the deployed Worker for /api
npm run e2e          # whole flow from a fresh wallet against Tiramisu, printed step by step
```

To run your own copy end to end, put seven fresh private keys in `.env` (`KEY_DRIP`, `KEY_RUPEELEAF`, `KEY_BAZAARLINE`, `KEY_LEDGERLIGHT`, `KEY_RECOVERLY`, `KEY_DAKROUTE`, `KEY_PINGWAVE`), fund `KEY_DRIP` from the [faucet](https://hub.arkiv.network/faucet), then:

```bash
npm run seed                       # funds the cast and publishes parties and notices
npx wrangler secret bulk keys.json # the same keys, plus optional ARKIV_KEY (an RPC access key)
npm run deploy
```

To refresh the snapshot, run `python3 scripts/fetch-dla.py` (needs `requests` and `beautifulsoup4`; it only reads RBI's public report and writes `data/rbi-dla-<date>.json`). To publish your own copy of the RBI directory, add `KEY_MIRROR` (a fresh key funded from the faucet; our last run of 189 creates cost about 0.024 test GLM), point `MIRROR` in `shared/cast.ts` at its address, and run `npx tsx --env-file=.env scripts/mirror-dla.ts` (add `DRY=1` to see what it would do). Run it again at least weekly: it renews apps with under 25 days left and lets delisted ones lapse.

## Built during the challenge

Built 9–18 October 2026; the repo's commits start on 17 October. No pre-existing code. AI assistance: Claude (Anthropic) was used for research, code and writing.

## Licence

MIT
