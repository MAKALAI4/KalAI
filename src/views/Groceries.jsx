import { useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import PageHeader from '../components/PageHeader.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import {
  getGroceryBudget,
  getGroceryListStats,
  getGroceryFavorites,
  formatMoney,
} from '../store/selectors.js'

function CartCard({ cart, canDelete, goTo }) {
  const { state, dispatch } = useStore()
  const [form, setForm] = useState({ name: '', qty: '', estPrice: '' })
  const { toBuy, bought, boughtTotal } = getGroceryListStats(state, cart.id)

  const addItem = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    dispatch({
      type: 'grocery/add',
      payload: {
        name: form.name.trim(),
        qty: form.qty.trim(),
        estPrice: form.estPrice === '' ? null : Number(form.estPrice),
        cartId: cart.id,
      },
    })
    setForm({ name: '', qty: '', estPrice: '' })
  }

  const ItemRow = ({ g }) => (
    <div className={`item-row ${g.bought ? 'done' : ''}`}>
      <button className={`check ${g.bought ? 'checked' : ''}`} onClick={() => dispatch({ type: 'grocery/toggle', id: g.id })} aria-label="toggle">
        ✓
      </button>
      <div className="grow">
        <div className="title">{g.name}</div>
        <div className="meta">{g.qty && <span>{g.qty}</span>}</div>
      </div>
      {g.estPrice != null && g.estPrice !== 0 && (
        <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>{formatMoney(g.estPrice)} €</span>
      )}
      <button className="icon-btn danger" onClick={() => dispatch({ type: 'grocery/delete', id: g.id })} aria-label="delete">
        ✕
      </button>
    </div>
  )

  return (
    <div className="card cart-card">
      <div className="cart-head">
        <input
          className="cart-name"
          value={cart.name}
          onChange={(e) => dispatch({ type: 'cart/rename', id: cart.id, name: e.target.value })}
          title="Click to rename this cart"
        />
        <span className="tag tag-orange">{toBuy.length} to buy</span>
        {canDelete && (
          <button className="icon-btn danger" onClick={() => dispatch({ type: 'cart/delete', id: cart.id })} title="Delete cart (items move to first cart)">
            ✕
          </button>
        )}
      </div>

      <form onSubmit={addItem} className="cart-add">
        <input placeholder="Add an item…" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Qty" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} style={{ width: 64 }} />
        <input type="number" min="0" step="0.01" placeholder="€" value={form.estPrice} onChange={(e) => setForm({ ...form, estPrice: e.target.value })} style={{ width: 70 }} />
        <button type="submit" className="btn btn-primary btn-sm">+</button>
      </form>

      {toBuy.length === 0 && bought.length === 0 ? (
        <div className="empty" style={{ padding: '20px 8px' }}>
          <span className="empty-icon">🛒</span>
          Empty cart.
        </div>
      ) : (
        <div className="item-list">
          {toBuy.map((g) => (
            <ItemRow g={g} key={g.id} />
          ))}
        </div>
      )}

      {bought.length > 0 && (
        <div className="cart-bought">
          <div className="cart-bought-head">
            <span>
              In cart ({bought.length}) — {formatMoney(boughtTotal)} €
            </span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => dispatch({ type: 'grocery/logTrip', cartId: cart.id })}
              title="Logs an expense in the Groceries budget category and saves items to history"
            >
              Log now
            </button>
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text-faint)', marginBottom: 4 }}>
            ✓ Added to{' '}
            <button className="tag tag-accent" onClick={() => goTo('planner')}>
              ☀ today's Planner
            </button>{' '}
            — check it off there to log the trip to Budget.
          </div>
          <div className="item-list">
            {bought.map((g) => (
              <ItemRow g={g} key={g.id} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Groceries({ goTo }) {
  const { state, dispatch } = useStore()

  const budget = getGroceryBudget(state)
  const { estTotal } = getGroceryListStats(state)
  const favorites = getGroceryFavorites(state)
  const history = [...(state.groceryHistory || [])].reverse().slice(0, 15)
  const carts = state.carts || []
  const overEstimate = budget && estTotal > budget.remaining

  return (
    <div>
      <PageHeader
        title="Groceries"
        subtitle="Shopping lists, linked to your grocery budget and planner"
        goTo={goTo}
        action={
          carts.length < 3 ? (
            <button className="btn btn-ghost" onClick={() => dispatch({ type: 'cart/add' })}>
              + Add cart
            </button>
          ) : null
        }
      />

      {/* Cross-link banner: grocery category from Budget */}
      {budget && (
        <div className="link-banner">
          <div className="grow">
            <div className="label">Grocery budget — this month</div>
            <div className="value" style={{ color: budget.over ? 'var(--red)' : 'var(--green)' }}>
              {formatMoney(budget.remaining)} € left of {formatMoney(budget.allocated)} €
            </div>
            <div style={{ marginTop: 8 }}>
              <ProgressBar ratio={budget.ratio} over={budget.over} />
            </div>
          </div>
          <div className="grow">
            <div className="label">All lists estimate</div>
            <div className="value" style={{ color: overEstimate ? 'var(--orange)' : undefined }}>
              ≈ {formatMoney(estTotal)} €
            </div>
            {overEstimate && <div style={{ fontSize: 13.5, color: 'var(--orange)' }}>⚠ Above remaining budget</div>}
          </div>
          <button className="btn btn-ghost" onClick={() => goTo('budget')}>
            Open budget →
          </button>
        </div>
      )}

      {/* Favorites: bought 3+ times, one click to re-add */}
      {favorites.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">
            <span>Favorites</span>
            <span style={{ fontSize: 13.5, fontWeight: 400, color: 'var(--text-faint)' }}>
              bought 3+ times · click to add to {carts[0]?.name}
            </span>
          </div>
          <div className="fav-chips">
            {favorites.map((f) => (
              <button
                key={f.name}
                className="fav-chip"
                onClick={() =>
                  dispatch({
                    type: 'grocery/add',
                    payload: { name: f.name, qty: f.qty || '', estPrice: f.price, cartId: carts[0].id },
                  })
                }
                title={`Bought ${f.count} times`}
              >
                ★ {f.name}
                <span className="fav-count">×{f.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Carts side by side (max 3) */}
      <div className="carts-grid">
        {carts.map((cart) => (
          <CartCard cart={cart} key={cart.id} canDelete={carts.length > 1} goTo={goTo} />
        ))}
      </div>

      {/* Purchase history */}
      {history.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title">Previously bought</div>
          <div className="item-list">
            {history.map((h) => (
              <div className="item-row" key={h.id}>
                <span style={{ color: 'var(--text-faint)' }}>✓</span>
                <div className="grow">
                  <div className="title">{h.name}</div>
                  <div className="meta">
                    {h.qty && <span>{h.qty}</span>}
                    <span>{h.date}</span>
                    {h.cart && <span className="tag tag-orange">{h.cart}</span>}
                  </div>
                </div>
                {h.price != null && <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>{formatMoney(h.price)} €</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
