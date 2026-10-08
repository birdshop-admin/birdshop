import { requireOwner } from "@/lib/staff-auth";
import AdminSidebar from "@/components/AdminSidebar";
import {
  parseServiceFlag,
  serviceImageUrl,
  type Service,
} from "@/lib/services";
import ServiceCatalog from "./ServiceCatalog";
import shell from "../admin.module.css";

export const dynamic = "force-dynamic";

type ServiceRow = {
  slug: string;
  data: unknown;
  packages: unknown;
  is_visible: boolean;
};

/* Raw rows for the editor: every stored key is kept (the editor shows the
   real saved values), with the pricing flag, image and lists normalised the
   same way the storefront reads them. */
function toEntry(row: ServiceRow) {
  const data =
    row.data && typeof row.data === "object" && !Array.isArray(row.data)
      ? (row.data as Record<string, unknown>)
      : {};

  return {
    service: {
      ...data,
      slug: row.slug,
      packages: Array.isArray(row.packages) ? row.packages : [],
      features: Array.isArray(data.features) ? data.features : [],
      customOnly: parseServiceFlag(data.customOnly),
      image: serviceImageUrl(data.image, row.slug),
    } as Service,
    visible: row.is_visible,
  };
}

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
              Manage services, publish Basic / Standard / Premium packages, or
              mark a service as custom quote only.
            </p>
          </div>
        </header>
        <ServiceCatalog
          services={((data ?? []) as ServiceRow[]).map(toEntry)}
        />
      </section>
    </main>
  );
}
