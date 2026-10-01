import { Inbox } from "@/components/Inbox";

export const metadata = { title: "Messages · MentorsMD" };

export default function MessageThreadPage({ params }: { params: { id: string } }) {
  return <Inbox selectedId={params.id} />;
}
