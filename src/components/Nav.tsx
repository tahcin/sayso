// The site nav: transparent over the top of the page, a frosted bar with a hairline once you scroll.
// Section links on the home page, the two other pages, GitHub and Arkiv, and a menu sheet on phones.
import { ArrowRight, Menu, X } from "lucide-react"
import { useEffect, useState } from "react"

const REPO = "https://github.com/tahcin/sayso"

function GitHubIcon() {
  return (
    <svg viewBox="0 0 16 16" width="17" height="17" aria-hidden fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

export function Nav({ path }: { path: string }) {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8)
    on()
    window.addEventListener("scroll", on, { passive: true })
    return () => window.removeEventListener("scroll", on)
  }, [])
  useEffect(() => setOpen(false), [path])
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
  }, [open])

  const links = [
    { href: "/#try", label: "Demo", on: false },
    { href: "/#how", label: "How it works", on: false },
    { href: "/#why", label: "Why Arkiv", on: false },
    { href: "/board", label: "Cease board", on: path === "/board" },
    { href: "/developers", label: "Developers", on: path === "/developers" },
  ]

  return (
    <header className={`nav ${scrolled || open ? "scrolled" : ""} ${open ? "menu-open" : ""}`}>
      <div className="nav-in">
        <a href="/" className="brandmark" aria-label="Say So home">
          <img src="/favicon.svg" alt="" width={22} height={22} />
          Say So
        </a>
        <nav className="nav-links" aria-label="Main">
          {links.map((l) => (
            <a key={l.label} href={l.href} className={l.on ? "on" : ""} aria-current={l.on ? "page" : undefined}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="nav-right">
          <a className="icon-btn" href={REPO} target="_blank" rel="noreferrer" aria-label="Say So on GitHub" title="Source on GitHub">
            <GitHubIcon />
          </a>
          <span className="nav-sep" aria-hidden />
          <a href="/#try" className="btn dark small nav-cta">
            Try the demo
          </a>
          <button className="icon-btn menu-btn" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="sheet" role="dialog" aria-label="Menu">
          {links.map((l) => (
            <a key={l.label} href={l.href} onClick={() => setOpen(false)} className={l.on ? "on" : ""}>
              {l.label}
              <ArrowRight size={16} />
            </a>
          ))}
          <div className="sheet-foot">
            <a href={REPO} target="_blank" rel="noreferrer" className="btn outline">
              <GitHubIcon /> GitHub
            </a>
            <a href="/#try" className="btn dark" onClick={() => setOpen(false)}>
              Try the demo
            </a>
          </div>
        </div>
      ) : null}
    </header>
  )
}
