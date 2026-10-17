// Live wiring: a block clock for countdowns, and one WebSocket subscription to Arkiv entity events.
import { createPublicClient, type EntityEvent } from "@arkiv-network/sdk"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { useEffect, useRef, useState } from "react"
import { webSocket } from "viem"
import { pub } from "../shared/sayso"

// No fromBlock: with a WebSocket transport that makes it a real subscription instead of polling.
const ws = createPublicClient({ chain: tiramisu, transport: webSocket() })

type Listener = (e: EntityEvent) => void
const listeners = new Set<Listener>()
let started = false
export const feed: EntityEvent[] = []

function start() {
  if (started) return
  started = true
  ws.watchEntityEvents({
    onEvent: (e) => {
      feed.unshift(e)
      feed.length = Math.min(feed.length, 50)
      listeners.forEach((l) => l(e))
    },
    onError: (err) => console.warn("arkiv events", err.message),
  })
}

/** Calls `fn` for every entity event on the chain. The stream is chain-wide, so filter in `fn`. */
export function useEntityEvents(fn: Listener) {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    start()
    const l: Listener = (e) => ref.current(e)
    listeners.add(l)
    return () => void listeners.delete(l)
  }, [])
}

export type Clock = { block: bigint; blockMs: number; at: number }

/** Current block, re-read every 60 s and interpolated in between so countdowns tick every second. */
export function useBlockClock(): Clock | null {
  const [base, setBase] = useState<Clock | null>(null)
  const [, tick] = useState(0)
  useEffect(() => {
    let alive = true
    const read = () =>
      pub
        .getBlockTiming()
        .then((t) => alive && setBase({ block: t.currentBlock, blockMs: t.blockDuration * 1000, at: Date.now() }))
        .catch(() => undefined)
    read()
    const a = setInterval(read, 60000)
    const b = setInterval(() => tick((n) => n + 1), 1000)
    return () => {
      alive = false
      clearInterval(a)
      clearInterval(b)
    }
  }, [])
  if (!base) return null
  const drift = BigInt(Math.floor((Date.now() - base.at) / base.blockMs))
  return { ...base, block: base.block + drift }
}

/** Seconds from now until `block`, by the clock. Negative once passed. */
export const secondsUntil = (clock: Clock, block: bigint) => (Number(block - clock.block) * clock.blockMs) / 1000

type Units = { day: string; days: string; h: string; min: string; s: string }
const EN_UNITS: Units = { day: "day", days: "days", h: "h", min: "min", s: "s" }

export function fmtDuration(sec: number, u: Units = EN_UNITS): string {
  const s = Math.max(0, Math.round(sec))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (d >= 2) return `${d} ${u.days}`
  if (d === 1) return `1 ${u.day} ${h} ${u.h}`
  if (h) return `${h} ${u.h} ${m} ${u.min}`
  if (m) return r ? `${m} ${u.min} ${r.toString().padStart(2, "0")} ${u.s}` : `${m} ${u.min}`
  return `${r} ${u.s}`
}

export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
