import { requireOwner } from "@/lib/staff-auth";
export default async function OwnerLayout({children}:{children:React.ReactNode}) {await requireOwner();return <div id="site-content">{children}</div>;}
