import { requireStaff } from "@/lib/staff-auth";

import OwnerAdminChatPage from "./OwnerAdminChatPage";
import ServiceAgentChatPage from "./ServiceAgentChatPage";

type PageProps = {
  searchParams: Promise<{
    view?: string;
    type?: string;
    conversation?: string;
    message?: string;
    tone?: string;
  }>;
};

/* =========================================================
   ROLE ROUTER

   requireStaff verifies the session and active staff role, and
   reports a temporary lookup failure as retryable instead of
   signing staff out.
========================================================= */

export default async function AdminChatPage({ searchParams }: PageProps) {
  const { profile } = await requireStaff();

  if (profile.role === "owner") {
    return <OwnerAdminChatPage searchParams={searchParams} />;
  }

  return <ServiceAgentChatPage searchParams={searchParams} />;
}
