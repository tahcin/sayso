import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Address } from "viem"
import { FIDUCIARIES, PROCESSORS, PURPOSE_LABEL } from "../../shared/cast"
import { answer, renew, withdraw } from "../../shared/actions"
import { DATA_EXPLORER, EXPLORER, type Notice } from "../../shared/sayso"
import { loadPerson, loadWorld, onRelay, relayed, type Item, type World } from "../data"
import { fmtDuration, secondsUntil, short, useBlockClock, useEntityEvents, type Clock } from "../live"
import { accountFor, ensureGas, poke, resetIdentity, walletFor } from "../wallet"

type Tab = "rupeeleaf" | "bazaarline" | "mine"
type Busy = { label: string; started: number } | null
type Done = { label: string; tx: string } | null

export default function Try() {
  const [world, setWorld] = useState<World | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [tab, setTab] = useState<Tab>("rupeeleaf")
  const [busy, setBusy] = useState<Busy>(null)
  const [done, setDone] = useState<Done>(null)
  const [error, setError] = useState<string | null>(null)
  const [idVersion, setIdVersion] = useState(0)
  const clock = useBlockClock()
  const [viaRelay, setViaRelay] = useState(relayed)
  useEffect(() => onRelay(() => setViaRelay(true)), [])

  const addresses = useMemo(
    () => Object.fromEntries(FIDUCIARIES.map((f) => [f.slug, accountFor(f.slug).address])) as Record<string, Address>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [idVersion],
  )

  useEffect(() => {
    loadWorld().then(setWorld).catch((e) => setError(e.message))
  }, [])


  const refreshing = useRef(false)
  const again = useRef(false)
  const refresh = useCallback(async () => {
    if (refreshing.current) {
      again.current = true
      return
    }
    refreshing.current = true
    try {
      setItems(await loadPerson(addresses))
    } catch (e) {
      setError((e as Error).message.split("\n")[0])
    } finally {
      refreshing.current = false
      if (again.current) {
        again.current = false
        setTimeout(refresh, 300)
      }
    }
  }, [addresses])

  useEffect(() => {
    refresh()
    // Live events drive updates; this slow poll only catches anything the socket missed.
    const t = setInterval(refresh, 120000)
    return () => clearInterval(t)
  }, [refresh])

  // React to Arkiv events that touch this person: their own writes, and the processors' leases and acks.
  const watched = useMemo(() => {
    const s = new Set<string>(Object.values(addresses).map((a) => a.toLowerCase()))
    world?.parties.filter((p) => p.role === "processor").forEach((p) => s.add(p.address.toLowerCase()))
    return s
  }, [addresses, world])
  const keys = useMemo(() => new Set(items.flatMap((i) => [i.consent, i.lease?.key].filter(Boolean).map((k) => k!.toLowerCase()))), [items])
  const timer = useRef<number | undefined>(undefined)
  useEntityEvents((e) => {
    const owner = "owner" in e ? e.owner : "newOwner" in e ? e.newOwner : undefined
    if ((owner && watched.has(owner.toLowerCase())) || keys.has(e.entityKey.toLowerCase())) {
      clearTimeout(timer.current)
      timer.current = window.setTimeout(refresh, 1500)
    }
  })

  async function run(label: string, fn: () => Promise<{ txHash: string }>) {
    setError(null)
    setDone(null)
    setBusy({ label, started: Date.now() })
    try {
      const r = await fn()
      setDone({ label, tx: r.txHash })
      poke()
      await refresh()
    } catch (e) {
      const err = e as Error & { shortMessage?: string; details?: string }
      console.error(err)
      ;(window as unknown as { __lastError?: string }).__lastError = err.message
      setError([(err.shortMessage ?? err.message).split("\n")[0], err.details].filter(Boolean).join(" "))
    } finally {
      setBusy(null)
    }
  }

  const partyName = (a: string) => world?.parties.find((p) => p.address.toLowerCase() === a.toLowerCase())?.name ?? short(a)
  const noticeFor = (it: Item) => world?.notices[it.slug]?.find((n) => n.purpose === it.purpose)
  const live = items.filter((i) => i.live)

  return (
    <main>
      <section className="hero">
        <h1>Your data moves only while you say so.</h1>
        <p className="lede">
          Under India's new data protection law, the company that asks for your consent also keeps the only proof of it. Say So makes every
          consent a record you own on Arkiv. Withdraw it, and every vendor handling your data has to stop and sign for it, where anyone can see
          how long they took.
        </p>
        <p className="fine">
          Try it below. The companies are fictional; the consents, leases and receipts are real Arkiv entities on the Tiramisu testnet, written
          from a wallet that lives only in this browser.
        </p>
      </section>

      <div className="stage">
        <div className="phone" aria-label="Your phone">
          <div className="phone-top">
            <span className="phone-title">Your phone</span>
            <span className="gas ok">Your keys stay on this device</span>
          </div>
          <nav className="phone-tabs">
            {FIDUCIARIES.map((f) => (
              <button key={f.slug} className={tab === f.slug ? "on" : ""} onClick={() => setTab(f.slug)}>
                {f.name}
              </button>
            ))}
            <button className={tab === "mine" ? "on" : ""} onClick={() => setTab("mine")}>
              My consents{live.length ? <span className="count">{live.length}</span> : null}
            </button>
          </nav>

          <div className="phone-body">
            {!world ? (
              <p className="muted pad">Reading the companies' notices from Arkiv…</p>
            ) : tab === "mine" ? (
              <Mine
                items={items}
                clock={clock}
                busy={!!busy}
                partyName={partyName}
                noticeFor={noticeFor}
                addresses={addresses}
                onWithdraw={(it) => run(`Withdrawing ${PURPOSE_LABEL[it.purpose]}`, () => withdraw(walletFor(it.slug), it.live!, it.processor))}
                onRenew={(it) => run(`Renewing ${PURPOSE_LABEL[it.purpose]}`, () => renew(walletFor(it.slug), it.live!, noticeFor(it)!))}
                onNew={() => {
                  resetIdentity()
                  setItems([])
                  setIdVersion((v) => v + 1)
                  setTab("rupeeleaf")
                }}
              />
            ) : (
              <Signup
                key={tab}
                slug={tab}
                notices={world.notices[tab] ?? []}
                partyName={partyName}
                already={items.filter((i) => i.slug === tab && (i.live || i.status === "denied"))}
                disabled={!!busy}
                onAnswer={(yes, no) =>
                  run(yes.length ? `Saving ${yes.length} consent${yes.length > 1 ? "s" : ""}` : "Saving your no", async () => {
                    await ensureGas(accountFor(tab).address, tab)
                    const r = await answer(walletFor(tab), yes, no)
                    setTab("mine")
                    return r
                  })
                }
              />
            )}
          </div>

          <div className="phone-status" aria-live="polite">
            {busy ? (
              <Writing busy={busy} />
            ) : error ? (
              <span className="err">{error}</span>
            ) : done ? (
              <span>
                {done.label}: done.{" "}
                <a href={`${EXPLORER}/tx/${done.tx}`} target="_blank" rel="noreferrer">
                  See the transaction
                </a>
              </span>
            ) : (
              <span className="muted">
                Each tap is one Arkiv transaction, signed in this browser.
                {viaRelay ? " Your network used up Arkiv's free read quota, so reads now go through Say So's read-only relay." : ""}
              </span>
            )}
          </div>
        </div>

        <Behind items={items} clock={clock} partyName={partyName} world={world} />
      </div>

      <section className="how">
        <div>
          <h3>You own the consent</h3>
          <p>
            Your browser writes each consent from an address only you control, one address per company. It expires on its own when the
            purpose ends. Only you can renew it, and withdrawing deletes it.
          </p>
        </div>
        <div>
          <h3>Vendors hold a lease</h3>
          <p>
            A company's vendors take a lease on your consent that is set to end when your consent would. Before any job they check that your
            consent is still live. When you withdraw, they must drop the lease and sign that they stopped.
          </p>
        </div>
        <div>
          <h3>Stopping is public</h3>
          <p>
            A vendor that stops posts a signed note. How long it took is on the <a href="/board">cease board</a> for anyone to check, and so
            is the vendor that never answers.
          </p>
        </div>
      </section>
    </main>
  )
}

