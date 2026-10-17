import { motion } from "motion/react"
import { ArrowDown, ArrowUpRight } from "lucide-react"
import { useRef, type ReactNode } from "react"
import { Guide } from "../components/Guide"
import { AnyApp, AppWindow, usePerson, type Person } from "../person"

const ease = [0.16, 1, 0.3, 1] as const

function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, delay, ease }}
    >
      {children}
    </motion.div>
  )
}

export default function Home() {
  const p = usePerson()
  return (
    <main className="home">
      <Hero />
      <Product p={p} />
      <Problem />
      <How />
      <Today p={p} />
      <WhyArkiv />
      <Timeline />
      <Cta />
    </main>
  )
}

function Hero() {
  return (
    <section className="intro">
      <motion.a href="#why" className="badge" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
        Built on Arkiv for India's data protection law <ArrowUpRight size={14} />
      </motion.a>
      <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease }}>
        Withdraw consent.
        <br />
        Prove they stopped.
      </motion.h1>
      <motion.p className="sub" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1, ease }}>
        Your consent becomes a record you own on Arkiv. When you withdraw it, every vendor holding your data signs that it stopped, or ends up on
        a public list.
      </motion.p>
      <motion.div className="actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.2 }}>
        <a className="btn outline" href="https://github.com/tahcin/sayso" target="_blank" rel="noreferrer">
          Read the code
        </a>
        <a className="btn dark" href="#try">
          Try it below <ArrowDown size={15} />
        </a>
      </motion.div>
    </section>
  )
}

function Product({ p }: { p: Person }) {
  const stage = useRef<HTMLDivElement>(null)
  return (
    <section id="try" className="product">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.25, ease }}>
        <div className="stage" ref={stage}>
          <AppWindow p={p} />
          <Guide p={p} root={stage} />
        </div>
        <p className="caption">
          Every tap is a real transaction on Arkiv's Tiramisu testnet. Rupeeleaf, Bazaarline and their vendors are fictional; your wallet never
          leaves this browser.
        </p>
      </motion.div>
    </section>
  )
}

