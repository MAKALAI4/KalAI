import { useEffect, useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { VIEWS } from '../App.jsx'

function viewLabel(id) {
  return VIEWS.find((v) => v.id === id)?.label || id
}

/* On phones the free-floating positions don't apply: stickies stay
   in their panel and can't be dragged around. */
export function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 860px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 860px)')
    const fn = (e) => setMobile(e.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return mobile
}

export function StickyCard({ s, showCat, floating, moveable = true, onReorderDrop, dragState, onShift }) {
  const { dispatch } = useStore()
  const update = (payload) => dispatch({ type: 'sticky/update', id: s.id, payload })

  /* Free move: pointer-drag the bar background. The note is converted
     to a floating note at its current visual spot on the very first
     movement (so it never jumps), and stays inside the main area —
     it can never cover the sidebar nor go below the page. */
  const startMove = (e) => {
    if (!moveable || e.button !== 0) return
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('.drag-handle')) return
    const stickyEl = e.currentTarget.closest('.sticky')
    const mainEl = stickyEl.closest('.main')
    if (!mainEl) return
    e.preventDefault()
    const rect = stickyEl.getBoundingClientRect()
    const mainRect0 = mainEl.getBoundingClientRect()
    const offX = e.clientX - rect.left
    const offY = e.clientY - rect.top
    const start = { x: Math.round(rect.left - mainRect0.left), y: Math.round(rect.top - mainRect0.top) }
    let last = s.pos || start
    if (!s.pos) update({ pos: start }) // re-renders as floating at the same visual spot
    const onMove = (ev) => {
      const el = mainEl.querySelector(`.sticky.floating[data-sid="${s.id}"]`) || (floating ? stickyEl : null)
      const mainRect = mainEl.getBoundingClientRect()
      let x = ev.clientX - mainRect.left - offX
      let y = ev.clientY - mainRect.top - offY
      x = Math.max(0, Math.min(x, mainRect.width - rect.width - 4))
      y = Math.max(0, Math.min(y, mainRect.height - rect.height - 4))
      last = { x: Math.round(x), y: Math.round(y) }
      if (el) {
        el.style.left = last.x + 'px'
        el.style.top = last.y + 'px'
      }
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      update({ pos: last })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const saveHeight = (e) => {
    const h = e.target.offsetHeight
    if (Math.abs(h - (s.height || 0)) > 2) update({ height: h })
  }

  return (
    <div
      className={`sticky ${floating ? 'floating' : ''}`}
      data-sid={s.id}
      style={floating ? { left: s.pos.x, top: s.pos.y } : undefined}
      onDragOver={onReorderDrop ? (e) => e.preventDefault() : undefined}
      onDrop={onReorderDrop ? () => onReorderDrop(s.id) : undefined}
    >
      <div className="sticky-bar" onPointerDown={startMove} title={moveable ? 'Drag to move anywhere' : undefined}>
        {!floating && (
          <span
            className="drag-handle"
            draggable
            onDragStart={(e) => {
              e.stopPropagation()
              dragState?.set(s.id)
            }}
            onDragEnd={() => dragState?.set(null)}
            title="Drag onto another note to reorder"
          >
            ⠿
          </span>
        )}
        {showCat && <span className="sticky-cat">{viewLabel(s.view)}</span>}
        <span style={{ flex: 1 }} />
        {onShift && (
          <span className="m-only" style={{ display: 'inline-flex' }}>
            <button className="icon-btn" title="Move up" onClick={() => onShift(-1)}>
              ↑
            </button>
            <button className="icon-btn" title="Move down" onClick={() => onShift(1)}>
              ↓
            </button>
          </span>
        )}
        {floating && (
          <button className="icon-btn" title="Back to side panel" onClick={() => update({ pos: null })}>
            ⇥
          </button>
        )}
        <button
          className={`icon-btn ${s.blurred ? 'on' : ''}`}
          title={s.blurred ? 'Show content' : 'Blur content (privacy)'}
          onClick={() => update({ blurred: !s.blurred })}
        >
          {s.blurred ? '◉' : '◎'}
        </button>
        <button
          className="icon-btn"
          title={s.collapsed ? 'Expand' : 'Collapse'}
          onClick={() => update({ collapsed: !s.collapsed })}
        >
          {s.collapsed ? '▢' : '—'}
        </button>
        <button className="icon-btn danger" title="Delete" onClick={() => dispatch({ type: 'sticky/delete', id: s.id })}>
          ✕
        </button>
      </div>

      {!s.collapsed && (
        <input
          className="sticky-title"
          placeholder="Title…"
          value={s.title || ''}
          onChange={(e) => update({ title: e.target.value })}
        />
      )}

      {s.collapsed ? (
        <div className={`preview ${s.blurred ? 'blurred' : ''}`}>
          {(s.title || s.text).trim() || 'Empty note'}
        </div>
      ) : (
        <textarea
          className={s.blurred ? 'blurred' : ''}
          style={s.height ? { height: s.height } : undefined}
          value={s.text}
          placeholder="Write something…"
          onChange={(e) => update({ text: e.target.value })}
          onMouseUp={saveHeight}
        />
      )}
    </div>
  )
}

/* Stickies that were dragged out of the rail — absolutely positioned
   inside the main area of their own category page. Desktop only. */
export function FloatingStickies({ view }) {
  const { state } = useStore()
  const isMobile = useIsMobile()
  if (isMobile) return null
  const floats = (state.stickies || []).filter((s) => s.pos && s.view === view)
  return floats.map((s) => <StickyCard s={s} key={s.id} floating />)
}

export default function StickyRail({ view, showAll = false }) {
  const { state, dispatch } = useStore()
  const isMobile = useIsMobile()
  const [dragId, setDragId] = useState(null)

  const stickies = showAll
    ? state.stickies || []
    : (state.stickies || []).filter((s) => s.view === view && (isMobile || !s.pos))

  const reorderDrop = (targetId) => {
    if (!dragId || dragId === targetId) return
    dispatch({ type: 'sticky/reorder', fromId: dragId, toId: targetId })
    setDragId(null)
  }

  return (
    <aside className="sticky-rail">
      {!showAll && (
        <button className="btn btn-ghost btn-sm rail-add" onClick={() => dispatch({ type: 'sticky/add', view })}>
          + Sticky note
        </button>
      )}

      {stickies.map((s, i) => (
        <StickyCard
          s={s}
          key={s.id}
          showCat={showAll}
          moveable={!showAll && !isMobile}
          onReorderDrop={reorderDrop}
          dragState={{ set: setDragId }}
          onShift={(dir) => {
            const target = stickies[i + dir]
            if (target) dispatch({ type: 'sticky/reorder', fromId: s.id, toId: target.id })
          }}
        />
      ))}
    </aside>
  )
}
