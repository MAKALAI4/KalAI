import { useEffect, useRef, useState } from 'react'
import { VIEWS } from '../App.jsx'
import { useStore } from '../store/StoreContext.jsx'
import { exportData, importData } from '../store/persistence.js'
import { useIsMobile } from './StickyRail.jsx'

const MOBILE_TABS = ['dashboard', 'planner', 'profile']

export default function Sidebar({ view, setView, theme, toggleTheme, side, toggleSide, privacy, togglePrivacy }) {
  const { state, dispatch } = useStore()
  const fileRef = useRef(null)
  const isMobile = useIsMobile()
  const [drawer, setDrawer] = useState(false)

  const handleImport = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      importData(file, (data) => dispatch({ type: 'data/replace', payload: data }))
    }
    e.target.value = ''
  }

  const navItems = isMobile ? VIEWS.filter((v) => MOBILE_TABS.includes(v.id)) : VIEWS
  const drawerItems = VIEWS.filter((v) => !MOBILE_TABS.includes(v.id))

  const drawerOpenRef = useRef(false)
  drawerOpenRef.current = drawer

  // Open the categories drawer by swiping right from the left edge,
  // close it by swiping left anywhere.
  useEffect(() => {
    if (!isMobile) return
    let startX = null
    let startY = null
    let fromEdge = false
    const onStart = (e) => {
      const t = e.touches[0]
      startX = t.clientX
      startY = t.clientY
      fromEdge = t.clientX < 32
    }
    const onMove = (e) => {
      if (startX == null) return
      const t = e.touches[0]
      const dx = t.clientX - startX
      const dy = Math.abs(t.clientY - startY)
      if (dy > 70) {
        startX = null
        return
      }
      if (!drawerOpenRef.current && fromEdge && dx > 55) {
        setDrawer(true)
        startX = null
      } else if (drawerOpenRef.current && dx < -55) {
        setDrawer(false)
        startX = null
      }
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
    }
  }, [isMobile])

  const go = (id) => {
    setView(id)
    setDrawer(false)
  }

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="logo">K</span>
          <span>KalAI</span>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((v) => (
            <button
              key={v.id}
              className={`nav-item ${view === v.id ? 'active' : ''}`}
              onClick={() => go(v.id)}
            >
              <span className="nav-icon">{v.icon}</span>
              <span>{v.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            className="nav-item"
            onClick={togglePrivacy}
            title="Blur all sensitive content (budget amounts, notes, sticky notes) in one click"
          >
            <span className="nav-icon">{privacy ? '◉' : '◎'}</span>
            <span>{privacy ? 'Privacy on' : 'Privacy mode'}</span>
          </button>
          <button className="nav-item" onClick={toggleSide} title={side === 'left' ? 'Move sidebar to the right' : 'Move sidebar to the left'}>
            <span className="nav-icon">{side === 'left' ? '⇉' : '⇇'}</span>
            <span>{side === 'left' ? 'Sidebar right' : 'Sidebar left'}</span>
          </button>
          <button className="nav-item" onClick={toggleTheme}>
            <span className="nav-icon">{theme === 'dark' ? '☀' : '☾'}</span>
            <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>
          <button className="nav-item" onClick={() => exportData(state)}>
            <span className="nav-icon">⇩</span>
            <span>Export data</span>
          </button>
          <button className="nav-item" onClick={() => fileRef.current?.click()}>
            <span className="nav-icon">⇧</span>
            <span>Import data</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={handleImport}
          />
        </div>
      </aside>

      {/* Mobile: retractable category menu on the LEFT edge —
          swipe right from the edge (or tap the tab) to open */}
      {isMobile && (
        <>
          <button className="drawer-tab" onClick={() => setDrawer(true)} aria-label="Open categories menu">
            ❯
          </button>
          {drawer && (
            <div className="drawer-backdrop" onClick={() => setDrawer(false)}>
              <div className="drawer" onClick={(e) => e.stopPropagation()}>
                <div className="drawer-title">Categories</div>
                {drawerItems.map((v) => (
                  <button
                    key={v.id}
                    className={`nav-item ${view === v.id ? 'active' : ''}`}
                    onClick={() => go(v.id)}
                  >
                    <span className="nav-icon">{v.icon}</span>
                    <span>{v.label}</span>
                  </button>
                ))}
                <button className="nav-item" style={{ marginTop: 'auto' }} onClick={() => setDrawer(false)}>
                  <span className="nav-icon">❮</span>
                  <span>Close</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}
