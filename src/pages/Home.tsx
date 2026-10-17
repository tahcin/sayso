import { motion, useInView, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react"
import { ArrowDown, ArrowRight, BellRing, Building2, Check, FileLock2, Landmark, Smartphone } from "lucide-react"
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react"
import { FlowMap } from "../components/FlowMap"
import { HeroThreads } from "../components/HeroThreads"
import { AnyApp, EventTicker, Phone, usePerson, type Person } from "../person"

const ease = [0.16, 1, 0.3, 1] as const

export default function Home() {
  const p = usePerson()
  return (
    <main className="home">
      <Hero />
      <Problem />
      <Finding />
      <Changes />
      <Demo p={p} />
      <WorksToday p={p} />
      <WhyNow />
      <WhyArkiv />
      <Closing />
    </main>
  )
}

/* ---------- 1. Hero ---------- */

function Hero() {
  return (
    <section className="hero-card">
      <HeroThreads />
      <div className="hero-inner">
        <motion.h1 className="display hero-title" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.1, ease }}>
          You said stop.
          <br />
          Did they<span className="sun">?</span>
        </motion.h1>
        <motion.p className="hero-sub" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.1, delay: 0.25, ease }}>
          India's data protection law lets you take back your consent from any app. Say So turns that into a record you own on Arkiv, and shows in
          public which companies and vendors actually stopped.
        </motion.p>
        <motion.div className="hero-cta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.5 }}>
          <a href="#demo" className="btn sun">
            Try it, it's live <ArrowDown size={16} />
          </a>
          <a href="/board" className="btn ghost-light">
            See who ignored a stop
          </a>
        </motion.div>
      </div>
    </section>
  )
}

/* ---------- 2. The problem, sharpening word by word ---------- */

type Piece = string | { icon: typeof Smartphone; tone: string }
const PROBLEM: Piece[] = [
  "You said yes to a loan app once.",
  { icon: Smartphone, tone: "sun" },
  "It passed your number to a credit bureau, a collections agency and an SMS vendor.",
  { icon: Building2, tone: "teal" },
  "Then you said stop. The only record of that sits with the company you asked to stop,",
  { icon: FileLock2, tone: "teal" },
  "and nobody can see whether the calls ever end.",
  { icon: BellRing, tone: "red" },
]

function Word({ children, progress, at, reduce }: { children: ReactNode; progress: MotionValue<number>; at: [number, number]; reduce: boolean }) {
  const opacity = useTransform(progress, at, [0.13, 1])
  const blur = useTransform(progress, at, [6, 0], { clamp: true })
  const filter = useTransform(blur, (b) => (b < 0.2 ? "none" : `blur(${b}px)`))
  if (reduce) return <span className="word">{children}</span>
  return (
    <motion.span style={{ opacity, filter }} className="word">
      {children}
    </motion.span>
  )
}

function Problem() {
  const reduce = !!useReducedMotion()
  const ref = useRef<HTMLParagraphElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.55"] })
  const tokens = PROBLEM.flatMap<Piece>((x) => (typeof x === "string" ? x.split(" ") : [x]))
  const n = tokens.length
  return (
    <section className="wrap problem">
      <p ref={ref} className="display manifesto">
        <span className="sr-only">{PROBLEM.filter((x) => typeof x === "string").join(" ")}</span>
        <span aria-hidden>
          {tokens.map((tk, i) => {
            const at: [number, number] = [i / n, Math.min(1, (i + 2) / n)]
            const body =
              typeof tk === "string" ? (
                tk
              ) : (
                <span className={`pill-icon ${tk.tone}`}>
                  <tk.icon strokeWidth={2.2} />
                </span>
              )
            return (
              <Fragment key={i}>
                <Word progress={scrollYProgress} at={at} reduce={reduce}>
                  {body}
                </Word>{" "}
              </Fragment>
            )
          })}
        </span>
      </p>
    </section>
  )
}

/* ---------- 3. The finding: 52 of 53 ---------- */

