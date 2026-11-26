// The one "Show more" button under a long admin list (email log, legal
// acceptance records, action log, Insights tables, Orders). Centered,
// small, always the same words unless a list really needs others.
export function ShowMore({ onClick, busy, label = "Show more" }: { onClick: () => void; busy?: boolean; label?: string }) {
  return (
    <div className="adm-show-more">
      <button type="button" className="btn btn-sm" onClick={onClick} disabled={busy}>
        {busy ? "Loading…" : label}
      </button>
    </div>
  );
}
