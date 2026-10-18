import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Address } from "viem"
import { Check, ShieldCheck } from "lucide-react"
import { DLA_SNAPSHOT, FIDUCIARIES, MIRROR, NOTICES, PROCESSORS } from "../shared/cast"
import { Combobox, type ComboOption } from "./components/Combobox"
import { Select } from "./components/Select"
import "./components/lending.css"
import "./components/window.css"
import { answer, declare, keepDeclaration, removeDeclaration, renew, withdraw } from "../shared/actions"
import { DATA_EXPLORER, EXPLORER, searchDla, type Declaration, type Dla, type Notice } from "../shared/sayso"
import { loadPerson, loadWorld, onRelay, read, relayed, type Item, type World } from "./data"
import { fmtDuration, secondsUntil, short, useBlockClock, useEntityEvents, useFallbackPoll, useReadAt, useStreamDown, type Clock } from "./live"
import { LangContext, loadLang, saveLang, STRINGS, useT, type Cite, type Lang } from "./i18n"
import { accountFor, declSlug, ensureGas, loadDeclCount, poke, recoveryPhrase, resetIdentity, restoreIdentity, saveDeclCount, walletFor } from "./wallet"

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

  // Every "Any app" record has its own address. Read the ones this identity has used plus a few beyond,
  // so records made in another browser with the same recovery phrase are found too.
  const [declCount, setDeclCount] = useState(loadDeclCount)
  useEffect(() => setDeclCount(loadDeclCount()), [idVersion])
  const addresses = useMemo(
    () =>
      Object.fromEntries(
        [...FIDUCIARIES.map((f) => f.slug), "self", ...Array.from({ length: declCount + DECL_LOOKAHEAD }, (_, i) => declSlug(i))].map((s) => [s, accountFor(s).address]),
      ) as Record<string, Address>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [idVersion, declCount],
  )
  /** Which of this person's addresses wrote a record, so the right key can delete or extend it. */
  const slugOf = (creator: string) => Object.entries(addresses).find(([, a]) => a.toLowerCase() === creator.toLowerCase())?.[0]

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
      // A record at an address past the remembered count (made in another browser): look further.
      const used = p.declarations.map((d) => Object.entries(addresses).find(([, a]) => a.toLowerCase() === d.creator.toLowerCase())?.[0] ?? "")
      const top = Math.max(-1, ...used.filter((u) => u.startsWith("decl:")).map((u) => Number(u.slice(5))))
      setDeclCount((n) => {
        if (top + 1 <= n) return n
        saveDeclCount(top + 1)
        return top + 1
      })
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

  // Live events drive updates. A consent or lease that expires makes no event, so one read is scheduled
  // at its expiry block; the slow poll runs only while the event stream is down.
  useEffect(() => {
    refresh()
  }, [refresh])
  useFallbackPoll(refresh)
  useReadAt(refresh, items.flatMap((i) => [i.live?.expiresAt, i.lease?.expiresAt]))

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

  /** Run one write. Resolves true once it is on Arkiv, false if it failed (the error is shown). */
  async function run(label: string, fn: () => Promise<{ txHash: string }>) {
    setError(null)
    setDone(null)
    setBusy({ label, started: Date.now() })
    try {
      const r = await fn()
      setDone({ label, tx: r.txHash })
      poke()
      await refresh()
      return true
    } catch (e) {
      const err = e as Error & { shortMessage?: string; details?: string }
      console.error(err)
      ;(window as unknown as { __lastError?: string }).__lastError = err.message
      setError([(err.shortMessage ?? err.message).split("\n")[0], err.details].filter(Boolean).join(" "))
      return false
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

  // A fresh address for each record, funded with a little test gas by Say So's house wallet (the same
  // wallet funds every visitor's record addresses, so the funding does not link one person's records).
  const recordAny = (company: string, purpose: string, dla?: Dla) =>
    run(T.recording, async () => {
      const n = declCount
      const slug = declSlug(n)
      await ensureGas(accountFor(slug).address, "self")
      const r = await declare(walletFor(slug), company, purpose, dla)
      saveDeclCount(n + 1)
      setDeclCount((c) => Math.max(c, n + 1))
      return r
    })

  // Renewals and extensions done in this session, so the button says so and a second press spends no gas.
  const [extended, setExtended] = useState<Set<string>>(new Set())
  const markExtended = (key: string) => setExtended((s) => new Set(s).add(key.toLowerCase()))
  const declWallet = async (d: Declaration) => {
    const slug = slugOf(d.creator)
    if (!slug) throw new Error("This record was made by another identity. Restore its recovery phrase to manage it.")
    await ensureGas(accountFor(slug).address, "self")
    return walletFor(slug)
  }
  const deleteDecl = (d: Declaration) => run(T.deleting, async () => removeDeclaration(await declWallet(d), d))
  const keepDecl = async (d: Declaration) => {
    if (await run(T.extending, async () => keepDeclaration(await declWallet(d), d))) markExtended(d.key)
  }

  return {
    recordAny,
    deleteDecl,
    keepDecl,
    extended,
    markExtended,
    prefund,
    world, items, declarations, tab, setTab, busy, done, error, clock, lang, setLang, T, viaRelay, addresses,
    setItems, setDeclarations, setIdVersion, run, partyName, noticeFor, live,
  }
}

export type Person = ReturnType<typeof usePerson>

const DECL_LOOKAHEAD = 3

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
                onRenew={async (it) => {
                  if (await run(T.renewing(T.purpose[it.purpose] ?? it.purpose), () => renew(walletFor(it.slug), it.live!, noticeFor(it)!))) p.markExtended(it.consent)
                }}
                extended={p.extended}
                onDeleteDecl={p.deleteDecl}
                onKeepDecl={p.keepDecl}
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
            <VendorPanel items={items} clock={clock} tab={tab} />
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
  extended: Set<string>
  onDeleteDecl: (d: Declaration) => void
  onKeepDecl: (d: Declaration) => void
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
                <div key={it.consent} className={`consent ${it.status}`} data-consent={it.consent.toLowerCase()} data-slug={it.slug}>
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
                      {props.extended.has(it.consent.toLowerCase()) ? (
                        <button className="ghost done-state" disabled>
                          <Check size={14} aria-hidden /> {T.renewed}
                        </button>
                      ) : (
                        <button className="ghost" disabled={props.busy || !props.noticeFor(it)} onClick={() => props.onRenew(it)}>
                          {T.renew}
                        </button>
                      )}
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
            <DeclarationRow
              key={d.key}
              d={d}
              clock={props.clock}
              busy={props.busy}
              extended={props.extended.has(d.key.toLowerCase())}
              onDelete={() => props.onDeleteDecl(d)}
              onKeep={() => props.onKeepDecl(d)}
            />
          ))}
        </div>
      ) : null}
      <Recovery onNew={props.onNew} />
    </div>
  )
}