function Writing({ busy }: { busy: NonNullable<Busy> }) {
  const [, t] = useState(0)
  useEffect(() => {
    const i = setInterval(() => t((n) => n + 1), 250)
    return () => clearInterval(i)
  }, [])
  const s = (Date.now() - busy.started) / 1000
  return (
    <span className="writing">
      <span className="spinner" /> {busy.label} on Arkiv… {s.toFixed(0)} s <span className="muted">(usually 4 to 10 s)</span>
    </span>
  )
}

function Signup(props: {
  slug: string
  notices: Notice[]
  partyName: (a: string) => string
  already: Item[]
  disabled: boolean
  onAnswer: (yes: Notice[], no: Notice[]) => void
}) {
  const f = FIDUCIARIES.find((x) => x.slug === props.slug)!
  const open = props.notices.filter((n) => !props.already.some((i) => i.purpose === n.purpose))
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const chosen = open.filter((n) => picked.has(n.purpose))

  return (
    <div className="signup">
      <div className="co">
        <span className={`logo ${f.slug}`}>{f.name[0]}</span>
        <div>
          <strong>{f.name}</strong>
          <span className="muted"> · {f.blurb}</span>
        </div>
      </div>
      {open.length === 0 ? (
        <p className="pad">You have already answered every request from {f.name}. Your answers are under My consents.</p>
      ) : (
        <>
          <p className="ask">Choose what {f.name} may do with your data. Each one is separate, and none is ticked for you.</p>
          {open.map((n) => (
            <label key={n.key} className={`notice ${picked.has(n.purpose) ? "picked" : ""}`}>
              <input
                type="checkbox"
                checked={picked.has(n.purpose)}
                onChange={(e) => {
                  const s = new Set(picked)
                  if (e.target.checked) s.add(n.purpose)
                  else s.delete(n.purpose)
                  setPicked(s)
                }}
              />
              <span className="notice-body">
                <span className="notice-title">{n.title}</span>
                <span className="notice-text">{n.text}</span>
                <span className="chips">
                  {n.dataItems.map((d) => (
                    <span key={d} className="chip">
                      {d}
                    </span>
                  ))}
                </span>
                <span className="notice-meta">
                  Shared with {props.partyName(n.processor)} · ends after {fmtDuration(n.periodSeconds)}
                </span>
              </span>
            </label>
          ))}
          <button className="primary wide" disabled={props.disabled || chosen.length === 0} onClick={() => props.onAnswer(chosen, open.filter((n) => !picked.has(n.purpose)))}>
            {chosen.length ? `Agree to ${chosen.length} of ${open.length}` : "Tick what you agree to"}
          </button>
          <button className="link wide-link" disabled={props.disabled} onClick={() => props.onAnswer([], open)}>
            Say no to all of these
          </button>
          <p className="fine small">Your answer, yes or no, is kept as a receipt you own for seven years.</p>
        </>
      )}
    </div>
  )
}

