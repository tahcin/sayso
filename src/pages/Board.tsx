import { useCallback, useEffect, useRef, useState } from "react"
import { FIDUCIARIES, PROCESSORS, PURPOSE_LABEL } from "../../shared/cast"
import { EXPLORER, getBoard, type Ceased, type Lease, type Receipt } from "../../shared/sayso"
import { preserve } from "../../shared/actions"
import { read } from "../data"
import { accountFor, ensureGas, walletFor } from "../wallet"
import { blockNow, fmtDuration, short, useBlockClock, useEntityEvents, useFallbackPoll, useReadAt } from "../live"

const WEEK = 7 * 24 * 3600 * 1000
// Entities from before the final schema (17 Oct 2026, 13:30 IST) lack fields this board reads.
const LAUNCH = Date.UTC(2026, 9, 17, 8, 0)
// A stop note is written to last 7 years (LIFETIME.record); "Keep longer" moves it to 8 years from that day.
const RECORD_S = 7 * 365 * 24 * 3600

type Row = { r: Receipt; ceased?: Ceased; lease?: Lease }

export default function Board() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const clock = useBlockClock()
  const busy = useRef(false)
  // Live consents the board knows about: deleting one is a withdrawal, so its event triggers a reload.
  const liveKeys = useRef(new Set<string>())

  const load = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    try {
      // The shared block clock: read once per page, then kept current by the event socket.
      const c = await blockNow()
      const blocksBack = (ms: number) => BigInt(Math.floor(ms / c.blockMs))
      const since = c.block - blocksBack(Date.now() - Math.max(LAUNCH, Date.now() - WEEK))
      const vendors = PROCESSORS.map((p) => p.address)
      const snap = await read(() => getBoard(since, vendors))
      const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
      // A withdrawal is on the board only if the named vendor's own wallet proves it held this
      // person's consent: a lease or a stop note about that consent and that person. Receipts from
      // strangers, or naming vendors that never touched the consent, cannot move a vendor's score.
      // Close the obvious ways to game the board with real receipts: a "withdrawal" whose consent is
      // still live, a second receipt for the same consent, and a receipt written after the stop note.
      const live = new Set(snap.consents.map((c) => c.key.toLowerCase()))
      liveKeys.current = live
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
  }, [load])

  // The board reloads when Arkiv says something changed, not on a timer: a vendor wrote, extended or
  // deleted something (a lease, a stop note), or a person deleted a consent the board knows is live.
  const timer = useRef<number | undefined>(undefined)
  useEntityEvents((e) => {
    const owner = "owner" in e ? e.owner : ""
    const vendor = PROCESSORS.some((p) => p.address.toLowerCase() === owner.toLowerCase())
    const withdrawal = e.type === "EntityDeleted" && liveKeys.current.has(e.entityKey.toLowerCase())
    if (vendor || withdrawal) {
      clearTimeout(timer.current)
      timer.current = window.setTimeout(load, 2000)
    }
  })
  // Expiry emits no event. Reload once when the next lease on the board runs out, or when the oldest
  // row leaves the 7-day window.
  const weekBlocks = clock ? BigInt(Math.floor(WEEK / clock.blockMs)) : 0n
  useReadAt(load, (rows ?? []).flatMap((x) => [x.ceased ? undefined : x.lease?.expiresAt, clock ? x.r.createdAt + weekBlocks : undefined]))
  // Only if the event socket is down: a slow re-read so the board cannot go stale.
  useFallbackPoll(load)

  const [keeping, setKeeping] = useState<string | null>(null)
  const [kept, setKept] = useState<Set<string>>(new Set())
  // Anyone may extend a vendor's stop note (it is created with permissionless Lifetime Extension); only
  // the vendor that wrote it could delete it. Receipts are not: only the person who wrote one can extend
  // it. The extension is signed by a separate "witness" address in this browser.
  async function keep(x: Row) {
    setKeeping(x.r.key)
    setError(null)
    try {
      await ensureGas(accountFor("witness").address, "witness")
      await preserve(walletFor("witness"), [x.ceased!.key])
      // Disable at once, so a second press cannot spend gas before the reload shows the new expiry.
      setKept((k) => new Set(k).add(x.ceased!.key))
      await load()
    } catch (e) {
      setError((e as Error).message.split("\n")[0])
    } finally {
      setKeeping(null)
    }
  }
  const name = (a: string) => [...FIDUCIARIES, ...PROCESSORS].find((p) => p.address.toLowerCase() === a.toLowerCase())?.name ?? short(a)
  const blockMs = clock?.blockMs ?? 2000
  // A stop note whose expiry sits more than a day past its original 7 years has been kept longer.
  const extended = (c: Ceased) => kept.has(c.key) || c.expiresAt > c.createdAt + BigInt(Math.floor(((RECORD_S + 86400) * 1000) / blockMs))
  const stopSec = (x: Row) => (x.ceased ? (Number(x.ceased.createdAt - x.r.createdAt) * blockMs) / 1000 : null)

  return (
    <main className="board">
      <section className="hero slim">
        <h1>Cease board</h1>
        <p className="lede">
          Every withdrawal in the last 7 days, and how long each vendor took to stop. Nobody runs this list: it is read straight from Arkiv, so
          a vendor cannot remove its own slow answer. All four vendors are fictional and scripted: three sign stop notes, and Pingwave is
          scripted never to answer, so it shows what silence looks like.
        </p>
        <p className="muted small keep-hint">
          Each stop note is kept for 7 years. "Keep longer" lets anyone, you included, push one to 8 years from today; the vendor cannot stop it.
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
              <span className="muted small">{p.slug === "pingwave" ? `${p.blurb} · fictional, scripted never to answer` : `${p.blurb} · fictional`}</span>
              <div className={`score-num ${median === null && !silent ? "quiet" : ""}`}>{median !== null ? fmtDuration(median) : silent ? "No answer" : "No withdrawals yet"}</div>
              <div className="small">
                {median !== null ? "typical time to sign a stop note · " : ""}
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
                    <td data-label="Withdrawn">
                      <a href={`${EXPLORER}/block/${x.r.createdAt}`} target="_blank" rel="noreferrer">
                        {clock
                          ? new Date(Date.now() - Number(clock.block - x.r.createdAt) * blockMs).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
                          : `block ${x.r.createdAt}`}
                      </a>
                    </td>
                    <td data-label="Company">{name(x.r.fiduciary)}</td>
                    <td data-label="Purpose">{PURPOSE_LABEL[x.r.purpose] ?? x.r.purpose}</td>
                    <td data-label="Vendor">{name(x.r.processor)}</td>
                    <td data-label="Result">
                      {s !== null ? (
                        <span className="ok">Signed a stop note after {fmtDuration(s)}</span>
                      ) : x.lease ? (
                        <span className="bad">Still holding a lease, {fmtDuration(waiting)} later</span>
                      ) : (
                        <span className="muted">No answer, no lease</span>
                      )}
                    </td>
                    <td data-label="Stop note kept until">
                      {x.ceased && clock ? (
                        extended(x.ceased) ? (
                          <span>
                            <span className="tag green">Extended</span> to{" "}
                            {new Date(Date.now() + Number(x.ceased.expiresAt - clock.block) * blockMs).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                          </span>
                        ) : (
                          <>
                            {new Date(Date.now() + Number(x.ceased.expiresAt - clock.block) * blockMs).toLocaleDateString("en-IN", { dateStyle: "medium" })}{" "}
                            <button className="link small" disabled={!!keeping} onClick={() => keep(x)}>
                              {keeping === x.r.key ? "Extending…" : "Keep longer"}
                            </button>
                          </>
                        )
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
        stop note, so neither side can backdate them. Only the vendor that wrote a stop note could delete it, and an extended one shows as
        "Extended" with its new date.
      </p>
    </main>
  )
}
