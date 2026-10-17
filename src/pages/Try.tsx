import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Address } from "viem"
import { FIDUCIARIES, PROCESSORS, PURPOSE_LABEL } from "../../shared/cast"
import { answer, renew, withdraw } from "../../shared/actions"
import { DATA_EXPLORER, EXPLORER, type Notice } from "../../shared/sayso"
import { loadPerson, loadWorld, onRelay, relayed, type Item, type World } from "../data"
import { fmtDuration, secondsUntil, short, useBlockClock, useEntityEvents, type Clock } from "../live"
import { LangContext, loadLang, saveLang, STRINGS, useT, type Lang } from "../i18n"
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
  const [lang, setLang] = useState<Lang>(loadLang)
  const T = STRINGS[lang]
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
          Under India's new data protection law your consent is what lets a company use your data, yet today the company that asks for it
          usually keeps the only record. Say So makes every consent a record you own on Arkiv. Withdraw it, and each vendor handling your data
          is expected to stop and sign that it did, where anyone can see how long it took.
        </p>
        <p className="fine">
          Try it below. The companies are fictional; the consents, leases and receipts are real Arkiv entities on the Tiramisu testnet, written
          from a wallet that lives only in this browser.
        </p>
      </section>

      <div className="stage">
        <LangContext.Provider value={lang}>
        <div className="phone" aria-label="Your phone" lang={lang}>
          <div className="phone-top">
            <span className="phone-title">{T.yourPhone}</span>
            <span className="langs" role="group" aria-label="Language">
              {(["en", "hi"] as Lang[]).map((l) => (
                <button
                  key={l}
                  className={lang === l ? "on" : ""}
                  onClick={() => {
                    setLang(l)
                    saveLang(l)
                  }}
                >
                  {l === "en" ? "English" : "हिन्दी"}
                </button>
              ))}
            </span>
          </div>
          <nav className="phone-tabs">
            {FIDUCIARIES.map((f) => (
              <button key={f.slug} className={tab === f.slug ? "on" : ""} onClick={() => setTab(f.slug)}>
                {f.name}
              </button>
            ))}
            <button className={tab === "mine" ? "on" : ""} onClick={() => setTab("mine")}>
              {T.myConsents}
              {live.length ? <span className="count">{live.length}</span> : null}
            </button>
          </nav>

          <div className="phone-body">
            {!world ? (
              <p className="muted pad">{T.reading}</p>
            ) : tab === "mine" ? (
              <Mine
                items={items}
                clock={clock}
                busy={!!busy}
                partyName={partyName}
                noticeFor={noticeFor}
                addresses={addresses}
                onWithdraw={(it) => run(T.withdrawing(T.purpose[it.purpose] ?? it.purpose), () => withdraw(walletFor(it.slug), it.live!, it.processor))}
                onRenew={(it) => run(T.renewing(T.purpose[it.purpose] ?? it.purpose), () => renew(walletFor(it.slug), it.live!, noticeFor(it)!))}
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
                already={items.filter((i) => i.slug === tab && i.live)}
                saidNo={items.filter((i) => i.slug === tab && i.status === "denied").map((i) => i.purpose)}
                disabled={!!busy}
                onAnswer={(yes, no) =>
                  run(T.saving(yes.length), async () => {
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
                {T.saved}{" "}
                <a href={`${EXPLORER}/tx/${done.tx}`} target="_blank" rel="noreferrer">
                  {T.seeTx}
                </a>
              </span>
            ) : (
              <span className="muted">
                {T.eachTap}
                {viaRelay ? T.relay : ""}
              </span>
            )}
          </div>
        </div>
        </LangContext.Provider>

        <Behind items={items} clock={clock} partyName={partyName} world={world} />
      </div>

      <section className="india">
        <h2>Why this matters in India now</h2>
        <div className="facts">
          <a className="fact" href="https://www.ascionline.in/wp-content/uploads/2024/07/Press-Release.-Conscious-Patterns-25.07.24.docx.pdf" target="_blank" rel="noreferrer">
            <strong>52 of 53</strong>
            <span>popular Indian apps used deceptive design, and every e-commerce app made deleting your account hard (ASCI, 2024)</span>
          </a>
          <a className="fact" href="https://www.businesstoday.in/amp/technology/news/story/95-indians-continue-to-get-unwanted-calls-daily-despite-regulatory-interventions-survey-443922-2024-09-02" target="_blank" rel="noreferrer">
            <strong>95%</strong>
            <span>of people surveyed get unwanted commercial calls every day, and 96% of those on Do Not Disturb still get them (LocalCircles, 2024)</span>
          </a>
          <a className="fact" href="https://www.deccanherald.com/india/cyberabad-cops-nab-man-stealing-selling-data-of-67-crore-individuals-1205735.html" target="_blank" rel="noreferrer">
            <strong>66.9 crore</strong>
            <span>individuals and organisations had their data found with one seller by Cyberabad police (2023)</span>
          </a>
        </div>
        <ol className="timeline">
          <li>
            <strong>Aug 2023</strong> Digital Personal Data Protection Act passed: consent must be free, specific and as easy to withdraw as to give
          </li>
          <li>
            <strong>13 Nov 2025</strong> DPDP Rules published
          </li>
          <li className="soon">
            <strong>13 Nov 2026</strong> Consent Managers can register with the Data Protection Board
          </li>
          <li>
            <strong>13 May 2027</strong> Notice, consent, security and erasure duties apply to every company
          </li>
        </ol>
      </section>

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
  const T = useT()
  const [, t] = useState(0)
  useEffect(() => {
    const i = setInterval(() => t((n) => n + 1), 250)
    return () => clearInterval(i)
  }, [])
  const s = (Date.now() - busy.started) / 1000
  return (
    <span className="writing">
      <span className="spinner" /> {T.busy(busy.label)} {s.toFixed(0)} {T.units.s} <span className="muted">{T.usually}</span>
    </span>
  )
}

function Signup(props: {
  slug: string
  notices: Notice[]
  partyName: (a: string) => string
  already: Item[]
  saidNo: string[]
  disabled: boolean
  onAnswer: (yes: Notice[], no: Notice[]) => void
}) {
  const T = useT()
  const hindi = T === STRINGS.hi
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
          <span className="muted"> · {T.blurb[f.slug] ?? f.blurb}</span>
        </div>
      </div>
      {open.length === 0 ? (
        <p className="pad">{T.answeredAll(f.name)}</p>
      ) : (
        <>
          <p className="ask">{T.ask(f.name)}</p>
          {open.map((n) => {
            const words = hindi && n.hi ? n.hi : n
            return (
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
                <span className="notice-title">{words.title}</span>
                <span className="notice-text">{words.text}</span>
                <span className="chips">
                  {words.dataItems.map((d) => (
                    <span key={d} className="chip">
                      {d}
                    </span>
                  ))}
                </span>
                <span className="notice-meta">
                  {T.sharedWith(props.partyName(n.processor))} · {T.endsAfter(fmtDuration(n.periodSeconds, T.units))}
                </span>
                {props.saidNo.includes(n.purpose) ? <span className="notice-meta said-no">{T.saidNoBefore}</span> : null}
              </span>
            </label>
            )
          })}
          <button className="primary wide" disabled={props.disabled || chosen.length === 0} onClick={() => props.onAnswer(chosen, open.filter((n) => !picked.has(n.purpose)))}>
            {chosen.length ? T.agree(chosen.length, open.length) : T.tick}
          </button>
          <button className="link wide-link" disabled={props.disabled} onClick={() => props.onAnswer([], open)}>
            {T.noAll}
          </button>
          <p className="fine small">{T.kept}</p>
          {open[0]?.contact ? <p className="fine small rights">{T.rights(open[0].contact)}</p> : null}
        </>
      )}
    </div>
  )
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
  const T = useT()
  if (!props.items.length) return <p className="pad muted">{T.nothingYet}</p>
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
                {T.knowsYouAs} {short(props.addresses[f.slug])}
              </a>
            </div>
            {list.map((it) => {
              const left = it.live && props.clock ? secondsUntil(props.clock, it.live.expiresAt) : null
              return (
                <div key={it.consent} className={`consent ${it.status}`}>
                  <div className="consent-row">
                    <span className="consent-title">{T.purpose[it.purpose] ?? it.purpose}</span>
                    <span className={`pill ${it.status}`}>{T.status[it.status]}</span>
                  </div>
                  <div className="consent-meta">
                    {it.status === "denied" ? T.notShared(props.partyName(it.processor)) : T.sharedWith(props.partyName(it.processor))}
                    {left !== null ? <> · {T.endsOn(endDate(left, T === STRINGS.hi), fmtDuration(left, T.units))}</> : null}
                  </div>
                  <VendorLine it={it} clock={props.clock} vendor={props.partyName(it.processor)} />
                  {it.live ? (
                    <div className="consent-actions">
                      <button className="stop" disabled={props.busy} onClick={() => props.onWithdraw(it)}>
                        {T.withdraw}
                      </button>
                      <button className="ghost" disabled={props.busy || !props.noticeFor(it)} onClick={() => props.onRenew(it)}>
                        {T.renew}
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
        {T.startOver}
      </button>
    </div>
  )
}

function endDate(secondsLeft: number, hindi: boolean) {
  const d = new Date(Date.now() + secondsLeft * 1000)
  const loc = hindi ? "hi-IN" : "en-IN"
  return secondsLeft < 86400 ? d.toLocaleTimeString(loc, { timeStyle: "short" }) : d.toLocaleDateString(loc, { dateStyle: "medium" })
}

// The vendor's state, inside the card, so it is visible on a phone without scrolling to the panel.
function VendorLine({ it, clock, vendor }: { it: Item; clock: Clock | null; vendor: string }) {
  const T = useT()
  const blockMs = clock?.blockMs ?? 2000
  const dur = (blocks: bigint) => fmtDuration((Number(blocks) * blockMs) / 1000, T.units)
  if (it.status === "stopped" && it.ceased && it.withdrawn)
    return <div className="vline ok">{T.vStopped(vendor, dur(it.ceased.createdAt - it.withdrawn.createdAt))}</div>
  if (it.status === "ignoring" && it.withdrawn && clock) return <div className="vline bad">{T.vIgnoring(vendor, dur(clock.block - it.withdrawn.createdAt))}</div>
  if (it.status === "released") return <div className="vline">{T.vReleased(vendor)}</div>
  if (it.status === "using") return <div className="vline">{T.vUsing(vendor)}</div>
  if (it.status === "pending") return <div className="vline">{T.vPending(vendor)}</div>
  return null
}

const RANK: Record<Item["status"], number> = { ignoring: 0, released: 1, using: 2, pending: 3, stopped: 4, ended: 5, denied: 6 }

function Behind({ items, clock, partyName, world }: { items: Item[]; clock: Clock | null; partyName: (a: string) => string; world: World | null }) {
  const procs = PROCESSORS.map((p) => ({ ...p, address: world?.parties.find((x) => x.slug === p.slug)?.address }))
  return (
    <aside className="behind">
      <h2>Who is using your data</h2>
      <p className="muted small">Each company's vendor, read live from Arkiv. When you withdraw, watch the clock.</p>
      <div className="procs">
        {procs.map((p) => {
          // Show the item that matters most for this vendor, not merely the newest: a vendor still
          // holding a lease after a withdrawal outranks everything, and a "no" never involved it.
          const mine = items.filter((i) => p.address && i.processor.toLowerCase() === p.address.toLowerCase() && i.status !== "denied")
          const pick = mine.sort((a, b) => RANK[a.status] - RANK[b.status] || Number(b.granted.createdAt - a.granted.createdAt))[0]
          return <ProcCard key={p.slug} name={p.name} blurb={p.blurb} item={pick} clock={clock} partyName={partyName} />
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
