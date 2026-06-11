# KalAI — Life Dashboard

A minimalist dashboard (dark & light themes) to manage your life: daily planner, workouts, budget, groceries and notes — all linked together, all stored locally in your browser. Installable on your phone as an offline app (PWA).

## Run it

```bash
npm install   # first time only
npm run dev   # then open http://localhost:5173
```

Production build: `npm run build` (output in `dist/`, deployable on any static host).

## Install on your phone (PWA)

1. `npm run build`, then host the `dist/` folder on any HTTPS static host (GitHub Pages, Netlify, Vercel — all free).
2. Open the URL on your phone, then **Add to Home Screen** (Chrome: menu → "Install app"; Safari iOS: Share → "Add to Home Screen").
3. The app then works fully offline — data lives on the device.

## How categories are linked

- A workout scheduled today appears automatically in the **Daily Planner** (checking it off completes the session). Recurring tasks repeat on their weekdays.
- Checking grocery items puts a **Shopping** entry in today's Planner; checking it there logs the trip as an expense in the **Budget** Groceries category and archives the items to history.
- The **Groceries** view shows your grocery budget and a one-click **Favorites** row (items bought 3+ times). Up to 3 named carts side by side.
- **Budget**: recurring categories (rent, subscriptions…) are auto-paid each month; the **Spending pace** card compares what you really have left vs the expected glide path for today's date; months are archived automatically on the 1st (blue = spent, gray = expected on the chart).
- Sticky notes can be attached to every section (blur/collapse), and they all appear together on the **Notes** page with their category.
- Workout **reminders** fire 1 h and 30 min before a session (while the app is open and notifications are allowed).

## Data

Everything is saved in `localStorage` (key `kalai-data`, versioned schema with automatic migrations). Use **Export data** / **Import data** in the sidebar to back up, restore, or move your data to another device.
