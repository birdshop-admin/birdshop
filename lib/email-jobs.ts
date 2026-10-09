import "server-only";

import { createHash } from "node:crypto";

import {
  decryptInventoryCode,
  encryptInventoryCode,
} from "@/lib/inventory-crypto";

import { orderToken } from "@/lib/order-access";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { env, logServerError, siteUrl } from "@/lib/server-config";
import { serverRpc } from "@/lib/payment-service";

import {
  conversationCreatedCustomerEmail,
  conversationCreatedAdminEmail,
} from "@/lib/email/service-created";

import {
  paymentConfirmedCustomerEmail,
  paymentConfirmedAdminEmail,
} from "@/lib/email/payment-confirmed";

import { orderCompletedCustomerEmail } from "@/lib/email/order-completed";

type Envelope = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
};

type EmailJob = {
  id: string;
  kind: string;
  entity_id: string;
  payload: Envelope | null;
  encrypted_payload: string | null;
  lease_id: string;
  attempts: number;
};

const conversationKinds = [
  "conversation_customer",
  "conversation_admin",
  "recovery",
];

const formatAmount = (value: unknown, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: String(currency || "usd").toUpperCase(),
  }).format(Number(value ?? 0));

const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c]!,
  );

function simpleEmail(
  subject: string,
  text: string,
  link: string,
  label: string,
) {
  return {
    subject,
    text: `${text}\n\n${label}: ${link}\n\nKeep your private link safe.`,
    html: `<div style="background:#101e16;color:#f1eddf;padding:32px;font:16px/1.7 Arial,sans-serif"><p style="letter-spacing:.15em">BIRDSHOP</p><h1 style="font-size:25px">${escape(subject)}</h1><p>${escape(text).replaceAll("\n", "<br>")}</p><p><a style="display:inline-block;background:#eae3ce;color:#13261b;padding:14px 22px;border-radius:8px;text-decoration:none" href="${escape(link)}">${escape(label)}</a></p><p style="font-size:12px">Keep this private link safe.</p></div>`,
  };
}

async function holdJob(
  job: EmailJob,
  status: "cancelled" | "attention",
  reason: string,
) {
  const { error } = await createAdminClient()
    .from("birdshop_email_jobs")
    .update({
      status,
      lease_id: null,
      lease_until: null,
      last_error: reason,
    })
    .eq("id", job.id)
    .eq("lease_id", job.lease_id)
    .select("id")
    .single();

  if (error) throw new Error("Email lease changed.");
}

async function maySend(job: EmailJob): Promise<boolean> {
  const db = createAdminClient();

  if (job.kind === "service_completed") {
    const { data: order, error } = await db
      .from("orders")
      .select("service_status,payment_status")
      .eq("id", job.entity_id)
      .maybeSingle();

    if (error) {
      throw new Error("Completion email order could not be checked.");
    }

    // Never announce a completion that was reversed or fully refunded.
    if (
      !order ||
      order.service_status !== "completed" ||
      !["paid", "partially_refunded"].includes(order.payment_status)
    ) {
      await holdJob(
        job,
        "cancelled",
        "Order is no longer completed and paid; completion email cancelled.",
      );

      return false;
    }
  }

  if (conversationKinds.includes(job.kind)) {
    const { data: chat, error } = await db
      .from("service_conversations")
      .select("id,purged_at,deleted_at")
      .eq("id", job.entity_id)
      .maybeSingle();

    if (error) {
      throw new Error("Conversation availability could not be checked.");
    }

    if (!chat || chat.purged_at || chat.deleted_at) {
      await holdJob(
        job,
        "cancelled",
        "Conversation removed; chat email cancelled.",
      );

      return false;
    }
  } else if (
    job.kind !== "product_delivery" &&
    (job.payload || job.encrypted_payload)
  ) {
    const prepared: Envelope =
      job.payload ??
      JSON.parse(decryptInventoryCode(job.encrypted_payload!));

    const hasPrivateChatLink =
      /\/(?:service-chat\?token=|admin\/chat\?conversation=)/.test(
        prepared.html + prepared.text,
      );

    if (!hasPrivateChatLink) return true;

    const { data: order, error } = await db
      .from("orders")
      .select("order_type")
      .eq("id", job.entity_id)
      .single();

    if (error) {
      throw new Error("Receipt availability could not be checked.");
    }

    if (order.order_type === "service") {
      const { data: chat, error: chatError } = await db
        .from("service_conversations")
        .select("id,purged_at,deleted_at")
        .eq("order_id", job.entity_id)
        .maybeSingle();

      if (chatError) {
        throw new Error("Receipt conversation could not be checked.");
      }

      if (!chat || chat.purged_at || chat.deleted_at) {
        // The provider may already have accepted this exact envelope.
        // Changing it during a retry could break duplicate-send protection.
        await holdJob(
          job,
          "attention",
          "Chat removed after receipt preparation. Check provider history before sending a replacement receipt without its private chat link.",
        );

        return false;
      }
    }
  }

  return true;
}

