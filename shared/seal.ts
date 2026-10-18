// Sealed payloads for "Any app" records: AES-256-GCM with a key that only the person and whoever gets
// their letter hold. The key is derived from the record address's private key, so the recovery phrase
// still opens every record; the letter carries it after "#" in the link, which browsers never send to a server.
import { concat, keccak256, toBytes, type Hex } from "viem"

export type Sealed = { v: 1; iv: string; ct: string }

const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))

/** The record's key: keccak256(private key, label). Same phrase, same key, on any device. */
export const recordKey = (privateKey: Hex) => toBytes(keccak256(concat([toBytes(privateKey), toBytes("sayso:record-key:v1")])))
export const keyToFragment = (k: Uint8Array) => b64u(k)
export const keyFromFragment = (s: string) => unb64u(s)

const aes = (k: Uint8Array, use: KeyUsage) => crypto.subtle.importKey("raw", k as BufferSource, "AES-GCM", false, [use])

export async function seal(data: unknown, k: Uint8Array): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aes(k, "encrypt"), new TextEncoder().encode(JSON.stringify(data)))
  return { v: 1, iv: b64u(iv), ct: b64u(new Uint8Array(ct)) }
}

export async function open<T>(s: Sealed, k: Uint8Array): Promise<T> {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64u(s.iv) as BufferSource }, await aes(k, "decrypt"), unb64u(s.ct) as BufferSource)
  return JSON.parse(new TextDecoder().decode(pt)) as T
}

export const isSealed = (x: unknown): x is Sealed => !!x && typeof x === "object" && (x as Sealed).v === 1 && typeof (x as Sealed).ct === "string"
