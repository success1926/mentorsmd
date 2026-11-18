// Browser tab title for this mentor page (the page itself is a client component).
export const metadata = { title: { absolute: "Payouts | MentorsMD", template: "%s | MentorsMD" }, robots: { index: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
