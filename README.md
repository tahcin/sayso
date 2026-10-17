# Say So

**Your data moves only while you say so.**

Live: https://sayso.tahcin.tech

India's Digital Personal Data Protection Act, 2023 makes consent the main legal basis for processing personal data. Today the company that asks for your consent also keeps the only record of it, and so do the vendors it passes your data to. When you withdraw, nobody outside can tell whether the lender, its credit bureau and its SMS vendor actually stopped.

- 52 of 53 popular Indian apps used deceptive design patterns, and every e-commerce app made deleting your account hard ([ASCI and Parallel HQ, July 2024](https://www.ascionline.in/wp-content/uploads/2024/07/Press-Release.-Conscious-Patterns-25.07.24.docx.pdf)).
- 95% of people surveyed got unwanted commercial calls every day, including 96% of those on the Do Not Disturb list ([LocalCircles via Business Today, Sept 2024](https://www.businesstoday.in/amp/technology/news/story/95-indians-continue-to-get-unwanted-calls-daily-despite-regulatory-interventions-survey-443922-2024-09-02)).
- Consent Managers, the new regulated role that will hold people's consents, can register from **13 November 2026**; the notice, consent and erasure duties of the DPDP Rules, 2025 apply from **13 May 2027**.

Say So keeps consent on [Arkiv](https://arkiv.network), the Web3 database:

- **You own the consent.** Your browser writes it from an address only you control, a different one for each company. It expires when its purpose ends. Only you can renew it. Withdrawing deletes it. Saying no is recorded too.
- **Vendors hold a lease set to end with your consent.** Before any job they check for a live consent. When you withdraw, they must drop the lease and sign a stop note.
- **Stopping is public.** How long each vendor took to sign is on the cease board for anyone to check, and so is the vendor that never answers.

No personal data goes to Arkiv: only wallet addresses, purpose codes and times.

Built for the Arkiv pre-Devcon global tour stop (Best Indian Use Case and Privacy tracks) by team Solus.

## Why Arkiv

- **The company or its Consent Manager cannot be the only witness.** The Act puts the burden of proving consent on the company (s.6(10)). A database the company runs proves it only to itself. The Rules let the Data Protection Board suspend or cancel a Consent Manager (Rule 4(5)), while consent records must be kept for seven years. On Arkiv the person's consent and receipts are entities their own address created; they outlive any one operator, and nobody else can edit or delete them.
- **Consent has to stop existing on time.** A consent ends when its purpose does, and a withdrawal must be as easy as giving it (s.6(4)). Arkiv's Entity Expiration makes the end a property of the record, not a cron job we might forget; IPFS or Arweave would keep it forever.
- **Vendors must not depend on our server.** Every vendor and any developer reads the same entities straight from the Arkiv RPC (see the curl below) and checks `$creator`. A subgraph or our own API would make us the party everyone has to trust.
- **What stays off Arkiv:** personal data, the data being processed, the link between an address and a customer account, seed phrases and all keys.

## Try it in two minutes

1. Open https://sayso.tahcin.tech. The page makes a wallet in your browser; your keys never leave it.
2. On the **Rupeeleaf** tab (a fictional loan app), tick what you agree to and press **Agree**, or **Say no to all**. Rupeeleaf sends your address a little test gas, then one transaction writes every answer: a consent and a receipt for each yes, a receipt for each no.
3. Watch **Who is using your data**: within seconds each vendor takes a lease on your consent.
4. Open **My consents** and **Withdraw** "Loan servicing". Recoverly drops its lease and signs a stop note, usually within 10 seconds. Withdraw "SMS offers": Pingwave, the SMS vendor, never answers, and its clock keeps counting in red.
5. Open the **Cease board**: every withdrawal and each vendor's time to sign, read straight from Arkiv. Press **Keep longer** on any row to extend that public record by eight years from your own browser, although you did not write it.
6. The credit-check consent lasts 10 minutes. Leave it, and it ends on its own, and so does Ledgerlight's lease.

All companies and vendors are fictional and labelled as such.

## Check it without our app

Every fact on screen is an Arkiv entity on the Tiramisu testnet. Ask the RPC directly whether a person's address still consents to Rupeeleaf's SMS offers:

```bash
curl -s https://rpc.tiramisu.db-chain.testnet.arkiv.network -H 'content-type: application/json' --data @- <<'EOF'
{"jsonrpc": "2.0", "id": 1, "method": "arkiv_query", "params": [
  "app = str('sayso') AND kind = str('consent') AND fiduciary = addr(0xcc3F2990437ded5f3182335219bC30bbF64A6460) AND purpose = str('marketing') AND $owner = addr(<PERSON>) AND $creator = addr(<PERSON>)",
  {"select": {"key": true, "expiresAt": true}, "limit": "0x1"}]}
EOF
```

`<PERSON>` is the address shown next to "knows you as" in My consents. An empty `data` list means no live consent. If your network has used Arkiv's anonymous read quota (HTTP 429), send the same body to `https://sayso.tahcin.tech/api/rpc`, our read-only relay.

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
| `0xf080E9D09411A66013f2b205314D6075B3cD4941` | House wallet: tops up the fictional companies and funds "Keep longer" witnesses | no entities, only GLM transfers |
| each visitor's browser | the person, one address per company; a separate witness address for Keep longer | consent, receipt; Lifetime Extensions |

Explorer: `https://tiramisu.explorer.arkiv.network/address/<wallet>`. Data explorer: `https://data.arkiv.network/owner/<wallet>`.

## How it is built

- `shared/sayso.ts`: entity types, lifetimes, attributes, queries and the `hasLiveConsent` check.
- `shared/actions.ts`: give, withdraw and renew, each one atomic `executeBatch`.
- `shared/robot.ts`: the vendors' duty loop (lease, extend, cease).
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

## Built during the challenge

Everything here was written between 9 and 18 October 2026. No pre-existing code. AI assistance: Claude (Anthropic) was used for research, code and writing.

## Licence

MIT
