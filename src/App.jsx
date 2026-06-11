import { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import StickyRail, { FloatingStickies } from './components/StickyRail.jsx'
import { useStore } from './store/StoreContext.jsx'
import Dashboard from './views/Dashboard.jsx'
import Planner from './views/Planner.jsx'
import Workouts from './views/Workouts.jsx'
import Budget from './views/Budget.jsx'
import Groceries from './views/Groceries.jsx'
import Notes from './views/Notes.jsx'

export const VIEWS = [
  { id: 'dashboard', label: 'Dashboard', icon: '◧' },
  { id: 'planner', label: 'Planner', icon: '☀' },
  { id: 'workouts', label: 'Workouts', icon: '⚡' },
  { id: 'budget', label: 'Budget', icon: '◍' },
  { id: 'groceries', label: 'Groceries', icon: '🛒' },
  { id: 'notes', label: 'Notes', icon: '✎' },
]

export default function App() {
  const { state } = useStore()
  const [view, setView] = useState('dashboard')
  const [theme, setTheme] = useState(() => localStorage.getItem('kalai-theme') || 'dark')
  const [side, setSide] = useState(() => localStorage.getItem('kalai-side') || 'left')
  const [privacy, setPrivacy] = useState(() => localStorage.getItem('kalai-privacy') === '1')

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
              new Notification(`Workout in ${min === 60 ? '1 hour' : '30 minutes'}`, {
                body: `${w.name}${w.time ? ` — ${w.time}` : ''}`,
                icon: `${import.meta.env.BASE_URL}icon-192.png`,
              })
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
      />
      <button className="theme-fab" onClick={toggleTheme} title="Toggle theme">
        {theme === 'dark' ? '☀' : '☾'}
      </button>
      <button className={`theme-fab privacy-fab ${privacy ? 'on' : ''}`} onClick={togglePrivacy} title="Privacy mode">
        {privacy ? '◉' : '◎'}
      </button>
      <main className="main">
        <div className="main-inner">
          <div className="view-area">{renderView()}</div>
          <StickyRail view={view} showAll={view === 'notes'} />
        </div>
        <FloatingStickies view={view} />
      </main>
    </div>
  )
}
