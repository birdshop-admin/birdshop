import AdminSidebar from "@/components/AdminSidebar";
import AdminAnalytics from "@/components/AdminAnalytics";
import { requireOwner } from "@/lib/staff-auth";
import styles from "../admin.module.css";
export const dynamic = "force-dynamic";
export default async function Page() {
  await requireOwner();
  return (
    <main className={styles.page}>
      <AdminSidebar />
      <section className={styles.content}>
        <header className={styles.topbar}>
          <div>
            <span>STORE INSIGHTS</span>
            <h1>Analytics</h1>
            <p>Current activity and retained sales history.</p>
          </div>
        </header>
        <AdminAnalytics />
      </section>
    </main>
  );
}
