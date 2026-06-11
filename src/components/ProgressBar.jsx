export default function ProgressBar({ ratio, over = false }) {
  const pct = Math.min(Math.max(ratio * 100, 0), 100)
  const color = over ? 'red' : pct >= 85 ? 'orange' : 'green'
  return (
    <div className="progress">
      <div className={`progress-fill ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}
