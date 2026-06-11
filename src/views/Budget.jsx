import { useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Modal from '../components/Modal.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import {
  getBudgetSummary,
  getCategorySpending,
  getMonthExpenses,
  getPacing,
  getBudgetHistory,
  formatMoney,
} from '../store/selectors.js'
import { todayISO, uid, DEFAULT_TILE_ORDER } from '../store/persistence.js'

/* Small SVG chart: blue = actual spending, gray = expected (spendable). */
function HistoryChart({ data }) {
  if (data.length < 2) {
    return (
      <div className="empty" style={{ padding: '18px 8px' }}>
        History builds up automatically — each month is archived on the 1st.
      </div>
    )
  }
  const W = 560
  const H = 150
  const PAD = 26
  const max = Math.max(...data.flatMap((d) => [d.spent, d.expected]), 1)
  const x = (i) => PAD + (i * (W - PAD * 2)) / Math.max(data.length - 1, 1)
  const y = (v) => H - PAD - (v / max) * (H - PAD * 2)
  const line = (key) => data.map((d, i) => `${x(i)},${y(d[key])}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      <polyline points={line('expected')} fill="none" stroke="var(--text-faint)" strokeWidth="2" strokeDasharray="5 4" />
      <polyline points={line('spent')} fill="none" stroke="var(--accent)" strokeWidth="2.5" />
      {data.map((d, i) => (
        <g key={d.month}>
          <circle cx={x(i)} cy={y(d.spent)} r="3.5" fill="var(--accent)" />
          <circle cx={x(i)} cy={y(d.expected)} r="3" fill="var(--text-faint)" />
          <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--text-dim)">
            {d.month.slice(5)}{d.live ? '•' : ''}
          </text>
        </g>
      ))}
    </svg>
  )
}

function SubAdder({ onAdd }) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')

  const submit = () => {
    if (!name.trim()) return
    onAdd({ id: uid(), name: name.trim(), amount: Number(amount) || 0 })
    setName('')
    setAmount('')
  }

  return (
    <div className="sub-add">
      <input
        placeholder="Sub-line (e.g. Netflix)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        style={{ flex: 2 }}
      />
      <input
        type="number"
        min="0"
        step="0.01"
        placeholder="€"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        style={{ width: 90, flex: 'none' }}
      />
      <button type="button" className="btn btn-ghost btn-sm" onClick={submit}>
        Add
      </button>
    </div>
  )
}

export default function Budget({ goTo }) {
  const { state, dispatch } = useStore()
  const [modal, setModal] = useState(null) // 'income' | 'category' | 'expense' | null
  const [incomeInput, setIncomeInput] = useState(state.budget.monthlyIncome)
  const [catForm, setCatForm] = useState({ name: '', allocated: '', recurring: false })
  const [expForm, setExpForm] = useState({ label: '', amount: '', categoryId: '', date: todayISO() })
  const [dragTile, setDragTile] = useState(null)
  const [dragCat, setDragCat] = useState(null)
  const [overTile, setOverTile] = useState(null)
  const [overCat, setOverCat] = useState(null)

  const summary = getBudgetSummary(state)
  const pacing = getPacing(state)
  const history = getBudgetHistory(state)
  const categories = getCategorySpending(state)
  // Pinned envelopes stay on top, manual order otherwise
  const displayCats = [...categories].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
  const expenses = getMonthExpenses(state)
    .slice()
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))

  const monthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  /* ---- Draggable summary tiles ---- */
  const tileOrder = state.budget.tileOrder || DEFAULT_TILE_ORDER
  const TILES = {
    income: { label: 'Income', value: `${formatMoney(summary.income)} €`, color: undefined },
    spent: { label: 'Spent', value: `${formatMoney(summary.totalSpent)} €`, color: 'var(--orange)' },
    remaining: {
      label: 'Remaining',
      value: `${formatMoney(summary.remaining)} €`,
      color: summary.remaining < 0 ? 'var(--red)' : 'var(--green)',
    },
    unallocated: {
      label: 'Unallocated',
      value: `${formatMoney(summary.unallocated)} €`,
      color: summary.unallocated < 0 ? 'var(--red)' : undefined,
    },
  }

  const dropTile = (target) => {
    setOverTile(null)
    if (!dragTile || dragTile === target) return
    const order = [...tileOrder]
    order.splice(order.indexOf(dragTile), 1)
    order.splice(order.indexOf(target) + (tileOrder.indexOf(dragTile) < tileOrder.indexOf(target) ? 1 : 0), 0, dragTile)
    dispatch({ type: 'budget/setTileOrder', order })
  }

  const dropCat = (targetId) => {
    setOverCat(null)
    if (!dragCat || dragCat === targetId) return
    dispatch({ type: 'budget/moveCategory', fromId: dragCat, toId: targetId })
  }

  /* ---- Forms ---- */
  const saveIncome = (e) => {
    e.preventDefault()
    dispatch({ type: 'budget/setIncome', amount: Number(incomeInput) || 0 })
    setModal(null)
  }

  const saveCategory = (e) => {
    e.preventDefault()
    if (!catForm.name.trim()) return
    dispatch({
      type: 'budget/addCategory',
      payload: {
        name: catForm.name.trim(),
        allocated: Number(catForm.allocated) || 0,
        recurring: catForm.recurring,
        pinned: false,
        subs: [],
      },
    })
    setCatForm({ name: '', allocated: '', recurring: false })
    setModal(null)
  }

  const saveExpense = (e) => {
    e.preventDefault()
    if (!expForm.label.trim() || !expForm.categoryId) return
    dispatch({
      type: 'budget/addExpense',
      payload: {
        label: expForm.label.trim(),
        amount: Number(expForm.amount) || 0,
        categoryId: expForm.categoryId,
        date: expForm.date,
      },
    })
    setExpForm({ label: '', amount: '', categoryId: '', date: todayISO() })
    setModal(null)
  }

  const updateCat = (id, payload) => dispatch({ type: 'budget/updateCategory', id, payload })

  const catName = (id) => state.budget.categories.find((c) => c.id === id)?.name || '—'

  return (
    <div>
      <PageHeader
        title="Budget"
        subtitle={monthLabel}
        goTo={goTo}
        action={
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" onClick={() => { setIncomeInput(state.budget.monthlyIncome); setModal('income') }}>
              Set income
            </button>
            <button className="btn btn-primary" onClick={() => setModal('expense')}>
              + Add expense
            </button>
          </div>
        }
      />

      {/* Drag the tiles to rearrange them */}
      <div className="budget-summary">
        {tileOrder.map((key) => {
          const t = TILES[key]
          if (!t) return null
          return (
            <div
              key={key}
              className={`stat-tile draggable ${overTile === key ? 'drag-over' : ''}`}
              draggable
              onDragStart={() => setDragTile(key)}
              onDragEnd={() => { setDragTile(null); setOverTile(null) }}
              onDragOver={(e) => { e.preventDefault(); setOverTile(key) }}
              onDragLeave={() => setOverTile((o) => (o === key ? null : o))}
              onDrop={() => dropTile(key)}
              title="Drag to reorder"
            >
              <div className="label">{t.label}</div>
              <div className="value" style={{ color: t.color }}>{t.value}</div>
            </div>
          )
        })}
      </div>

      {/* Spending pace: real remaining vs expected for today's date */}
      <div className="card pace-card">
        <div className="card-title">
          <span>Spending pace</span>
          <span className={`tag ${pacing.delta >= 0 ? 'tag-green' : 'tag-red'}`} style={{ fontSize: 15 }}>
            {pacing.delta >= 0 ? '+' : '−'}
            {formatMoney(Math.abs(pacing.delta))} € vs expected
          </span>
        </div>
        <div className="pace-grid">
          <div>
            <div className="label">Spendable this month</div>
            <div className="value">{formatMoney(pacing.spendable)} €</div>
            <div className="sub">income − auto-paid − savings</div>
          </div>
          <div>
            <div className="label">Really left</div>
            <div className="value" style={{ color: pacing.realLeft < 0 ? 'var(--red)' : 'var(--text)' }}>
              {formatMoney(pacing.realLeft)} €
            </div>
            <div className="sub">{formatMoney(pacing.variableSpent)} € spent so far</div>
          </div>
          <div>
            <div className="label">Expected today</div>
            <div className="value" style={{ color: 'var(--text-dim)' }}>{formatMoney(pacing.expectedLeft)} €</div>
            <div className="sub">
              {pacing.daysLeft} day{pacing.daysLeft > 1 ? 's' : ''} left of {pacing.daysInMonth}
            </div>
          </div>
          <div>
            <div className="label">Daily budget</div>
            <div className="value" style={{ color: 'var(--accent)' }}>{formatMoney(pacing.daily)} €</div>
            <div className="sub">per remaining day</div>
          </div>
        </div>
        <div style={{ marginTop: 12, fontSize: 15, color: pacing.delta >= 0 ? 'var(--green)' : 'var(--red)' }}>
          {pacing.delta >= 0
            ? '✓ On track — you are ahead of your spending plan.'
            : '⚠ Watch your spending — you are behind the expected pace.'}
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <span>Categories</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setModal('category')}>
            + Category
          </button>
        </div>

        {displayCats.map((cat) => {
          const isOpen = !!cat.open
          const hasSubs = (cat.subs || []).length > 0
          const catExpenses = expenses.filter((e) => e.categoryId === cat.id)
          return (
            <div
              className={`budget-cat ${overCat === cat.id ? 'drag-over' : ''}`}
              key={cat.id}
              onDragOver={(e) => { e.preventDefault(); setOverCat(cat.id) }}
              onDragLeave={() => setOverCat((o) => (o === cat.id ? null : o))}
              onDrop={() => dropCat(cat.id)}
            >
              <div className="budget-cat-head">
                <span
                  className="drag-handle"
                  draggable
                  onDragStart={() => setDragCat(cat.id)}
                  onDragEnd={() => { setDragCat(null); setOverCat(null) }}
                  title="Drag to reorder"
                >
                  ⠿
                </span>

                <button className="icon-btn" onClick={() => updateCat(cat.id, { open: !cat.open })} title={isOpen ? 'Collapse' : 'Sub-lines & details'}>
                  {isOpen ? '▾' : '▸'}
                </button>

                <span className="name">
                  {cat.name}
                  {cat.slug === 'groceries' && (
                    <button className="tag tag-orange" onClick={() => goTo('groceries')} title="Linked to Groceries">
                      🛒 linked
                    </button>
                  )}
                  {cat.recurring && <span className="tag tag-green" title="Settled automatically each month">auto-paid</span>}
                  {cat.over && <span className="tag tag-red">over budget</span>}
                </span>

                <span className="nums">
                  {formatMoney(cat.spent)} € / {formatMoney(cat.allocated)} €
                </span>

                <label className="auto-check" title="Recurring: settled automatically every month, deducted from Remaining">
                  <input
                    type="checkbox"
                    checked={!!cat.recurring}
                    onChange={(e) => updateCat(cat.id, { recurring: e.target.checked })}
                  />
                  auto
                </label>

                {hasSubs ? (
                  <span className="nums" title="Sum of sub-lines" style={{ width: 92, textAlign: 'right' }}>
                    Σ {formatMoney(cat.allocated)} €
                  </span>
                ) : (
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="amount-input"
                    value={cat.allocated}
                    onChange={(e) => updateCat(cat.id, { allocated: Number(e.target.value) || 0 })}
                    title="Allocated amount"
                  />
                )}

                <button
                  className={`icon-btn ${cat.pinned ? 'on' : ''}`}
                  onClick={() => updateCat(cat.id, { pinned: !cat.pinned })}
                  title={cat.pinned ? 'Unpin' : 'Pin to top'}
                >
                  ⚑
                </button>

                {cat.slug !== 'groceries' && (
                  <button
                    className="icon-btn danger"
                    onClick={() => dispatch({ type: 'budget/deleteCategory', id: cat.id })}
                    aria-label="delete category"
                  >
                    ✕
                  </button>
                )}
              </div>

              <ProgressBar ratio={cat.ratio} over={cat.over} />

              {isOpen && (
                <div className="sub-lines">
                  {(cat.subs || []).map((sub) => (
                    <div className="sub-line" key={sub.id}>
                      <span className="sub-name">{sub.name}</span>
                      <span className="sub-amount">{formatMoney(sub.amount)} €</span>
                      <button
                        className="icon-btn danger"
                        onClick={() => updateCat(cat.id, { subs: cat.subs.filter((s) => s.id !== sub.id) })}
                        title="Remove sub-line"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <SubAdder onAdd={(sub) => updateCat(cat.id, { subs: [...(cat.subs || []), sub] })} />
                  {hasSubs && (
                    <div style={{ fontSize: 13.5, color: 'var(--text-faint)' }}>
                      The category amount is the sum of its sub-lines.
                    </div>
                  )}
                  {catExpenses.length > 0 && (
                    <>
                      <div style={{ fontSize: 13, color: 'var(--text-faint)', marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Spent this month
                      </div>
                      {catExpenses.map((e) => (
                        <div className="sub-line" key={e.id}>
                          <span className="sub-name">{e.label}</span>
                          <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>{e.date?.slice(5)}</span>
                          <span className="sub-amount">−{formatMoney(e.amount)} €</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="card">
        <div className="card-title">Expenses this month</div>
        {summary.autoSpent > 0 && (
          <div className="item-row">
            <div className="grow">
              <div className="title">Recurring envelopes (auto-paid)</div>
              <div className="meta">
                {categories.filter((c) => c.recurring).map((c) => c.name).join(' · ')}
              </div>
            </div>
            <strong style={{ color: 'var(--text-dim)' }}>-{formatMoney(summary.autoSpent)} €</strong>
          </div>
        )}
        {expenses.length === 0 && summary.autoSpent === 0 ? (
          <div className="empty">
            <span className="empty-icon">◍</span>
            No expense logged this month.
          </div>
        ) : (
          <div className="item-list">
            {expenses.map((e) => (
              <div className="item-row" key={e.id}>
                <div className="grow">
                  <div className="title">{e.label}</div>
                  <div className="meta">
                    <span>{e.date}</span>
                    <span className="tag tag-accent">{catName(e.categoryId)}</span>
                  </div>
                </div>
                <strong>-{formatMoney(e.amount)} €</strong>
                <button className="icon-btn danger" onClick={() => dispatch({ type: 'budget/deleteExpense', id: e.id })} aria-label="delete">
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">
          <span>Monthly history</span>
          <span style={{ fontSize: 13.5, fontWeight: 400, color: 'var(--text-dim)', display: 'flex', gap: 14 }}>
            <span><span style={{ color: 'var(--accent)' }}>━</span> spent</span>
            <span><span style={{ color: 'var(--text-faint)' }}>╌</span> expected</span>
          </span>
        </div>
        <HistoryChart data={history} />
        {history.length >= 2 && (
          <div style={{ fontSize: 13.5, color: 'var(--text-faint)', marginTop: 4 }}>
            Months are archived automatically on the 1st. • = current month (live).
          </div>
        )}
      </div>

      {modal === 'income' && (
        <Modal title="Monthly income" onClose={() => setModal(null)}>
          <form className="form-grid" onSubmit={saveIncome}>
            <div className="field">
              <label>Income (€ / month)</label>
              <input autoFocus type="number" min="0" step="0.01" value={incomeInput} onChange={(e) => setIncomeInput(e.target.value)} />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === 'category' && (
        <Modal title="New envelope" onClose={() => setModal(null)}>
          <form className="form-grid" onSubmit={saveCategory}>
            <div className="field">
              <label>Name</label>
              <input autoFocus placeholder="e.g. Subscriptions" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} />
            </div>
            <div className="field">
              <label>Allocated (€ / month)</label>
              <input type="number" min="0" step="0.01" placeholder="0" value={catForm.allocated} onChange={(e) => setCatForm({ ...catForm, allocated: e.target.value })} />
            </div>
            <label className="auto-check">
              <input
                type="checkbox"
                checked={catForm.recurring}
                onChange={(e) => setCatForm({ ...catForm, recurring: e.target.checked })}
              />
              Recurring — settled automatically every month (rent, subscriptions…)
            </label>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Add</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === 'expense' && (
        <Modal title="Add expense" onClose={() => setModal(null)}>
          <form className="form-grid" onSubmit={saveExpense}>
            <div className="field">
              <label>Label</label>
              <input autoFocus placeholder="e.g. Cinema tickets" value={expForm.label} onChange={(e) => setExpForm({ ...expForm, label: e.target.value })} />
            </div>
            <div className="form-row">
              <div className="field">
                <label>Amount (€)</label>
                <input type="number" min="0" step="0.01" placeholder="0.00" value={expForm.amount} onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })} />
              </div>
              <div className="field">
                <label>Date</label>
                <input type="date" value={expForm.date} onChange={(e) => setExpForm({ ...expForm, date: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>Category</label>
              <select value={expForm.categoryId} onChange={(e) => setExpForm({ ...expForm, categoryId: e.target.value })}>
                <option value="">Select…</option>
                {state.budget.categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Add</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
