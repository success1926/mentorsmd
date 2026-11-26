// One section of a Settings page (students' /account, mentors'
// /dashboard/settings, Calendar & availability): a title, a short
// description, an optional control on the right (a switch), then the body.
// Every settings section uses this, so they all look the same.
import type { ReactNode } from "react";

export function SettingsSection({
  id,
  title,
  description,
  aside,
  badge,
  children,
  className,
}: {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  // A switch or button shown beside the title.
  aside?: ReactNode;
  badge?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`card settings-section${className ? ` ${className}` : ""}`}>
      <div className="settings-section-head">
        <div className="settings-section-text">
          <h2 className="block-title">
            {title}
            {badge}
          </h2>
          {description && <div className="text-secondary">{description}</div>}
        </div>
        {aside && <div className="settings-section-aside">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

// A label and value on one line inside a settings section (Login email,
// Password, Date of birth), with a line above it.
export function SettingsRow({ label, children, action }: { label: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="settings-row">
      <div className="stack-sm" style={{ gap: 0 }}>
        <span className="text-secondary">{label}</span>
        {children}
      </div>
      {action}
    </div>
  );
}
