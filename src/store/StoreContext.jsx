import { createContext, useContext, useEffect, useReducer } from 'react'
import { loadState, saveState, uid, todayISO } from './persistence.js'
import { catAllocated, findSavingsCat } from './selectors.js'

const StoreContext = createContext(null)

function reducer(state, action) {
  switch (action.type) {
    /* ---- Tasks (Daily Planner) ---- */
    case 'task/add':
      return { ...state, tasks: [...state.tasks, { id: uid(), done: false, order: null, ...action.payload }] }
    case 'task/toggle':
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t)),
      }
    case 'task/update':
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.id ? { ...t, ...action.payload } : t)),
      }
    case 'task/delete':
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.id) }
    case 'task/reorder':
      // action.ids: manual task ids of one day, in their new visual order
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          action.ids.includes(t.id) ? { ...t, order: action.ids.indexOf(t.id) } : t,
        ),
      }
    /* Visual order of a whole day's agenda (tasks, workouts, recurring…).
       Keys look like "task:id" / "workout:id". */
    case 'agenda/reorder':
      return {
        ...state,
        agendaOrder: { ...(state.agendaOrder || {}), [action.date]: action.keys },
      }

    /* ---- Recurring tasks ---- */
    case 'recurring/add':
      return {
        ...state,
        recurringTasks: [...state.recurringTasks, { id: uid(), doneDates: [], ...action.payload }],
      }
    case 'recurring/toggleDone': {
      return {
        ...state,
        recurringTasks: state.recurringTasks.map((r) => {
          if (r.id !== action.id) return r
          const done = (r.doneDates || []).includes(action.date)
          return {
            ...r,
            doneDates: done
              ? r.doneDates.filter((d) => d !== action.date)
              : [...(r.doneDates || []), action.date].slice(-120),
          }
        }),
      }
    }
    case 'recurring/delete':
      return { ...state, recurringTasks: state.recurringTasks.filter((r) => r.id !== action.id) }

    /* ---- Workouts ---- */
    case 'workout/add':
      return {
        ...state,
        workouts: [...state.workouts, { id: uid(), completed: false, exercises: [], ...action.payload }],
      }
    case 'workout/toggle':
      return {
        ...state,
        workouts: state.workouts.map((w) =>
          w.id === action.id ? { ...w, completed: !w.completed } : w,
        ),
      }
    case 'workout/update':
      return {
        ...state,
        workouts: state.workouts.map((w) => (w.id === action.id ? { ...w, ...action.payload } : w)),
      }
    case 'workout/delete':
      return { ...state, workouts: state.workouts.filter((w) => w.id !== action.id) }

    /* ---- Workout templates ---- */
    case 'template/saveFromWorkout': {
      const w = state.workouts.find((x) => x.id === action.workoutId)
      if (!w) return state
      return {
        ...state,
        workoutTemplates: [
          ...state.workoutTemplates,
          { id: uid(), name: w.name, exercises: w.exercises.map((e) => ({ ...e })) },
        ],
      }
    }
    case 'template/delete':
      return { ...state, workoutTemplates: state.workoutTemplates.filter((t) => t.id !== action.id) }

    /* ---- Dashboard layout ---- */
    case 'dash/setOrder':
      return { ...state, dashOrder: action.order }

    /* ---- Budget ---- */
    case 'budget/setIncome':
      return { ...state, budget: { ...state.budget, monthlyIncome: action.amount } }
    case 'budget/addCategory':
      return {
        ...state,
        budget: {
          ...state.budget,
          categories: [...state.budget.categories, { id: uid(), open: false, ...action.payload }],
        },
      }
    case 'budget/updateCategory':
      return {
        ...state,
        budget: {
          ...state.budget,
          categories: state.budget.categories.map((c) =>
            c.id === action.id ? { ...c, ...action.payload } : c,
          ),
        },
      }
    case 'budget/deleteCategory':
      return {
        ...state,
        budget: {
          ...state.budget,
          categories: state.budget.categories.filter((c) => c.id !== action.id),
          expenses: state.budget.expenses.filter((e) => e.categoryId !== action.id),
        },
      }
    case 'budget/moveCategory': {
      const cats = [...state.budget.categories]
      const from = cats.findIndex((c) => c.id === action.fromId)
      const to = cats.findIndex((c) => c.id === action.toId)
      if (from < 0 || to < 0) return state
      const [moved] = cats.splice(from, 1)
      cats.splice(to, 0, moved)
      return { ...state, budget: { ...state.budget, categories: cats } }
    }
    case 'budget/setTileOrder':
      return { ...state, budget: { ...state.budget, tileOrder: action.order } }
    case 'budget/addExpense':
      return {
        ...state,
        budget: {
          ...state.budget,
          expenses: [...state.budget.expenses, { id: uid(), ...action.payload }],
        },
      }
    case 'budget/deleteExpense':
      return {
        ...state,
        budget: {
          ...state.budget,
          expenses: state.budget.expenses.filter((e) => e.id !== action.id),
        },
      }

    /* On the 1st of a new month: snapshot the closed month into
       history, then make the new month current. */
    case 'budget/closeMonth': {
      const oldMonth = state.budget.currentMonth
      if (!oldMonth || oldMonth === action.nowMonth) return state
      const cats = state.budget.categories
      const income = Number(state.budget.monthlyIncome) || 0
      const autoSpent = cats.filter((c) => c.recurring).reduce((s, c) => s + catAllocated(c), 0)
      const savingsCat = findSavingsCat(state)
      const savings = savingsCat && !savingsCat.recurring ? catAllocated(savingsCat) : 0
      const spendable = income - autoSpent - savings
      const spent = state.budget.expenses
        .filter((e) => (e.date || '').startsWith(oldMonth))
        .filter((e) => !savingsCat || e.categoryId !== savingsCat.id)
        .reduce((s, e) => s + (Number(e.amount) || 0), 0)
      return {
        ...state,
        budget: {
          ...state.budget,
          currentMonth: action.nowMonth,
          history: [
            ...(state.budget.history || []),
            { month: oldMonth, income, autoSpent, savings, expected: spendable, spent },
          ].slice(-24),
        },
      }
    }

    /* ---- Carts & Groceries ---- */
    case 'cart/add': {
      if ((state.carts || []).length >= 3) return state
      const n = state.carts.length + 1
      return { ...state, carts: [...state.carts, { id: uid(), name: `Cart ${n}` }] }
    }
    case 'cart/rename':
      return {
        ...state,
        carts: state.carts.map((c) => (c.id === action.id ? { ...c, name: action.name } : c)),
      }
    case 'cart/delete': {
      if (state.carts.length <= 1) return state
      const remaining = state.carts.filter((c) => c.id !== action.id)
      return {
        ...state,
        carts: remaining,
        groceries: state.groceries.map((g) =>
          g.cartId === action.id ? { ...g, cartId: remaining[0].id } : g,
        ),
      }
    }
    case 'grocery/add':
      return { ...state, groceries: [...state.groceries, { id: uid(), bought: false, ...action.payload }] }
    case 'grocery/toggle':
      return {
        ...state,
        groceries: state.groceries.map((g) => (g.id === action.id ? { ...g, bought: !g.bought } : g)),
      }
    case 'grocery/delete':
      return { ...state, groceries: state.groceries.filter((g) => g.id !== action.id) }

    /* Checking the shopping item in the Planner (or "Log now"):
       checked items → expense in the Groceries category + history. */
    case 'grocery/logTrip': {
      const cart = state.carts.find((c) => c.id === action.cartId)
      const items = state.groceries.filter((g) => g.cartId === action.cartId && g.bought)
      if (!cart || items.length === 0) return state
      const total = items.reduce((s, g) => s + (Number(g.estPrice) || 0), 0)
      const groceriesCat = state.budget.categories.find((c) => c.slug === 'groceries')
      const date = todayISO()
      return {
        ...state,
        groceries: state.groceries.filter((g) => !(g.cartId === action.cartId && g.bought)),
        groceryHistory: [
          ...(state.groceryHistory || []),
          ...items.map((g) => ({
            id: uid(),
            name: g.name,
            qty: g.qty,
            price: g.estPrice != null ? Number(g.estPrice) : null,
            date,
            cart: cart.name,
          })),
        ].slice(-300),
        budget: groceriesCat
          ? {
              ...state.budget,
              expenses: [
                ...state.budget.expenses,
                {
                  id: uid(),
                  label: `Shopping — ${cart.name} (${items.length} item${items.length > 1 ? 's' : ''})`,
                  amount: total,
                  categoryId: groceriesCat.id,
                  date,
                },
              ],
            }
          : state.budget,
      }
    }

    /* ---- Notes ---- */
    case 'note/add':
      return {
        ...state,
        notes: [{ id: uid(), pinned: false, createdAt: Date.now(), ...action.payload }, ...state.notes],
      }
    case 'note/togglePin':
      return {
        ...state,
        notes: state.notes.map((n) => (n.id === action.id ? { ...n, pinned: !n.pinned } : n)),
      }
    case 'note/toggleBlur':
      return {
        ...state,
        notes: state.notes.map((n) => (n.id === action.id ? { ...n, blurred: !n.blurred } : n)),
      }
    case 'note/delete':
      return { ...state, notes: state.notes.filter((n) => n.id !== action.id) }

    /* ---- Sticky notes (per-view pense-bête) ---- */
    case 'sticky/add':
      return {
        ...state,
        stickies: [
          ...state.stickies,
          { id: uid(), view: action.view, text: '', title: '', blurred: false, collapsed: false, pos: null, height: null },
        ],
      }
    case 'sticky/reorder': {
      const list = [...state.stickies]
      const from = list.findIndex((s) => s.id === action.fromId)
      const to = list.findIndex((s) => s.id === action.toId)
      if (from < 0 || to < 0) return state
      const [moved] = list.splice(from, 1)
      list.splice(to, 0, moved)
      return { ...state, stickies: list }
    }
    case 'sticky/update':
      return {
        ...state,
        stickies: state.stickies.map((s) => (s.id === action.id ? { ...s, ...action.payload } : s)),
      }
    case 'sticky/delete':
      return { ...state, stickies: state.stickies.filter((s) => s.id !== action.id) }

    /* ---- Global ---- */
    case 'data/replace':
      return action.payload

    default:
      return state
  }
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, loadState)

  useEffect(() => {
    saveState(state)
  }, [state])

  // Month rollover: archive the closed month automatically.
  useEffect(() => {
    const nowMonth = todayISO().slice(0, 7)
    if (state.budget.currentMonth && state.budget.currentMonth !== nowMonth) {
      dispatch({ type: 'budget/closeMonth', nowMonth })
    }
  }, [state.budget.currentMonth])

  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
