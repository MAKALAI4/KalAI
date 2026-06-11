import { useRef } from 'react'
import { VIEWS } from '../App.jsx'
import { useStore } from '../store/StoreContext.jsx'
import { exportData, importData } from '../store/persistence.js'

export default function Sidebar({ view, setView, theme, toggleTheme, side, toggleSide, privacy, togglePrivacy }) {
  const { state, dispatch } = useStore()
  const fileRef = useRef(null)

  const handleImport = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      importData(file, (data) => dispatch({ type: 'data/replace', payload: data }))
    }
    e.target.value = ''
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="logo">K</span>
        <span>KalAI</span>
      </div>

      <nav className="sidebar-nav">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            className={`nav-item ${view === v.id ? 'active' : ''}`}
            onClick={() => setView(v.id)}
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
  )
}
