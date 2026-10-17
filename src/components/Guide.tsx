// A guided walkthrough over the live demo. A pointer glides to the next thing to do, pulses on it, and a
// bubble says what is happening and why. It waits for the visitor to act, then moves on. Every step is a
// real Arkiv transaction made by the visitor; the guide only points.
import { AnimatePresence, motion } from "motion/react"
import { ArrowRight, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState, type RefObject } from "react"
import { FIDUCIARIES, PROCESSORS } from "../../shared/cast"
import { STRINGS } from "../i18n"
import type { Item } from "../data"
import type { Person } from "../person"
import "./guide.css"

/** What the visitor had when the current step began, so a step counts only what they do during it. */
type Base = { granted: number; withdrawn: number; pick?: string }
type Ctx = { p: Person; root: HTMLElement; base?: Base }
const snapshot = (p: Person): Base => ({
  granted: p.items.filter((i) => i.status !== "denied").length,
  withdrawn: p.items.filter((i) => i.withdrawn).length,
  pick: toWithdraw(p)?.consent,
})
type Text = string | ((c: Ctx) => string)

type Step = {
  target: (c: Ctx) => HTMLElement | null
  /** Where the pointer goes inside the target (a checkbox, say), instead of over the target's text. */
  point?: string
  title: Text
  text: Text
  /** True once the visitor has done what this step asks. */
  done: (c: Ctx) => boolean
  /** Steps that only explain wait for "Next" (enabled once `done`); action steps advance by themselves. */
  info?: boolean
  waiting?: Text
  /** Shown while the visitor's own transaction or the vendors are working, so the wait never looks stuck. */
  busyText?: string
  side?: "left" | "right" | "below"
  /** Never scroll to this target: the visitor is still working just above it. */
  stay?: boolean
}

const STORE = "sayso.guide.v1"
const remembered = () => {
  try {
    return localStorage.getItem(STORE)
  } catch {
    return null
  }
}
const remember = (v: "done" | "skipped") => {
  try {
    localStorage.setItem(STORE, v)
  } catch {
    /* storage blocked: the guide simply shows again next time */
  }
}

const q = (sel: string) => (c: Ctx) => c.root.querySelector(sel) as HTMLElement | null
const has = (p: Person, s: string[]) => p.items.some((i) => s.includes(i.status))
const en = STRINGS.en
const name = (purpose: string) => en.purpose[purpose] ?? purpose
const vendor = (a: string) => PROCESSORS.find((v) => v.address.toLowerCase() === a.toLowerCase())
const company = (slug: string) => FIDUCIARIES.find((f) => f.slug === slug)?.name ?? slug

/** Requests the visitor has not answered yet, per demo company. */
const openFor = (p: Person, slug: string) => (p.world?.notices[slug] ?? []).filter((n) => !p.items.some((i) => i.slug === slug && i.purpose === n.purpose && i.live))
/** The company whose request the guide starts on: the open tab if it still has questions, else the first that does. */
const askingSlug = (p: Person) => {
  const tab = FIDUCIARIES.find((f) => f.slug === p.tab && openFor(p, f.slug).length)
  return (tab ?? FIDUCIARIES.find((f) => openFor(p, f.slug).length))?.slug ?? null
}

/**
 * The consent the guide asks the visitor to withdraw: one they actually granted, at the company they
 * answered last. SMS offers first, because its vendor never stops and that is the point of the demo;
 * otherwise loan servicing, otherwise whatever they gave.
 */
const toWithdraw = (p: Person): Item | undefined => {
  const all = p.items.filter((i) => i.live)
  const latest = [...all].sort((a, b) => Number(b.granted.createdAt - a.granted.createdAt))[0]
  const live = all.filter((i) => i.slug === latest?.slug)
  return live.find((i) => i.purpose === "marketing") ?? live.find((i) => i.purpose === "loan_servicing") ?? live[0]
}
/** The consent chosen when the step began, so the text and target do not jump while the withdrawal lands. */
const picked = (c: Ctx) => c.p.items.find((i) => i.consent === c.base?.pick) ?? toWithdraw(c.p)

/** The withdrawal the visitor made most recently. */
const lastWithdrawn = (p: Person): Item | undefined =>
  p.items.filter((i) => i.withdrawn).sort((a, b) => Number(b.withdrawn!.createdAt - a.withdrawn!.createdAt))[0]

