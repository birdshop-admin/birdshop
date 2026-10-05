import AdminSidebar from "@/components/AdminSidebar";
import AdminOverview from "@/components/AdminOverview";
import { requireOwner } from "@/lib/staff-auth";
import styles from "./admin.module.css";
export const dynamic = "force-dynamic";
export default async function Page() {
  await requireOwner();
  return (
    <main className={styles.page}>
      <AdminSidebar />
      <section className={styles.content}>
        <header className={styles.topbar}>
          <div>
            <span>BIRDSHOP / OVERVIEW</span>
            <h1>Your store, in focus.</h1>
            <p>
              The conversations, orders, and next steps that need you today.
            </p>
          </div>
        </header>
        <AdminOverview />
      </section>
    </main>
  );
}