const STATUS_TEXT: Record<Item["status"], string> = {
  using: "In use",
  pending: "Waiting for vendor",
  stopped: "Withdrawn · vendor stopped",
  ignoring: "Withdrawn · vendor has not stopped",
  released: "Withdrawn",
  ended: "Ended on its own",
  denied: "You said no",
}

function Mine(props: {
  items: Item[]
  clock: Clock | null
  busy: boolean
  partyName: (a: string) => string
  noticeFor: (i: Item) => Notice | undefined
  addresses: Record<string, Address>
  onWithdraw: (i: Item) => void
  onRenew: (i: Item) => void
  onNew: () => void
}) {
  if (!props.items.length)
    return (
      <p className="pad muted">
        Nothing yet. Open Rupeeleaf or Bazaarline and choose what they may do. Every answer you give shows up here.
      </p>
    )
  return (
    <div className="mine">
      {FIDUCIARIES.map((f) => {
        const list = props.items.filter((i) => i.slug === f.slug)
        if (!list.length) return null
        return (
          <div key={f.slug} className="group">
            <div className="group-head">
              <span className={`logo small ${f.slug}`}>{f.name[0]}</span>
              <strong>{f.name}</strong>
              <a className="who" href={`${DATA_EXPLORER}/owner/${props.addresses[f.slug]}`} target="_blank" rel="noreferrer">
                knows you as {short(props.addresses[f.slug])}
              </a>
            </div>
            {list.map((it) => {
              const left = it.live && props.clock ? secondsUntil(props.clock, it.live.expiresAt) : null
              return (
                <div key={it.consent} className={`consent ${it.status}`}>
                  <div className="consent-row">
                    <span className="consent-title">{PURPOSE_LABEL[it.purpose] ?? it.purpose}</span>
                    <span className={`pill ${it.status}`}>{STATUS_TEXT[it.status]}</span>
                  </div>
                  <div className="consent-meta">
                    Shared with {props.partyName(it.processor)}
                    {left !== null ? <> · ends in {fmtDuration(left)}</> : null}
                  </div>
                  <VendorLine it={it} clock={props.clock} vendor={props.partyName(it.processor)} />
                  {it.live ? (
                    <div className="consent-actions">
                      <button className="stop" disabled={props.busy} onClick={() => props.onWithdraw(it)}>
                        Withdraw
                      </button>
                      <button className="ghost" disabled={props.busy || !props.noticeFor(it)} onClick={() => props.onRenew(it)}>
                        Renew
                      </button>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )
      })}
      <button className="link" onClick={props.onNew}>
        Start over as a new person
      </button>
    </div>
  )
}

// The vendor's state, inside the card, so it is visible on a phone without scrolling to the panel.
function VendorLine({ it, clock, vendor }: { it: Item; clock: Clock | null; vendor: string }) {
  const blockMs = clock?.blockMs ?? 2000
  if (it.status === "stopped" && it.ceased && it.withdrawn)
    return <div className="vline ok">{vendor} signed a stop note {fmtDuration((Number(it.ceased.createdAt - it.withdrawn.createdAt) * blockMs) / 1000)} after you withdrew</div>
  if (it.status === "ignoring" && it.withdrawn && clock)
    return <div className="vline bad">{vendor} still holds a lease, {fmtDuration((Number(clock.block - it.withdrawn.createdAt) * blockMs) / 1000)} after you withdrew</div>
  if (it.status === "released") return <div className="vline">Waiting for {vendor} to confirm it stopped</div>
  if (it.status === "using") return <div className="vline">{vendor} holds a lease that ends with this consent</div>
  if (it.status === "pending") return <div className="vline">{vendor} has not picked it up yet</div>
  return null
}

function Behind({ items, clock, partyName, world }: { items: Item[]; clock: Clock | null; partyName: (a: string) => string; world: World | null }) {
  const procs = PROCESSORS.map((p) => ({ ...p, address: world?.parties.find((x) => x.slug === p.slug)?.address }))
  return (
    <aside className="behind">
      <h2>Who is using your data</h2>
      <p className="muted small">Each company's vendor, read live from Arkiv. When you withdraw, watch the clock.</p>
      <div className="procs">
        {procs.map((p) => {
          const mine = items.filter((i) => p.address && i.processor.toLowerCase() === p.address.toLowerCase())
          const latest = mine[0]
          return <ProcCard key={p.slug} name={p.name} blurb={p.blurb} item={latest} clock={clock} partyName={partyName} />
        })}
      </div>
      <EventTicker world={world} />
    </aside>
  )
}

function ProcCard({ name, blurb, item, clock, partyName }: { name: string; blurb: string; item?: Item; clock: Clock | null; partyName: (a: string) => string }) {
  const blockMs = clock?.blockMs ?? 2000
  let big = ""
  let line = "Not using your data"
  let tone = "idle"
  if (item) {
    const co = partyName(item.withdrawn?.fiduciary ?? item.granted.fiduciary)
    const purpose = PURPOSE_LABEL[item.purpose] ?? item.purpose
    if (item.status === "using") {
      tone = "go"
      line = `Holding a lease for ${co}: ${purpose}`
    } else if (item.status === "pending") {
      tone = "wait"
      line = `About to start: ${co}, ${purpose}`
    } else if (item.status === "stopped" && item.ceased && item.withdrawn) {
      tone = "done"
      big = fmtDuration((Number(item.ceased.createdAt - item.withdrawn.createdAt) * blockMs) / 1000)
      line = `Signed a stop note this long after you withdrew`
    } else if (item.status === "ignoring" && item.withdrawn) {
      tone = "bad"
      big = clock ? fmtDuration((Number(clock.block - item.withdrawn.createdAt) * blockMs) / 1000) : ""
      line = `You withdrew. It still holds a lease and has not said it stopped.`
    } else if (item.status === "ended") {
      tone = "idle"
      line = `Its permission ran out on its own`
    } else if (item.status === "released") {
      tone = "wait"
      line = `You withdrew. Waiting for it to confirm.`
    }
  }
  return (
    <div className={`proc ${tone}`}>
      <div className="proc-head">
        <span className="dot" />
        <strong>{name}</strong>
        <span className="muted small">{blurb}</span>
      </div>
      {big ? <div className="big">{big}</div> : null}
      <div className="proc-line">{line}</div>
      {item?.lease ? (
        <a className="small" href={`${DATA_EXPLORER}/entity/${item.lease.key}`} target="_blank" rel="noreferrer">
          Its lease on Arkiv
        </a>
      ) : item?.ceased ? (
        <a className="small" href={`${DATA_EXPLORER}/entity/${item.ceased.key}`} target="_blank" rel="noreferrer">
          Its signed stop note
        </a>
      ) : null}
    </div>
  )
}

const EVENT_TEXT: Record<string, string> = {
  EntityCreated: "created",
  EntityDeleted: "deleted",
  EntityPatched: "updated",
  ExpiryExtended: "extended",
  OwnershipTransferred: "transferred",
}

function EventTicker({ world }: { world: World | null }) {
  const [rows, setRows] = useState<{ k: string; text: string; block: bigint }[]>([])
  const [total, setTotal] = useState(0)
  useEntityEvents((e) => {
    setTotal((n) => n + 1)
    const owner = "owner" in e ? e.owner : "newOwner" in e ? e.newOwner : ""
    const who = world?.parties.find((p) => p.address.toLowerCase() === owner.toLowerCase())?.name
    const text = `${who ?? short(owner)} ${EVENT_TEXT[e.type] ?? e.type} entity ${short(e.entityKey)}`
    setRows((r) => [{ k: `${e.transactionHash}-${e.logIndex}`, text, block: e.blockNumber }, ...r].slice(0, 6))
  })
  return (
    <div className="ticker">
      <div className="ticker-head">
        <span className="pulse" /> Live from Arkiv over WebSocket · {total} events since you opened this page
      </div>
      {rows.length === 0 ? <div className="muted small">Waiting for the next block…</div> : null}
      {rows.map((r) => (
        <div key={r.k} className="tick">
          <span className="blk">#{r.block.toString()}</span> {r.text}
        </div>
      ))}
    </div>
  )
}