function Problem() {
  const stats = [
    { n: "52 of 53", t: "popular Indian apps used a deceptive design pattern on their users.", src: "ASCI, 2024", href: "https://www.ascionline.in/wp-content/uploads/2024/07/Press-Release.-Conscious-Patterns-25.07.24.docx.pdf" },
    { n: "95%", t: "of people surveyed get unwanted commercial calls every day.", src: "LocalCircles, 2024", href: "https://www.businesstoday.in/amp/technology/news/story/95-indians-continue-to-get-unwanted-calls-daily-despite-regulatory-interventions-survey-443922-2024-09-02" },
    { n: "66.9 crore", t: "individuals and organisations had their data found with a single seller.", src: "Cyberabad Police, 2023", href: "https://www.deccanherald.com/india/cyberabad-cops-nab-man-stealing-selling-data-of-67-crore-individuals-1205735.html" },
  ]
  return (
    <section className="block">
      <Reveal>
        <h2 className="statement">
          Saying yes takes one tap.{" "}
          <span>Saying stop proves nothing. The only record of it sits with the company you asked to stop, and its vendors never have to answer.</span>
        </h2>
      </Reveal>
      <div className="grid3">
        {stats.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.06} className="cell">
            <p className="num">{s.n}</p>
            <p>{s.t}</p>
            <a href={s.href} target="_blank" rel="noreferrer" className="src">
              {s.src}
            </a>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function How() {
  return (
    <section id="how" className="block">
      <Reveal>
        <h2 className="statement">
          How it works. <span>Three records on Arkiv, each with its own clock, and nobody but the writer can delete one.</span>
        </h2>
      </Reveal>
      <div className="grid3">
        <Reveal className="cell">
          <span className="idx">01</span>
          <h3>Your consent</h3>
          <p>Written by your own address, one per company. It ends when its purpose does, and only you can renew it.</p>
          <div className="mini">
            <div className="mini-row">
              <span>Loan servicing</span>
              <span className="tag amber">ends 17 Oct 2027</span>
            </div>
            <div className="mini-row muted">
              <span>Owner</span>
              <code>0x1b0B…f5eF</code>
            </div>
          </div>
        </Reveal>
        <Reveal className="cell" delay={0.06}>
          <span className="idx">02</span>
          <h3>Their lease</h3>
          <p>Each vendor holds a lease that expires with your consent, and checks your consent is live before every job.</p>
          <div className="mini">
            <div className="mini-row">
              <span>Recoverly</span>
              <span className="tag amber">lease</span>
            </div>
            <div className="mini-row">
              <span>Pingwave</span>
              <span className="tag amber">lease</span>
            </div>
          </div>
        </Reveal>
        <Reveal className="cell" delay={0.12}>
          <span className="idx">03</span>
          <h3>Their stop note</h3>
          <p>When you withdraw, honest vendors drop the lease and sign that they stopped. Silence stays public.</p>
          <div className="mini">
            <div className="mini-row">
              <span>Recoverly</span>
              <span className="tag green">stopped · 8 s</span>
            </div>
            <div className="mini-row">
              <span>Pingwave</span>
              <span className="tag red">still using · 4 min</span>
            </div>
          </div>
        </Reveal>
      </div>
      <Reveal>
        <a className="more" href="/board">
          See every vendor's record on the cease board <ArrowUpRight size={15} />
        </a>
      </Reveal>
    </section>
  )
}

function Today({ p }: { p: Person }) {
  return (
    <section className="block">
      <Reveal>
        <h2 className="statement">
          Works today, with any company.{" "}
          <span>Record that you withdrew from a real app, bank or shop, and send them a message that links to proof they can't edit.</span>
        </h2>
      </Reveal>
      <Reveal className="card any-card">
        <AnyApp compact split disabled={!!p.busy} latest={p.declarations[0]} onRecord={p.recordAny} />
        {p.busy ? <p className="note pad-x">Writing to Arkiv…</p> : p.error ? <p className="err pad-x">{p.error}</p> : null}
      </Reveal>
    </section>
  )
}

function WhyArkiv() {
  const rows = [
    ["In the company's database", "The party that must prove your consent holds the only proof, and can edit it."],
    ["With a Consent Manager", "The Data Protection Board can suspend one, while consent records must last seven years."],
    ["On IPFS or Arweave", "Consent has to stop existing when its purpose ends. Permanent storage keeps it forever."],
    ["Behind our own API", "Every vendor would have to trust us to tell them you withdrew."],
  ]
  return (
    <section id="why" className="block">
      <Reveal>
        <h2 className="statement">
          Why Arkiv. <span>Your address owns the consent, it expires with its purpose, and anyone can check it with one query.</span>
        </h2>
      </Reveal>
      <Reveal className="table">
        {rows.map(([a, b]) => (
          <div key={a} className="trow">
            <span>{a}</span>
            <span>{b}</span>
          </div>
        ))}
        <div className="trow off">
          <span>Kept off Arkiv</span>
          <span>Names, phone numbers, the data itself, which address belongs to which customer, and every key.</span>
        </div>
      </Reveal>
    </section>
  )
}

function Timeline() {
  const items = [
    { d: "Aug 2023", t: "DPDP Act passed" },
    { d: "Nov 2025", t: "DPDP Rules published" },
    { d: "13 Nov 2026", t: "Consent Managers can register", soon: true },
    { d: "13 May 2027", t: "Consent duties apply to every company" },
  ]
  return (
    <section className="block">
      <Reveal>
        <h2 className="statement">
          Why now. <span>India's consent rules arrive in steps, and the next one is next month.</span>
        </h2>
      </Reveal>
      <div className="grid4">
        {items.map((x, i) => (
          <Reveal key={x.d} delay={i * 0.05} className={`cell ${x.soon ? "soon" : ""}`}>
            <span className="date">{x.d}</span>
            <p>{x.t}</p>
            {x.soon ? <span className="tag amber">next month</span> : null}
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function Cta() {
  return (
    <section className="cta">
      <h2>Your data moves only while you say so.</h2>
      <div className="actions">
        <a className="btn outline" href="/developers">
          Check a consent from your code
        </a>
        <a className="btn dark" href="#try">
          Try it now
        </a>
      </div>
    </section>
  )
}
