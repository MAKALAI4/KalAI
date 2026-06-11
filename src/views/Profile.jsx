import { useRef } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { exportData, importData } from '../store/persistence.js'
import { useIsMobile } from '../components/StickyRail.jsx'

export default function Profile({ goTo, theme, toggleTheme, privacy, togglePrivacy, side, toggleSide }) {
  const { state, dispatch } = useStore()
  const fileRef = useRef(null)
  const isMobile = useIsMobile()

  const handleImport = (e) => {
    const file = e.target.files?.[0]
    if (file) importData(file, (data) => dispatch({ type: 'data/replace', payload: data }))
    e.target.value = ''
  }

  const counts = {
    tasks: state.tasks.length + state.recurringTasks.length,
    workouts: state.workouts.length,
    expenses: state.budget.expenses.length,
    notes: state.notes.length + state.stickies.length,
  }

  return (
    <div>
      <PageHeader title="Profile" subtitle="Settings & data" goTo={goTo} />

      <div className="card">
        <div className="card-title">Appearance</div>
        <div className="profile-row">
          <div>
            <div className="title">Theme</div>
            <div className="meta-sub">Dark or milky-white light mode</div>
          </div>
          <button className="btn btn-ghost" onClick={toggleTheme}>
            {theme === 'dark' ? '☀ Switch to light' : '☾ Switch to dark'}
          </button>
        </div>
        <div className="profile-row">
          <div>
            <div className="title">Privacy mode</div>
            <div className="meta-sub">Blur all amounts, notes and sticky notes in one tap</div>
          </div>
          <button className={`btn ${privacy ? 'btn-primary' : 'btn-ghost'}`} onClick={togglePrivacy}>
            {privacy ? '◉ On' : '◎ Off'}
          </button>
        </div>
        {!isMobile && (
          <div className="profile-row">
            <div>
              <div className="title">Sidebar position</div>
              <div className="meta-sub">Left or right side of the screen</div>
            </div>
            <button className="btn btn-ghost" onClick={toggleSide}>
              {side === 'left' ? '⇉ Move right' : '⇇ Move left'}
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">My data</div>
        <div className="profile-row">
          <div>
            <div className="title">Export backup</div>
            <div className="meta-sub">
              Download everything as a JSON file — also how you move data between phone and computer
            </div>
          </div>
          <button className="btn btn-ghost" onClick={() => exportData(state)}>
            ⇩ Export
          </button>
        </div>
        <div className="profile-row">
          <div>
            <div className="title">Import backup</div>
            <div className="meta-sub">Restore from a previously exported file (replaces current data)</div>
          </div>
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            ⇧ Import
          </button>
          <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={handleImport} />
        </div>
        <div className="profile-row">
          <div>
            <div className="title">Stored on this device</div>
            <div className="meta-sub">
              {counts.tasks} tasks · {counts.workouts} workouts · {counts.expenses} expenses · {counts.notes} notes
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">About</div>
        <div style={{ color: 'var(--text-dim)', fontSize: 15 }}>
          KalAI — your life dashboard. All data lives in this browser only (localStorage); nothing is ever
          sent to a server. Installed as an app, it works fully offline.
        </div>
      </div>
    </div>
  )
}
