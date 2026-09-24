"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/* =========================================================
   HELPERS
========================================================= */

function ordersUrl(
  message: string,
  tone: "success" | "error" = "success",
  view = "services"
) {
  return `/admin/orders?view=${encodeURIComponent(
    view
  )}&message=${encodeURIComponent(
    message
  )}&tone=${tone}`;
}

async function requireAdmin() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const { data: admin } =
    await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

  if (!admin) {
    redirect("/admin/login");
  }

  return supabase;
}

function getOrderId(
  formData: FormData
) {
  const id =
    String(
      formData.get("id") ??
        ""
    ).trim();

  if (!id) {
    throw new Error(
      "Missing order ID."
    );
  }

  return id;
}

function refreshOrders() {
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/products");
  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/services");
}

/* =========================================================
   TEST SERVICE ORDER
========================================================= */

export async function createTestServiceOrder(
  formData: FormData
) {
  const supabase =
    await requireAdmin();

  const customerName =
    String(
      formData.get(
        "customer_name"
      ) ?? ""
    ).trim();

  const customerEmail =
    String(
      formData.get(
        "customer_email"
      ) ?? ""
    ).trim();

  const serviceName =
    String(
      formData.get(
        "service_name"
      ) ?? ""
    ).trim();

  const packageName =
    String(
      formData.get(
        "package_name"
      ) ?? ""
    ).trim();

  const price =
    Number(
      formData.get(
        "price"
      ) ?? 0
    );

  const note =
    String(
      formData.get(
        "note"
      ) ?? ""
    ).trim();

  if (
    !customerName ||
    !customerEmail ||
    !serviceName
  ) {
    redirect(
      ordersUrl(
        "Customer name, email, and service are required.",
        "error",
        "testing"
      )
    );
  }

  if (
    !Number.isFinite(price) ||
    price < 0
  ) {
    redirect(
      ordersUrl(
        "Enter a valid service price.",
        "error",
        "testing"
      )
    );
  }

  const { error } =
    await supabase.rpc(
      "birdshop_admin_create_test_service_order",
      {
        p_customer_name:
          customerName,

        p_customer_email:
          customerEmail,

        p_service_name:
          serviceName,

        p_package_name:
          packageName || null,

        p_price:
          price,

        p_note:
          note || null,
      }
    );

  if (error) {
    redirect(
      ordersUrl(
        error.message,
        "error",
        "testing"
      )
    );
  }

  refreshOrders();

  redirect(
    ordersUrl(
      "Test service order created.",
      "success",
      "services"
    )
  );
}

/* =========================================================
   SERVICE STATUS
========================================================= */

export async function updateServiceOrder(
  formData: FormData
) {
  const supabase =
    await requireAdmin();

  const id =
    getOrderId(formData);

  const status =
    String(
      formData.get(
        "status"
      ) ?? ""
    ).trim();

  const assignedTo =
    String(
      formData.get(
        "assigned_to"
      ) ?? ""
    ).trim();

  const allowed = [
    "new",
    "discussing",
    "quote_sent",
    "awaiting_payment",
    "assigned",
    "in_progress",
    "waiting_customer",
    "customer_replied",
    "ready_for_delivery",
    "completed",
    "cancelled",
  ];

  if (
    !allowed.includes(status)
  ) {
    redirect(
      ordersUrl(
        "Invalid service status.",
        "error"
      )
    );
  }

  const { error } =
    await supabase.rpc(
      "birdshop_set_service_order_status",
      {
        p_order_id: id,
        p_status: status,
        p_assigned_to:
          assignedTo || null,
      }
    );

  if (error) {
    redirect(
      ordersUrl(
        error.message,
        "error"
      )
    );
  }

  refreshOrders();

  if (status === "completed") {
    redirect(
      ordersUrl(
        "Service completed and moved to Completed.",
        "success",
        "completed"
      )
    );
  }

  redirect(
    ordersUrl(
      status ===
        "awaiting_payment"
        ? "Service is now waiting for payment."
        : status ===
            "ready_for_delivery"
          ? "Service marked ready for final delivery."
          : "Service order updated."
    )
  );
}

/* =========================================================
   MARK TEST SERVICE PAID

   DEVELOPMENT ONLY.

   Real customer payments will eventually be recorded
   automatically by Stripe's verified webhook.
========================================================= */

