import { useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import DashboardCard from '../components/DashboardCard.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import {
  getTodayAgenda,
  getNextWorkout,
  getBudgetSummary,
  getPacing,
  getGroceryBudget,
  getGroceryListStats,
  getSortedNotes,
  formatDate,
  formatMoney,
} from '../store/selectors.js'
import { DEFAULT_DASH_ORDER } from '../store/persistence.js'

export default function Dashboard({ goTo }) {
  const { state, dispatch } = useStore()
  const [dragId, setDragId] = useState(null)
  const [overId, setOverId] = useState(null)
  const [locked, setLocked] = useState(true)

  const agenda = getTodayAgenda(state)
  const remainingToday = agenda.filter((a) => !a.done)
  const nextWorkout = getNextWorkout(state)
  const budget = getBudgetSummary(state)
  const pacing = getPacing(state)
  const groceryBudget = getGroceryBudget(state)
  const groceryList = getGroceryListStats(state)
  const notes = getSortedNotes(state).slice(0, 2)

  const order = state.dashOrder || DEFAULT_DASH_ORDER

  /* Pointer-based drag (mouse AND touch — HTML5 drag doesn't work on
     phones). While unlocked, clicks into categories are disabled. */
  const startDrag = (e, id) => {
    if (locked) return
    e.preventDefault()
    setDragId(id)
    const slotAt = (ev) => document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.dash-slot')
    const onMove = (ev) => {
      const el = slotAt(ev)
      setOverId(el ? el.dataset.slot : null)
    }
    const onUp = (ev) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      const el = slotAt(ev)
      const target = el?.dataset.slot
      if (target && target !== id) {
        const next = order.filter((x) => x !== id)
        next.splice(next.indexOf(target) + (order.indexOf(id) < order.indexOf(target) ? 1 : 0), 0, id)
        dispatch({ type: 'dash/setOrder', order: next })
      }
      setDragId(null)
      setOverId(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const CARDS = {
    planner: (
      <DashboardCard icon="☀" color="accent" title="Planner" hint="Today's agenda" onClick={() => goTo('planner')}>
        <div className="dash-stat">
          {remainingToday.length}
          <span className="unit">item{remainingToday.length !== 1 ? 's' : ''} left today</span>
        </div>
        {remainingToday.slice(0, 3).map((item) => (
          <div className="dash-row" key={item.kind + item.id}>
            <span className="tag tag-accent">{item.time || '—'}</span>
            <span className="ellip">{item.title}</span>
            {item.kind === 'workout' && <span className="tag tag-teal">workout</span>}
            {item.kind === 'recurring' && <span className="tag tag-purple">↻</span>}
            {item.kind === 'shopping' && <span className="tag tag-orange">🛒</span>}
          </div>
        ))}
        {remainingToday.length === 0 && <span>All clear — nothing left for today ✓</span>}
      </DashboardCard>
    ),
    notes: (
      <DashboardCard
        icon="✎"
        color="purple"
        title="Notes"
        hint={`${state.notes.length} note${state.notes.length !== 1 ? 's' : ''} · ${state.stickies.length} sticky`}
        onClick={() => goTo('notes')}
      >
        {notes.length > 0 ? (
          notes.map((n) => (
            <div className="dash-row" key={n.id}>
              {n.pinned && <span className="tag tag-orange">pin</span>}
              <span className="ellip">{n.text}</span>
            </div>
          ))
        ) : (
          <span>No notes yet — capture an idea.</span>
        )}
      </DashboardCard>
    ),
    workouts: (
      <DashboardCard icon="⚡" color="teal" title="Workouts" hint="Next session" onClick={() => goTo('workouts')}>
        {nextWorkout ? (
          <>
            <div className="dash-stat">{formatDate(nextWorkout.date)}</div>
            <div className="dash-row">
              <span className="tag tag-teal">{nextWorkout.time || 'any time'}</span>
              <span className="ellip">{nextWorkout.name}</span>
            </div>
            <span>{nextWorkout.exercises.length} exercise{nextWorkout.exercises.length !== 1 ? 's' : ''} planned</span>
          </>
        ) : (
          <span>No upcoming session — plan one!</span>
        )}
      </DashboardCard>
    ),
    budget: (
      <DashboardCard icon="◍" color="green" title="Budget" hint="This month" onClick={() => goTo('budget')}>
        <div className="dash-stat">
          {formatMoney(budget.remaining)} €<span className="unit">left of {formatMoney(budget.income)} €</span>
        </div>
        <ProgressBar
          ratio={budget.income > 0 ? budget.totalSpent / budget.income : 0}
          over={budget.totalSpent > budget.income}
        />
        <span style={{ color: pacing.delta >= 0 ? 'var(--green)' : 'var(--red)' }}>
          {pacing.delta >= 0 ? '+' : '−'}
          {formatMoney(Math.abs(pacing.delta))} € vs expected pace
        </span>
      </DashboardCard>
    ),
    groceries: (
      <DashboardCard icon="🛒" color="orange" title="Groceries" hint="Shopping list" onClick={() => goTo('groceries')}>
        <div className="dash-stat">
          {groceryList.toBuy.length}
          <span className="unit">item{groceryList.toBuy.length !== 1 ? 's' : ''} to buy</span>
        </div>
        {groceryBudget && (
          <>
            <ProgressBar ratio={groceryBudget.ratio} over={groceryBudget.over} />
            <span>
              Grocery budget: {formatMoney(groceryBudget.remaining)} € left of{' '}
              {formatMoney(groceryBudget.allocated)} €
            </span>
          </>
        )}
      </DashboardCard>
    ),
  }

  return (
    <div>
      <div className="page-header">
        <div className="titles">
          <h1>What's for today? 👋</h1>
          <div className="subtitle">{todayLabel}</div>
          <button
            className={`layout-lock ${locked ? '' : 'on'}`}
            onClick={() => setLocked((l) => !l)}
            title={locked ? 'Unlock to rearrange the blocks' : 'Lock the layout'}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="11" width="16" height="9" rx="2" />
              {locked ? <path d="M8 11V7a4 4 0 0 1 8 0v4" /> : <path d="M8 11V7a4 4 0 0 1 7.5-1.9" />}
            </svg>
            <span>{locked ? 'layout locked' : 'drag to rearrange'}</span>
          </button>
        </div>
      </div>

      <div className="dash-grid">
        {order.map(
          (id) =>
            CARDS[id] && (
              <div
                key={id}
                data-slot={id}
                className={`dash-slot ${overId === id ? 'drag-over' : ''} ${dragId === id ? 'row-dragging' : ''} ${locked ? '' : 'unlocked'}`}
                onPointerDown={locked ? undefined : (e) => startDrag(e, id)}
              >
                {CARDS[id]}
              </div>
            ),
        )}
      </div>
    </div>
  )
}
