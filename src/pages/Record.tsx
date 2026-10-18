import { useEffect, useState } from "react"
import type { Hex } from "viem"
import { DATA_EXPLORER, EXPLORER, getDeclaration, type Declaration, type DeclarationBody } from "../../shared/sayso"
import { keyFromFragment, open } from "../../shared/seal"
import { read } from "../data"
import { STRINGS } from "../i18n"
import { short, useBlockClock } from "../live"

// The page a withdrawal letter links to. The record on Arkiv is sealed; the key travels after "#" in the
// link, which browsers never send to a server, so only whoever got the letter can open it, here, in their browser.
type State = { kind: "loading" } | { kind: "missing" } | { kind: "nokey"; d: Declaration } | { kind: "open"; d: Declaration; b: DeclarationBody } | { kind: "error"; msg: string }

export default function Record() {
  const key = location.pathname.split("/")[2] as Hex
  const frag = new URLSearchParams(location.hash.slice(1)).get("k")
  const [st, setSt] = useState<State>({ kind: "loading" })
  const clock = useBlockClock()

  useEffect(() => {
    if (!/^0x[0-9a-fA-F]{64}$/.test(key ?? "")) return setSt({ kind: "missing" })
    read(() => getDeclaration(key))
      .then(async (d) => {
        if (!d) return setSt({ kind: "missing" })
        if (!d.sealed) return setSt({ kind: "open", d, b: { company: d.company, purpose: d.purpose, lender: d.lender, dla: d.dla, at_ms: d.atMs } })
        if (!frag) return setSt({ kind: "nokey", d })
        try {
          setSt({ kind: "open", d, b: await open<DeclarationBody>(d.sealed, keyFromFragment(frag)) })
        } catch {
          setSt({ kind: "error", msg: "This link's key does not open this record. Check that the whole link was copied, including the part after #." })
        }
      })
      .catch((e) => setSt({ kind: "error", msg: (e as Error).message.split("\n")[0] }))
  }, [key, frag])

  // The time comes from the block, which nobody (the writer included) can choose.
  const at = "d" in st ? (clock ? Date.now() - Number(clock.block - st.d.createdAt) * clock.blockMs : st.kind === "open" ? st.b.at_ms : null) : null
  const until =
    "d" in st && clock
      ? new Date(Date.now() + Number(st.d.expiresAt - clock.block) * clock.blockMs).toLocaleDateString("en-IN", { dateStyle: "long" })
      : null

  return (
    <main className="board record-page">
      <section className="hero slim">
        <h1>Withdrawal record</h1>
        <p className="lede">
          A person recorded on Arkiv that they withdrew their consent. The record is readonly: nobody can change it, and only its owner can
          delete it. Its content is encrypted on Arkiv
          {st.kind === "open" && st.d.sealed ? " and was opened here, in your browser, with the key in your link." : ". The key travels in the letter's link, after #."}
        </p>
      </section>
      {st.kind === "loading" ? <p className="muted">Reading the record from Arkiv…</p> : null}
      {st.kind === "missing" ? <p className="err">No Say So record with this key. Its owner may have deleted it, or it has expired.</p> : null}
      {st.kind === "error" ? <p className="err">{st.msg}</p> : null}
      {st.kind === "nokey" ? (
        <p className="err">This record is encrypted. Open the full link from the letter, including the part after #, to read it.</p>
      ) : null}
      {"d" in st ? (
        <table className="record-table">
          <tbody>
            {st.kind === "open" ? (
              <>
                <tr>
                  <th>Company or app</th>
                  <td>{st.b.company}</td>
                </tr>
                {st.b.lender ? (
                  <tr>
                    <th>Lender</th>
                    <td>
                      {st.b.lender} <span className="muted">(as listed in RBI's directory of digital lending apps)</span>
                    </td>
                  </tr>
                ) : null}
                <tr>
                  <th>Withdrawn</th>
                  <td>{STRINGS.en.anyPurpose[st.b.purpose] ?? st.b.purpose}</td>
                </tr>
              </>
            ) : null}
            <tr>
              <th>Recorded</th>
              <td>
                {at ? `${new Date(at).toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Kolkata" })} IST, ` : null}
                Arkiv block {String(st.d.createdAt)}
              </td>
            </tr>
            <tr>
              <th>Written by</th>
              <td>
                <a href={`${EXPLORER}/address/${st.d.creator}`} target="_blank" rel="noreferrer">
                  {short(st.d.creator)}
                </a>{" "}
                <span className="muted">(an address made for this record only)</span>
              </td>
            </tr>
            {until ? (
              <tr>
                <th>Kept until</th>
                <td>{until}</td>
              </tr>
            ) : null}
            <tr>
              <th>On Arkiv</th>
              <td>
                <a href={`${DATA_EXPLORER}/entity/${st.d.key}`} target="_blank" rel="noreferrer">
                  The raw entity
                </a>{" "}
                <span className="muted">{st.d.sealed ? "(public view: only that a record exists, and when)" : null}</span>
              </td>
            </tr>
          </tbody>
        </table>
      ) : null}
    </main>
  )
}
