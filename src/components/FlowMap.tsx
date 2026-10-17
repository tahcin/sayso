// Where your data is going, drawn live from Arkiv. You on the left, the companies you answered in the
// middle, and their vendors on the right. A thread carries moving dots while a vendor holds a lease on your
// consent, turns into a settled line with a stamp when the vendor signs that it stopped, and stays lit in
// vermilion, with a clock running, when a vendor keeps its lease after you withdrew.
import { AnimatePresence, motion } from "motion/react"
import { Check, Clock3, X } from "lucide-react"
import { FIDUCIARIES, NOTICES, PROCESSORS } from "../../shared/cast"
import type { Item } from "../data"
import { fmtDuration, type Clock } from "../live"
import { RANK } from "../person"

type Edge = { from: string; to: string; item?: Item }

const W = 680
const H = 470
const YOU = { x: 70, y: 235 }
const CO: Record<string, { x: number; y: number }> = { rupeeleaf: { x: 290, y: 150 }, bazaarline: { x: 290, y: 340 } }
const VEN: Record<string, { x: number; y: number }> = {
  ledgerlight: { x: 560, y: 62 },
  recoverly: { x: 560, y: 172 },
  pingwave: { x: 560, y: 290 },
  dakroute: { x: 560, y: 404 },
}

const curve = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  const mx = (a.x + b.x) / 2
  return `M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`
}

const tone = (s?: Item["status"]) =>
  s === "using" || s === "pending" ? "flow" : s === "stopped" ? "settled" : s === "ignoring" ? "breach" : s === "released" ? "wait" : "idle"

export function FlowMap({ items, clock }: { items: Item[]; clock: Clock | null }) {
  const blockMs = clock?.blockMs ?? 2000
  // The most telling item for each (company, vendor) pair.
  const pick = (slug: string, vendorAddr: string) =>
    items
      .filter((i) => i.slug === slug && i.processor.toLowerCase() === vendorAddr.toLowerCase())
      .sort((a, b) => RANK[a.status] - RANK[b.status] || Number(b.granted.createdAt - a.granted.createdAt))[0]

  const edges: Edge[] = FIDUCIARIES.flatMap((f) =>
    NOTICES[f.slug].map((n) => {
      const v = PROCESSORS.find((p) => p.slug === n.processor)!
      return { from: f.slug, to: v.slug, item: pick(f.slug, v.address) }
    }),
  )
  const answered = (slug: string) => items.some((i) => i.slug === slug && i.status !== "denied")
  const anyAnswer = (slug: string) => items.some((i) => i.slug === slug)

  // Each vendor shows its most telling state across both companies.
  const vendorState = (slug: string) =>
    edges
      .filter((e) => e.to === slug && e.item)
      .map((e) => e.item!)
      .sort((a, b) => RANK[a.status] - RANK[b.status])[0]

  return (
    <div className="flowmap" role="img" aria-label="Where your data is going, read live from Arkiv">
      <svg viewBox={`0 0 ${W} ${H}`} className="flowmap-svg">
        <defs>
          <radialGradient id="youGlow">
            <stop offset="0%" stopColor="var(--sun)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--sun)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={YOU.x} cy={YOU.y} r="70" fill="url(#youGlow)" />

        {FIDUCIARIES.map((f) => (
          <path key={f.slug} d={curve(YOU, CO[f.slug])} className={`thread ${answered(f.slug) ? "flow" : anyAnswer(f.slug) ? "wait" : "idle"}`} />
        ))}
        {edges.map((e) => (
          <path key={e.from + e.to} d={curve(CO[e.from], VEN[e.to])} className={`thread ${tone(e.item?.status)}`} />
        ))}
      </svg>

      <div className="node you" style={{ left: `${(YOU.x / W) * 100}%`, top: `${(YOU.y / H) * 100}%` }}>
        <span className="node-dot" />
        <strong>You</strong>
      </div>
      {FIDUCIARIES.map((f) => (
        <div key={f.slug} className={`node co ${answered(f.slug) ? "on" : ""}`} style={{ left: `${(CO[f.slug].x / W) * 100}%`, top: `${(CO[f.slug].y / H) * 100}%` }}>
          <span className={`logo small ${f.slug}`}>{f.name[0]}</span>
          <strong>{f.name}</strong>
        </div>
      ))}
      {PROCESSORS.map((p) => {
        const it = vendorState(p.slug)
        const s = it?.status
        const t = tone(s)
        let badge: React.ReactNode = null
        if (s === "stopped" && it?.ceased && it.withdrawn) {
          const sec = (Number(it.ceased.createdAt - it.withdrawn.createdAt) * blockMs) / 1000
          badge = (
            <motion.span className="stamp settled" initial={{ scale: 1.8, opacity: 0, rotate: -8 }} animate={{ scale: 1, opacity: 1, rotate: -4 }} transition={{ type: "spring", stiffness: 260, damping: 16 }}>
              <Check size={13} strokeWidth={3} /> Stopped · {fmtDuration(sec)}
            </motion.span>
          )
        } else if (s === "ignoring" && it?.withdrawn && clock) {
          const sec = (Number(clock.block - it.withdrawn.createdAt) * blockMs) / 1000
          badge = (
            <span className="stamp breach">
              <Clock3 size={13} strokeWidth={2.6} /> Still using · {fmtDuration(sec)}
            </span>
          )
        } else if (s === "using") badge = <span className="stamp flow">Holding your data</span>
        else if (s === "pending") badge = <span className="stamp flow faint">Picking it up…</span>
        else if (s === "released") badge = <span className="stamp wait">Waiting for its answer</span>
        else if (s === "ended") badge = <span className="stamp idle">Permission ended</span>
        else if (s === "denied")
          badge = (
            <span className="stamp idle">
              <X size={12} /> You said no
            </span>
          )
        return (
          <div key={p.slug} className={`node vendor ${t}`} style={{ left: `${(VEN[p.slug].x / W) * 100}%`, top: `${(VEN[p.slug].y / H) * 100}%` }}>
            <div className="vendor-head">
              <span className="node-dot" />
              <strong>{p.name}</strong>
            </div>
            <span className="vendor-blurb">{p.blurb}</span>
            <AnimatePresence mode="wait">
              <motion.div key={String(s)} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {badge}
              </motion.div>
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
