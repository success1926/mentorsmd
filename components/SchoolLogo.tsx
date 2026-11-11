import { logoFor, schoolInitials, type LogoMap } from "@/lib/schoolLogoKey";

// A school's logo in a small rounded square (Nov 2026), or its initials on
// a deep colour when no logo has been uploaded yet (Admin -> Website ->
// Site settings -> School logos). Works in server and client components.

// Deep colours that read like school crests, picked by the name so a
// school always gets the same one.
const CREST = ["#8C1D2F", "#1F3A68", "#245B3C", "#5536D6", "#7A4A12", "#2B1F6B", "#0F5C6B", "#6B1F4E"];
function crestColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return CREST[h % CREST.length];
}

export function SchoolLogo({ name, logos, size = 32, title = true }: { name: string; logos?: LogoMap | null; size?: number; title?: boolean }) {
  const logo = logoFor(logos, name);
  const style = { width: size, height: size, borderRadius: Math.round(size / 5) };
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logo} alt={title ? name : ""} title={title ? name : undefined} className="school-logo" style={style} loading="lazy" />
    );
  }
  return (
    <span
      className="school-logo school-logo-letters"
      role={title ? "img" : undefined}
      aria-label={title ? name : undefined}
      aria-hidden={title ? undefined : true}
      title={title ? name : undefined}
      style={{ ...style, background: crestColor(name), fontSize: Math.max(10, Math.round(size * 0.38)) }}
    >
      {schoolInitials(name)}
    </span>
  );
}

// "Successful clients at:" and a row of logos (the Leland-style card).
export function ClientSchools({ schools, logos, size = 32, max, label = "Successful clients at:" }: { schools: string[]; logos?: LogoMap | null; size?: number; max?: number; label?: string }) {
  if (!schools?.length) return null;
  const shown = max ? schools.slice(0, max) : schools;
  const more = schools.length - shown.length;
  return (
    <div className="client-schools">
      <span className="client-schools-label">{label}</span>
      <ul className="client-schools-row" aria-label={label.replace(/:$/, "")}>
        {shown.map((s) => (
          <li key={s}>
            <SchoolLogo name={s} logos={logos} size={size} />
          </li>
        ))}
        {more > 0 && <li className="client-schools-more">+{more}</li>}
      </ul>
    </div>
  );
}
