import { getServices } from "@/lib/service-catalog";
import ServicesClient from "./ServicesClient";
export const dynamic = "force-dynamic";
export default async function Page() {
  return <ServicesClient serviceList={await getServices()} />;
}
