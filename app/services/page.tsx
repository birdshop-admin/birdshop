import { getServices } from "@/lib/service-catalog";
import ServicesClient from "./ServicesClient";
export const dynamic = "force-dynamic";

/** Display honest unavailable state if the preview cannot fetch live listings. */
export default async function Page() {
  let serviceList: Awaited<ReturnType<typeof getServices>> = [];
  let loadError = false;
  try {
    serviceList = await getServices();
  } catch (error) {
    loadError = true;
    console.error("[services] catalog unavailable:", error instanceof Error ? error.message : "unknown error");
  }
  return <ServicesClient serviceList={serviceList} loadError={loadError} />;
}
