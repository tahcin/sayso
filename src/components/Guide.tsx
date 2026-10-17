// A guided walkthrough over the live demo. A pointer glides to the next thing to do, pulses on it, and a
// bubble says what is happening and why. It waits for the visitor to act, then moves on. Every step is a
// real Arkiv transaction made by the visitor; the guide only points.
import { AnimatePresence, motion } from "motion/react"
import { ArrowRight, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState, type RefObject } from "react"
import type { Person } from "../person"

type Step = {
  target: (root: HTMLElement) => HTMLElement | null
  title: string
  text: string
  /** True once the visitor has done what this step asks. */
  done: (p: Person, root: HTMLElement) => boolean
  /** Steps that only explain wait for "Next" (enabled once `done`); action steps advance by themselves. */
  info?: boolean
  waiting?: string
  side?: "left" | "right" | "below"
}

const q = (sel: string) => (root: HTMLElement) => root.querySelector(sel) as HTMLElement | null
const has = (p: Person, s: string[]) => p.items.some((i) => s.includes(i.status))
const smsWithdraw = (root: HTMLElement) => {
  const card = [...root.querySelectorAll(".win-main .consent")].find((c) => c.querySelector(".consent-title")?.textContent === "SMS offers" && c.querySelector(".stop"))
  return ((card?.querySelector(".stop") as HTMLElement) ?? (root.querySelector(".win-main .consent .stop") as HTMLElement)) || null
}

const STEPS: Step[] = [
  {
    target: q(".win-main .notice"),
    title: "A loan app asks for your data",
    text: "Rupeeleaf wants three separate permissions, and nothing is ticked for you. Tick the ones you'd agree to.",
    done: (_, root) => !!root.querySelector(".win-main .notice.picked"),
    side: "right",
  },
  {
    target: q(".win-main .primary.wide"),
    title: "Say yes",
    text: "One tap writes each consent, and a receipt for it, to Arkiv. It's signed by a wallet that lives only in this browser.",
    done: (p) => !!p.busy || p.items.some((i) => i.live),
    side: "right",
  },
  {
    target: q(".win-right"),
    title: "Your data starts moving",
    text: "Rupeeleaf's vendors pick up your consent. Each takes a lease that ends when your consent does. Today, only the company would ever know this.",
    done: (p) => has(p, ["using", "stopped", "ignoring", "released"]),
    info: true,
    waiting: "Waiting for the vendors…",
    side: "left",
  },
  {
    target: (root) => [...root.querySelectorAll(".win-side button")].at(-1) as HTMLElement | null,
    title: "Your consents live here",
    text: "Open My consents to see every permission you've given, who holds it, and when it ends.",
    done: (p) => p.tab === "mine",
    side: "right",
  },
  {
    target: smsWithdraw,
    title: "Change your mind",
    text: "Withdraw SMS offers. It's one tap: your consent is deleted and a withdrawal receipt is written in the same transaction.",
    done: (p) => has(p, ["stopped", "ignoring", "released"]),
    side: "right",
  },
  {
    target: q(".win-right"),
    title: "Who actually stopped?",
    text: "Honest vendors sign a stop note within seconds. Pingwave never answers, so its clock keeps running, in public. Try withdrawing Loan servicing too.",
    done: (p) => has(p, ["stopped", "ignoring"]),
    info: true,
    waiting: "Waiting for the vendors to answer…",
    side: "left",
  },
]

type Box = { x: number; y: number; w: number; h: number }

