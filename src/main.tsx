import React, { StrictMode, useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import Board from "./pages/Board"
import Dev from "./pages/Dev"
import Home from "./pages/Home"
import "@fontsource-variable/newsreader/opsz.css"
import "@fontsource-variable/inter"
import "@fontsource-variable/jetbrains-mono"
import "./styles.css"

const ROUTES: Record<string, () => React.JSX.Element> = { "/": Home, "/board": Board, "/developers": Dev }

function App() {
  const [path, setPath] = useState(location.pathname)
  useEffect(() => {
    const on = () => setPath(location.pathname)
    window.addEventListener("popstate", on)
    // Internal links navigate without a reload, so the WebSocket stays open.
    const click = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a")
      if (!a || a.target || a.origin !== location.origin || !(a.pathname in ROUTES) || e.metaKey || e.ctrlKey) return
      e.preventDefault()
      history.pushState(null, "", a.pathname + a.hash)
      setPath(a.pathname)
      if (a.hash) setTimeout(() => document.querySelector(a.hash)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60)
      else window.scrollTo(0, 0)
    }
    document.addEventListener("click", click)
    return () => {
      window.removeEventListener("popstate", on)
      document.removeEventListener("click", click)
    }
  }, [])
  const Page = ROUTES[path] ?? Home
  return (
    <>
      <header className="topbar">
        <nav className="pillnav glass">
          <a href="/" className="brand">
            <img src="/favicon.svg" alt="" width={22} height={22} /> Say So
          </a>
          <div className="links">
            <a href="/#demo" className={path === "/" ? "on" : ""}>
              Try it
            </a>
            <a href="/board" className={path === "/board" ? "on" : ""}>
              Cease board
            </a>
            <a href="/developers" className={path === "/developers" ? "on" : ""}>
              Developers
            </a>
            <a href="https://github.com/tahcin/sayso" target="_blank" rel="noreferrer">
              Code
            </a>
          </div>
        </nav>
      </header>
      <Page />
      <footer className="foot">
        <span>
          <strong>Say So</strong> · built by team Solus for the Arkiv pre-Devcon challenge, on Arkiv's Tiramisu testnet.
        </span>
        <span>Companies and vendors in the demo are fictional. No personal data is written to Arkiv: only addresses, purpose codes and times.</span>
      </footer>
    </>
  )
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
