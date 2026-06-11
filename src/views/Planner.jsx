import { useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Modal from '../components/Modal.jsx'
import { getAgendaForDate, agendaKey, formatDate, recurringLabel, WEEKDAY_LABELS } from '../store/selectors.js'
import { todayISO, addDaysISO } from '../store/persistence.js'

export default function Planner({ goTo }) {
  const { state, dispatch } = useStore()
  const today = todayISO()
  const [openDays, setOpenDays] = useState(() => new Set([today]))
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ title: '', time: '', date: today, recurring: false, days: [1, 2, 3, 4, 5, 6, 0] })
  const [drag, setDrag] = useState(null) // { key, kind, id, date }
  const [overKey, setOverKey] = useState(null)
  const [overDay, setOverDay] = useState(null)
  const [edit, setEdit] = useState(null) // { kind, id, title, time, date, days }

  const next7 = [...Array(7)].map((_, i) => addDaysISO(today, i))

  const toggleDay = (date) =>
    setOpenDays((prev) => {
      const next = new Set(prev)
      next.has(date) ? next.delete(date) : next.add(date)
      return next
    })

  const openAdd = (date) => {
    setForm({ title: '', time: '', date, recurring: false, days: [1, 2, 3, 4, 5, 6, 0] })
    setShowAdd(true)
  }

  const addTask = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    if (form.recurring) {
      dispatch({
        type: 'recurring/add',
        payload: { title: form.title.trim(), time: form.time, days: form.days.length === 7 ? [] : form.days },
      })
    } else {
      dispatch({ type: 'task/add', payload: { title: form.title.trim(), time: form.time, date: form.date } })
    }
    setShowAdd(false)
  }

  const toggleFormDay = (d) =>
    setForm((f) => ({
      ...f,
      days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d],
    }))

  const toggleItem = (item, date) => {
    if (item.kind === 'workout') dispatch({ type: 'workout/toggle', id: item.id })
    else if (item.kind === 'recurring') dispatch({ type: 'recurring/toggleDone', id: item.id, date })
    else if (item.kind === 'shopping') dispatch({ type: 'grocery/logTrip', cartId: item.id })
    else dispatch({ type: 'task/toggle', id: item.id })
  }

  const deleteItem = (item) => {
    if (item.kind === 'task') dispatch({ type: 'task/delete', id: item.id })
    else if (item.kind === 'recurring') dispatch({ type: 'recurring/delete', id: item.id })
  }

  const canMoveDays = (kind) => kind === 'task' || kind === 'workout'

  /* Finger / mouse drag via the ⠿ handle (pointer events work on touch,
     unlike HTML5 drag & drop). Drop on a row of the same day to reorder;
     drop anywhere on another day card to move the item to that day. */
  const startRowDrag = (e, item, date) => {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return
    e.preventDefault()
    const dragInfo = { key: agendaKey(item), kind: item.kind, id: item.id, date }
    setDrag(dragInfo)
    const probe = (ev) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY)
      return {
        row: el?.closest('.item-row[data-key]') || null,
        day: el?.closest('.day-card[data-date]') || null,
      }
    }
    const onMove = (ev) => {
      const { row, day } = probe(ev)
      setOverKey(row && row.dataset.date === dragInfo.date ? row.dataset.key : null)
      setOverDay(day && day.dataset.date !== dragInfo.date && canMoveDays(dragInfo.kind) ? day.dataset.date : null)
      // keep dragging usable on long lists
      if (ev.clientY < 90) window.scrollBy(0, -12)
      else if (ev.clientY > window.innerHeight - 110) window.scrollBy(0, 12)
    }
    const onUp = (ev) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      const { row, day } = probe(ev)
      setDrag(null)
      setOverKey(null)
      setOverDay(null)
      if (row && row.dataset.date === dragInfo.date && row.dataset.key !== dragInfo.key) {
        // reorder inside the same day
        const agenda = getAgendaForDate(state, dragInfo.date)
        const keys = agenda.map(agendaKey)
        const next = keys.filter((k) => k !== dragInfo.key)
        next.splice(
          next.indexOf(row.dataset.key) + (keys.indexOf(dragInfo.key) < keys.indexOf(row.dataset.key) ? 1 : 0),
          0,
          dragInfo.key,
        )
        dispatch({ type: 'agenda/reorder', date: dragInfo.date, keys: next })
      } else if (day && day.dataset.date !== dragInfo.date && canMoveDays(dragInfo.kind)) {
        // move to another day
        if (dragInfo.kind === 'task') dispatch({ type: 'task/update', id: dragInfo.id, payload: { date: day.dataset.date } })
        else dispatch({ type: 'workout/update', id: dragInfo.id, payload: { date: day.dataset.date } })
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const openEdit = (item, date) => {
    setEdit({
      kind: item.kind,
      id: item.id,
      title: item.title,
      time: item.time || '',
      date,
      days: item.days && item.days.length ? item.days : [1, 2, 3, 4, 5, 6, 0],
    })
  }

  const saveEdit = (e) => {
    e.preventDefault()
    if (!edit.title.trim()) return
    const title = edit.title.trim()
    if (edit.kind === 'task') {
      dispatch({ type: 'task/update', id: edit.id, payload: { title, time: edit.time, date: edit.date } })
    } else if (edit.kind === 'workout') {
      dispatch({ type: 'workout/update', id: edit.id, payload: { name: title, time: edit.time, date: edit.date } })
    } else if (edit.kind === 'recurring') {
      dispatch({
        type: 'recurring/update',
        id: edit.id,
        payload: { title, time: edit.time, days: edit.days.length === 7 ? [] : edit.days },
      })
    }
    setEdit(null)
  }

  const toggleEditDay = (d) =>
    setEdit((f) => ({
      ...f,
      days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d],
    }))

  const todayAgenda = getAgendaForDate(state, today)
  const doneToday = todayAgenda.filter((a) => a.done).length

  return (
    <div>
      <PageHeader
        title="Daily Planner"
        subtitle={`Next 7 days · today ${doneToday}/${todayAgenda.length} done`}
        goTo={goTo}
        action={
          <button className="btn btn-primary" onClick={() => openAdd(today)}>
            + Add task
          </button>
        }
      />

      {next7.map((date) => {
        const agenda = getAgendaForDate(state, date)
        const isOpen = openDays.has(date)
        const left = agenda.filter((a) => !a.done).length
        const dayName = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })

        return (
          <div
            className={`card day-card ${overDay === date ? 'day-drop' : ''}`}
            key={date}
            data-date={date}
          >
            <button className="day-head" onClick={() => toggleDay(date)}>
              <span className="day-chevron">{isOpen ? '▾' : '▸'}</span>
              <span className="day-title">
                {formatDate(date)}
                {formatDate(date) !== dayName && <span className="day-sub"> · {dayName}</span>}
              </span>
              <span style={{ flex: 1 }} />
              {agenda.some((a) => a.kind === 'workout' && !a.done) && <span className="tag tag-teal">⚡</span>}
              {left > 0 ? (
                <span className="tag tag-accent">{left} left</span>
              ) : agenda.length > 0 ? (
                <span className="tag tag-green">all done</span>
              ) : (
                <span className="tag" style={{ color: 'var(--text-faint)' }}>free</span>
              )}
              <span
                className="icon-btn"
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); openAdd(date) }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); openAdd(date) } }}
                title="Add task on this day"
              >
                +
              </span>
            </button>

            {isOpen && (
              <div className="item-list" style={{ marginTop: 6 }}>
                {agenda.length === 0 && (
                  <div className="empty" style={{ padding: '18px 8px' }}>
                    Nothing planned.
                  </div>
                )}
                {agenda.map((item) => {
                  const key = agendaKey(item)
                  return (
                    <div
                      className={`item-row ${item.done ? 'done' : ''} ${overKey === key && drag?.key !== key ? 'row-drag-over' : ''} ${drag?.key === key ? 'row-dragging' : ''}`}
                      key={key}
                      data-key={key}
                      data-date={date}
                    >
                      <span
                        className="drag-handle"
                        onPointerDown={(e) => startRowDrag(e, item, date)}
                        title={canMoveDays(item.kind) ? 'Drag to reorder or onto another day' : 'Drag to reorder'}
                      >
                        ⠿
                      </span>
                      <button
                        className={`check ${item.done ? 'checked' : ''}`}
                        onClick={() => toggleItem(item, date)}
                        aria-label="toggle"
                      >
                        ✓
                      </button>
                      <div className="grow">
                        <div className="title">{item.title}</div>
                        <div className="meta">
                          {item.time && <span>{item.time}</span>}
                          {item.kind === 'recurring' && (
                            <span className="tag tag-purple">↻ {recurringLabel(item.days)}</span>
                          )}
                          {item.kind === 'workout' && (
                            <button className="tag tag-teal" onClick={() => goTo('workouts')}>
                              ⚡ workout — view session
                            </button>
                          )}
                          {item.kind === 'shopping' && (
                            <button className="tag tag-orange" onClick={() => goTo('groceries')} title="Checking this logs the trip to Budget">
                              🛒 view cart · check = log to Budget
                            </button>
                          )}
                        </div>
                      </div>
                      {item.kind !== 'shopping' && (
                        <button
                          className="icon-btn"
                          onClick={() => openEdit(item, date)}
                          aria-label="edit"
                          title={item.kind === 'workout' ? 'Edit session name / time / date' : 'Edit (change the date to move it to another day)'}
                        >
                          ✎
                        </button>
                      )}
                      {(item.kind === 'task' || item.kind === 'recurring') && (
                        <button
                          className="icon-btn danger"
                          onClick={() => deleteItem(item)}
                          aria-label="delete"
                          title={item.kind === 'recurring' ? 'Delete recurring task (all days)' : 'Delete'}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {edit && (
        <Modal title={`Edit ${edit.kind === 'workout' ? 'session' : edit.kind === 'recurring' ? 'recurring task' : 'task'}`} onClose={() => setEdit(null)}>
          <form className="form-grid" onSubmit={saveEdit}>
            <div className="field">
              <label>{edit.kind === 'workout' ? 'Session name' : 'Task'}</label>
              <input autoFocus value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
            </div>
            <div className="form-row">
              <div className="field">
                <label>Time (optional)</label>
                <input type="time" value={edit.time} onChange={(e) => setEdit({ ...edit, time: e.target.value })} />
              </div>
              {edit.kind !== 'recurring' && (
                <div className="field">
                  <label>Date (change it to move to another day)</label>
                  <input
                    type="date"
                    value={edit.date}
                    onChange={(e) => e.target.value && setEdit({ ...edit, date: e.target.value })}
                  />
                </div>
              )}
            </div>
            {edit.kind === 'recurring' && (
              <div className="field">
                <label>Repeat on</label>
                <div className="day-chips">
                  {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                    <button
                      type="button"
                      key={d}
                      className={`day-chip ${edit.days.includes(d) ? 'on' : ''}`}
                      onClick={() => toggleEditDay(d)}
                    >
                      {WEEKDAY_LABELS[d]}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setEdit(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={edit.kind === 'recurring' && edit.days.length === 0}>
                Save
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showAdd && (
        <Modal title="Add task" onClose={() => setShowAdd(false)}>
          <form className="form-grid" onSubmit={addTask}>
            <div className="field">
              <label>Task</label>
              <input
                autoFocus
                placeholder="e.g. Call the bank"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="form-row">
              <div className="field">
                <label>Time (optional)</label>
                <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
              </div>
              {!form.recurring && (
                <div className="field">
                  <label>Date</label>
                  <input type="date" value={form.date} onChange={(e) => e.target.value && setForm({ ...form, date: e.target.value })} />
                </div>
              )}
            </div>

            <label className="auto-check">
              <input
                type="checkbox"
                checked={form.recurring}
                onChange={(e) => setForm({ ...form, recurring: e.target.checked })}
              />
              Recurring task
            </label>

            {form.recurring && (
              <div className="field">
                <label>Repeat on</label>
                <div className="day-chips">
                  {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                    <button
                      type="button"
                      key={d}
                      className={`day-chip ${form.days.includes(d) ? 'on' : ''}`}
                      onClick={() => toggleFormDay(d)}
                    >
                      {WEEKDAY_LABELS[d]}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`day-chip ${form.days.length === 7 ? 'on' : ''}`}
                    onClick={() => setForm({ ...form, days: form.days.length === 7 ? [] : [1, 2, 3, 4, 5, 6, 0] })}
                  >
                    Every day
                  </button>
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={form.recurring && form.days.length === 0}>
                Add
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
