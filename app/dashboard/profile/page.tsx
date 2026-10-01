import { redirect } from "next/navigation";

// Old address for the account page - kept so existing links still work.
export default function OldProfilePage() {
  redirect("/account");
}
