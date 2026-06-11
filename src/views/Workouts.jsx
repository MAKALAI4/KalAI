import { useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Modal from '../components/Modal.jsx'
import { getWorkoutsSplit, formatDate } from '../store/selectors.js'
import { todayISO } from '../store/persistence.js'

const emptyForm = () => ({
  name: '',
  date: todayISO(),
  time: '',
  exercises: [{ name: '', sets: 3, reps: 10, weight: '' }],
})

export default function Workouts({ goTo }) {
  const { state, dispatch } = useStore()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [notifPerm, setNotifPerm] = useState(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
  )

  const { upcoming, past } = getWorkoutsSplit(state)
  const templates = state.workoutTemplates || []

  const enableReminders = () => {
    Notification.requestPermission().then((p) => setNotifPerm(p))
  }

  const useTemplate = (t) => {
    setForm({
      name: t.name,
      date: todayISO(),
      time: '',
      exercises: t.exercises.length
        ? t.exercises.map((ex) => ({ ...ex }))
        : [{ name: '', sets: 3, reps: 10, weight: '' }],
    })
    setShowForm(true)
  }

  const setExo = (i, patch) => {
    const exercises = form.exercises.map((ex, idx) => (idx === i ? { ...ex, ...patch } : ex))
    setForm({ ...form, exercises })
  }

  const submit = (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.date) return
    const exercises = form.exercises
      .filter((ex) => ex.name.trim())
      .map((ex) => ({
        name: ex.name.trim(),
        sets: Number(ex.sets) || 0,
        reps: Number(ex.reps) || 0,
        weight: Number(ex.weight) || 0,
      }))
    dispatch({ type: 'workout/add', payload: { name: form.name.trim(), date: form.date, time: form.time, exercises } })
    setForm(emptyForm())
    setShowForm(false)
  }

  const WorkoutCard = ({ w }) => (
    <div className="item-row" style={{ alignItems: 'flex-start' }}>
      <button
        className={`check ${w.completed ? 'checked' : ''}`}
        onClick={() => dispatch({ type: 'workout/toggle', id: w.id })}
        aria-label="toggle completed"
        style={{ marginTop: 3 }}
      >
        ✓
      </button>
      <div className="grow">
        <div className="title" style={w.completed ? { textDecoration: 'line-through', color: 'var(--text-faint)' } : null}>
          {w.name}
        </div>
        <div className="meta">
          <span className="tag tag-teal">{formatDate(w.date)}</span>
          {w.time && <span>{w.time}</span>}
          {w.date === todayISO() && !w.completed && (
            <button className="tag tag-accent" onClick={() => goTo('planner')}>
              ☀ in today's planner
            </button>
          )}
        </div>
        {w.exercises.length > 0 && (
          <div className="exo-list">
            {w.exercises.map((ex, i) => (
              <div className="exo-row" key={i}>
                <span className="exo-name">{ex.name}</span>
                <span>
                  {ex.sets} × {ex.reps}
                  {ex.weight ? ` @ ${ex.weight} kg` : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <button
        className="icon-btn"
        onClick={() => dispatch({ type: 'template/saveFromWorkout', workoutId: w.id })}
        title="Save as template"
      >
        ⧉
      </button>
      <button className="icon-btn danger" onClick={() => dispatch({ type: 'workout/delete', id: w.id })} aria-label="delete">
        ✕
      </button>
    </div>
  )

  return (
    <div>
      <PageHeader
        title="Workouts"
        subtitle="Sessions scheduled today appear automatically in your Daily Planner"
        goTo={goTo}
        action={
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + Plan session
          </button>
        }
      />

      {notifPerm === 'default' && (
        <div className="link-banner" style={{ borderLeftColor: 'var(--teal)' }}>
          <div className="grow">
            <div className="label">Workout reminders</div>
            <div style={{ fontSize: 15, color: 'var(--text-dim)' }}>
              Get notified 1 hour and 30 minutes before each session (while the app is open).
            </div>
          </div>
          <button className="btn btn-primary" onClick={enableReminders}>
            Enable reminders
          </button>
        </div>
      )}
      {notifPerm === 'granted' && (
        <div style={{ marginBottom: 14 }}>
          <span className="tag tag-teal">🔔 Reminders on — 1 h & 30 min before each session</span>
        </div>
      )}
      {notifPerm === 'denied' && (
        <div style={{ marginBottom: 14, fontSize: 14, color: 'var(--text-faint)' }}>
          Notifications are blocked in your browser settings — reminders can't be shown.
        </div>
      )}

      <div className="section-label">Upcoming</div>
      <div className="card">
        {upcoming.length === 0 ? (
          <div className="empty">
            <span className="empty-icon">⚡</span>
            No upcoming session. Plan one — it will show up in your planner on that day.
          </div>
        ) : (
          <div className="item-list">
            {upcoming.map((w) => (
              <WorkoutCard w={w} key={w.id} />
            ))}
          </div>
        )}
      </div>

      {templates.length > 0 && (
        <>
          <div className="section-label">Templates</div>
          <div className="card">
            <div className="item-list">
              {templates.map((t) => (
                <div className="item-row" key={t.id}>
                  <span style={{ fontSize: 17 }}>⧉</span>
                  <div className="grow">
                    <div className="title">{t.name}</div>
                    <div className="meta">
                      {t.exercises.length} exercise{t.exercises.length !== 1 ? 's' : ''} ·{' '}
                      {t.exercises.map((e) => e.name).join(', ')}
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => useTemplate(t)}>
                    Schedule →
                  </button>
                  <button className="icon-btn danger" onClick={() => dispatch({ type: 'template/delete', id: t.id })} title="Delete template">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {past.length > 0 && (
        <>
          <div className="section-label">History</div>
          <div className="card">
            <div className="item-list">
              {past.slice(0, 10).map((w) => (
                <WorkoutCard w={w} key={w.id} />
              ))}
            </div>
          </div>
        </>
      )}

      {showForm && (
        <Modal title="Plan a session" onClose={() => setShowForm(false)}>
          <form className="form-grid" onSubmit={submit}>
            <div className="field">
              <label>Session name</label>
              <input
                autoFocus
                placeholder="e.g. Legs day"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="form-row">
              <div className="field">
                <label>Date</label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="field">
                <label>Time (optional)</label>
                <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
              </div>
            </div>

            <div className="field">
              <label>Exercises</label>
              {form.exercises.map((ex, i) => (
                <div className="form-row" key={i} style={{ marginBottom: 8 }}>
                  <input
                    placeholder="Exercise"
                    value={ex.name}
                    onChange={(e) => setExo(i, { name: e.target.value })}
                    style={{ flex: 2 }}
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="Sets"
                    title="Sets"
                    value={ex.sets}
                    onChange={(e) => setExo(i, { sets: e.target.value })}
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="Reps"
                    title="Reps"
                    value={ex.reps}
                    onChange={(e) => setExo(i, { reps: e.target.value })}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="kg"
                    title="Weight (kg)"
                    value={ex.weight}
                    onChange={(e) => setExo(i, { weight: e.target.value })}
                  />
                </div>
              ))}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setForm({ ...form, exercises: [...form.exercises, { name: '', sets: 3, reps: 10, weight: '' }] })}
              >
                + Add exercise
              </button>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save session
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
