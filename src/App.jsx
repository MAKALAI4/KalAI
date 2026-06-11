import { useEffect, useRef, useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import StickyRail, { FloatingStickies, useIsMobile } from './components/StickyRail.jsx'
import { useStore } from './store/StoreContext.jsx'
import Dashboard from './views/Dashboard.jsx'
import Planner from './views/Planner.jsx'
import Workouts from './views/Workouts.jsx'
import Budget from './views/Budget.jsx'
import Groceries from './views/Groceries.jsx'
import Notes from './views/Notes.jsx'
import Profile from './views/Profile.jsx'

export const VIEWS = [
  { id: 'dashboard', label: 'Dashboard', icon: '◧' },
  { id: 'planner', label: 'Planner', icon: '☀' },
  { id: 'workouts', label: 'Workouts', icon: '⚡' },
  { id: 'budget', label: 'Budget', icon: '◍' },
  { id: 'groceries', label: 'Shopping', icon: '🛒' },
  { id: 'notes', label: 'Notes', icon: '✎' },
  { id: 'profile', label: 'Profile', icon: '👤' },
]

/* Android Chrome forbids `new Notification()` in page context —
   notifications must go through the service worker when available. */
function showNotification(title, body) {
  const opts = { body, icon: `${import.meta.env.BASE_URL}icon-192.png` }
  const fallback = () => {
    try {
      new Notification(title, opts)
    } catch {
      /* unsupported context */
    }
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => {
        if (reg && reg.showNotification) reg.showNotification(title, opts)
        else fallback()
      })
      .catch(fallback)
  } else {
    fallback()
  }
}

export default function App() {
  const { state } = useStore()
  const [view, setView] = useState('dashboard')
  const [theme, setTheme] = useState(() => localStorage.getItem('kalai-theme') || 'dark')
  const [side, setSide] = useState(() => localStorage.getItem('kalai-side') || 'left')
  const [privacy, setPrivacy] = useState(() => localStorage.getItem('kalai-privacy') === '1')
  const [drawer, setDrawer] = useState(false)
  const isMobile = useIsMobile()

  const viewRef = useRef(view)
  viewRef.current = view
  const drawerRef = useRef(drawer)
  drawerRef.current = drawer

  /* Mobile swipe navigation:
     swipe left  → Dashboard → Planner → Profile (and closes the menu)
     swipe right → Profile → Planner → Dashboard;
                   on Dashboard it opens the categories menu;
                   on a category page it goes back to Dashboard. */
  useEffect(() => {
    if (!isMobile) return
    const TABS = ['dashboard', 'planner', 'profile']
    let sx = null
    let sy = null
    let blocked = false
    const onStart = (e) => {
      const t = e.touches[0]
      sx = t.clientX
      sy = t.clientY
      blocked = !!e.target.closest('.drag-handle, .modal, input, textarea, select, .sticky, .dash-slot.unlocked, .check')
    }
    const onEnd = (e) => {
      if (sx == null || blocked) {
        sx = null
        return
      }
      const t = e.changedTouches[0]
      const dx = t.clientX - sx
      const dy = Math.abs(t.clientY - sy)
      sx = null
      if (Math.abs(dx) < 70 || dy > 70) return
      const cur = viewRef.current
      const i = TABS.indexOf(cur)
      if (dx < 0) {
        // swipe left
        if (drawerRef.current) setDrawer(false)
        else if (i >= 0 && i < TABS.length - 1) setView(TABS[i + 1])
      } else {
        // swipe right
        if (drawerRef.current) return
        if (cur === 'dashboard') setDrawer(true)
        else if (i > 0) setView(TABS[i - 1])
        else if (i === -1) setView('dashboard')
      }
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchend', onEnd)
    }
  }, [isMobile])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('kalai-theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('kalai-side', side)
  }, [side])

  useEffect(() => {
    localStorage.setItem('kalai-privacy', privacy ? '1' : '0')
  }, [privacy])

  const toggleSide = () => setSide((s) => (s === 'left' ? 'right' : 'left'))
  const togglePrivacy = () => setPrivacy((p) => !p)

  // Workout reminders: 1 h and 30 min before a session (while app is open).
  useEffect(() => {
    const check = () => {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
      let fired
      try {
        fired = JSON.parse(localStorage.getItem('kalai-notified') || '[]')
      } catch {
        fired = []
      }
      const now = Date.now()
      let changed = false
      state.workouts
        .filter((w) => !w.completed && w.date && w.time)
        .forEach((w) => {
          const target = new Date(`${w.date}T${w.time}`).getTime()
          for (const min of [60, 30]) {
            const key = `${w.id}-${min}`
            const diff = (target - now) / 60000
            if (diff <= min && diff > min - 6 && !fired.includes(key)) {
              showNotification(
                `Workout in ${min === 60 ? '1 hour' : '30 minutes'}`,
                `${w.name}${w.time ? ` — ${w.time}` : ''}`,
              )
              fired.push(key)
              changed = true
            }
          }
        })
      if (changed) localStorage.setItem('kalai-notified', JSON.stringify(fired.slice(-60)))
    }
    check()
    const t = setInterval(check, 60000)
    return () => clearInterval(t)
  }, [state.workouts])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  const renderView = () => {
    switch (view) {
      case 'planner':
        return <Planner goTo={setView} />
      case 'workouts':
        return <Workouts goTo={setView} />
      case 'budget':
        return <Budget goTo={setView} />
      case 'groceries':
        return <Groceries goTo={setView} />
      case 'notes':
        return <Notes goTo={setView} />
      case 'profile':
        return (
          <Profile
            goTo={setView}
            theme={theme}
            toggleTheme={toggleTheme}
            privacy={privacy}
            togglePrivacy={togglePrivacy}
            side={side}
            toggleSide={toggleSide}
          />
        )
      default:
        return <Dashboard goTo={setView} />
    }
  }

  return (
    <div className={`app sidebar-${side} ${privacy ? 'privacy' : ''}`}>
      <Sidebar
        view={view}
        setView={setView}
        theme={theme}
        toggleTheme={toggleTheme}
        side={side}
        toggleSide={toggleSide}
        privacy={privacy}
        togglePrivacy={togglePrivacy}
        drawer={drawer}
        setDrawer={setDrawer}
      />
      <main className="main">
        <div className="page-topbar">
          {isMobile && view === 'dashboard' ? (
            <button className="privacy-top" onClick={() => setDrawer(true)} title="Open categories menu">
              ☰<span>Menu</span>
            </button>
          ) : (
            <span />
          )}
          <button
            className={`privacy-top ${privacy ? 'on' : ''}`}
            onClick={togglePrivacy}
            title={privacy ? 'Show sensitive content' : 'Blur sensitive content (privacy)'}
          >
            {privacy ? '◉' : '◎'}
            <span>{privacy ? 'Privacy on' : 'Privacy'}</span>
          </button>
        </div>
        <div className="main-inner">
          <div className="view-area">{renderView()}</div>
          {view !== 'profile' && <StickyRail view={view} showAll={view === 'notes'} />}
        </div>
        <FloatingStickies view={view} />
      </main>
    </div>
  )
}
