// A small dropdown that matches the rest of the UI instead of the browser's native select.
// Keyboard: Enter/Space/ArrowDown opens, arrows move, Enter picks, Escape closes.
import { Check, ChevronDown } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"

export type Option = { value: string; label: string }

export function Select({ value, options, onChange, label }: { value: string; options: Option[]; onChange: (v: string) => void; label: string }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(() => Math.max(0, options.findIndex((o) => o.value === value)))
  const root = useRef<HTMLDivElement>(null)
  const id = useId()
  const current = options.find((o) => o.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [open])

  // Keep the highlighted row visible when arrowing through a long list.
  useEffect(() => {
    if (open) root.current?.querySelector(".select-list li.active")?.scrollIntoView({ block: "nearest" })
  }, [open, active])

  const pick = (i: number) => {
    onChange(options[i].value)
    setOpen(false)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (!open && ["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
      e.preventDefault()
      setActive(Math.max(0, options.findIndex((o) => o.value === value)))
      setOpen(true)
      return
    }
    if (!open) return
    if (e.key === "Escape") setOpen(false)
    else if (e.key === "ArrowDown") setActive((a) => Math.min(options.length - 1, a + 1))
    else if (e.key === "ArrowUp") setActive((a) => Math.max(0, a - 1))
    else if (e.key === "Enter" || e.key === " ") pick(active)
    else return
    e.preventDefault()
  }

  return (
    <div className="select" ref={root}>
      <button
        type="button"
        className={`select-btn ${open ? "open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKey}
      >
        <span>{current.label}</span>
        <ChevronDown size={16} className="chev" />
      </button>
      {open ? (
        <ul className="select-list" role="listbox" id={id} aria-label={label}>
          {options.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={`${i === active ? "active" : ""} ${o.value === value ? "selected" : ""}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(i)
              }}
            >
              <span>{o.label}</span>
              {o.value === value ? <Check size={15} /> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