export async function markTestServicePaid(
  formData: FormData
) {
  const supabase =
    await requireAdmin();

  const id =
    getOrderId(formData);

  const {
    data: order,
    error: orderError,
  } =
    await supabase
      .from("orders")
      .select(
        "id, source, order_type, payment_status"
      )
      .eq("id", id)
      .maybeSingle();

  if (
    orderError ||
    !order
  ) {
    redirect(
      ordersUrl(
        "Unable to find that test order.",
        "error"
      )
    );
  }

  if (
    order.source !==
      "admin_test" ||
    order.order_type !==
      "service"
  ) {
    redirect(
      ordersUrl(
        "Only admin test service orders can be manually marked paid.",
        "error"
      )
    );
  }

  if (
    order.payment_status ===
    "paid"
  ) {
    redirect(
      ordersUrl(
        "That test service order is already paid."
      )
    );
  }

  const { error } =
    await supabase
      .from("orders")
      .update({
        payment_status:
          "paid",

        payment_provider:
          "admin_test",

        payment_reference:
          `ADMIN-TEST-${Date.now()}`,

        paid_at:
          new Date()
            .toISOString(),

        order_status:
          "active",
      })
      .eq("id", id);

  if (error) {
    redirect(
      ordersUrl(
        error.message,
        "error"
      )
    );
  }

  refreshOrders();

  redirect(
    ordersUrl(
      "Test payment recorded."
    )
  );
}

/* =========================================================
   ARCHIVE
========================================================= */

export async function archiveOrder(
  formData: FormData
) {
  const supabase =
    await requireAdmin();

  const id =
    getOrderId(formData);

  const { error } =
    await supabase
      .from("orders")
      .update({
        archived_at:
          new Date()
            .toISOString(),
      })
      .eq("id", id);

  if (error) {
    redirect(
      ordersUrl(
        error.message,
        "error"
      )
    );
  }

  refreshOrders();

  redirect(
    ordersUrl(
      "Order archived.",
      "success",
      "archived"
    )
  );
}

/* =========================================================
   RESTORE FROM ARCHIVE
========================================================= */

export async function unarchiveOrder(
  formData: FormData
) {
  const supabase =
    await requireAdmin();

  const id =
    getOrderId(formData);

  const { error } =
    await supabase
      .from("orders")
      .update({
        archived_at: null,
      })
      .eq("id", id);

  if (error) {
    redirect(
      ordersUrl(
        error.message,
        "error",
        "archived"
      )
    );
  }

  refreshOrders();

  redirect(
    ordersUrl(
      "Order restored from archive."
    )
  );
}

/* =========================================================
   MOVE TO DELETED
========================================================= */

export async function softDeleteOrder(
  formData: FormData
) {
  const supabase =
    await requireAdmin();

  const id =
    getOrderId(formData);

  const { error } =
    await supabase
      .from("orders")
      .update({
        deleted_at:
          new Date()
            .toISOString(),
      })
      .eq("id", id);

  if (error) {
    redirect(
      ordersUrl(
        error.message,
        "error"
      )
    );
  }

  refreshOrders();

  redirect(
    ordersUrl(
      "Order moved to Deleted.",
      "success",
      "deleted"
    )
  );
}

/* =========================================================
   RESTORE FROM DELETED
========================================================= */

export async function restoreDeletedOrder(
  formData: FormData
) {
  const supabase =
    await requireAdmin();

  const id =
    getOrderId(formData);

  const { error } =
    await supabase
      .from("orders")
      .update({
        deleted_at: null,
      })
      .eq("id", id);

  if (error) {
    redirect(
      ordersUrl(
        error.message,
        "error",
        "deleted"
      )
    );
  }

  refreshOrders();

  redirect(
    ordersUrl(
      "Order restored.",
      "success",
      "deleted"
    )
  );
}

/* =========================================================
   PERMANENTLY DELETE

   Real paid orders are protected by the database function.
========================================================= */

export async function permanentlyDeleteOrder(
  formData: FormData
) {
  const supabase =
    await requireAdmin();

  const id =
    getOrderId(formData);

  const { error } =
    await supabase.rpc(
      "birdshop_permanently_delete_order",
      {
        p_order_id: id,
      }
    );

  if (error) {
    redirect(
      ordersUrl(
        error.message,
        "error",
        "deleted"
      )
    );
  }

  refreshOrders();

  redirect(
    ordersUrl(
      "Order permanently deleted.",
      "success",
      "deleted"
    )
  );
}

/* =========================================================
   LEGACY TEST DELETE

   Kept because existing testing tools may still use it.
========================================================= */

export async function deleteTestOrder(
  formData: FormData
) {
  const supabase =
    await requireAdmin();

  const id =
    getOrderId(formData);

  const { error } =
    await supabase.rpc(
      "birdshop_delete_test_order",
      {
        p_order_id: id,
      }
    );

  if (error) {
    redirect(
      ordersUrl(
        error.message,
        "error",
        "testing"
      )
    );
  }

  refreshOrders();

  redirect(
    ordersUrl(
      "Test order permanently deleted.",
      "success",
      "testing"
    )
  );
}