import { getServices } from "@/lib/service-catalog";
import HomeClient from "./HomeClient";
export const dynamic = "force-dynamic";
export default async function Page() {
  return <HomeClient serviceList={await getServices()} />;
}
