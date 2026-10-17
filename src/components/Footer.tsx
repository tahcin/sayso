// Site footer: what Say So is in one line, where everything lives, and the honest fine print.
import { ArrowUpRight } from "lucide-react"

const REPO = "https://github.com/tahcin/sayso"

const COLS: { title: string; links: { label: string; href: string; ext?: boolean }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Demo", href: "/#try" },
      { label: "How it works", href: "/#how" },
      { label: "Why Arkiv", href: "/#why" },
      { label: "Cease board", href: "/board" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Consent check", href: "/developers" },
      { label: "Source on GitHub", href: REPO, ext: true },
      { label: "schema.md", href: `${REPO}/blob/main/arkiv/schema.md`, ext: true },
      { label: "friction.md", href: `${REPO}/blob/main/arkiv/friction.md`, ext: true },
    ],
  },
  {
    title: "Built on Arkiv",
    links: [
      { label: "Arkiv", href: "https://arkiv.network", ext: true },
      { label: "Tiramisu explorer", href: "https://tiramisu.explorer.arkiv.network", ext: true },
      { label: "Data explorer", href: "https://data.arkiv.network", ext: true },
      { label: "Arkiv docs", href: "https://docs.arkiv.network", ext: true },
    ],
  },
]

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-in">
        <div className="footer-brand">
          <a href="/" className="brandmark">
            <img src="/favicon.svg" alt="" width={22} height={22} />
            Say So
          </a>
          <p>Consent you own. When you withdraw it, every vendor holding your data signs that it stopped, or ends up on a public list.</p>
          <a className="btn outline small" href={REPO} target="_blank" rel="noreferrer">
            Star on GitHub <ArrowUpRight size={14} />
          </a>
        </div>
        {COLS.map((c) => (
          <div key={c.title} className="footer-col">
            <span className="footer-title">{c.title}</span>
            {c.links.map((l) => (
              <a key={l.label} href={l.href} target={l.ext ? "_blank" : undefined} rel={l.ext ? "noreferrer" : undefined}>
                {l.label}
                {l.ext ? <ArrowUpRight size={12} /> : null}
              </a>
            ))}
          </div>
        ))}
      </div>
      <div className="footer-base">
        <span>© 2026 Team Solus · Built for the Arkiv pre-Devcon challenge · MIT licence</span>
        <span>Fictional companies, real Arkiv entities on the Tiramisu testnet. No personal data on chain.</span>
      </div>
    </footer>
  )
}