async function renderJob(job: EmailJob): Promise<Envelope> {
  const db = createAdminClient();
  const from = env("BIRDSHOP_EMAIL_FROM");
  const base = siteUrl();

  if (conversationKinds.includes(job.kind)) {
    const { data: c, error } = await db
      .from("service_conversations")
      .select("*")
      .eq("id", job.entity_id)
      .single();

    if (
      error ||
      !c?.customer_email ||
      c.purged_at ||
      c.deleted_at
    ) {
      throw new Error("Conversation email record is unavailable.");
    }

    const chatUrl =
      `${base}/service-chat?token=` +
      encodeURIComponent(c.public_token);

    if (job.kind === "recovery") {
      return {
        from,
        to: c.customer_email,
        ...simpleEmail(
          `Your private BirdShop chat · ${c.reference}`,
          "Use the link below to return to your conversation. If you did not request this email, you can ignore it.",
          chatUrl,
          "Open private chat",
        ),
      };
    }

    const data = {
      reference: c.reference,
      conversationType: c.conversation_type,
      customerName: c.customer_name,
      customerEmail: c.customer_email,
      customerContact: c.customer_contact,
      subject: c.subject,
      requestMessage: c.request_message,
      serviceName: c.service_name,
      packageName: c.package_name,
      productName: c.product_name,
      productPlatform: c.product_platform,
      productRegion: c.product_region,
      chatUrl,
      recoveryUrl: `${base}/service-chat`,
      adminUrl: `${base}/admin/chat?conversation=${c.id}`,
    };

    return {
      from,
      to:
        job.kind === "conversation_admin"
          ? env("BIRDSHOP_ADMIN_EMAIL")
          : c.customer_email,
      ...(job.kind === "conversation_admin"
        ? conversationCreatedAdminEmail(data)
        : conversationCreatedCustomerEmail(data)),
    };
  }

  const { data: order, error } = await db
    .from("orders")
    .select("*")
    .eq("id", job.entity_id)
    .single();

  if (error || !order?.paid_at) {
    throw new Error("A verified paid order is required for this email.");
  }

  if (job.kind === "product_delivery") {
    const { data: items, error: itemError } = await db
      .from("order_items")
      .select("id,product_name,quantity")
      .eq("order_id", order.id)
      .order("id");

    const { data: allocations, error: allocationError } = await db
      .from("order_fulfillments")
      .select("order_item_id,product_inventory_id")
      .eq("order_id", order.id)
      .order("product_inventory_id");

    if (
      itemError ||
      allocationError ||
      !items?.length ||
      !allocations?.length
    ) {
      throw new Error("Delivery assignment is incomplete.");
    }

    const { data: inventory, error: inventoryError } = await db
      .from("product_inventory")
      .select("id,code_ciphertext")
      .in(
        "id",
        allocations.map((a) => a.product_inventory_id),
      );

    const { data: attempt, error: attemptError } = await db
      .from("birdshop_checkout_attempts")
      .select("id")
      .eq("order_id", order.id)
      .single();

    if (inventoryError || attemptError || !inventory) {
      throw new Error("Delivery records are unavailable.");
    }

    const lines = items.map((item) => {
      const codes = allocations
        .filter((a) => a.order_item_id === item.id)
        .map((a) => {
          const code = inventory.find(
            (i) => i.id === a.product_inventory_id,
          );

          if (!code) throw new Error("Missing assigned code.");

          return decryptInventoryCode(code.code_ciphertext);
        });

      if (codes.length !== item.quantity) {
        throw new Error("Delivery assignment is incomplete.");
      }

      return (
        item.product_name +
        " ×" +
        item.quantity +
        "\n" +
        codes.join("\n")
      );
    });

    return {
      from,
      to: order.customer_email,
      ...simpleEmail(
        "Your BirdShop codes · " + order.reference,
        "Your order " +
          order.reference +
          " has been completed and your codes are below.\nAmount paid: " +
          formatAmount(order.total, order.currency) +
          "\n\n" +
          lines.join("\n\n") +
          "\n\nNeed help? Contact BirdShop Product Support with your order reference.",
        base + "/orders/access?token=" + orderToken(attempt.id),
        "View order status",
      ),
    };
  }

  if (job.kind === "admin_refund" || job.kind === "customer_refund") {
    const admin = job.kind === "admin_refund";
    const refunded = Number(order.refunded_amount ?? 0);
    const full = order.payment_status === "refunded";
    const label = order.order_type === "product"
      ? "digital order"
      : `${order.service_name ?? "service"} order`;

    return {
      from,
      to: admin ? env("BIRDSHOP_ADMIN_EMAIL") : order.customer_email,
      ...simpleEmail(
        admin
          ? `Refund recorded · ${order.reference}`
          : `Your BirdShop refund · ${order.reference}`,
        (admin
          ? `Stripe confirmed a ${full ? "full" : "partial"} refund for ${order.customer_name || "a customer"}'s ${label}.`
          : `Hi ${order.customer_name || "there"}, your ${full ? "refund" : "partial refund"} for your BirdShop ${label} has been processed. Refunds usually reach your card within 5–10 business days, depending on your bank.`) +
          `\n\nOrder: ${order.reference}\nOriginal payment: ${formatAmount(order.total, order.currency)}\nRefunded so far: ${formatAmount(refunded, order.currency)}`,
        admin
          ? `${base}${order.order_type === "product" ? "/admin/analytics" : "/admin/chat?type=service"}`
          : `${base}/contact`,
        admin ? "View orders" : "Contact BirdShop",
      ),
    };
  }

  if (job.kind === "service_completed") {
    const { data: chat, error: chatError } = await db
      .from("service_conversations")
      .select("public_token,purged_at,deleted_at")
      .eq("order_id", order.id)
      // Prefer a live chat if an order was ever linked to more than one.
      .order("deleted_at", { ascending: true, nullsFirst: true })
      .limit(1)
      .maybeSingle();

    if (chatError) {
      throw new Error("Completion conversation could not be checked.");
    }

    const chatUrl =
      chat && !chat.purged_at && !chat.deleted_at
        ? `${base}/service-chat?token=${encodeURIComponent(chat.public_token)}`
        : null;

    return {
      from,
      to: order.customer_email,
      ...orderCompletedCustomerEmail({
        orderReference: order.reference,
        customerName: order.customer_name,
        serviceName: order.service_name ?? "Custom service",
        packageName: order.package_name ?? "Custom",
        amount: Number(order.total),
        refunded: Number(order.refunded_amount ?? 0),
        currency: order.currency,
        completedAt: order.fulfilled_at ?? new Date().toISOString(),
        chatUrl,
        supportUrl: `${base}/contact`,
      }),
    };
  }

  if (job.kind === "admin_payment" && order.order_type === "product") {
    return {
      from,
      to: env("BIRDSHOP_ADMIN_EMAIL"),
      ...simpleEmail(
        "Product payment · " + order.reference,
        `Payment recorded: ${formatAmount(order.total, order.currency)}. Delivery is tracked separately.`,
        base + "/admin/settings#deliveries",
        "View order",
      ),
    };
  }

  const { data: c, error: conversationError } = await db
    .from("service_conversations")
    .select("*")
    .eq("order_id", order.id)
    .single();

  const { data: payment, error: paymentError } = await db
    .from("service_payment_requests")
    .select("id,stripe_checkout_session_id")
    .eq("order_id", order.id)
    .single();

  if (conversationError || paymentError || !c || !payment) {
    throw new Error("Receipt records are unavailable.");
  }

  if (c.purged_at || c.deleted_at) {
    const admin = job.kind === "admin_payment";

    return {
      from,
      to: admin
        ? env("BIRDSHOP_ADMIN_EMAIL")
        : order.customer_email,
      ...simpleEmail(
        `Payment record · ${order.reference}`,
        `Order: ${order.reference}\nOriginal payment: ${formatAmount(order.total, order.currency)}.\nRefunded: ${formatAmount(order.refunded_amount ?? 0, order.currency)}.\nPayment status: ${order.payment_status}.\nThe original conversation is no longer available. Keep this order reference for support.`,
        base + (admin ? "/admin/analytics" : "/contact"),
        admin ? "View orders" : "Contact BirdShop",
      ),
    };
  }

  const data = {
    reference: c.reference,
    orderReference: order.reference,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    serviceName: order.service_name ?? "Custom service",
    packageName: order.package_name ?? "Custom",
    amount: Number(order.total),
    currency: order.currency,
    paidAt: order.paid_at,
    chatUrl: `${base}/service-chat?token=${encodeURIComponent(c.public_token)}`,
    adminUrl: `${base}/admin/chat?conversation=${c.id}`,
    paymentRequestId: payment.id,
    orderId: order.id,
    stripeSessionId: payment.stripe_checkout_session_id,
  };

  const admin = job.kind === "admin_payment";

  const template =
    order.payment_status === "paid"
      ? admin
        ? paymentConfirmedAdminEmail(data)
        : paymentConfirmedCustomerEmail(data)
      : simpleEmail(
          `Payment update · ${order.reference}`,
          `Original payment: ${formatAmount(order.total, order.currency)}. Refunded: ${formatAmount(order.refunded_amount ?? 0, order.currency)}.`,
          admin ? data.adminUrl : data.chatUrl,
          "View current status",
        );

  return {
    from,
    to: admin
      ? env("BIRDSHOP_ADMIN_EMAIL")
      : order.customer_email,
    ...template,
  };
}

