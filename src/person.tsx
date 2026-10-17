import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Address } from "viem"
import { FIDUCIARIES, PROCESSORS } from "../shared/cast"
import { Select } from "./components/Select"
import { answer, declare, renew, withdraw } from "../shared/actions"
import { DATA_EXPLORER, EXPLORER, type Declaration, type Notice } from "../shared/sayso"
import { loadPerson, loadWorld, onRelay, relayed, type Item, type World } from "./data"
import { fmtDuration, secondsUntil, short, useBlockClock, useEntityEvents, type Clock } from "./live"
import { LangContext, loadLang, saveLang, STRINGS, useT, type Lang } from "./i18n"
import { accountFor, ensureGas, poke, recoveryPhrase, resetIdentity, restoreIdentity, walletFor } from "./wallet"

type Tab = "rupeeleaf" | "bazaarline" | "any" | "mine"
type Busy = { label: string; started: number } | null
type Done = { label: string; tx: string } | null

/** Everything about the visitor as a person: their addresses, their answers on Arkiv, and the actions they can take. */
export function usePerson() {
  const [world, setWorld] = useState<World | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [declarations, setDeclarations] = useState<Declaration[]>([])
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
    () => Object.fromEntries([...FIDUCIARIES.map((f) => f.slug), "self"].map((s) => [s, accountFor(s).address])) as Record<string, Address>,
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
      const p = await loadPerson(addresses)
      setItems(p.items)
      setDeclarations(p.declarations)
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
      timer.current = window.setTimeout(refresh, 600)
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

  // Start the company's test-gas transfer as soon as the person starts answering, so pressing Agree
  // waits for one transaction instead of two. It is still that company funding that address.
  const funding = useRef<Record<string, Promise<unknown>>>({})
  const prefund = (slug: string) => {
    const key = `${idVersion}:${slug}`
    if (!funding.current[key]) funding.current[key] = ensureGas(accountFor(slug).address, slug).catch(() => (delete funding.current[key], undefined))
    return funding.current[key]
  }

  const recordAny = (company: string, purpose: string) =>
    run(T.recording, async () => {
      await ensureGas(accountFor("self").address, "self")
      return declare(walletFor("self"), company, purpose)
    })

  return {
    recordAny,
    prefund,
    world, items, declarations, tab, setTab, busy, done, error, clock, lang, setLang, T, viaRelay, addresses,
    setItems, setDeclarations, setIdVersion, run, partyName, noticeFor, live,
  }
}

export type Person = ReturnType<typeof usePerson>

/**
 * The product, in one window: the companies' consent requests and your consents on the left, and on the
 * right who holds your data right now, read live from Arkiv.
 */
