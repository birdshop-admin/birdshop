import { getServices } from "@/lib/service-catalog";
import ServicesClient from "./ServicesClient";
export const dynamic = "force-dynamic";

/** Keep the page functional even if the preview lacks the service-role key.
 * Never substitute fake service listings when the database query fails. */
export default async function Page() {
  try {
    const services = await getServices();
    return <ServicesClient serviceList={services} />;
  } catch (error) {
    console.error("[services] catalog unavailable:", error instanceof Error ? error.message : "unknown error");
    return <ServicesClient serviceList={[]} loadError />;
  }
}
