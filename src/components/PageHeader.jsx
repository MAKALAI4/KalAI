export default function PageHeader({ title, subtitle, goTo, action }) {
  return (
    <div>
      {goTo && (
        <button className="back-link" onClick={() => goTo('dashboard')}>
          ← Back to dashboard
        </button>
      )}
      <div className="page-header">
        <div className="titles">
          <h1>{title}</h1>
          {subtitle && <div className="subtitle">{subtitle}</div>}
        </div>
        {action}
      </div>
    </div>
  )
}