const STEPS: Step[] = [
  {
    target: q(".win-main .notice"),
    point: "input",
    title: (c) => `${company(askingSlug(c.p) ?? "rupeeleaf")} asks for your data`,
    text: (c) => {
      const slug = askingSlug(c.p) ?? "rupeeleaf"
      const n = openFor(c.p, slug).length
      const words = ["no", "one", "two", "three", "four", "five"]
      return n === 1
        ? `${company(slug)} wants one more permission, and it isn't ticked for you. Tick it if you'd agree.`
        : `${company(slug)} wants ${words[n] ?? n} separate permissions, and nothing is ticked for you. Tick the ones you'd agree to.`
    },
    done: (c) => !!c.root.querySelector(".win-main .notice.picked"),
    side: "right",
  },
  {
    target: q(".win-main .primary.wide"),
    title: "Say yes",
    // The visitor may still be ticking boxes. Scrolling now would move a checkbox out from under their
    // finger and the tap would land on something else, so this step only points.
    stay: true,
    text: "One tap writes each consent you ticked, and a receipt for every answer, to Arkiv. It's signed by a wallet that lives only in this browser.",
    done: (c) => c.p.items.some((i) => i.live) && c.p.items.filter((i) => i.status !== "denied").length > (c.base?.granted ?? 0),
    busyText: "Writing your answers to Arkiv",
    side: "right",
  },
  {
    target: q(".win-right"),
    title: "Your data starts moving",
    text: "The company's vendors pick up your consent. Each takes a lease that ends when your consent does. Today, only the company would ever know this.",
    done: (c) => has(c.p, ["using", "stopped", "ignoring", "released"]),
    info: true,
    waiting: "The vendors are reading your consent from Arkiv",
    side: "left",
  },
  {
    target: (c) => [...c.root.querySelectorAll(".win-side button")].at(-1) as HTMLElement | null,
    title: "Your consents live here",
    text: "Open My consents to see every permission you've given, who holds it, and when it ends.",
    done: (c) => c.p.tab === "mine",
    side: "right",
  },
  {
    target: (c) => {
      const it = picked(c)
      return it ? (c.root.querySelector(`.win-main .consent[data-consent="${it.consent.toLowerCase()}"] .stop`) as HTMLElement | null) : null
    },
    title: "Change your mind",
    text: (c) => {
      const it = picked(c)
      return `Withdraw ${it ? `${name(it.purpose)} for ${company(it.slug)}` : "a consent"}. It's one tap: your consent is deleted and a withdrawal receipt is written in the same transaction.`
    },
    done: (c) => c.p.items.filter((i) => i.withdrawn).length > (c.base?.withdrawn ?? 0),
    busyText: "Deleting your consent and writing the receipt",
    side: "right",
  },
  {
    // The vendor row for the consent just withdrawn, so a phone shows the row that changes.
    target: (c) => {
      const w = lastWithdrawn(c.p)
      const v = w && vendor(w.processor)
      const row = v ? (c.root.querySelector(`.win-right .vrow[data-company="${w!.slug}"][data-vendor="${v.slug}"]`) as HTMLElement | null) : null
      return row && window.innerWidth < SMALL ? row : (c.root.querySelector(".win-right") as HTMLElement | null)
    },
    title: "Who actually stopped?",
    text: (c) => {
      const w = lastWithdrawn(c.p)
      const v = w && vendor(w.processor)
      const sms = c.p.items.find((i) => i.live && i.purpose === "marketing")
      if (!v || !v.honest) {
        const next = c.p.items.find((i) => i.live && i.consent !== w?.consent)
        const tryNext = next ? ` Try withdrawing ${name(next.purpose)} for ${company(next.slug)} too.` : ""
        return `Honest vendors sign a stop note within seconds. ${v?.name ?? "Pingwave"} never answers, so its clock keeps running, in public.${tryNext}`
      }
      return `Honest vendors like ${v.name} sign a stop note within seconds, so the clock stops. Pingwave, the SMS vendor, never answers.${
        sms ? ` Withdraw SMS offers for ${company(sms.slug)} and watch its clock keep running, in public.` : " Its clocks keep running on the cease board, in public."
      }`
    },
    done: (c) => ["stopped", "ignoring"].includes(lastWithdrawn(c.p)?.status ?? ""),
    info: true,
    waiting: (c) => {
      const v = lastWithdrawn(c.p) && vendor(lastWithdrawn(c.p)!.processor)
      return v ? `${v.name} is reading your withdrawal` : "The vendors are reading your withdrawal"
    },
    side: "left",
  },
]

