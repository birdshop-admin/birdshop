import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/staff-auth";

// The Orders page was retired: service work is completed from Chat, digital
// delivery recovery lives in Settings, and sales history is in Analytics.
// Old links (including ones in earlier admin emails) land in the right place.
export default async function OrdersRedirect({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  await requireOwner();
  const { view } = await searchParams;

  if (view === "digital" || view === "products") redirect("/admin/settings#deliveries");
  if (view === "completed") redirect("/admin/chat?view=completed&type=service");
  if (view === "archived" || view === "deleted") redirect("/admin/analytics");

  redirect("/admin/chat?view=progress&type=service");
}
