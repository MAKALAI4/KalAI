import { todayISO } from './persistence.js'

/* =========================================================
   Cross-category selectors — all "links" between categories
   are derived here from the single store. No duplicated data.
   ========================================================= */

export function formatMoney(n) {
  return (Math.round(n * 100) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

/* ---- Planner ⟵ Workouts + Recurring + Groceries ----
   A day's agenda merges manual tasks, recurring tasks that fall
   on that weekday, workouts scheduled that day, and (today only)
   one "shopping" item per cart that has checked items. */
const timeKey = (t) => (t ? parseInt(t.replace(':', ''), 10) : 2400)

export const agendaKey = (it) => `${it.kind}:${it.id}`

export function getAgendaForDate(state, date) {
  const today = todayISO()
  const weekday = new Date(date + 'T00:00:00').getDay()

  const tasks = state.tasks.filter((t) => t.date === date).map((t) => ({ ...t, kind: 'task' }))

  const recurring = (state.recurringTasks || [])
    .filter((r) => !r.days || r.days.length === 0 || r.days.includes(weekday))
    .map((r) => ({
      id: r.id,
      title: r.title,
      time: r.time,
      done: (r.doneDates || []).includes(date),
      kind: 'recurring',
      days: r.days,
      order: null,
    }))

  const workouts = state.workouts
    .filter((w) => w.date === date)
    .map((w) => ({ id: w.id, title: w.name, time: w.time, done: w.completed, kind: 'workout', order: null }))

  const shopping =
    date === today
      ? (state.carts || [])
          .map((c) => {
            const items = state.groceries.filter((g) => g.cartId === c.id && g.bought)
            if (items.length === 0) return null
            const total = items.reduce((s, g) => s + (Number(g.estPrice) || 0), 0)
            return {
              id: c.id,
              title: `Shopping — ${c.name} (${items.length} item${items.length > 1 ? 's' : ''}, ≈ ${formatMoney(total)} €)`,
              time: '',
              done: false,
              kind: 'shopping',
              order: null,
            }
          })
          .filter(Boolean)
      : []

  // Manual order (drag & drop) wins for any kind of item; everything
  // else falls back to time order. Completed items sink to the bottom
  // while keeping their original relative order.
  const orderKeys = (state.agendaOrder || {})[date] || []
  const sortKey = (it) => {
    const i = orderKeys.indexOf(agendaKey(it))
    return i >= 0 ? i : 10000 + timeKey(it.time)
  }
  return [...tasks, ...recurring, ...workouts, ...shopping].sort(
    (a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1) || sortKey(a) - sortKey(b),
  )
}

export function getTodayAgenda(state) {
  return getAgendaForDate(state, todayISO())
}

/* ---- Budget (current month) ---- */
function currentMonthPrefix() {
  return todayISO().slice(0, 7) // "YYYY-MM"
}

export function getMonthExpenses(state) {
  const month = currentMonthPrefix()
  return state.budget.expenses.filter((e) => (e.date || '').startsWith(month))
}

/* A category's real allocation: the sum of its sub-lines when it
   has any, otherwise its own allocated amount. */
export function catAllocated(cat) {
  const subs = cat.subs || []
  if (subs.length > 0) return subs.reduce((s, x) => s + (Number(x.amount) || 0), 0)
  return Number(cat.allocated) || 0
}

export function findSavingsCat(state) {
  return state.budget.categories.find((c) => /saving/i.test(c.name)) || null
}

export function getBudgetSummary(state) {
  const expenses = getMonthExpenses(state)
  const totalAllocated = state.budget.categories.reduce((s, c) => s + catAllocated(c), 0)
  const loggedSpent = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  // Recurring envelopes (rent, subscriptions…) are settled automatically:
  // their full allocation counts as spent without logging an expense.
  const autoSpent = state.budget.categories
    .filter((c) => c.recurring)
    .reduce((s, c) => s + catAllocated(c), 0)
  const totalSpent = loggedSpent + autoSpent
  const income = Number(state.budget.monthlyIncome) || 0
  return {
    income,
    totalAllocated,
    totalSpent,
    autoSpent,
    remaining: income - totalSpent,
    unallocated: income - totalAllocated,
  }
}

export function getCategorySpending(state) {
  const expenses = getMonthExpenses(state)
  return state.budget.categories.map((cat) => {
    const logged = expenses
      .filter((e) => e.categoryId === cat.id)
      .reduce((s, e) => s + (Number(e.amount) || 0), 0)
    const allocated = catAllocated(cat)
    const spent = logged + (cat.recurring ? allocated : 0)
    return {
      ...cat,
      spent,
      allocated,
      remaining: allocated - spent,
      ratio: allocated > 0 ? Math.min(spent / allocated, 1) : 0,
      over: spent > allocated,
    }
  })
}

/* ---- Spending pace: am I on track this month? ----
   spendable  = income − auto-paid − savings (the real "free" money)
   realLeft   = spendable − variable expenses logged so far
   expected   = spendable × daysLeft / daysInMonth (linear glide path)
   delta > 0  → ahead of plan; delta < 0 → overspending */
export function getPacing(state) {
  const summary = getBudgetSummary(state)
  const savingsCat = findSavingsCat(state)
  const savings = savingsCat && !savingsCat.recurring ? catAllocated(savingsCat) : 0
  const expenses = getMonthExpenses(state)
  const variableSpent = expenses
    .filter((e) => !savingsCat || e.categoryId !== savingsCat.id)
    .reduce((s, e) => s + (Number(e.amount) || 0), 0)

  const spendable = summary.income - summary.autoSpent - savings
  const realLeft = spendable - variableSpent

  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const dayNum = now.getDate()
  const daysLeft = daysInMonth - dayNum + 1
  const expectedLeft = (spendable * daysLeft) / daysInMonth
  const delta = realLeft - expectedLeft
  const daily = daysLeft > 0 ? Math.max(realLeft, 0) / daysLeft : 0

  return { spendable, realLeft, expectedLeft, delta, daily, daysLeft, daysInMonth, variableSpent, savings }
}

/* ---- Budget history (archived months + live current month) ---- */
export function getBudgetHistory(state) {
  const pacing = getPacing(state)
  const current = {
    month: currentMonthPrefix(),
    spent: pacing.variableSpent,
    expected: pacing.spendable,
    live: true,
  }
  const past = (state.budget.history || []).map((h) => ({ ...h, live: false }))
  return [...past, current].slice(-12)
}

/* ---- Groceries ⟵ Budget ---- */
export function getGroceryBudget(state) {
  const cat = state.budget.categories.find((c) => c.slug === 'groceries')
  if (!cat) return null
  return getCategorySpending(state).find((c) => c.id === cat.id) || null
}

export function getGroceryListStats(state, cartId = null) {
  const all = cartId ? state.groceries.filter((g) => g.cartId === cartId) : state.groceries
  const toBuy = all.filter((g) => !g.bought)
  const bought = all.filter((g) => g.bought)
  const estTotal = toBuy.reduce((s, g) => s + (Number(g.estPrice) || 0), 0)
  const boughtTotal = bought.reduce((s, g) => s + (Number(g.estPrice) || 0), 0)
  return { toBuy, bought, estTotal, boughtTotal }
}

/* Items bought 3+ times become one-click favorites. */
export function getGroceryFavorites(state) {
  const groups = new Map()
  for (const h of state.groceryHistory || []) {
    const key = h.name.trim().toLowerCase()
    const g = groups.get(key) || { name: h.name, qty: h.qty, price: h.price, count: 0 }
    g.count += 1
    g.qty = h.qty || g.qty
    g.price = h.price != null ? h.price : g.price
    groups.set(key, g)
  }
  return [...groups.values()].filter((g) => g.count >= 3).sort((a, b) => b.count - a.count)
}

/* ---- Workouts ---- */
export function getNextWorkout(state) {
  const today = todayISO()
  return (
    state.workouts
      .filter((w) => !w.completed && w.date >= today)
      .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))[0] || null
  )
}

export function getWorkoutsSplit(state) {
  const today = todayISO()
  const upcoming = state.workouts
    .filter((w) => w.date >= today && !w.completed)
    .sort((a, b) => a.date.localeCompare(b.date))
  const past = state.workouts
    .filter((w) => w.date < today || w.completed)
    .sort((a, b) => b.date.localeCompare(a.date))
  return { upcoming, past }
}

/* ---- Notes ----
   Pinned notes first, then manual order (↑/↓ arrows on the cards). */
export function getSortedNotes(state) {
  return [...state.notes].sort((a, b) => b.pinned - a.pinned)
}

/* ---- Date display helpers ---- */
export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function recurringLabel(days) {
  if (!days || days.length === 0 || days.length === 7) return 'every day'
  return [1, 2, 3, 4, 5, 6, 0]
    .filter((d) => days.includes(d))
    .map((d) => WEEKDAY_LABELS[d])
    .join(', ')
}

export function formatDate(iso) {
  if (!iso) return ''
  const today = todayISO()
  if (iso === today) return 'Today'
  const d = new Date(iso + 'T00:00:00')
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (sameDay(d, tomorrow)) return 'Tomorrow'
  if (sameDay(d, yesterday)) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
