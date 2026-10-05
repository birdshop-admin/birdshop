import Link from "next/link";
import AdminSidebar from "@/components/AdminSidebar";
import AdminAnalytics from "@/components/AdminAnalytics";
import { requireOwner } from "@/lib/staff-auth";
import styles from "./admin.module.css";
export const dynamic = "force-dynamic";
export default async function Page() {
  const { supabase } = await requireOwner();
  const [queue, issues] = await Promise.all([
    supabase
      .from("service_conversations")
      .select("id", { count: "exact", head: true })
      .neq("source", "admin_test")
      .eq("status", "open")
      .is("deleted_at", null),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .neq("source", "admin_test")
      .eq("order_type", "product")
      .in("delivery_status", ["failed", "attention"]),
  ]);
  return (
    <main className={styles.page}>
      <AdminSidebar />
      <section className={styles.content}>
        <header className={styles.topbar}>
          <div>
            <span>BIRDSHOP / OVERVIEW</span>
            <h1>Your store today.</h1>
            <p>
              Confirmed sales, current activity, and work needing attention.
            </p>
          </div>
        </header>
        <AdminAnalytics />
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
            gap: 16,
          }}
        >
          <Link href="/admin/chat">
            Open conversations · {queue.error ? "Unavailable" : queue.count}
          </Link>
          <Link href="/admin/orders?view=digital">
            Delivery issues · {issues.error ? "Unavailable" : issues.count}
          </Link>
          <Link href="/admin/settings">Payment and delivery recovery →</Link>
        </section>
      </section>
    </main>
  );
}
