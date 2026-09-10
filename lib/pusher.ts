import Pusher from "pusher";

export const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

// One conversation = one private channel. Naming it this way keeps the
// channel name predictable on both the server (when triggering) and the
// frontend (when subscribing), and "private-" is what tells Pusher this
// channel needs the /api/pusher/auth check before anyone can join it.
export function conversationChannel(conversationId: string) {
  return `private-conversation-${conversationId}`;
}

// Same idea, for the separate dispute thread on an order. Kept as its
// own channel (rather than reusing conversationChannel) since a dispute
// thread has a different participant set - buyer, seller, AND any admin,
// not just the two people in the regular conversation.
export function disputeChannel(orderId: string) {
  return `private-dispute-${orderId}`;
}
