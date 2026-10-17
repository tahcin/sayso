import { Check, Copy } from "lucide-react"
import { useState } from "react"
import { FIDUCIARIES, MIRROR, PROCESSORS } from "../../shared/cast"
import { DATA_EXPLORER, EXPLORER } from "../../shared/sayso"
import { accountFor } from "../wallet"

const REPO = "https://github.com/tahcin/sayso"
const HOUSE = "0xf080E9D09411A66013f2b205314D6075B3cD4941"
const RELAY = "https://sayso.tahcin.tech/api/rpc"
const PUBLIC_RPC = "https://rpc.tiramisu.db-chain.testnet.arkiv.network"

const GATE = `import { createPublicClient } from "@arkiv-network/sdk"
import { addr } from "@arkiv-network/sdk/attr"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { and, eq } from "@arkiv-network/sdk/query"
import { http } from "viem"

// retryCount 0: on Arkiv's anonymous read quota (HTTP 429) fail at once instead of retrying for minutes.
// Behind a busy network, point the transport at an endpoint with an access key, or at our read relay.
const arkiv = createPublicClient({ chain: tiramisu, transport: http(undefined, { retryCount: 0 }) })

// Call before any job touches a customer's data. True only if the customer's own
// address created this consent, still owns it, and it has not expired or been withdrawn.
export async function hasLiveConsent(customer, company, purpose) {
  const page = await arkiv
    .select({ key: true })
    .where(and(eq("app", "sayso"), eq("kind", "consent"),
               eq("fiduciary", addr(company)), eq("purpose", purpose)))
    .ownedBy(customer)
    .createdBy(customer)
    .limit(1)
    .fetch()
  return page.entities.length > 0
}`

const curl = (url: string, company: string, customer: string) => `curl -s ${url} \\
  -H 'content-type: application/json' --data @- <<'EOF'
{"jsonrpc": "2.0", "id": 1, "method": "arkiv_query", "params": [
  "app = str('sayso') AND kind = str('consent') AND fiduciary = addr(${company}) AND purpose = str('marketing') AND $owner = addr(${customer}) AND $creator = addr(${customer})",
  {"select": {"key": true, "expiresAt": true}, "limit": "0x1"}]}
EOF`

/** A full address (or any text) with a button that copies it. */
function Copyable({ text, label }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <span className="copyable">
      <code className="mono">{text}</code>
      <button
        className="icon-btn copy-btn"
        aria-label={`Copy ${label ?? "address"}`}
        title="Copy"
        onClick={() =>
          navigator.clipboard
            ?.writeText(text)
            .then(() => {
              setDone(true)
              setTimeout(() => setDone(false), 1500)
            })
            .catch(() => undefined)
        }
      >
        {done ? <Check size={15} /> : <Copy size={15} />}
      </button>
    </span>
  )
}

// Same rows, in the same order, as the wallet table in README.md.
const WALLETS: { name: string; address: string; role: string; writes: string }[] = [
  ...FIDUCIARIES.map((f) => ({
    name: f.name,
    address: f.address,
    role: `Company (fictional): ${f.blurb}`,
    writes: "party, notice",
  })),
  ...PROCESSORS.map((p) => ({
    name: p.name,
    address: p.address,
    role: p.slug === "pingwave" ? `Vendor (fictional): ${p.blurb}, scripted never to stop` : `Vendor (fictional): ${p.blurb}`,
    writes: p.slug === "pingwave" ? "party, lease (never a stop note)" : "party, lease, ceased",
  })),
  {
    name: MIRROR.name,
    address: MIRROR.address,
    role: "Publishes RBI's directory of digital lending apps and renews each app every 30 days while RBI lists it",
    writes: "dla",
  },
  {
    name: "Say So house wallet",
    address: HOUSE,
    role: 'Tops up the fictional companies and funds "Keep longer" witnesses and "Any app" records',
    writes: "no entities, only GLM transfers",
  },
]

export default function Dev() {
  const rupeeleaf = FIDUCIARIES.find((f) => f.slug === "rupeeleaf")!.address
  // This browser's own Rupeeleaf address, so the curl below asks about a real person (you).
  const [me] = useState(() => accountFor("rupeeleaf").address)

  return (
    <main className="dev">
      <section className="hero slim">
        <h1>For developers</h1>
        <p className="lede">
          From 13 May 2027 every company processing personal data in India needs consent it can prove and withdrawal it can act on. Say So's
          consent check works today, needs no account or API key, and reads the same Arkiv entities the person controls.
        </p>
      </section>

      <h2>The consent check</h2>
      <p>Run it before each job, not once at sign-up. A withdrawn or expired consent is simply not there, so there is no revocation list to sync.</p>
      <pre>
        <code>{GATE}</code>
      </pre>

      <h2>The same question with curl</h2>
      <p>
        No SDK and no key. Start with our read-only relay, which forwards Arkiv read methods only: one run of the demo can use up a network's
        anonymous Arkiv read quota, after which the public RPC answers HTTP 429 <code>ANON_COST_LIMITED</code>. An empty <code>data</code> list
        means no live consent.
      </p>
      <p>
        The customer below is your own Rupeeleaf address in this browser (My consents shows it shortened, next to "knows you as"). Tick
        "Send you offers by SMS" for Rupeeleaf on the home page and the query returns that consent; withdraw it and the query returns nothing.
      </p>
      <p className="addr-line">
        <span className="muted small">Your Rupeeleaf address</span> <Copyable text={me} label="your Rupeeleaf address" />
      </p>
      <pre className="wrap">
        <code>{curl(RELAY, rupeeleaf, me)}</code>
      </pre>
      <p>
        On a network with quota left, the same body works against Arkiv's public RPC: replace the URL with <code>{PUBLIC_RPC}</code>.
      </p>

      <h2>React to a withdrawal the moment it happens</h2>
      <pre>
        <code>{`import { webSocket } from "viem"
const live = createPublicClient({ chain: tiramisu, transport: webSocket() })
// No fromBlock: over a WebSocket this is a real subscription, not polling.
live.watchEntityEvents({
  onEntityDeleted: (e) => { if (myConsentKeys.has(e.entityKey)) stopJobsFor(e.entityKey) },
})`}</code>
      </pre>

      <h2>Who writes what</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Wallet</th>
              <th>Role</th>
              <th>Writes</th>
            </tr>
          </thead>
          <tbody>
            {WALLETS.map((w) => (
              <tr key={w.address}>
                <td data-label="Wallet">
                  <a href={`${EXPLORER}/address/${w.address}`} target="_blank" rel="noreferrer">
                    {w.name}
                  </a>
                  <Copyable text={w.address} label={`${w.name} address`} />
                </td>
                <td data-label="Role">{w.role}</td>
                <td data-label="Writes">{w.writes}</td>
              </tr>
            ))}
            <tr>
              <td data-label="Wallet">Each visitor's browser</td>
              <td data-label="Role">
                The person: one address per company and a "self" address for Any app, plus a separate witness address for Keep longer
              </td>
              <td data-label="Writes">consent, receipt, declaration; Lifetime Extensions</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Every entity type, attribute, lifetime and query is written up in{" "}
        <a href={`${REPO}/blob/main/arkiv/schema.md`} target="_blank" rel="noreferrer">
          arkiv/schema.md
        </a>
        . Browse all of them on the{" "}
        <a href={`${DATA_EXPLORER}/owner/${rupeeleaf}`} target="_blank" rel="noreferrer">
          Arkiv data explorer
        </a>
        .
      </p>
    </main>
  )
}