/** One "Any app" record: what it says, its own address, and the owner's two controls over it. */
function DeclarationRow(props: { d: Declaration; clock: Clock | null; busy: boolean; extended: boolean; onDelete: () => void; onKeep: () => void }) {
  const { d } = props
  const T = useT()
  const hindi = T === STRINGS.hi
  const [confirm, setConfirm] = useState(false)
  const left = props.clock ? secondsUntil(props.clock, d.expiresAt) : null
  return (
    <div className="consent released decl">
      <div className="consent-row">
        <span className="consent-title">
          {d.company}
          {d.lender ? <span className="muted"> · {T.lenderLabel}: {d.lender}</span> : null}
        </span>
        <span className="pill released">{T.status.released}</span>
      </div>
      <div className="consent-meta">
        {T.anyPurpose[d.purpose] ?? d.purpose} · {new Date(d.atMs).toLocaleString(hindi ? "hi-IN" : "en-IN", { dateStyle: "medium", timeStyle: "short" })} ·{" "}
        <a href={`${DATA_EXPLORER}/entity/${d.key}`} target="_blank" rel="noreferrer">
          {T.record}
        </a>
      </div>
      <div className="consent-meta">
        <a href={`${DATA_EXPLORER}/owner/${d.creator}`} target="_blank" rel="noreferrer">
          {T.ownAddress} {short(d.creator)}
        </a>
        {left !== null && left > 0 ? <> · {T.keptUntil(endDate(left, hindi))}</> : null}
      </div>
      {confirm ? <p className="fine small decl-warn">{T.deleteWarn}</p> : null}
      <div className="consent-actions">
        {props.extended ? (
          <button className="ghost done-state" disabled>
            <Check size={14} aria-hidden /> {T.extended}
          </button>
        ) : (
          <button className="ghost" disabled={props.busy} title={T.keepLongerTitle} onClick={props.onKeep}>
            {T.keepLonger}
          </button>
        )}
        <button
          className={confirm ? "ghost danger" : "ghost"}
          disabled={props.busy}
          onClick={() => {
            if (!confirm) return setConfirm(true)
            setConfirm(false)
            props.onDelete()
          }}
        >
          {confirm ? T.deleteConfirm : T.deleteRecord}
        </button>
      </div>
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
// A loan app from RBI's directory gets the purposes the RBI's digital lending rules give borrowers a say over.
const LOAN_PURPOSES = ["beyond_loan", "third_party_sharing", "phone_access", "marketing_calls"] as const
const clean = (s: string) => s.replace(/[^\p{L}\p{M} &.'-]/gu, "").replace(/\s+/g, " ").trimStart().slice(0, 40)
// Only these names are ever written to Arkiv. A company not on the list is written as "Another company";
// whatever the person types for it stays in their message and never touches the chain, so a person's
// name cannot end up on Arkiv by mistake. Loan apps from RBI's directory are the other names allowed.
const COMPANIES = [
  "Airtel", "Jio", "Vi", "Paytm", "PhonePe", "CRED", "Bajaj Finserv", "KreditBee", "Navi", "MoneyView",
  "HDFC Bank", "ICICI Bank", "SBI", "Axis Bank", "Swiggy", "Zomato", "Flipkart", "Amazon India", "Myntra",
  "Meesho", "Blinkit", "Zepto", "BigBasket", "Nykaa", "MakeMyTrip", "Ola", "Policybazaar", "Dream11",
]
const OTHER = "Another company"

/** One app name from RBI's directory, with every lender it is listed under. */
type LoanApp = { name: string; lenders: Dla[] }
type Choice = { kind: "list"; name: string } | { kind: "other" } | { kind: "loan"; app: LoanApp; lender: Dla | null } | null

const tidy = (s: string) => s.trim().replace(/\s+/g, " ")
// The directory has a few placeholder rows ("0", "1", "NA"); they are not apps.
const junk = (s: string) => !/\p{L}/u.test(s) || /^n\s*\/?\s*a\.?$/i.test(s)

/** Group directory rows by app name, ignoring case, and keep one row per lender. */
function groupApps(rows: Dla[], query: string): LoanApp[] {
  const by = new Map<string, Dla[]>()
  for (const r of rows) {
    const name = tidy(r.app)
    if (junk(name) || !r.lender || paymentsBank(r)) continue
    const k = name.toLowerCase()
    by.set(k, [...(by.get(k) ?? []), r])
  }
  const q = query.trim().toLowerCase()
  return [...by.values()]
    .map((rs) => {
      // Spelling varies ("Kreditbee", "KreditBee"); show the one RBI's list uses most.
      const counts = new Map<string, number>()
      rs.forEach((r) => counts.set(tidy(r.app), (counts.get(tidy(r.app)) ?? 0) + 1))
      const name = [...counts].sort((a, b) => b[1] - a[1])[0][0]
      const lenders = new Map<string, Dla>()
      rs.forEach((r) => lenders.has(tidy(r.lender).toLowerCase()) || lenders.set(tidy(r.lender).toLowerCase(), r))
      return { name, lenders: orderLenders(name, [...lenders.values()]) }
    })
    .sort(
      (a, b) =>
        Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)) || a.name.length - b.name.length || a.name.localeCompare(b.name),
    )
}

// Words too common in app and lender names to say anything about a match.
const COMMON = new Set(["loan", "loans", "credit", "cash", "money", "finance", "financial", "fin", "india", "rupee", "rupees", "instant", "quick", "easy", "my", "the", "mobile", "app", "bank", "pay", "personal", "digital", "capital"])

/**
 * Alphabetical, except that lenders whose name contains the app's first distinctive word come first
 * ("Navi" puts "Navi Finserv" on top). A shared word is only a hint for finding your lender faster;
 * it does not mean the two are related. The Key Facts Statement is what names the lender.
 */
function orderLenders(app: string, lenders: Dla[]) {
  const first = app.toLowerCase().split(/[^\p{L}\p{N}]+/u).find((w) => w.length >= 3 && !COMMON.has(w))
  const near = (l: Dla) => !!first && l.lender.toLowerCase().split(/[^\p{L}\p{N}]+/u).includes(first)
  return lenders.sort((a, b) => Number(near(b)) - Number(near(a)) || a.lender.localeCompare(b.lender))
}

type Search = { q: string; apps: LoanApp[]; loading: boolean; error: boolean }

/** Search the RBI directory mirrored on Arkiv, 250 ms after the person stops typing. Reads fall back to the relay like every other read. */
function useDlaSearch(text: string): Search {
  const [state, setState] = useState<Search>({ q: "", apps: [], loading: false, error: false })
  useEffect(() => {
    const q = text.trim()
    if (q.length < 2) {
      setState({ q, apps: [], loading: false, error: false })
      return
    }
    setState((s) => ({ ...s, loading: true, error: false }))
    let alive = true
    const t = setTimeout(() => {
      read(() => searchDla(q, MIRROR.address, 40))
        .then((rows) => alive && setState({ q, apps: groupApps(rows, q), loading: false, error: false }))
        .catch((e) => {
          console.warn("RBI directory search", e)
          if (alive) setState({ q, apps: [], loading: false, error: true })
        })
    }, 250)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [text])
  return state
}

/**
 * Which Directions to cite. Since 28 Nov 2025 every kind of lender has its own Credit Facilities
 * Directions, 2025, all with the same paragraph numbers: 13(1) phone access, 13(2) consent, 13(4)
 * third-party sharing, 12(4) escalation after 30 days. RBI's directory only says "BANK", so the kind of
 * bank comes from its name (this sorts every bank in the 17 Oct 2026 snapshot correctly; note "Central
 * Bank of India" is a commercial bank, while a "Central Co-operative Bank" is a rural co-operative one).
 */
export function citeFor(d: Pick<Dla, "lender" | "lenderType">): Cite {
  const paras = { consent: "13(2)", share: "13(4)", phone: "13(1)", griev: "12(4)" }
  if (d.lenderType.toUpperCase() !== "BANK") return { kind: "nbfc", ...paras }
  const n = d.lender
  const kind: Cite["kind"] = /small finance/i.test(n)
    ? "sfb"
    : /central co-?\s?operative|apex/i.test(n)
      ? "rcb"
      : /gramin|grameen|regional rural/i.test(n)
        ? "rrb"
        : /local area/i.test(n)
          ? "lab"
          : /co-?\s?op|sahakari|\bsah\b|nagrik|urban/i.test(n)
            ? "ucb"
            : "cb"
  return { kind, ...paras }
}
/** Payments banks cannot lend, so a payments bank listed as a lender is left out rather than given the wrong rules. */
const paymentsBank = (d: Dla) => d.lenderType.toUpperCase() === "BANK" && /payments bank/i.test(d.lender)

const snapshotDate = (iso: string, hindi: boolean) => {
  const d = new Date(`${iso || DLA_SNAPSHOT}T12:00:00+05:30`)
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(hindi ? "hi-IN" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })
}

export function AnyApp({
  disabled,
  latest,
  onRecord,
  compact,
  split,
}: {
  disabled: boolean
  latest?: Declaration
  onRecord: (company: string, purpose: string, dla?: Dla) => void
  compact?: boolean
  split?: boolean
}) {
  const T = useT()
  const hindi = T === STRINGS.hi
  const [choice, setChoice] = useState<Choice>({ kind: "list", name: COMPANIES[0] })
  const [text, setText] = useState(COMPANIES[0])
  // True once the person types; until then the box shows the picked name and the full list.
  const [typed, setTyped] = useState(false)
  const [otherName, setOtherName] = useState("")
  const [notListed, setNotListed] = useState(false)
  const [picked, setPurpose] = useState<string>("marketing_calls")
  const [copied, setCopied] = useState(false)

  const query = typed ? text : ""
  const search = useDlaSearch(query)
  const q = query.trim().toLowerCase()
  const fresh = search.q === query.trim() && !search.loading
  const loanNames = new Set(search.apps.map((a) => a.name.toLowerCase()))
  const local = COMPANIES.filter((c) => !q || c.toLowerCase().includes(q)).filter((c) => !loanNames.has(c.toLowerCase()))
  const typedName = clean(text).trim()
  const nothing = q.length >= 2 && fresh && !search.error && search.apps.length === 0 && local.length === 0

  const options: ComboOption[] = [
    ...local.map((c) => ({ id: `co:${c}`, label: c })),
    ...search.apps.slice(0, 12).map((a) => ({
      id: `dla:${a.name.toLowerCase()}`,
      label: a.name,
      hint: `${T.rbiListed} · ${a.lenders.length === 1 ? a.lenders[0].lender : T.lenderCount(a.lenders.length)}`,
    })),
    q && typedName ? { id: "other", label: T.otherTyped(typedName), hint: T.otherTypedHint } : { id: "other", label: T.otherCompany },
  ]
  const selected =
    choice?.kind === "list" ? `co:${choice.name}` : choice?.kind === "loan" ? `dla:${choice.app.name.toLowerCase()}` : choice?.kind === "other" ? "other" : undefined

  const onPick = (o: ComboOption) => {
    setTyped(false)
    setCopied(false)
    if (o.id === "other") {
      if (q && typedName) setOtherName(typedName)
      setNotListed(nothing)
      setChoice({ kind: "other" })
      setText(q && typedName ? typedName : T.otherCompany.replace(/…$/, ""))
    } else if (o.id.startsWith("dla:")) {
      const app = search.apps.find((a) => `dla:${a.name.toLowerCase()}` === o.id)!
      setChoice({ kind: "loan", app, lender: app.lenders.length === 1 ? app.lenders[0] : null })
      setText(app.name)
    } else {
      setChoice({ kind: "list", name: o.label })
      setText(o.label)
    }
  }

  const loan = choice?.kind === "loan" ? choice : null
  const lender = loan?.lender ?? null
  const purposes: readonly string[] = loan ? LOAN_PURPOSES : ANY_PURPOSES
  const purpose = purposes.includes(picked) ? picked : purposes[0]
  const company = choice?.kind === "list" ? choice.name : choice?.kind === "other" ? OTHER : loan ? loan.app.name : ""
  const display = choice?.kind === "other" ? otherName.trim() || T.theCompany : company || T.theCompany
  const ready = !!choice && (!loan || !!lender)

  // Show the real letter once this exact withdrawal is on Arkiv; until then, a live draft of it.
  const recorded =
    ready && latest && latest.company === company && latest.purpose === purpose && (lender ? latest.dla?.toLowerCase() === lender.key.toLowerCase() : !latest.dla)
      ? latest
      : undefined
  const when = recorded ? new Date(recorded.atMs) : new Date()
  const link = recorded ? `${DATA_EXPLORER}/entity/${recorded.key}` : T.linkPending
  const typeLabel = (d: Dla) => T.lenderTypes[d.lenderType.toUpperCase()] ?? d.lenderType
  let msg: string
  if (loan) {
    // Before a lender is picked, draft with the citation all of this app's lenders share (NBFC if they differ).
    const kinds = new Set(loan.app.lenders.map((l) => citeFor(l).kind))
    const cite = lender ? citeFor(lender) : kinds.size === 1 ? citeFor(loan.app.lenders[0]) : citeFor({ lender: "", lenderType: "NBFC" })
    msg = T.loanLetter({ app: loan.app.name, lender: lender?.lender ?? T.yourLender, purposeCode: purpose, purpose: T.anyPurpose[purpose] ?? purpose, when, link, cite })
  } else msg = T.letter(display, T.anyPurpose[purpose] ?? purpose, when, link)

  const status = search.loading ? (
    <>
      <span className="spinner" /> {T.searching}
    </>
  ) : search.error && q.length >= 2 ? (
    <span className="err">{T.searchFailed}</span>
  ) : null
  const notListedHint = (
    <>
      {T.notListedA}
      <a href="https://sachet.rbi.org.in" target="_blank" rel="noreferrer">
        sachet.rbi.org.in
      </a>
      {T.notListedB}
      <a href="tel:1930">1930</a>
      {T.notListedC}
    </>
  )

  const form = (
    <div className="any-form">
      {compact ? null : <p className="ask">{T.anyIntro}</p>}
      <div className="field">
        <span>{T.companyLabel}</span>
        <Combobox
          label={T.companyLabel}
          text={text}
          onText={(t) => {
            setText(t.slice(0, 60))
            setTyped(true)
            setChoice(null)
            setCopied(false)
          }}
          options={options}
          selected={selected}
          onPick={onPick}
          placeholder={T.searchPlaceholder}
          status={status}
          footer={nothing ? notListedHint : null}
        />
        {!choice ? <span className="field-note">{T.pickFromList}</span> : null}
      </div>
      {loan ? (
        <>
          {loan.app.lenders.length > 1 ? (
            <div className="field">
              <span>{T.lenderLabel}</span>
              <Select
                label={T.lenderLabel}
                value={lender?.key ?? ""}
                onChange={(k) => setChoice({ ...loan, lender: loan.app.lenders.find((l) => l.key === k) ?? null })}
                options={[{ value: "", label: T.pickLender }, ...loan.app.lenders.map((l) => ({ value: l.key, label: `${l.lender} (${typeLabel(l)})` }))]}
              />
              <span className="field-note">{T.lenderNote(loan.app.lenders.length)}</span>
            </div>
          ) : null}
          <div className="dla-box">
            <span className="dla-line">
              <ShieldCheck size={15} aria-hidden />
              <span>
                <strong>{T.inDirectory}</strong>
                {lender ? <> · {T.lenderIs(lender.lender, typeLabel(lender))}</> : null}
              </span>
            </span>
            <span className="dla-src">
              {T.sourceA(snapshotDate((lender ?? loan.app.lenders[0]).snapshot, hindi))}
              <a href="https://www.rbi.org.in" target="_blank" rel="noreferrer">
                {T.rbiHome}
              </a>
            </span>
          </div>
        </>
      ) : null}
      {choice?.kind === "other" ? (
        <>
          <label className="field">
            <span>{T.otherName}</span>
            <input value={otherName} onChange={(e) => setOtherName(clean(e.target.value))} placeholder={T.companyHint} maxLength={40} />
            <span className="field-note">{T.otherNote}</span>
          </label>
          {notListed ? <p className="dla-warn">{notListedHint}</p> : null}
        </>
      ) : null}
      <div className="field">
        <span>{T.purposeLabel}</span>
        <Select label={T.purposeLabel} value={purpose} onChange={setPurpose} options={purposes.map((p) => ({ value: p, label: T.anyPurpose[p] }))} />
      </div>
      <button className="primary wide" disabled={disabled || !ready} onClick={() => ready && onRecord(company, purpose, lender ?? undefined)}>
        {T.recordBtn}
      </button>
      {loan && !lender ? <p className="fine small">{T.pickLenderFirst}</p> : null}
      <p className="fine small">{loan ? T.loanPrivacy : T.anyPrivacy}</p>
    </div>
  )
  const letter = (
    <div className={`letter ${recorded ? "sent" : "draft"}`}>
      <div className="letter-head">
        <span>{recorded ? (lender ? T.loanLetterIntro(lender.lender) : T.letterIntro(display)) : T.letterDraft}</span>
        {recorded ? (
          <button className="ghost" onClick={() => navigator.clipboard?.writeText(msg).then(() => setCopied(true)).catch(() => undefined)}>
            {copied ? T.copied : T.copy}
          </button>
        ) : null}
      </div>
      <pre>{msg}</pre>
      {recorded && lender ? (
        <p className="letter-next">
          {T.escalateOn(
            new Date(recorded.atMs + 30 * 864e5).toLocaleDateString(hindi ? "hi-IN" : "en-IN", { dateStyle: "long", timeZone: "Asia/Kolkata" }),
          )}
          {lender.url ? (
            <>
              {" "}
              <a href={lender.url} target="_blank" rel="noreferrer">
                {T.appLink}
              </a>
            </>
          ) : null}
        </p>
      ) : null}
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

/**
 * Who holds your data right now: one quiet row per vendor, with the clock that matters. A vendor's state
 * comes only from consents given to the company it works for, so a Bazaarline withdrawal never shows up
 * on Rupeeleaf. On a company's tab only its vendors show; elsewhere they are grouped by company.
 */
function VendorPanel({ items, clock, tab }: { items: Item[]; clock: Clock | null; tab: Tab }) {
  const T = useT()
  const blockMs = clock?.blockMs ?? 2000
  const secs = (blocks: bigint) => fmtDuration((Number(blocks) * blockMs) / 1000, T.units)
  const one = FIDUCIARIES.find((f) => f.slug === tab)
  const companies = one ? [one] : FIDUCIARIES
  const row = (slug: string, v: (typeof PROCESSORS)[number]) => {
    const it = items
      .filter((i) => i.slug === slug && i.processor.toLowerCase() === v.address.toLowerCase() && i.status !== "denied")
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
      <div key={`${slug}:${v.slug}`} className={`vrow ${state}`} data-vendor={v.slug} data-company={slug}>
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
  }
  return (
    <div className="vendors">
      <div className="vendors-head">
        <strong>{T.whoHas}</strong>
        {one ? <span className="muted"> · {T.via(one.name)}</span> : null}
      </div>
      {companies.map((f) => {
        // The company's own notices name its vendors, in the order it asks.
        const vendors = [...new Set(NOTICES[f.slug].map((n) => n.processor))].map((slug) => PROCESSORS.find((v) => v.slug === slug)!).filter(Boolean)
        return [
          one ? null : (
            <div key={`h:${f.slug}`} className="vgroup">
              <span className={`logo small ${f.slug}`}>{f.name[0]}</span> {T.via(f.name)}
            </div>
          ),
          ...vendors.map((v) => row(f.slug, v)),
        ]
      })}
    </div>
  )
}

/** A quiet sign that the page is subscribed to Arkiv over a WebSocket. */
function LiveDot({ world }: { world: World | null }) {
  const T = useT()
  const [n, setN] = useState(0)
  useEntityEvents(() => setN((x) => x + 1))
  const down = useStreamDown()
  void world
  return (
    <span className={`live ${down ? "down" : ""}`} title={down ? T.reconnectingTitle : T.liveTitle}>
      <span className="live-dot" /> {down ? T.reconnecting : T.live(n)}
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
