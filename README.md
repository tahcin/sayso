# Say So

**Your data moves only while you say so.**

Live: https://sayso.tahcin.tech

India's Digital Personal Data Protection Act makes consent the legal basis for processing personal data. Today the company that collects your consent also keeps the only record of it, and so do the vendors it passes your data to. When you withdraw, nobody can tell whether the lender, its credit bureau and its SMS vendor actually stopped.

Say So keeps consent on [Arkiv](https://arkiv.network), the Web3 database:

- **You own the consent.** Your browser writes it from an address only you control, a different one for each company. It expires when its purpose ends. Only you can renew it. Withdrawing deletes it.
- **Vendors hold a lease that can never outlive your consent.** Before any job they check for a live consent. If it is gone, they stop.
- **Stopping is public.** When you withdraw, each vendor posts a signed stop note. The time it took is on the cease board for anyone to check, and so is the vendor that never answers.

No personal data goes to Arkiv: only wallet addresses, purpose codes and times.

Built for the Arkiv pre-Devcon global tour stop (Best Indian Use Case and Privacy tracks) by team Solus.

## Try it in two minutes

1. Open https://sayso.tahcin.tech. The page makes a wallet in your browser and gets it a little test gas.
2. On the **Rupeeleaf** tab (a fictional loan app), tick what you agree to and press **Agree**. One transaction writes your consents and their receipts together.
3. Watch **Who is using your data**: within about a minute each vendor takes a lease on your consent.
4. Open **My consents** and **Withdraw** "SMS offers". Ledgerlight and Recoverly would stop and sign for it; Pingwave, the SMS vendor, never does, and its clock keeps counting in red. Withdraw "Loan servicing" to see an honest vendor's stop time.
5. Open the **Cease board** to see every withdrawal and every vendor's stop time, read straight from Arkiv.
6. The credit-check consent lasts 10 minutes. Leave it, and it ends on its own, taking Ledgerlight's lease with it.

All companies and vendors are fictional and labelled as such.

## Check it without our app

Every fact on screen is an Arkiv entity on the Tiramisu testnet. Ask the RPC directly whether a person's address still consents to Rupeeleaf's SMS offers:

```bash
curl -s https://rpc.tiramisu.db-chain.testnet.arkiv.network -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"arkiv_query","params":["app = str('"'"'sayso'"'"') AND kind = str('"'"'consent'"'"') AND fiduciary = addr(0xcc3F2990437ded5f3182335219bC30bbF64A6460) AND purpose = str('"'"'marketing'"'"') AND $owner = addr(<PERSON>) AND $creator = addr(<PERSON>)",{"select":{"key":true,"expiresAt":true},"limit":"0x1"}]}'
```

`<PERSON>` is the address shown next to "knows you as" in My consents. An empty `data` array means no live consent.

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
| `0xf080E9D09411A66013f2b205314D6075B3cD4941` | Test-gas drip for visitors' browser wallets | no entities, only GLM transfers |
| each visitor's browser | the person, one address per company | consent, receipt |

Explorer: `https://tiramisu.explorer.arkiv.network/address/<wallet>`. Data explorer: `https://data.arkiv.network/owner/<wallet>`.

## How it is built

- `shared/sayso.ts`: entity types, lifetimes, attributes, queries and the `hasLiveConsent` check.
- `shared/actions.ts`: give, withdraw and renew, each one atomic `executeBatch`.
- `shared/robot.ts`: the vendors' duty loop (lease, extend, cease).
- `worker/index.ts`: a Cloudflare Worker that serves the app, sends test gas to new browser wallets, runs the vendors every minute, and relays reads for visitors whose IP has used Arkiv's anonymous read quota. It stores nothing.
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
