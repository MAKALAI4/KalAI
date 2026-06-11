import { useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { getSortedNotes } from '../store/selectors.js'

export default function Notes({ goTo }) {
  const { state, dispatch } = useStore()
  const [text, setText] = useState('')
  const [dragId, setDragId] = useState(null)
  const [overId, setOverId] = useState(null)

  const notes = getSortedNotes(state)

  const addNote = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    dispatch({ type: 'note/add', payload: { text: text.trim() } })
    setText('')
  }

  /* Drag a note card by its ⠿ handle onto another card to reorder
     (pointer events: works with mouse and finger alike). */
  const startNoteDrag = (e, id) => {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return
    e.preventDefault()
    setDragId(id)
    const probe = (ev) => document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.note-card[data-id]')
    const onMove = (ev) => {
      const card = probe(ev)
      setOverId(card && card.dataset.id !== id ? card.dataset.id : null)
      if (ev.clientY < 90) window.scrollBy(0, -12)
      else if (ev.clientY > window.innerHeight - 110) window.scrollBy(0, 12)
    }
    const onUp = (ev) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      const card = probe(ev)
      if (card && card.dataset.id !== id) {
        dispatch({ type: 'note/reorder', fromId: id, toId: card.dataset.id })
      }
      setDragId(null)
      setOverId(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  return (
    <div>
      <PageHeader title="Notes" subtitle="Quick thoughts, ideas, reminders" goTo={goTo} />

      <form onSubmit={addNote} className="card" style={{ marginBottom: 16 }}>
        <textarea
          rows={3}
          placeholder="Write a note… (ideas, reminders, anything)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addNote(e)
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <button type="submit" className="btn btn-primary">Add note</button>
        </div>
      </form>

      {notes.length === 0 ? (
        <div className="empty">
          <span className="empty-icon">✎</span>
          No notes yet.
        </div>
      ) : (
        <div className="notes-grid">
          {notes.map((n) => (
            <div
              className={`note-card ${n.pinned ? 'pinned' : ''} ${overId === n.id ? 'drag-over' : ''} ${dragId === n.id ? 'row-dragging' : ''}`}
              key={n.id}
              data-id={n.id}
            >
              <div className={`note-text ${n.blurred ? 'blurred' : ''}`}>{n.text}</div>
              <div className="note-foot">
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    className="drag-handle"
                    onPointerDown={(e) => startNoteDrag(e, n.id)}
                    title="Drag onto another note to reorder"
                  >
                    ⠿
                  </span>
                  <span>{new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </span>
                <span style={{ display: 'flex', gap: 4 }}>
                  <button
                    className={`icon-btn ${n.blurred ? 'on' : ''}`}
                    onClick={() => dispatch({ type: 'note/toggleBlur', id: n.id })}
                    title={n.blurred ? 'Show content' : 'Blur content (privacy)'}
                  >
                    {n.blurred ? '◉' : '◎'}
                  </button>
                  <button
                    className="icon-btn"
                    style={n.pinned ? { color: 'var(--orange)' } : null}
                    onClick={() => dispatch({ type: 'note/togglePin', id: n.id })}
                    title={n.pinned ? 'Unpin' : 'Pin'}
                  >
                    ⚑
                  </button>
                  <button className="icon-btn danger" onClick={() => dispatch({ type: 'note/delete', id: n.id })} title="Delete">
                    ✕
                  </button>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