export function Guide({ p, root }: { p: Person; root: RefObject<HTMLDivElement | null> }) {
  const [on, setOn] = useState(true)
  const [i, setI] = useState<number | null>(null)
  const [box, setBox] = useState<Box | null>(null)
  const [finished, setFinished] = useState(false)
  const started = useRef(false)

  // Start where the visitor already is: a returning visitor skips what they have done.
  useEffect(() => {
    if (started.current || !p.world) return
    started.current = true
    setI(has(p, ["stopped", "ignoring", "released"]) ? 5 : p.items.some((x) => x.live) ? 3 : 0)
  }, [p])

  const step = i !== null && i < STEPS.length ? STEPS[i] : null

  // Follow the target as the page or pane scrolls and the layout changes. Measured at most once per
  // animation frame, and state only changes when the box actually moved, so an idle page does no work.
  const last = useRef<Box | null>(null)
  const frame = useRef(0)
  const measure = useCallback(() => {
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      const r = root.current
      const el = r && step ? step.target(r) : null
      let next: Box | null = null
      if (r && el) {
        const a = r.getBoundingClientRect()
        const b = el.getBoundingClientRect()
        next = { x: Math.round(b.left - a.left), y: Math.round(b.top - a.top), w: Math.round(b.width), h: Math.round(b.height) }
      }
      const prev = last.current
      if (prev === next || (prev && next && prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h)) return
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
  }, [measure, root, p.tab])

  // Action steps advance as soon as they are done.
  const ok = !!(step && root.current && step.done(p, root.current))
  useEffect(() => {
    if (!on || !step || step.info || !ok) return
    const t = setTimeout(() => setI((x) => (x === null ? x : x + 1)), 500)
    return () => clearTimeout(t)
  }, [on, step, ok])

  // Keep the target in view inside the scrolling pane, without moving the page.
  useEffect(() => {
    const r = root.current
    if (!r || !step) return
    const el = step.target(r)
    const pane = el?.closest(".win-main") as HTMLElement | null
    if (el && pane) {
      const top = el.offsetTop - pane.offsetTop
      if (top < pane.scrollTop || top > pane.scrollTop + pane.clientHeight - 80) pane.scrollTo({ top: Math.max(0, top - 80), behavior: "smooth" })
    }
  }, [i, root, step, p.tab])

  const next = () => {
    if (i === null) return
    if (i + 1 >= STEPS.length) setFinished(true)
    setI(i + 1)
  }

  if (!on) {
    return (
      <button className="guide-restart" onClick={() => setOn(true)}>
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

  // Bubble placement: beside the target when there is room, otherwise below it.
  const W = root.current?.clientWidth ?? 1000
  const bw = Math.min(300, W - 24)
  let side = step.side ?? "right"
  if (side === "right" && box.x + box.w + 16 + bw > W) side = box.x - 16 - bw > 0 ? "left" : "below"
  if (side === "left" && box.x - 16 - bw < 0) side = "below"
  if (W < 700) side = "below"
  const bx = side === "right" ? box.x + box.w + 16 : side === "left" ? box.x - 16 - bw : Math.max(12, Math.min(W - bw - 12, box.x))
  const by = side === "below" ? box.y + box.h + 14 : Math.max(8, box.y + Math.min(box.h / 2, 60) - 40)
  // The pointer sits on the target's natural click point: a control's middle, a panel's top area.
  const px = box.x + Math.min(box.w / 2, step.info ? box.w / 2 : 56)
  const py = box.y + (step.info ? Math.min(60, box.h / 2) : box.h / 2)

  return (
    <div className="guide" aria-live="polite">
      <motion.div
        className="guide-ring"
        animate={{ x: box.x - 4, y: box.y - 4, width: box.w + 8, height: box.h + 8 }}
        transition={{ type: "spring", stiffness: 140, damping: 22 }}
      />
      {!step.info ? (
        <motion.div className="guide-pointer" animate={{ x: px, y: py }} transition={{ type: "spring", stiffness: 70, damping: 16 }}>
          <span className="guide-pulse" />
          <svg width="22" height="24" viewBox="0 0 20 22" aria-hidden>
            <path d="M2 1.5 L2 17.5 L6.4 13.4 L9.3 20 L12.2 18.7 L9.4 12.3 L15.4 12.3 Z" fill="#0a0a0a" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        </motion.div>
      ) : null}
      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          className={`guide-bubble ${side}`}
          style={{ width: bw }}
          initial={{ opacity: 0, x: bx, y: by + 8, scale: 0.97 }}
          animate={{ opacity: 1, x: bx, y: by, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="guide-top">
            <span className="guide-n">
              {(i ?? 0) + 1} of {STEPS.length}
            </span>
            <button className="guide-x" aria-label="Skip the guide" onClick={() => setOn(false)}>
              <X size={14} />
            </button>
          </div>
          <strong>{step.title}</strong>
          <p>{step.text}</p>
          {step.info ? (
            <button className="btn dark small" disabled={!ok} onClick={next}>
              {ok ? (
                <>
                  Next <ArrowRight size={14} />
                </>
              ) : (
                step.waiting
              )}
            </button>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
