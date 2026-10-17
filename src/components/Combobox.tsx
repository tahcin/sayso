// A text box with a list of suggestions under it (WAI-ARIA combobox, list autocomplete).
// Keyboard: typing or ArrowDown opens, arrows move, Enter picks, Escape closes, Tab leaves.
// The parent owns the text and the options, so results can come from anywhere (a local list, Arkiv).
import { Check, Search } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import "./Combobox.css"

export type ComboOption = { id: string; label: string; hint?: string; tag?: string }

export function Combobox(props: {
  label: string
  text: string
  onText: (t: string) => void
  options: ComboOption[]
  selected?: string
  onPick: (o: ComboOption) => void
  placeholder?: string
  /** Shown above the options while a search runs, or when it fails. */
  status?: React.ReactNode
  /** Shown under the options (not an option itself), e.g. a hint when nothing matched. */
  footer?: React.ReactNode
}) {
  const { options } = props
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const id = useId()
  const optId = (i: number) => `${id}-o${i}`

  // Keep the highlight on a real row as results change underneath it.
  useEffect(() => setActive((a) => Math.min(a, Math.max(0, options.length - 1))), [options.length])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [open])

  useEffect(() => {
    if (open) list.current?.querySelector(`#${CSS.escape(optId(active))}`)?.scrollIntoView({ block: "nearest" })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, open])

  const pick = (i: number) => {
    const o = options[i]
    if (!o) return
    props.onPick(o)
    setOpen(false)
  }

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      const n = options.length
      if (!n) return
      setActive((a) => (e.key === "ArrowDown" ? (a + 1) % n : (a - 1 + n) % n))
    } else if (e.key === "Enter") {
      if (open && options.length) {
        e.preventDefault()
        pick(active)
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault()
        setOpen(false)
      }
    } else if (e.key === "Tab") setOpen(false)
  }

  const showList = open && (options.length > 0 || props.status || props.footer)

  return (
    <div className="combo" ref={root}>
      <div className={`combo-box ${open ? "open" : ""}`}>
        <Search size={15} className="combo-icon" aria-hidden />
        <input
          ref={input}
          role="combobox"
          aria-label={props.label}
          aria-autocomplete="list"
          aria-expanded={!!showList}
          aria-controls={`${id}-list`}
          aria-activedescendant={showList && options.length ? optId(active) : undefined}
          autoComplete="off"
          spellCheck={false}
          value={props.text}
          placeholder={props.placeholder}
          onChange={(e) => {
            props.onText(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onFocus={(e) => {
            e.target.select()
            setOpen(true)
          }}
          onClick={() => setOpen(true)}
          onKeyDown={onKey}
        />
      </div>
      {showList ? (
        <div className="combo-pop">
          {props.status ? (
            <div className="combo-status" aria-live="polite">
              {props.status}
            </div>
          ) : null}
          {options.length ? (
            <ul className="combo-list" role="listbox" id={`${id}-list`} aria-label={props.label} ref={list}>
              {options.map((o, i) => (
                <li
                  key={o.id}
                  id={optId(i)}
                  role="option"
                  aria-selected={i === active}
                  className={`${i === active ? "active" : ""} ${o.id === props.selected ? "selected" : ""}`}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    pick(i)
                  }}
                >
                  <span className="combo-text">
                    <span className="combo-label">{o.label}</span>
                    {o.hint ? <span className="combo-hint">{o.hint}</span> : null}
                  </span>
                  {o.tag ? <span className="combo-tag">{o.tag}</span> : null}
                  {o.id === props.selected ? <Check size={15} className="combo-check" /> : null}
                </li>
              ))}
            </ul>
          ) : (
            <ul className="combo-list" role="listbox" id={`${id}-list`} aria-label={props.label} />
          )}
          {props.footer ? <div className="combo-foot">{props.footer}</div> : null}
        </div>
      ) : null}
    </div>
  )
}
