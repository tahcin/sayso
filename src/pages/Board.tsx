import { useCallback, useEffect, useRef, useState } from "react"
import { PROCESSORS, PURPOSE_LABEL } from "../../shared/cast"
import { EXPLORER, getBoard, type Ceased, type Lease, type Party, type Receipt } from "../../shared/sayso"
import { read } from "../data"
import { fmtDuration, short, useBlockClock, useEntityEvents } from "../live"

const WEEK = 7 * 24 * 3600 * 1000

type Row = { r: Receipt; ceased?: Ceased; lease?: Lease }

export default function Board() {
  const [parties, setParties] = useState<Party[]>([])
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const clock = useBlockClock()
  const busy = useRef(false)

  const load = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    try {
      const snap = await read(() => getBoard(Date.now() - WEEK))
      const ps = snap.parties
      setParties(ps)
      // Only withdrawals that name one of our fictional vendors belong on this board, and a stop note
      // or lease counts only if that vendor's own wallet wrote it.
      const known = new Set(ps.filter((p) => p.role === "processor").map((p) => p.address.toLowerCase()))
      const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
      setRows(
        snap.receipts
          .filter((r) => known.has(r.processor.toLowerCase()))
          .map((r) => ({
            r,
            ceased: snap.ceased.find((c) => same(c.consent, r.consent) && same(c.creator, r.processor)),
            lease: snap.leases.find((l) => same(l.consent, r.consent) && same(l.creator, r.processor)),
          }))
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
    if (parties.some((p) => p.role === "processor" && p.address.toLowerCase() === owner.toLowerCase())) {
      clearTimeout(timer.current)
      timer.current = window.setTimeout(load, 2000)
    }
  })

  const name = (a: string) => parties.find((p) => p.address.toLowerCase() === a.toLowerCase())?.name ?? short(a)
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
          const addr = parties.find((x) => x.slug === p.slug)?.address?.toLowerCase()
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
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <tr>
                <td colSpan={5} className="muted">
                  Reading Arkiv…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
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
                        {new Date(x.r.atMs).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                      </a>
                    </td>
                    <td>{name(x.r.fiduciary)}</td>
                    <td>{PURPOSE_LABEL[x.r.purpose] ?? x.r.purpose}</td>
                    <td>{name(x.r.processor)}</td>
                    <td>
                      {s !== null ? (
                        <span className="ok">Stopped in {fmtDuration(s)}</span>
                      ) : x.lease ? (
                        <span className="bad">Still holding a lease, {fmtDuration(waiting)} later</span>
                      ) : (
                        <span className="muted">No answer, no lease</span>
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
        stop note, so neither side can backdate them.
      </p>
    </main>
  )
}