export function AppWindow({ p }: { p: Person }) {
  const { lang, T, setLang, tab, setTab, live, world, busy, declarations, run, items, clock, partyName, noticeFor, addresses, setItems, setDeclarations, setIdVersion, error, done, viaRelay } = p
  const nav: { id: Tab; label: string; mark: React.ReactNode; count?: number }[] = [
    ...FIDUCIARIES.map((f) => ({ id: f.slug as Tab, label: f.name, mark: <span className={`mark ${f.slug}`}>{f.name[0]}</span> })),
    { id: "any", label: T.anyApp, mark: <span className="mark any">+</span> },
    { id: "mine", label: T.myConsents, mark: <span className="mark you">✓</span>, count: live.length },
  ]
  return (
    <LangContext.Provider value={lang}>
      <div className="window" lang={lang}>
        <div className="win-bar">
          <span className="dots" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          <span className="win-title">sayso.tahcin.tech</span>
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
                {l === "en" ? "EN" : "हिं"}
              </button>
            ))}
          </span>
        </div>
        <div className="win-body">
          <nav className="win-side">
            <span className="side-label">{T.yourPhone}</span>
            {nav.map((n) => (
              <button key={n.id} className={tab === n.id ? "on" : ""} onClick={() => setTab(n.id)}>
                {n.mark}
                <span>{n.label}</span>
                {n.count ? <span className="count">{n.count}</span> : null}
              </button>
            ))}
            <span className="side-foot">{T.keysStay}</span>
          </nav>

          <section className="win-main">
            {!world ? (
              <p className="muted pad">{T.reading}</p>
            ) : tab === "any" ? (
              <AnyApp disabled={!!busy} latest={declarations[0]} onRecord={p.recordAny} />
            ) : tab === "mine" ? (
              <Mine
                items={items}
                declarations={declarations}
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
                  setDeclarations([])
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
                onTouch={() => p.prefund(tab)}
                onAnswer={(yes, no) =>
                  run(T.saving(yes.length), async () => {
                    await p.prefund(tab)
                    await ensureGas(accountFor(tab).address, tab)
                    const r = await answer(walletFor(tab), yes, no)
                    setTab("mine")
                    return r
                  })
                }
              />
            )}
          </section>

          <aside className="win-right">
            <VendorPanel items={items} clock={clock} />
          </aside>
        </div>
        <div className="win-status" aria-live="polite">
          {busy ? (
            <Writing busy={busy} />
          ) : error ? (
            <span className="err">{error}</span>
          ) : done ? (
            <span>
              <span className="ok-dot" /> {T.saved}{" "}
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
          <LiveDot world={world} />
        </div>
      </div>
    </LangContext.Provider>
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
  onTouch?: () => void
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
                  props.onTouch?.()
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
  declarations: Declaration[]
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
  if (!props.items.length && !props.declarations.length)
    return (
      <div className="mine">
        <p className="muted">{T.nothingYet}</p>
        <Recovery onNew={props.onNew} />
      </div>
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
      {props.declarations.length ? (
        <div className="group">
          <div className="group-head">
            <span className="logo small any">+</span>
            <strong>{T.otherApps}</strong>
          </div>
          {props.declarations.map((d) => (
            <div key={d.key} className="consent released">
              <div className="consent-row">
                <span className="consent-title">{d.company}</span>
                <span className="pill released">{T.status.released}</span>
              </div>
              <div className="consent-meta">
                {T.anyPurpose[d.purpose] ?? d.purpose} · {new Date(d.atMs).toLocaleString(T === STRINGS.hi ? "hi-IN" : "en-IN", { dateStyle: "medium", timeStyle: "short" })} ·{" "}
                <a href={`${DATA_EXPLORER}/entity/${d.key}`} target="_blank" rel="noreferrer">
                  {T.record}
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <Recovery onNew={props.onNew} />
    </div>
  )
}

function endDate(secondsLeft: number, hindi: boolean) {
  const d = new Date(Date.now() + secondsLeft * 1000)
  const loc = hindi ? "hi-IN" : "en-IN"
  return secondsLeft < 86400 ? d.toLocaleTimeString(loc, { timeStyle: "short" }) : d.toLocaleDateString(loc, { dateStyle: "medium" })
}

/**
 * Your consents are yours only while you hold the key. Show the 12-word phrase so a person can withdraw
 * later from another browser, restore one, and warn before throwing the current one away.
 */
function Recovery({ onNew }: { onNew: () => void }) {
  const T = useT()
  const [mode, setMode] = useState<"" | "show" | "restore" | "confirm">("")
  const [text, setText] = useState("")
  const [bad, setBad] = useState(false)
  return (
    <div className="recovery">
      <div className="recovery-links">
        <button className="link" onClick={() => setMode(mode === "show" ? "" : "show")}>
          {T.backup}
        </button>
        <button className="link" onClick={() => setMode(mode === "restore" ? "" : "restore")}>
          {T.restore}
        </button>
        <button className="link" onClick={() => setMode(mode === "confirm" ? "" : "confirm")}>
          {T.startOver}
        </button>
      </div>
      {mode === "show" ? (
        <div className="recovery-box">
          <p>{T.backupNote}</p>
          <code className="phrase">{recoveryPhrase()}</code>
        </div>
      ) : mode === "restore" ? (
        <div className="recovery-box">
          <p>{T.restoreNote}</p>
          <textarea value={text} onChange={(e) => (setText(e.target.value), setBad(false))} rows={2} spellCheck={false} />
          {bad ? <p className="err">{T.restoreBad}</p> : null}
          <button
            className="ghost"
            onClick={() => {
              if (!restoreIdentity(text)) return setBad(true)
              location.reload()
            }}
          >
            {T.restore}
          </button>
        </div>
      ) : mode === "confirm" ? (
        <div className="recovery-box">
          <p>{T.startOverWarn}</p>
          <button className="ghost danger" onClick={onNew}>
            {T.startOver}
          </button>
        </div>
      ) : null}
    </div>
  )
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

// Any real company: the person keeps their own timestamped proof that they withdrew, and gets a
// message to send. Company names only; digits and "@" are blocked so no phone or email reaches Arkiv.
const ANY_PURPOSES = ["marketing_calls", "sharing_partners", "personalised_ads", "contacts_photos", "other"] as const
const clean = (s: string) => s.replace(/[^\p{L}\p{M} &.'-]/gu, "").replace(/\s+/g, " ").trimStart().slice(0, 40)
// Only these names are ever written to Arkiv. A company not on the list is written as "Another company";
// whatever the person types for it stays in their message and never touches the chain, so a person's
// name cannot end up on Arkiv by mistake.
const COMPANIES = [
  "Airtel", "Jio", "Vi", "Paytm", "PhonePe", "CRED", "Bajaj Finserv", "KreditBee", "Navi", "MoneyView",
  "HDFC Bank", "ICICI Bank", "SBI", "Axis Bank", "Swiggy", "Zomato", "Flipkart", "Amazon India", "Myntra",
  "Meesho", "Blinkit", "Zepto", "BigBasket", "Nykaa", "MakeMyTrip", "Ola", "Policybazaar", "Dream11",
]
const OTHER = "Another company"

export function AnyApp({
  disabled,
  latest,
  onRecord,
  compact,
  split,
}: {
  disabled: boolean
  latest?: Declaration
  onRecord: (company: string, purpose: string) => void
  compact?: boolean
  split?: boolean
}) {
  const T = useT()
  const [company, setCompany] = useState<string>(COMPANIES[0])
  const [otherName, setOtherName] = useState("")
  const [purpose, setPurpose] = useState<string>("marketing_calls")
  const [copied, setCopied] = useState(false)
  const isOther = company === OTHER
  const display = isOther ? otherName.trim() || T.theCompany : company
  // Show the real letter once this exact withdrawal is on Arkiv; until then, a live draft of it.
  const recorded = latest && latest.company === company && latest.purpose === purpose ? latest : undefined
  const msg = recorded
    ? T.letter(display, T.anyPurpose[recorded.purpose] ?? recorded.purpose, new Date(recorded.atMs), `${DATA_EXPLORER}/entity/${recorded.key}`)
    : T.letter(display, T.anyPurpose[purpose], new Date(), T.linkPending)

  const form = (
    <div className="any-form">
      {compact ? null : <p className="ask">{T.anyIntro}</p>}
      <div className="field">
        <span>{T.companyLabel}</span>
        <Select label={T.companyLabel} value={company} onChange={setCompany} options={[...COMPANIES, OTHER].map((c) => ({ value: c, label: c === OTHER ? T.otherCompany : c }))} />
      </div>
      {isOther ? (
        <label className="field">
          <span>{T.otherName}</span>
          <input value={otherName} onChange={(e) => setOtherName(clean(e.target.value))} placeholder={T.companyHint} maxLength={40} />
          <span className="field-note">{T.otherNote}</span>
        </label>
      ) : null}
      <div className="field">
        <span>{T.purposeLabel}</span>
        <Select label={T.purposeLabel} value={purpose} onChange={setPurpose} options={ANY_PURPOSES.map((p) => ({ value: p, label: T.anyPurpose[p] }))} />
      </div>
      <button className="primary wide" disabled={disabled} onClick={() => onRecord(company, purpose)}>
        {T.recordBtn}
      </button>
      <p className="fine small">{T.anyPrivacy}</p>
    </div>
  )
  const letter = (
    <div className={`letter ${recorded ? "sent" : "draft"}`}>
      <div className="letter-head">
        <span>{recorded ? T.letterIntro(display) : T.letterDraft}</span>
        {recorded ? (
          <button className="ghost" onClick={() => navigator.clipboard?.writeText(msg).then(() => setCopied(true)).catch(() => undefined)}>
            {copied ? T.copied : T.copy}
          </button>
        ) : null}
      </div>
      <pre>{msg}</pre>
    </div>
  )
  if (split)
    return (
      <div className="any-split">
        {form}
        {letter}
      </div>
    )
  return (
    <div className="signup">
      {form}
      {letter}
    </div>
  )
}

export const RANK: Record<Item["status"], number> = { ignoring: 0, released: 1, using: 2, pending: 3, stopped: 4, ended: 5, denied: 6 }

/** Who holds your data right now: one quiet row per vendor, with the clock that matters. */
function VendorPanel({ items, clock }: { items: Item[]; clock: Clock | null }) {
  const T = useT()
  const blockMs = clock?.blockMs ?? 2000
  const secs = (blocks: bigint) => fmtDuration((Number(blocks) * blockMs) / 1000, T.units)
  return (
    <div className="vendors">
      <div className="vendors-head">
        <strong>{T.whoHas}</strong>
      </div>
      {PROCESSORS.map((v) => {
        const it = items
          .filter((i) => i.processor.toLowerCase() === v.address.toLowerCase() && i.status !== "denied")
          .sort((a, b) => RANK[a.status] - RANK[b.status] || Number(b.granted.createdAt - a.granted.createdAt))[0]
        const s = it?.status
        let state = "idle"
        let text: React.ReactNode = <span className="muted">{T.vNone}</span>
        if (s === "using") {
          state = "flow"
          text = T.vHolding
        } else if (s === "pending") {
          state = "flow"
          text = T.vPicking
        } else if (s === "stopped" && it?.ceased && it.withdrawn) {
          state = "settled"
          text = T.vStoppedIn(secs(it.ceased.createdAt - it.withdrawn.createdAt))
        } else if (s === "ignoring" && it?.withdrawn && clock) {
          state = "breach"
          text = T.vStillUsing(secs(clock.block - it.withdrawn.createdAt))
        } else if (s === "released") {
          state = "flow"
          text = T.vWaiting
        } else if (s === "ended") text = <span className="muted">{T.vEnded}</span>
        const link = it?.lease ?? it?.ceased
        return (
          <div key={v.slug} className={`vrow ${state}`}>
            <span className="vdot" />
            <div className="vname">
              <strong>{v.name}</strong>
              <span>{T.vendorBlurb[v.slug] ?? v.blurb}</span>
            </div>
            <div className="vstate">
              {text}
              {link ? (
                <a href={`${DATA_EXPLORER}/entity/${link.key}`} target="_blank" rel="noreferrer" className="vlink">
                  {T.onChain}
                </a>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** A quiet sign that the page is subscribed to Arkiv over a WebSocket. */
function LiveDot({ world }: { world: World | null }) {
  const T = useT()
  const [n, setN] = useState(0)
  useEntityEvents(() => setN((x) => x + 1))
  void world
  return (
    <span className="live" title={T.liveTitle}>
      <span className="live-dot" /> {T.live(n)}
    </span>
  )
}

const EVENT_TEXT: Record<string, string> = {
  EntityCreated: "created",
  EntityDeleted: "deleted",
  EntityPatched: "updated",
  ExpiryExtended: "extended",
  OwnershipTransferred: "transferred",
}

export function EventTicker({ world }: { world: World | null }) {
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
