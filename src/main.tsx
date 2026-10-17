import React, { StrictMode, useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import Board from "./pages/Board"
import Dev from "./pages/Dev"
import Home from "./pages/Home"
import { Footer } from "./components/Footer"
import { Nav } from "./components/Nav"
import "@fontsource-variable/geist"
import "@fontsource-variable/geist-mono"
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
      <Nav path={path} />
      <Page />
      <Footer />
    </>
  )
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
