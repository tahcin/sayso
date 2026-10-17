import { useCallback, useEffect, useRef, useState } from "react"
import { FIDUCIARIES, PROCESSORS, PURPOSE_LABEL } from "../../shared/cast"
import { EXPLORER, getBoard, pub, type Ceased, type Lease, type Receipt } from "../../shared/sayso"
import { preserve } from "../../shared/actions"
import { read } from "../data"
import { accountFor, ensureGas, walletFor } from "../wallet"
import { fmtDuration, short, useBlockClock, useEntityEvents } from "../live"

const WEEK = 7 * 24 * 3600 * 1000
// Entities from before the final schema (17 Oct 2026, 13:30 IST) lack fields this board reads.
const LAUNCH = Date.UTC(2026, 9, 17, 8, 0)

type Row = { r: Receipt; ceased?: Ceased; lease?: Lease }

export default function Board() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const clock = useBlockClock()
  const busy = useRef(false)

  const load = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    try {
      const timing = await read(() => pub.getBlockTiming())
      const blocksBack = (ms: number) => BigInt(Math.floor(ms / (timing.blockDuration * 1000)))
      const since = timing.currentBlock - blocksBack(Date.now() - Math.max(LAUNCH, Date.now() - WEEK))
      const vendors = PROCESSORS.map((p) => p.address)
      const snap = await read(() => getBoard(since, vendors))
      const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
      // A withdrawal is on the board only if the named vendor's own wallet proves it held this
      // person's consent: a lease or a stop note about that consent and that person. Receipts from
      // strangers, or naming vendors that never touched the consent, cannot move a vendor's score.
      // Close the obvious ways to game the board with real receipts: a "withdrawal" whose consent is
      // still live, a second receipt for the same consent, and a receipt written after the stop note.
      const live = new Set(snap.consents.map((c) => c.key.toLowerCase()))
      const first = new Map<string, Receipt>()
      for (const r of [...snap.receipts].sort((a, b) => Number(a.createdAt - b.createdAt))) {
        const k = r.consent.toLowerCase()
        if (!live.has(k) && !first.has(k)) first.set(k, r)
      }
      setRows(
        [...first.values()]
          .map((r) => ({
            r,
            ceased: snap.ceased.find((c) => same(c.consent, r.consent) && same(c.creator, r.processor) && same(c.principal, r.creator)),
            lease: snap.leases.find((l) => same(l.consent, r.consent) && same(l.creator, r.processor) && same(l.principal, r.creator)),
          }))
          .filter((x) => (x.ceased && x.ceased.createdAt >= x.r.createdAt) || (!x.ceased && x.lease))
          .sort((a, b) => Number(b.r.createdAt - a.r.createdAt)),
      )
    } catch (e) {
      setError((e as Error).message.split("\n")[0])
    } finally {
      busy.current = false
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [load])

  const timer = useRef<number | undefined>(undefined)
  useEntityEvents((e) => {
    const owner = "owner" in e ? e.owner : ""
    if (PROCESSORS.some((p) => p.address.toLowerCase() === owner.toLowerCase())) {
      clearTimeout(timer.current)
      timer.current = window.setTimeout(load, 2000)
    }
  })

  const [keeping, setKeeping] = useState<string | null>(null)
  // Anyone may extend a receipt and its stop note (permissionless Lifetime Extension); only the
  // writer could delete them. The extension is signed by a separate "witness" address in this browser.
  async function keep(x: Row) {
    setKeeping(x.r.key)
    setError(null)
    try {
      await ensureGas(accountFor("witness").address, "witness")
      await preserve(walletFor("witness"), [x.ceased!.key])
      await load()
    } catch (e) {
      setError((e as Error).message.split("\n")[0])
    } finally {
      setKeeping(null)
    }
  }
  const name = (a: string) => [...FIDUCIARIES, ...PROCESSORS].find((p) => p.address.toLowerCase() === a.toLowerCase())?.name ?? short(a)
  const blockMs = clock?.blockMs ?? 2000
  const stopSec = (x: Row) => (x.ceased ? (Number(x.ceased.createdAt - x.r.createdAt) * blockMs) / 1000 : null)

  return (
    <main className="board">
      <section className="hero slim">
        <h1>Cease board</h1>
        <p className="lede">
          Every withdrawal in the last 7 days, and how long each vendor took to stop. Nobody runs this list: it is read straight from Arkiv, so
          a vendor cannot remove its own slow answer.
        </p>
      </section>

      {error ? <p className="err">{error}</p> : null}

      <div className="scores">
        {PROCESSORS.map((p) => {
          const addr = p.address.toLowerCase()
          const mine = (rows ?? []).filter((x) => x.r.processor.toLowerCase() === addr)
          const stopped = mine.map(stopSec).filter((s): s is number => s !== null).sort((a, b) => a - b)
          const silent = mine.filter((x) => !x.ceased).length
          const median = stopped.length ? stopped[Math.floor(stopped.length / 2)] : null
          return (
            <div key={p.slug} className={`score ${silent && !stopped.length ? "bad" : ""}`}>
              <strong>{p.name}</strong>
              <span className="muted small">{p.blurb}</span>
              <div className="score-num">{median !== null ? fmtDuration(median) : silent ? "No answer" : "No withdrawals yet"}</div>
              <div className="small">
                {median !== null ? "typical time to stop · " : ""}
                {mine.length} withdrawal{mine.length === 1 ? "" : "s"}, {silent} unanswered
              </div>
            </div>
          )
        })}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Withdrawn</th>
              <th>Company</th>
              <th>Purpose</th>
              <th>Vendor</th>
              <th>Result</th>
              <th>Stop note kept until</th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <tr>
                <td colSpan={6} className="muted">
                  Reading Arkiv…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  No withdrawals in the last 7 days. Try one on the home page.
                </td>
              </tr>
            ) : (
              rows.map((x) => {
                const s = stopSec(x)
                const waiting = clock ? (Number(clock.block - x.r.createdAt) * blockMs) / 1000 : 0
                return (
                  <tr key={x.r.key}>
                    <td>
                      <a href={`${EXPLORER}/block/${x.r.createdAt}`} target="_blank" rel="noreferrer">
                        {clock
                          ? new Date(Date.now() - Number(clock.block - x.r.createdAt) * blockMs).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
                          : `block ${x.r.createdAt}`}
                      </a>
                    </td>
                    <td>{name(x.r.fiduciary)}</td>
                    <td>{PURPOSE_LABEL[x.r.purpose] ?? x.r.purpose}</td>
                    <td>{name(x.r.processor)}</td>
                    <td>
                      {s !== null ? (
                        <span className="ok">Signed a stop note after {fmtDuration(s)}</span>
                      ) : x.lease ? (
                        <span className="bad">Still holding a lease, {fmtDuration(waiting)} later</span>
                      ) : (
                        <span className="muted">No answer, no lease</span>
                      )}
                    </td>
                    <td>
                      {x.ceased && clock ? (
                        <>
                          {new Date(Date.now() + Number(x.ceased.expiresAt - clock.block) * blockMs).toLocaleDateString("en-IN", { dateStyle: "medium" })}{" "}
                          <button className="link small" disabled={!!keeping} onClick={() => keep(x)}>
                            {keeping === x.r.key ? "Extending…" : "Keep longer"}
                          </button>
                        </>
                      ) : (
                        <span className="muted">no stop note to keep</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="fine">
        Stop times are counted in Arkiv blocks, from the block that holds the withdrawal receipt to the block that holds the vendor's signed
        stop note, so neither side can backdate them. "Keep longer" moves a stop note's expiry to eight years from today: anyone may extend a
        vendor's stop note, and only the vendor that wrote it could delete it.
      </p>
    </main>
  )
}
