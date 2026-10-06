import { requireOwner } from "@/lib/staff-auth";
import AdminSidebar from "@/components/AdminSidebar";
import type { Service } from "@/lib/services";
import ServiceEditor from "./ServiceEditor";
import shell from "../admin.module.css";
export const dynamic = "force-dynamic";
export default async function Page() {
  const { supabase } = await requireOwner();
  const { data, error } = await supabase
    .from("birdshop_services")
    .select("slug,data,packages,is_visible")
    .is("deleted_at", null)
    .order("slug");
  if (error) throw Error("Service catalog unavailable.");
  return (
    <main className={shell.page}>
      <AdminSidebar />
      <section className={shell.content}>
        <header className={shell.topbar}>
          <div>
            <span>BIRDSHOP / SERVICES</span>
            <h1>Your service catalog.</h1>
            <p>
              Manage services, publish Basic / Standard / Premium packages, and
              keep Custom requests available.
            </p>
          </div>
        </header>
        <details>
          <summary>Add a new service</summary>
          <ServiceEditor />
        </details>
        {(data ?? []).map((row) => (
          <details key={row.slug}>
            <summary style={{ padding: "20px 0", cursor: "pointer" }}>
              {row.data.name} · {row.is_visible ? "Visible" : "Hidden"}
            </summary>
            <ServiceEditor
              service={
                {
                  ...row.data,
                  slug: row.slug,
                  packages: row.packages,
                } as Service
              }
              visible={row.is_visible}
            />
          </details>
        ))}
      </section>
    </main>
  );
}
