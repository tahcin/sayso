import { useEffect, useState } from "react"
import { getDirectory, type Party } from "../../shared/sayso"
import { read } from "../data"
import { DATA_EXPLORER, EXPLORER } from "../../shared/sayso"

const REPO = "https://github.com/tahcin/sayso"

const GATE = `import { createPublicClient } from "@arkiv-network/sdk"
import { addr } from "@arkiv-network/sdk/attr"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { and, eq } from "@arkiv-network/sdk/query"
import { http } from "viem"

const arkiv = createPublicClient({ chain: tiramisu, transport: http() })

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

const curl = (company: string, customer: string) => `curl -s https://rpc.tiramisu.db-chain.testnet.arkiv.network \\
  -H 'content-type: application/json' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"arkiv_query","params":[
    "app = str('"'"'sayso'"'"') AND kind = str('"'"'consent'"'"') AND fiduciary = addr(${company}) AND purpose = str('"'"'marketing'"'"') AND $owner = addr(${customer}) AND $creator = addr(${customer})",
    {"select":{"key":true,"expiresAt":true},"limit":"0x1"}]}'`

export default function Dev() {
  const [parties, setParties] = useState<Party[]>([])
  useEffect(() => {
    read(getDirectory).then((d) => setParties(d.parties)).catch(() => undefined)
  }, [])
  const rupeeleaf = parties.find((p) => p.slug === "rupeeleaf")?.address ?? "0xcc3F2990437ded5f3182335219bC30bbF64A6460"

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
      <p>No SDK, no server of ours. Swap in any customer address from the home page.</p>
      <pre>
        <code>{curl(rupeeleaf, "0xCUSTOMER_ADDRESS")}</code>
      </pre>

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
            {parties.map((p) => (
              <tr key={p.key}>
                <td>
                  <a href={`${EXPLORER}/address/${p.address}`} target="_blank" rel="noreferrer">
                    {p.name}
                  </a>{" "}
                  <span className="muted small mono">{p.address}</span>
                </td>
                <td>{p.role === "fiduciary" ? `Company (fictional): ${p.blurb}` : `Vendor (fictional): ${p.blurb}`}</td>
                <td>{p.role === "fiduciary" ? "party, notice" : "party, lease, ceased"}</td>
              </tr>
            ))}
            <tr>
              <td>Each visitor's browser</td>
              <td>The person, one address per company</td>
              <td>consent, receipt</td>
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
