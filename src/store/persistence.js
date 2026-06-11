const STORAGE_KEY = 'kalai-data'
const SCHEMA_VERSION = 4

export const DEFAULT_TILE_ORDER = ['income', 'spent', 'remaining', 'unallocated']
export const DEFAULT_DASH_ORDER = ['planner', 'notes', 'workouts', 'budget', 'groceries']

export function todayISO() {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}

export function addDaysISO(iso, days) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function seedData() {
  const today = todayISO()
  const month = today.slice(0, 7)
  const lastMonth = addDaysISO(month + '-01', -1).slice(0, 7)
  return {
    version: SCHEMA_VERSION,
    dashOrder: DEFAULT_DASH_ORDER,
    tasks: [
      { id: uid(), title: 'Plan tomorrow morning', date: today, time: '20:00', done: false, order: null },
      { id: uid(), title: 'Reply to pending emails', date: today, time: '', done: false, order: null },
    ],
    recurringTasks: [
      { id: uid(), title: 'Morning stretch', time: '07:30', days: [0, 1, 2, 3, 4, 5, 6], doneDates: [] },
    ],
    workouts: [
      {
        id: uid(),
        name: 'Upper body — push',
        date: today,
        time: '18:00',
        completed: false,
        exercises: [
          { name: 'Bench press', sets: 4, reps: 8, weight: 60 },
          { name: 'Overhead press', sets: 3, reps: 10, weight: 35 },
          { name: 'Dips', sets: 3, reps: 12, weight: 0 },
        ],
      },
    ],
    workoutTemplates: [
      {
        id: uid(),
        name: 'Upper body — push',
        exercises: [
          { name: 'Bench press', sets: 4, reps: 8, weight: 60 },
          { name: 'Overhead press', sets: 3, reps: 10, weight: 35 },
          { name: 'Dips', sets: 3, reps: 12, weight: 0 },
        ],
      },
    ],
    budget: {
      monthlyIncome: 1500,
      tileOrder: DEFAULT_TILE_ORDER,
      currentMonth: month,
      history: [],
      categories: [
        { id: 'cat-rent', name: 'Rent', allocated: 600, recurring: true, pinned: true, subs: [], open: false },
        {
          id: 'cat-subs',
          name: 'Subscriptions',
          allocated: 0,
          recurring: true,
          pinned: true,
          open: false,
          subs: [
            { id: uid(), name: 'Phone plan', amount: 15 },
            { id: uid(), name: 'Netflix', amount: 14 },
          ],
        },
        { id: 'cat-groceries', name: 'Groceries', slug: 'groceries', allocated: 300, recurring: false, pinned: false, subs: [], open: false },
        { id: uid(), name: 'Transport', allocated: 80, recurring: false, pinned: false, subs: [], open: false },
        { id: uid(), name: 'Leisure', allocated: 150, recurring: false, pinned: false, subs: [], open: false },
        { id: 'cat-savings', name: 'Savings', allocated: 250, recurring: false, pinned: false, subs: [], open: false },
      ],
      expenses: [],
    },
    carts: [{ id: 'cart-1', name: 'Cart' }],
    groceries: [
      { id: uid(), name: 'Chicken breast', qty: '1 kg', estPrice: 9, bought: false, cartId: 'cart-1' },
      { id: uid(), name: 'Rice', qty: '2 kg', estPrice: 4, bought: false, cartId: 'cart-1' },
      { id: uid(), name: 'Eggs', qty: '12', estPrice: 3.5, bought: false, cartId: 'cart-1' },
    ],
    groceryHistory: [
      { id: uid(), name: 'Eggs', qty: '12', price: 3.5, date: lastMonth + '-05', cart: 'Cart' },
      { id: uid(), name: 'Eggs', qty: '12', price: 3.4, date: lastMonth + '-15', cart: 'Cart' },
      { id: uid(), name: 'Eggs', qty: '12', price: 3.5, date: lastMonth + '-26', cart: 'Cart' },
      { id: uid(), name: 'Milk', qty: '1 L', price: 1.2, date: lastMonth + '-05', cart: 'Cart' },
      { id: uid(), name: 'Milk', qty: '1 L', price: 1.2, date: lastMonth + '-15', cart: 'Cart' },
      { id: uid(), name: 'Milk', qty: '1 L', price: 1.3, date: lastMonth + '-26', cart: 'Cart' },
    ],
    notes: [
      {
        id: uid(),
        text: 'Welcome to KalAI! Everything you add is saved in your browser (localStorage). Use Export in the sidebar to back up your data.',
        pinned: true,
        blurred: false,
        createdAt: Date.now(),
      },
    ],
    stickies: [],
    agendaOrder: {},
  }
}

/* Upgrade old data instead of discarding it. */
function migrate(data) {
  if (!data || typeof data.version !== 'number') return null
  let d = data
  if (d.version === 1) {
    d = {
      ...d,
      version: 2,
      stickies: [],
      budget: {
        ...d.budget,
        tileOrder: DEFAULT_TILE_ORDER,
        categories: d.budget.categories.map((c) => ({
          recurring: false,
          pinned: false,
          subs: [],
          ...c,
        })),
      },
    }
  }
  if (d.version === 2) {
    const defaultCart = { id: 'cart-1', name: 'Cart' }
    d = {
      ...d,
      version: 3,
      dashOrder: DEFAULT_DASH_ORDER,
      recurringTasks: [],
      workoutTemplates: [],
      carts: [defaultCart],
      groceryHistory: [],
      tasks: (d.tasks || []).map((t) => ({ order: null, ...t })),
      groceries: (d.groceries || []).map((g) => ({ cartId: defaultCart.id, ...g })),
      budget: {
        ...d.budget,
        currentMonth: todayISO().slice(0, 7),
        history: [],
        categories: d.budget.categories.map((c) => ({ open: false, ...c })),
      },
    }
  }
  if (d.version === 3) {
    d = {
      ...d,
      version: 4,
      agendaOrder: {},
      stickies: (d.stickies || []).map((s) => ({ title: '', pos: null, height: null, ...s })),
      notes: (d.notes || []).map((n) => ({ blurred: false, ...n })),
    }
  }
  return d.version === SCHEMA_VERSION ? d : null
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedData()
    const migrated = migrate(JSON.parse(raw))
    return migrated || seedData()
  } catch {
    return seedData()
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // storage full or unavailable — fail silently
  }
}

export function exportData(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `kalai-backup-${todayISO()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function importData(file, onLoaded) {
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const migrated = migrate(JSON.parse(reader.result))
      if (migrated) onLoaded(migrated)
      else alert('Invalid backup file.')
    } catch {
      alert('Could not read this file.')
    }
  }
  reader.readAsText(file)
}