export async function drainEmailJobs(
  limit = 4,
  jobId: string | null = null,
) {
  const db = createAdminClient();
  let sent = 0;

  for (let n = 0; n < limit; n++) {
    const job = await serverRpc<EmailJob | null>(
      "birdshop_v2_claim_email",
      {
        p_job_id: jobId,
      },
    );

    if (!job) break;

    // Set once the provider accepts this envelope; later failures are bookkeeping only.
    let accepted = false;
    let providerCode: string | null = null;
    let providerMessage = "";

    try {
      if (!(await maySend(job))) continue;

      if (
        job.kind === "product_delivery" &&
        !(await serverRpc<boolean>("birdshop_v2_prepare_delivery", {
          p_job_id: job.id,
          p_lease_id: job.lease_id,
        }))
      ) {
        continue;
      }

      const envelope: Envelope = job.encrypted_payload
        ? JSON.parse(decryptInventoryCode(job.encrypted_payload))
        : (job.payload ?? (await renderJob(job)));

      if (!job.payload && !job.encrypted_payload) {
        const { error } = await db
          .from("birdshop_email_jobs")
          .update(
            job.kind === "product_delivery"
              ? {
                  encrypted_payload: encryptInventoryCode(
                    JSON.stringify(envelope),
                  ),
                  payload: null,
                }
              : {
                  payload: envelope,
                },
          )
          .eq("id", job.id)
          .eq("lease_id", job.lease_id)
          .select("id")
          .single();

        if (error) {
          throw new Error("Email lease changed before delivery.");
        }
      }

      // Check again after preparation, including previously cached content.
      if (!(await maySend({ ...job, payload: envelope }))) {
        continue;
      }

      const { data: lease, error: leaseError } = await db
        .from("birdshop_email_jobs")
        .select("id")
        .eq("id", job.id)
        .eq("lease_id", job.lease_id)
        .eq("status", "sending")
        .maybeSingle();

      if (leaseError) {
        throw new Error("Email lease could not be checked.");
      }

      if (!lease) continue;

      // Saved envelopes keep the sender from when they were first built. Always
      // send from the current BIRDSHOP_EMAIL_FROM so fixing that setting fixes
      // retries. A changed sender was never accepted by the provider, so it gets
      // its own idempotency key; an unchanged one keeps the original key.
      const currentFrom = env("BIRDSHOP_EMAIL_FROM");
      const outgoing = { ...envelope, from: currentFrom };
      const idempotencyKey =
        envelope.from === currentFrom
          ? `birdshop-job-${job.id}`
          : `birdshop-job-${job.id}-${createHash("sha256").update(currentFrom).digest("hex").slice(0, 10)}`;

      const { data, error } = await new Resend(
        env("RESEND_API_KEY"),
      ).emails.send(outgoing, {
        idempotencyKey,
      });

      if (error || !data?.id) {
        // Provider error codes (e.g. validation_error) contain no secrets or recipient data.
        providerCode = error?.name ?? "missing_message_id";
        providerMessage = error?.message ?? "";
        throw new Error("Email provider rejected the message.");
      }

      accepted = true;

      if (job.kind === "product_delivery") {
        await serverRpc("birdshop_v2_finish_delivery", {
          p_job_id: job.id,
          p_lease_id: job.lease_id,
          p_provider_id: data.id,
        });

        sent++;
        continue;
      }

      const { error: saveError } = await db
        .from("birdshop_email_jobs")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          provider_id: data.id,
          lease_id: null,
          lease_until: null,
          last_error: null,
        })
        .eq("id", job.id)
        .eq("lease_id", job.lease_id)
        .select("id")
        .single();

      if (saveError) {
        throw new Error(
          "Email accepted; delivery state needs reconciliation.",
        );
      }

      sent++;
    } catch (problem) {
      // The saved note stays generic; the log names the real cause (for example a
      // missing setting or an unverified sending domain). Never logs email content.
      logServerError(
        `email ${job.kind}`,
        providerCode ? `${providerCode}: ${providerMessage}` : problem,
      );
      const { error: saveError } = await db
        .from("birdshop_email_jobs")
        .update({
          status: "failed",
          lease_until: null,
          lease_id: null,
          last_error: accepted
            ? "Provider accepted the email; state update failed. Retry reuses the same delivery identity."
            : providerCode
              ? `Provider rejected the email (${providerCode}). Retry with the same delivery identity.`
              : "Provider delivery or state update failed. Retry with the same delivery identity.",
          next_attempt_at: new Date(
            Date.now() +
              Math.min(
                3600,
                30 * 2 ** Math.min(job.attempts, 7),
              ) *
                1000,
          ).toISOString(),
        })
        .eq("id", job.id)
        .eq("lease_id", job.lease_id);

      if (saveError) {
        throw new Error("Email retry state could not be stored.");
      }

      // Codes already accepted by the provider must not be shown to staff as a failed delivery.
      if (job.kind === "product_delivery" && !accepted) {
        await db
          .from("orders")
          .update({
            delivery_status: "failed",
          })
          .eq("id", job.entity_id)
          .in("delivery_status", ["sending", "ready"]);
      }
    }

    if (n < limit - 1) {
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
  }

  return { sent };
}