// Privacy audit of everything Say So has on Arkiv: reads every live `app = "sayso"` entity (attributes and
// payloads) and checks that none carries an Indian phone number, an email, an Aadhaar number or a PAN, and
// that each kind uses only the attributes listed in arkiv/schema.md. Anyone can run it; it only reads.
// Run: npm run audit   (uses ARKIV_KEY from .env when present, otherwise the public RPC)
import { and, eq } from "@arkiv-network/sdk/query"
import { pub, RPC, useRpc } from "../shared/sayso"

if (process.env.ARKIV_KEY) useRpc(`${RPC}/${process.env.ARKIV_KEY}`)

// Public attribute names per kind (arkiv/schema.md). Anything else is reported.
const ALLOWED: Record<string, string[]> = {
  party: ["app", "kind", "role", "slug", "name"],
  notice: ["app", "kind", "purpose", "period_s", "processor", "version"],
  // ends_ms: one consent from before the final schema (17 Oct 2026) still carries it until it expires.
  consent: ["app", "kind", "fiduciary", "purpose", "notice", "processor", "granted_ms", "ends_ms"],
  receipt: ["app", "kind", "action", "consent", "notice", "fiduciary", "purpose", "processor", "at_ms", "granted_ms"],
  lease: ["app", "kind", "consent", "fiduciary", "purpose", "principal"],
  ceased: ["app", "kind", "consent", "receipt", "processor", "fiduciary", "purpose", "principal", "withdrawn_block", "at_ms"],
  // Records before 18 Oct 2026 were public; newer ones carry only app and kind, with the rest sealed.
  declaration: ["app", "kind", "action", "company", "purpose", "at_ms", "dla", "lender"],
  dla: ["app", "kind", "source", "app_name", "app_lc", "lender", "lender_lc", "lender_type", "snapshot"],
}

const PII: [string, RegExp][] = [
  ["phone", /(?<![\dA-Za-z])(?:\+?91[\s-]?)?[6-9]\d{9}(?![\dA-Za-z])/],
  // The fictional companies' contacts use the reserved .example domain (RFC 2606), so they are not anyone's address.
  ["email", /[A-Za-z0-9._%+-]+@(?![A-Za-z0-9.-]+\.example\b)[A-Za-z0-9.-]+\.[A-Za-z]{2,}/],
  ["aadhaar", /(?<![\dA-Za-z])[2-9]\d{3}\s?\d{4}\s?\d{4}(?![\dA-Za-z])/],
  ["pan", /(?<![A-Za-z0-9])[A-Z]{5}\d{4}[A-Z](?![A-Za-z0-9])/],
]
// Addresses, keys and ciphertext are long hex or base64 strings; they are not personal data, so skip them.
const strip = (t: string) => t.replace(/0x[0-9a-fA-F]{8,}/g, " ").replace(/"(iv|ct)":"[^"]*"/g, " ")

type E = { key: string; attributes?: Record<string, { value: unknown }>; payload?: Uint8Array; toText?: () => string }
const rows: E[] = []
let cursor: string | undefined
let atBlock: bigint | undefined
// Never print an error as is: with an access key, the RPC URL in it carries the key.
const redact = (e: unknown) => String((e as Error).message).split("\n")[0].replace(/ark_[A-Za-z0-9_]+/g, "<key>")
const fetchPage = async () => {
  for (let tries = 1; ; tries++) {
    try {
      return await pub.query(and(eq("app", "sayso")), { select: { key: true, attributes: true, payload: true }, limit: 100, cursor, atBlock })
    } catch (e) {
      if (tries === 4) throw new Error(redact(e))
      console.log(`page read failed (${redact(e)}), retrying`)
    }
  }
}
do {
  const page = await fetchPage()
  rows.push(...(page.entities as unknown as E[]))
  cursor = page.cursor
  atBlock = page.blockNumber
} while (cursor)

const byKind = new Map<string, number>()
const findings: string[] = []
let sealed = 0
for (const e of rows) {
  const attrs = Object.fromEntries(Object.entries(e.attributes ?? {}).map(([k, v]) => [k, String(v.value)]))
  const kind = attrs.kind ?? "?"
  byKind.set(kind, (byKind.get(kind) ?? 0) + 1)
  for (const k of Object.keys(attrs)) if (!(ALLOWED[kind] ?? []).includes(k)) findings.push(`${kind} ${e.key}: unexpected attribute "${k}"`)
  const payload = e.payload?.length ? new TextDecoder().decode(e.payload) : ""
  if (kind === "declaration" && payload.includes('"ct"')) sealed++
  const text = strip(Object.values(attrs).join(" | ") + " | " + payload)
  for (const [name, re] of PII) {
    const m = text.match(re)
    if (m) findings.push(`${kind} ${e.key}: looks like ${name}: "${m[0]}"`)
  }
}

console.log(`Say So privacy audit, ${new Date().toISOString().slice(0, 10)}, block ${atBlock}`)
console.log(`${rows.length} live entities:`, [...byKind].map(([k, n]) => `${k} ${n}`).join(", "))
console.log(`Any app records sealed: ${sealed} of ${byKind.get("declaration") ?? 0}`)
console.log(findings.length ? `${findings.length} findings:\n` + findings.join("\n") : "0 findings: no phone, email, Aadhaar or PAN, and no attribute outside the schema.")
