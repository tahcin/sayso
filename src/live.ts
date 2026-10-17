// Live wiring: one WebSocket subscription to Arkiv entity events, and a block clock for countdowns.
// Screens update when an event arrives, not on a timer. Expiry emits no event, so a screen that shows
// something with an expiry schedules one read at that block (useReadAt). Timers only take over while
// the socket is down (useFallbackPoll).
import { createPublicClient, type EntityEvent } from "@arkiv-network/sdk"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { useEffect, useRef, useState } from "react"
import { webSocket } from "viem"
import { pub } from "../shared/sayso"
import { onRelay, read, relayed } from "./data"

// No fromBlock: with a WebSocket transport that makes it a real subscription instead of polling.
// Arkiv's socket shares the anonymous read quota, so once this network is over it (the upgrade gets
// HTTP 429, or reads have already moved to the relay) the stream moves to our keyed relay, /api/events.
const relayUrl = () => `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/events`
let client = createPublicClient({ chain: tiramisu, transport: webSocket() })
let unwatch: (() => void) | undefined
let viaRelay = false

type Listener = (e: EntityEvent) => void
const listeners = new Set<Listener>()
let started = false
// True after a transport error until the next event arrives. A quiet chain is not a down socket.
let down = false
const stateListeners = new Set<() => void>()
const setDown = (v: boolean) => {
  if (down === v) return
  down = v
  stateListeners.forEach((l) => l())
}
export const feed: EntityEvent[] = []

function subscribe() {
  unwatch?.()
  unwatch = client.watchEntityEvents({
    onEvent: (e) => {
      setDown(false)
      anchor(e.blockNumber)
      feed.unshift(e)
      feed.length = Math.min(feed.length, 50)
      listeners.forEach((l) => l(e))
    },
    onError: (err) => {
      setDown(true)
      console.warn("arkiv events", err?.message ?? err)
      toRelay()
    },
  })
  // A connected socket counts as up even before the first event (a quiet chain sends none).
  const t = client.transport as unknown as { getRpcClient?: () => Promise<{ socket: WebSocket }> }
  t.getRpcClient?.()
    .then((c) => c.socket.readyState === WebSocket.OPEN && setDown(false))
    .catch(() => {
      setDown(true)
      toRelay()
    })
}

function toRelay() {
  if (viaRelay) return
  viaRelay = true
  client = createPublicClient({ chain: tiramisu, transport: webSocket(relayUrl()) })
  subscribe()
}

function start() {
  if (started) return
  started = true
  subscribe()
  // Reads hit the quota first: follow them to the relay before the socket fails too.
  if (relayed) toRelay()
  else onRelay(toRelay)
}

/** Whether the event stream has reported an error and not delivered an event since. */
export function useStreamDown(): boolean {
  const [, tick] = useState(0)
  useEffect(() => {
    start()
    const l = () => tick((n) => n + 1)
    stateListeners.add(l)
    return () => void stateListeners.delete(l)
  }, [])
  return down
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

/**
 * Safety net only: calls `fn` every `ms` while the event socket is reporting errors, so a dropped
 * subscription cannot leave a screen stale. While the socket is healthy it never reads anything.
 */
export function useFallbackPoll(fn: () => void, ms = 120000) {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    const t = setInterval(() => down && ref.current(), ms)
    return () => clearInterval(t)
  }, [ms])
}

export type Clock = { block: bigint; blockMs: number; at: number }

// One clock for the whole page: read once, then re-anchored to the block number of every event the
// socket delivers, so it costs one read per page load instead of one a minute.
let base: Clock | null = null
let reading: Promise<Clock> | null = null
const clockListeners = new Set<() => void>()

function anchor(block: bigint) {
  if (!base || block <= now(base).block) return
  base = { ...base, block, at: Date.now() }
  clockListeners.forEach((l) => l())
}

const now = (b: Clock): Clock => ({ ...b, block: b.block + BigInt(Math.floor((Date.now() - b.at) / b.blockMs)), at: Date.now() })

/** The current block, from the shared clock. Reads Arkiv only the first time. */
export function blockNow(): Promise<Clock> {
  if (base) return Promise.resolve(now(base))
  reading ??= read(() => pub.getBlockTiming()).then((t) => {
    base = { block: t.currentBlock, blockMs: t.blockDuration * 1000, at: Date.now() }
    clockListeners.forEach((l) => l())
    return base
  })
  reading.catch(() => (reading = null))
  return reading.then(now)
}

/** Current block, interpolated so countdowns tick every second. The tick is local; it reads nothing. */
export function useBlockClock(): Clock | null {
  const [, tick] = useState(0)
  useEffect(() => {
    start()
    const l = () => tick((n) => n + 1)
    clockListeners.add(l)
    blockNow().catch(() => undefined)
    const b = setInterval(l, 1000)
    // If the socket is down nothing re-anchors the clock; re-read it now and then until it is back.
    const a = setInterval(() => {
      if (!down) return
      base = null
      reading = null
      blockNow().catch(() => undefined)
    }, 300000)
    return () => {
      clockListeners.delete(l)
      clearInterval(a)
      clearInterval(b)
    }
  }, [])
  return base ? now(base) : null
}

/**
 * Arkiv emits no event when an entity expires, so a screen showing something that will expire calls
 * `fn` once, just after the earliest of `blocks` (block numbers still in the future), instead of polling.
 */
export function useReadAt(fn: () => void, blocks: readonly (bigint | undefined)[]) {
  const ref = useRef(fn)
  ref.current = fn
  const clock = useBlockClock()
  const cur = clock?.block
  const next = cur === undefined ? undefined : blocks.filter((b): b is bigint => b !== undefined && b > cur).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))[0]
  const key = next?.toString()
  const ms = clock?.blockMs
  useEffect(() => {
    if (key === undefined || !base || !ms) return
    // Two blocks of slack so the node has dropped the entity by the time we ask. setTimeout caps near 24.8 days.
    const wait = Math.min((Number(BigInt(key) - now(base).block) + 2) * ms, 2 ** 31 - 1)
    const t = setTimeout(() => ref.current(), Math.max(wait, 1000))
    return () => clearTimeout(t)
  }, [key, ms])
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