/** Steps 5 and 6 need a consent to withdraw. Without one (all said no, or it already ended), there is nothing to show. */
const blocked = (i: number, p: Person) => i === 4 && !toWithdraw(p) && !has(p, ["stopped", "ignoring", "released"])

const resolve = (t: Text | undefined, c: Ctx | null) => (typeof t === "function" ? (c ? t(c) : "") : (t ?? ""))

type Box = { x: number; y: number; w: number; h: number; px: number; py: number }

const SMALL = 700

export function Guide({ p, root }: { p: Person; root: RefObject<HTMLDivElement | null> }) {
  // A visitor who finished or closed the guide is not walked through it again on every reload.
  const [on, setOn] = useState(() => !remembered())
  const [i, setI] = useState<number | null>(null)
  const [box, setBox] = useState<Box | null>(null)
  const [finished, setFinished] = useState(false)
  const started = useRef(false)
  const [small, setSmall] = useState(() => typeof window !== "undefined" && window.innerWidth < SMALL)

  // Where to begin from what the visitor has already done.
  const startAt = useCallback((x: Person) => {
    if (has(x, ["stopped", "ignoring", "released"]) && !toWithdraw(x)) return 5
    if (x.items.some((it) => it.live)) return 3
    return 0
  }, [])

  useEffect(() => {
    if (started.current || !p.world || !on) return
    started.current = true
    const at = startAt(p)
    const slug = askingSlug(p)
    if (at === 0 && slug && p.tab !== slug) p.setTab(slug as Parameters<Person["setTab"]>[0])
    setI(at)
  }, [p, on, startAt])

  const step = i !== null && i < STEPS.length ? STEPS[i] : null

  const finish = useCallback(() => {
    setFinished(true)
    remember("done")
  }, [])

  // Follow the target as the page or pane scrolls and the layout changes. Measured at most once per
  // animation frame, and state only changes when the box actually moved, so an idle page does no work.
  const last = useRef<Box | null>(null)
  const frame = useRef(0)
  const pRef = useRef(p)
  pRef.current = p
  const measure = useCallback(() => {
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      const r = root.current
      setSmall(window.innerWidth < SMALL)
      const el = r && step ? step.target({ p: pRef.current, root: r }) : null
      let next: Box | null = null
      if (r && el) {
        const a = r.getBoundingClientRect()
        const b = el.getBoundingClientRect()
        const pt = step?.point ? (el.querySelector(step.point) as HTMLElement | null)?.getBoundingClientRect() : null
        next = {
          x: Math.round(b.left - a.left),
          y: Math.round(b.top - a.top),
          w: Math.round(b.width),
          h: Math.round(b.height),
          px: pt ? Math.round(pt.left - a.left + pt.width / 2) : -1,
          py: pt ? Math.round(pt.top - a.top + pt.height / 2) : -1,
        }
      }
      const prev = last.current
      if (prev === next || (prev && next && (Object.keys(next) as (keyof Box)[]).every((k) => prev[k] === next![k]))) return
      last.current = next
      setBox(next)
    })
  }, [root, step])
  useEffect(() => {
    const r = root.current
    measure()
    const pane = r?.querySelector(".win-main")
    const ro = new ResizeObserver(measure)
    if (r) ro.observe(r)
    window.addEventListener("resize", measure, { passive: true })
    pane?.addEventListener("scroll", measure, { passive: true })
    // Tab switches and new cards change the DOM without resizing anything; a slow check covers them.
    const id = window.setInterval(measure, 700)
    return () => {
      ro.disconnect()
      window.removeEventListener("resize", measure)
      pane?.removeEventListener("scroll", measure)
      clearInterval(id)
      cancelAnimationFrame(frame.current)
    }
  }, [measure, root, p.tab, p.items])

  const base = useRef<{ i: number | null; b: Base }>({ i: null, b: { granted: 0, withdrawn: 0 } })
  if (base.current.i !== i) base.current = { i, b: snapshot(p) }
  const ctx = root.current ? { p, root: root.current, base: base.current.b } : null

  // Action steps advance as soon as they are done. Explain-only steps wait for "Next", so the visitor
  // has time to read what just happened (the result often lands within a second).
  const ok = !!(step && ctx && step.done(ctx))
  useEffect(() => {
    if (!on || !step || !ok || step.info) return
    const t = setTimeout(() => setI((x) => (x === null ? x : x + 1 >= STEPS.length ? (finish(), x + 1) : x + 1)), 400)
    return () => clearTimeout(t)
  }, [on, step, ok, finish])

  // Step 1 needs a company with questions left. The visitor's answers may arrive after the step began,
  // so follow them: move to a company that still asks, or end the tour if none does.
  const asking = on && i === 0 && p.world ? askingSlug(p) : undefined
  useEffect(() => {
    const x = pRef.current
    if (asking === undefined || !FIDUCIARIES.some((f) => f.slug === x.tab)) return
    if (asking && asking !== x.tab) x.setTab(asking as Parameters<Person["setTab"]>[0])
    if (asking === null) {
      const t = setTimeout(() => setI(pRef.current.items.some((y) => y.live) ? 3 : STEPS.length), 1500)
      return () => clearTimeout(t)
    }
  }, [asking, p.tab])

  // Nothing left to withdraw: skip the withdrawal steps instead of pointing at a button that is not there.
  const stuck = on && i !== null && blocked(i, p)
  useEffect(() => {
    if (!stuck) return
    const t = setTimeout(finish, 1500)
    return () => clearTimeout(t)
  }, [stuck, finish])

  // A seconds counter for anything we are waiting on, so a wait never looks frozen.
  const waitingNow = !!step && !ok && (!!p.busy || !!step.info)
  const [since, setSince] = useState(0)
  const [, tick] = useState(0)
  useEffect(() => {
    if (!waitingNow) return
    setSince(Date.now())
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [waitingNow, i, p.busy])
  const secs = waitingNow && since ? Math.max(0, Math.round((Date.now() - since) / 1000)) : 0

  // Keep the target in view. On a wide screen it scrolls only the app's own pane, never the page. On a
  // phone the page itself scrolls, so after the visitor's first action the next target is brought up
  // below the sticky header, clear of the bubble docked at the bottom.
  const firstStep = useRef<number | null>(null)
  useEffect(() => {
    const r = root.current
    if (!r || !step || i === null) return
    if (firstStep.current === null) firstStep.current = i
    if (step.stay) return
    const el = step.target({ p: pRef.current, root: r })
    if (!el) return
    if (window.innerWidth < SMALL) {
      if (i === firstStep.current) return
      const b = el.getBoundingClientRect()
      const top = 96
      const bottom = window.innerHeight - 190
      if (b.top < top || b.top > bottom) window.scrollTo({ top: Math.max(0, window.scrollY + b.top - top), behavior: "smooth" })
      return
    }
    const pane = el.closest(".win-main") as HTMLElement | null
    if (pane) {
      const top = el.offsetTop - pane.offsetTop
      if (top < pane.scrollTop || top > pane.scrollTop + pane.clientHeight - 80) pane.scrollTo({ top: Math.max(0, top - 80), behavior: "smooth" })
    }
  }, [i, root, step, p.tab])

  // On a phone the bubble is docked to the bottom of the screen; hide it while the demo is off screen.
  const [inView, setInView] = useState(true)
  useEffect(() => {
    const r = root.current
    if (!r) return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: "-80px 0px -120px 0px" })
    io.observe(r)
    return () => io.disconnect()
  }, [root])

  const next = () => {
    if (i === null) return
    if (i + 1 >= STEPS.length) finish()
    setI(i + 1)
  }
  const skip = () => {
    remember("skipped")
    setOn(false)
  }
  const replay = () => {
    started.current = true
    firstStep.current = null
    setFinished(false)
    // From the top on a company that still has questions; otherwise from where the visitor is. Someone
    // with nothing left to answer or withdraw has seen it all ("Start over as a new person" under My
    // consents gives them a clean run).
    const slug = askingSlug(p)
    const at = slug ? 0 : startAt(p)
    if (at === 0 && slug && p.tab !== slug) p.setTab(slug as Parameters<Person["setTab"]>[0])
    setI(at === 0 && !slug ? STEPS.length : at)
    setOn(true)
  }

  if (!on) {
    return (
      <button className="guide-restart" onClick={replay}>
        Show me around
      </button>
    )
  }
  if (finished || (i !== null && i >= STEPS.length)) {
    return (
      <motion.div className="guide-done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div>
          <strong>That's Say So.</strong> Consent you own, and stops anyone can check. Every vendor's record is on the cease board.
        </div>
        <div className="guide-done-actions">
          <a className="btn outline small" href="/board">
            Open the cease board
          </a>
          <button className="btn dark small" onClick={() => setOn(false)}>
            Done
          </button>
        </div>
      </motion.div>
    )
  }
  if (!step || !box) return null

  // Bubble placement: beside the target when there is room, otherwise below it. On a phone there is
  // never room beside it, and below it would cover the very cards the visitor is reading, so the
  // bubble docks to the bottom of the screen instead.
  const W = root.current?.clientWidth ?? 1000
  const bw = Math.min(300, W - 24)
  let side: "left" | "right" | "below" | "dock" = step.side ?? "right"
  if (side === "right" && box.x + box.w + 16 + bw > W) side = box.x - 16 - bw > 0 ? "left" : "below"
  if (side === "left" && box.x - 16 - bw < 0) side = "below"
  if (small) side = "dock"
  const bx = side === "right" ? box.x + box.w + 16 : side === "left" ? box.x - 16 - bw : Math.max(12, Math.min(W - bw - 12, box.x))
  const by = side === "below" ? box.y + box.h + 14 : Math.max(8, box.y + Math.min(box.h / 2, 60) - 40)
  // The pointer sits on the target's natural click point: a checkbox, a control's left part, a panel's top.
  const px = box.px >= 0 ? box.px : box.x + Math.min(box.w / 2, step.info ? box.w / 2 : 56)
  const py = box.py >= 0 ? box.py : box.y + (step.info ? Math.min(60, box.h / 2) : box.h / 2)

  const title = resolve(step.title, ctx)
  const text = resolve(step.text, ctx)
  const inner = (
    <>
      <div className="guide-top">
        <span className="guide-n">
          {(i ?? 0) + 1} of {STEPS.length}
        </span>
        <button className="guide-x" aria-label="Skip the guide" onClick={skip}>
          <X size={14} />
        </button>
      </div>
      <strong>{title}</strong>
      <p>{text}</p>
      {waitingNow ? (
        <div className="guide-wait">
          <span className="guide-spin" />
          <span>
            {step.info ? resolve(step.waiting, ctx) : (step.busyText ?? "Writing to Arkiv")} · {secs} s
          </span>
        </div>
      ) : null}
      {step.info && ok ? (
        <button className="btn dark small" onClick={next}>
          {(i ?? 0) + 1 >= STEPS.length ? "Finish" : "Next"} <ArrowRight size={14} />
        </button>
      ) : null}
    </>
  )

  return (
    <div className="guide" aria-live="polite">
      <motion.div
        className="guide-ring"
        animate={{ x: box.x - 4, y: box.y - 4, width: box.w + 8, height: box.h + 8 }}
        transition={{ type: "spring", stiffness: 140, damping: 22 }}
      />
      {!step.info ? (
        <motion.div className={`guide-pointer ${small ? "pulse-only" : ""}`} animate={{ x: px, y: py }} transition={{ type: "spring", stiffness: 70, damping: 16 }}>
          <span className="guide-pulse" />
          <svg width="22" height="24" viewBox="0 0 20 22" aria-hidden>
            <path d="M2 1.5 L2 17.5 L6.4 13.4 L9.3 20 L12.2 18.7 L9.4 12.3 L15.4 12.3 Z" fill="#0a0a0a" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        </motion.div>
      ) : null}
      <AnimatePresence mode="wait">
        {side === "dock" ? (
          inView ? (
            <motion.div
              key={`d${i}`}
              className="guide-bubble dock"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              {inner}
            </motion.div>
          ) : null
        ) : (
          <motion.div
            key={i}
            className={`guide-bubble ${side}`}
            style={{ width: bw }}
            initial={{ opacity: 0, x: bx, y: by + 8, scale: 0.97 }}
            animate={{ opacity: 1, x: bx, y: by, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            {inner}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
