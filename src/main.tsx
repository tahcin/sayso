import React, { StrictMode, useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import Board from "./pages/Board"
import Dev from "./pages/Dev"
import Try from "./pages/Try"
import "./styles.css"

const ROUTES: Record<string, () => React.JSX.Element> = { "/": Try, "/board": Board, "/developers": Dev }

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
      history.pushState(null, "", a.pathname)
      setPath(a.pathname)
      window.scrollTo(0, 0)
    }
    document.addEventListener("click", click)
    return () => {
      window.removeEventListener("popstate", on)
      document.removeEventListener("click", click)
    }
  }, [])
  const Page = ROUTES[path] ?? Try
  return (
    <>
      <header className="top">
        <a href="/" className="brand">
          <img src="/favicon.svg" alt="" width={26} height={26} /> Say So
        </a>
        <nav>
          <a href="/" className={path === "/" ? "on" : ""}>
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
        </nav>
      </header>
      <Page />
      <footer>
        Built by team Solus for the Arkiv pre-Devcon challenge. Companies and vendors shown are fictional. No personal data is written to
        Arkiv: only addresses, purpose codes and times.
      </footer>
    </>
  )
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