function CountUp({ to, run }: { to: number; run: boolean }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!run) return
    let raf = 0
    const t0 = performance.now()
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 1400)
      setV(Math.round(to * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    // Background tabs throttle animation frames; make sure the true number always lands.
    const done = window.setTimeout(() => setV(to), 1700)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(done)
    }
  }, [run, to])
  return <>{v}</>
}

function Finding() {
  const reduce = useReducedMotion()
  const grid = useRef<HTMLDivElement>(null)
  const shown = useInView(grid, { once: true, margin: "-15% 0px" })
  return (
    <section className="wrap finding">
      <div className="finding-grid">
        <div>
          <h2 className="display finding-title">
            <span className="red">
              <CountUp to={52} run={shown} /> of 53
            </span>{" "}
            popular Indian apps used a deceptive design pattern on their users.
          </h2>
          <p className="lede">
            Pre-ticked boxes, consent buried in terms, deleting your account made hard. Found by the Advertising Standards Council of India with
            Parallel HQ in{" "}
            <a href="https://www.ascionline.in/wp-content/uploads/2024/07/Press-Release.-Conscious-Patterns-25.07.24.docx.pdf" target="_blank" rel="noreferrer">
              August 2024
            </a>
            .
          </p>
        </div>
        <div>
          <div ref={grid} className="waffle" role="img" aria-label="53 apps: 52 used a deceptive pattern, 1 did not">
            {Array.from({ length: 53 }, (_, i) => (
              <motion.span
                key={i}
                className={i < 52 ? "sq red" : "sq teal"}
                initial={reduce ? false : { opacity: 0, scale: 0.4 }}
                animate={shown ? { opacity: 1, scale: 1 } : undefined}
                transition={{ duration: 0.7, delay: (i % 9) * 0.03 + Math.floor(i / 9) * 0.07, ease }}
              />
            ))}
          </div>
          <p className="fine">One square per app.</p>
        </div>
      </div>
      <div className="stats">
        <div className="stat">
          <p className="display stat-num">95%</p>
          <p>
            of people surveyed get unwanted commercial calls every day, and 96% of those on Do Not Disturb still get them.{" "}
            <a href="https://www.businesstoday.in/amp/technology/news/story/95-indians-continue-to-get-unwanted-calls-daily-despite-regulatory-interventions-survey-443922-2024-09-02" target="_blank" rel="noreferrer">
              LocalCircles, 2024
            </a>
          </p>
        </div>
        <div className="stat">
          <p className="display stat-num">66.9 crore</p>
          <p>
            individuals and organisations had their data found with a single seller.{" "}
            <a href="https://www.deccanherald.com/india/cyberabad-cops-nab-man-stealing-selling-data-of-67-crore-individuals-1205735.html" target="_blank" rel="noreferrer">
              Cyberabad Police, 2023
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}

/* ---------- 4. What Say So changes: three steps, one picture ---------- */

const STEPS = [
  {
    title: "Your yes becomes yours.",
    text: "Each consent is a record your own address writes on Arkiv, a different address for every company. It ends exactly when its purpose does, and only you can renew it.",
  },
  {
    title: "Vendors get a lease, not forever.",
    text: "Every vendor that touches your data holds a lease set to expire with your consent, and checks that your consent is still live before each job.",
  },
  {
    title: "Your stop starts a public clock.",
    text: "Withdraw, and your consent is gone in one transaction. Honest vendors drop their lease and sign that they stopped. The ones that don't stay on the cease board, in red, for anyone to see.",
  },
]

function Changes() {
  const [step, setStep] = useState(0)
  return (
    <section className="wrap changes">
      <h2 className="display section-title">What Say So changes</h2>
      <div className="changes-grid">
        <div className="changes-steps">
          {STEPS.map((s, i) => (
            <StepBlock key={i} i={i} onEnter={setStep} active={step === i}>
              <span className="step-num">{i + 1}</span>
              <h3 className="display">{s.title}</h3>
              <p>{s.text}</p>
            </StepBlock>
          ))}
        </div>
        <div className="changes-pic">
          <Diagram step={step} />
        </div>
      </div>
    </section>
  )
}

function StepBlock({ i, onEnter, active, children }: { i: number; onEnter: (i: number) => void; active: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { margin: "-45% 0px -45% 0px" })
  useEffect(() => {
    if (inView) onEnter(i)
  }, [inView, i, onEnter])
  return (
    <div ref={ref} className={`step-block ${active ? "on" : ""}`}>
      {children}
    </div>
  )
}

function Diagram({ step }: { step: number }) {
  const vendors = [
    { name: "Ledgerlight", honest: true },
    { name: "Recoverly", honest: true },
    { name: "Pingwave", honest: false },
  ]
  return (
    <div className="diagram">
      <motion.div className="consent-card" layout>
        <div className="cc-top">
          <span className="logo small rupeeleaf">R</span>
          <strong>Rupeeleaf</strong>
          <span className={`cc-state ${step >= 2 ? "gone" : ""}`}>{step >= 2 ? "Withdrawn" : "Your consent"}</span>
        </div>
        <div className="cc-line">
          <span>Owner</span>
          <code>0x1b0B…f5eF (you)</code>
        </div>
        <div className="cc-line">
          <span>Ends</span>
          <code>{step >= 2 ? "now" : "with its purpose"}</code>
        </div>
      </motion.div>
      <div className="leases">
        {vendors.map((v, i) => {
          const show = step >= 1
          const stopped = step >= 2 && v.honest
          const breach = step >= 2 && !v.honest
          return (
            <motion.div
              key={v.name}
              className={`lease ${stopped ? "settled" : breach ? "breach" : "flow"}`}
              initial={false}
              animate={{ opacity: show ? 1 : 0.35, x: show ? 0 : -12 }}
              transition={{ duration: 0.6, delay: show ? i * 0.12 : 0, ease }}
            >
              <span className="lease-line" />
              <strong>{v.name}</strong>
              <span className="lease-tag">
                {stopped ? (
                  <>
                    <Check size={13} strokeWidth={3} /> Stopped · {i === 0 ? "6 s" : "8 s"}
                  </>
                ) : breach ? (
                  "Still using · 4 min"
                ) : show ? (
                  "Lease until your consent ends"
                ) : (
                  "No access yet"
                )}
              </span>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

/* ---------- 5. The demo ---------- */

function Demo({ p }: { p: Person }) {
  const has = (f: (s: string) => boolean) => p.items.some((i) => f(i.status))
  const steps = [
    { label: "Say yes", hint: "Tick what Rupeeleaf may do and press Agree.", done: has((s) => s !== "denied") },
    { label: "Watch the vendors", hint: "Each vendor takes a lease on your consent, live from Arkiv.", done: has((s) => ["using", "stopped", "ignoring", "released"].includes(s)) },
    { label: "Withdraw", hint: "Open My consents and withdraw SMS offers, then Loan servicing.", done: has((s) => ["stopped", "ignoring", "released"].includes(s)) },
    { label: "See who stopped", hint: "Honest vendors sign a stop note. Pingwave never does.", done: has((s) => s === "stopped") && has((s) => s === "ignoring") },
  ]
  const current = Math.max(0, steps.findIndex((s) => !s.done))
  const allDone = steps.every((s) => s.done)
  return (
    <section id="demo" className="wrap demo">
      <h2 className="display section-title">Try it. Every tap is a real Arkiv transaction.</h2>
      <p className="lede narrow">
        Rupeeleaf and Bazaarline are made-up apps, and so are their vendors. Your wallet, your consents and the vendors' leases and stop notes are
        real entities on Arkiv's Tiramisu testnet, and your keys never leave this browser.
      </p>
      <ol className="stepper">
        {steps.map((s, i) => (
          <li key={i} className={s.done ? "done" : i === current && !allDone ? "now" : ""}>
            <span className="dotnum">{s.done ? <Check size={14} strokeWidth={3} /> : i + 1}</span>
            {s.label}
          </li>
        ))}
      </ol>
      <p className="step-hint">{allDone ? "That's the whole loop. Open the cease board to see every vendor's record." : steps[current].hint}</p>
      <div className="demo-grid">
        <Phone p={p} />
        <div className="demo-right">
          <FlowMap items={p.items} clock={p.clock} />
          <EventTicker world={p.world} />
        </div>
      </div>
    </section>
  )
}

/* ---------- 6. Works today ---------- */

function WorksToday({ p }: { p: Person }) {
  return (
    <section className="wrap today">
      <div className="today-grid">
        <div>
          <h2 className="display section-title">Works today, with any real company.</h2>
          <p className="lede">
            Withdrawing consent from a loan app that keeps calling, or a shop that keeps texting? Record it here first. You get a timestamped record
            on Arkiv that you own and the company cannot change, and a message to send them that links to it.
          </p>
          <p className="fine">Only the company's name and the purpose are written. Numbers and @ are blocked, so a phone number or email cannot slip in.</p>
        </div>
        <div className="today-card">
          <AnyApp disabled={!!p.busy} latest={p.declarations[0]} onRecord={p.recordAny} />
          {p.busy ? <p className="fine pad-x">Writing to Arkiv…</p> : p.error ? <p className="err pad-x">{p.error}</p> : null}
        </div>
      </div>
    </section>
  )
}

/* ---------- 7. Why now ---------- */

function WhyNow() {
  const items = [
    { when: "Aug 2023", what: "The Digital Personal Data Protection Act passes. Consent must be free and specific, and withdrawing it as easy as giving it." },
    { when: "13 Nov 2025", what: "The DPDP Rules are published." },
    { when: "13 Nov 2026", what: "Consent Managers can register with the Data Protection Board.", soon: true },
    { when: "13 May 2027", what: "Notice, consent, security and erasure duties apply to every company." },
  ]
  return (
    <section className="wrap whynow">
      <h2 className="display section-title">The rules arrive in steps. The next one is next month.</h2>
      <ol className="timeline">
        {items.map((x) => (
          <li key={x.when} className={x.soon ? "soon" : ""}>
            <strong>{x.when}</strong>
            <span>{x.what}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

/* ---------- 8. Why Arkiv ---------- */

function WhyArkiv() {
  const rows = [
    { on: "The company's own database", why: "The party that must prove your consent holds the only proof, and can edit it." },
    { on: "A Consent Manager's database", why: "The Board can suspend a Consent Manager, while consent records must last seven years." },
    { on: "IPFS or Arweave", why: "Consent has to stop existing when its purpose ends. Permanent storage keeps it forever." },
    { on: "Our own API", why: "Every vendor would have to trust us to tell them you withdrew." },
  ]
  return (
    <section className="wrap whyarkiv">
      <h2 className="display section-title">Why this has to live on Arkiv</h2>
      <div className="why-grid">
        <div className="why-arkiv-card">
          <Landmark />
          <p className="display">
            Your address creates and owns the consent. It expires with its purpose. Vendors' leases share that expiry. Anyone can check it with one
            query, and only its writer can ever delete it.
          </p>
        </div>
        <div className="why-list">
          {rows.map((r) => (
            <div key={r.on} className="why-row">
              <strong>{r.on}</strong>
              <span>{r.why}</span>
            </div>
          ))}
          <div className="why-row off">
            <strong>Stays off Arkiv</strong>
            <span>Names, phone numbers, the data itself, which address belongs to which customer, and every key.</span>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------- 9. Close ---------- */

function Closing() {
  return (
    <section className="closing">
      <p className="display closing-line">
        Your data moves only while you say so<span className="sun">.</span>
      </p>
      <div className="hero-cta center">
        <a href="#demo" className="btn ink">
          Try the demo <ArrowRight size={16} />
        </a>
        <a href="/developers" className="btn ghost">
          Check a consent from your own code
        </a>
      </div>
    </section>
  )
}
