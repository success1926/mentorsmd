import { EMAILS } from "@/lib/emailTemplates";

// The browser tab shows which email is being edited.
export function generateMetadata({ params }: { params: { key: string } }) {
  const def = Object.prototype.hasOwnProperty.call(EMAILS, params.key) ? EMAILS[params.key] : null;
  return { title: def ? `${def.name} · Emails` : "Emails" };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
