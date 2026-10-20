"use client";

// Login email, date of birth (students under 18) and password, on /account
// (students and admins). Mentors have the same in Settings.
export function SignInCard({ profile, onChangePassword, title = "Sign-in & security" }: { profile: any; onChangePassword: () => void; title?: string }) {
  return (
    <section className="card stack" style={{ gap: 14 }}>
      <h2 style={{ fontSize: 26 }}>{title}</h2>
      <div className="between" style={{ flexWrap: "wrap", gap: 8 }}>
        <span className="text-secondary">Login email</span>
        <b>{profile.email}</b>
      </div>
      {profile.role === "BUYER" && profile.dateOfBirth && (
        <div className="between" style={{ flexWrap: "wrap", gap: 8, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          <span className="text-secondary">Date of birth</span>
          <span className="row" style={{ gap: 8 }}>
            <b>{new Date(profile.dateOfBirth).toLocaleDateString(undefined, { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" })}</b>
            {profile.minorStatus === "CONSENTED" && <span className="badge badge-success">Parent consent given</span>}
          </span>
        </div>
      )}
      {profile.hasPassword ? (
        <div className="between" style={{ flexWrap: "wrap", gap: 12, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          <div className="stack-sm" style={{ gap: 0 }}>
            <span className="text-secondary">Password</span>
            <b aria-label="Password hidden" style={{ letterSpacing: 2 }}>••••••••</b>
          </div>
          <button className="btn" onClick={onChangePassword}>Change password</button>
        </div>
      ) : (
        <p className="text-secondary" style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          You sign in with Google, so there&apos;s no MentorsMD password to change.
        </p>
      )}
    </section>
  );
}
