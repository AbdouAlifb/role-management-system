export default function DashboardHome() {
  return (
    <div className="panel">
      <h1>Dashboard</h1>
      <p className="muted">
        You’re authenticated. Next we’ll add Users / Roles tables + modals, with permission-based UI.
      </p>

      <div className="panel__body">
        <div className="emptyState">
          <div className="emptyState__icon">📊</div>
          <div className="emptyState__title">Ready.</div>
          <div className="emptyState__desc">
            Start by implementing the Users table and Role CRUD. The layout is responsive and sidebar is toggleable.
          </div>
        </div>
      </div>
    </div>
  );
}
