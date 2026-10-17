# Friction log (raw, while building; becomes arkiv/friction.md)

- 2026-10-17 11:40 IST. `predictEntityKeys` lives on the public client, not the wallet client, although it exists to build a wallet's batch. TS2339 "Property 'predictEntityKeys' does not exist" on the wallet client. SDK 0.8.1.
- 2026-10-17 11:20 IST. Node 25 ExperimentalWarning "localStorage is not available because --localstorage-file was not provided" on every script run (also seen in spike).
- 2026-10-17 11:30 IST. SDK 0.8.1 runs unchanged in a Cloudflare Worker (nodejs_compat), including executeBatch and sendTransaction. Worked first time (tested path).
