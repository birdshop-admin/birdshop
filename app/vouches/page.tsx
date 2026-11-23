import { redirect } from "next/navigation";

// Legacy vouches links resolve to the single moderated feedback destination.
export default function VouchesRedirect() {
  redirect("/reviews");
}
