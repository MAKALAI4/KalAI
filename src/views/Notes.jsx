import { useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { getSortedNotes } from '../store/selectors.js'

export default function Notes({ goTo }) {
  const { state, dispatch } = useStore()
  const [text, setText] = useState('')

  const notes = getSortedNotes(state)

  const addNote = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    dispatch({ type: 'note/add', payload: { text: text.trim() } })
    setText('')
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
            <div className={`note-card ${n.pinned ? 'pinned' : ''}`} key={n.id}>
              <div className={`note-text ${n.blurred ? 'blurred' : ''}`}>{n.text}</div>
              <div className="note-foot">
                <span>{new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                <span style={{ display: 'flex', gap: 4 }}>
                  <button className="icon-btn" onClick={() => dispatch({ type: 'note/move', id: n.id, dir: -1 })} title="Move earlier">
                    ↑
                  </button>
                  <button className="icon-btn" onClick={() => dispatch({ type: 'note/move', id: n.id, dir: 1 })} title="Move later">
                    ↓
                  </button>
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
