// The hero tells the story without words: your data flowing out along threads to five vendors, then a
// stop pulse from you. Three threads settle with a stamp, one keeps flowing in vermilion with its clock
// running, and the cycle starts again.
import { useEffect, useState } from "react"
import { useReducedMotion } from "motion/react"

const W = 1200
const H = 640
// Everything sits right of the headline, which takes the left 60% of the card.
const YOU = { x: 770, y: 330 }
const VENDORS = [
  { name: "Credit bureau", x: 1030, y: 130, honest: true },
  { name: "Collections", x: 1080, y: 235, honest: true },
  { name: "SMS vendor", x: 1060, y: 350, honest: false },
  { name: "Delivery", x: 1080, y: 460, honest: true },
  { name: "Ad network", x: 1010, y: 555, honest: true },
]
const curve = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  const mx = (a.x + b.x) / 2
  return `M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`
}

export function HeroThreads() {
  const reduce = useReducedMotion()
  // 0: data flowing · 1: you said stop · 2: settled (with one still flowing)
  const [phase, setPhase] = useState(0)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (reduce) {
      setPhase(2)
      return
    }
    const seq = [4200, 1400, 5200]
    let i = 0
    let t: number
    const next = () => {
      i = (i + 1) % 3
      setPhase(i)
      t = window.setTimeout(next, seq[i])
    }
    t = window.setTimeout(next, seq[0])
    return () => clearTimeout(t)
  }, [reduce])
  useEffect(() => {
    if (phase !== 2) return setTick(0)
    const id = setInterval(() => setTick((x) => x + 1), 1000)
    return () => clearInterval(id)
  }, [phase])

  return (
    <div className="hero-threads" aria-hidden>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="hg">
            <stop offset="0%" stopColor="#f0a030" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#f0a030" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={YOU.x} cy={YOU.y} r={phase === 1 ? 210 : 120} fill="url(#hg)" className="you-glow" />
        {phase === 1 ? <circle cx={YOU.x} cy={YOU.y} r="10" className="stop-pulse" /> : null}
        {VENDORS.map((v) => {
          const state = phase === 0 ? "flow" : phase === 1 ? "flow" : v.honest ? "settled" : "breach"
          return <path key={v.name} d={curve(YOU, v)} className={`hthread ${state}`} />
        })}
        <circle cx={YOU.x} cy={YOU.y} r="9" className="you-dot" />
      </svg>
      <span className="hlabel you" style={{ left: `${(YOU.x / W) * 100}%`, top: `${(YOU.y / H) * 100}%` }}>
        {phase === 1 ? "You: stop" : "You"}
      </span>
      {VENDORS.map((v) => (
        <span key={v.name} className={`hlabel v ${phase === 2 ? (v.honest ? "settled" : "breach") : ""}`} style={{ left: `${(v.x / W) * 100}%`, top: `${(v.y / H) * 100}%` }}>
          {v.name}
          {phase === 2 ? <span className="hstate">{v.honest ? "stopped ✓" : `still using · ${tick}s`}</span> : null}
        </span>
      ))}
    </div>
  )
}
