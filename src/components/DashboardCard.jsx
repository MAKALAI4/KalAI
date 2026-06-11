export default function DashboardCard({ icon, color, title, hint, onClick, children }) {
  return (
    <button className="dash-card" onClick={onClick}>
      <div className="dash-card-head">
        <span className="dash-card-icon" style={{ background: `var(--${color}-soft)`, color: `var(--${color})` }}>
          {icon}
        </span>
        <div>
          <h3>{title}</h3>
          {hint && <div className="hint">{hint}</div>}
        </div>
      </div>
      <div className="dash-card-body">{children}</div>
    </button>
  )
}
