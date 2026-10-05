"use server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { requireOwner } from "@/lib/staff-auth";

import { revalidatePath } from "next/cache";

import { redirect } from "next/navigation";

import {
  buildInventoryCodeHint,
  decryptInventoryCode,
  encryptInventoryCode,
  hashInventoryCode,
  normalizeInventoryCode,
} from "@/lib/inventory-crypto";

type InventoryStatus = "available" | "reserved" | "sold" | "disabled";

function stringValue(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function inventoryUrl(message: string, tone: "success" | "error" = "success") {
  const params = new URLSearchParams({
    message,
    tone,
  });

  return `/admin/inventory?${params.toString()}`;
}

async function requireAdmin() {
  const auth = await requireOwner();
  return { ...auth, supabase: createAdminClient() };
}

function refreshInventory() {
  revalidatePath("/admin/inventory");

  revalidatePath("/admin/products");

  revalidatePath("/products");

  revalidatePath("/");
}

export async function setProductInventoryMode(formData: FormData) {
  const { supabase, user } = await requireAdmin();

  const productId = stringValue(formData, "product_id");
  await auditInventory(user.id, "inventory_mode_requested", productId);

  const mode = stringValue(formData, "mode");

  if (!productId || !["manual", "keys"].includes(mode)) {
    redirect(inventoryUrl("Invalid inventory mode request.", "error"));
  }

  const { error } = await supabase
    .from("products")
    .update({
      inventory_mode: mode,
    })
    .eq("id", productId);

  if (error) {
    redirect(
      inventoryUrl(
        `Could not update inventory mode: ${"This action could not be completed. Refresh and retry. Financial history is protected."}`,
        "error",
      ),
    );
  }

  refreshInventory();

  redirect(
    inventoryUrl(
      mode === "keys"
        ? "Key-managed inventory enabled. Public stock now follows available codes."
        : "Manual stock mode restored. Existing codes remain securely stored.",
    ),
  );
}

export async function addInventoryCodes(formData: FormData) {
  const { supabase, user } = await requireAdmin();

  const productId = stringValue(formData, "product_id");

  const rawCodes = String(formData.get("codes") ?? "");

  const note = stringValue(formData, "note");
  if (
    rawCodes.length > 1048576 ||
    rawCodes.split(/\r?\n/).some((code) => code.length > 8192)
  )
    redirect(inventoryUrl("Inventory batch or code is too large.", "error"));

  if (!productId) {
    redirect(inventoryUrl("Choose a product before adding codes.", "error"));
  }

  const uniqueCodes = Array.from(
    new Set(
      rawCodes.split(/\r?\n/).map(normalizeInventoryCode).filter(Boolean),
    ),
  );

  if (uniqueCodes.length === 0) {
    redirect(inventoryUrl("Paste at least one inventory code.", "error"));
  }

  if (uniqueCodes.length > 250) {
    redirect(inventoryUrl("Add at most 250 codes at one time.", "error"));
  }

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, name, inventory_mode")
    .eq("id", productId)
    .maybeSingle();

  if (productError || !product) {
    redirect(inventoryUrl("The selected product could not be found.", "error"));
  }

  let prepared;

  try {
    prepared = uniqueCodes.map((code) => ({
      product_id: productId,

      code_ciphertext: encryptInventoryCode(code),

      code_hash: hashInventoryCode(code),

      code_hint: buildInventoryCodeHint(code),

      status: "available",

      note: note || null,

      created_by: user.id,
    }));
  } catch (error) {
    redirect(
      inventoryUrl(
        error instanceof Error
          ? "This action could not be completed. Refresh and retry. Financial history is protected."
          : "Inventory encryption failed.",
        "error",
      ),
    );
  }

  const hashes = prepared.map((item) => item.code_hash);

  const { data: existing, error: existingError } = await supabase
    .from("product_inventory")
    .select("code_hash")
    .in("code_hash", hashes);

  if (existingError) {
    redirect(
      inventoryUrl(
        "Could not check existing inventory. Please retry.",
        "error",
      ),
    );
  }

  const existingHashes = new Set(
    (existing ?? []).map((item) => item.code_hash),
  );

  const rows = prepared.filter((item) => !existingHashes.has(item.code_hash));

  const duplicateCount = prepared.length - rows.length;

  if (rows.length === 0) {
    redirect(
      inventoryUrl(
        "Every submitted code already exists in inventory.",
        "error",
      ),
    );
  }

  const { error } = await supabase.from("product_inventory").insert(rows);

  if (error) {
    redirect(
      inventoryUrl(
        "Could not add inventory codes. Check for duplicates and retry.",
        "error",
      ),
    );
  }

  refreshInventory();

  const modeNote =
    product.inventory_mode === "keys"
      ? "Public stock was updated automatically."
      : "The product is still using manual stock until key-managed mode is enabled.";

  const duplicateNote =
    duplicateCount > 0
      ? ` ${duplicateCount} duplicate${duplicateCount === 1 ? " was" : "s were"} skipped.`
      : "";

  redirect(
    inventoryUrl(
      `${rows.length} code${rows.length === 1 ? "" : "s"} added to ${product.name}.${duplicateNote} ${modeNote}`,
    ),
  );
}

export async function setInventoryCodeStatus(formData: FormData) {
  const { supabase, user } = await requireAdmin();

  const id = stringValue(formData, "id");
  await auditInventory(user.id, "inventory_status_requested", id);

  const nextStatus = stringValue(formData, "status") as InventoryStatus;

  if (!id || !["available", "disabled"].includes(nextStatus)) {
    redirect(inventoryUrl("Invalid inventory status change.", "error"));
  }

  const { data: current, error: currentError } = await supabase
    .from("product_inventory")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (currentError || !current) {
    redirect(inventoryUrl("Inventory code could not be found.", "error"));
  }

  if (current.status === "reserved" || current.status === "sold") {
    redirect(
      inventoryUrl(
        "Reserved or sold codes are locked from manual status changes.",
        "error",
      ),
    );
  }

  const { error } = await supabase
    .from("product_inventory")
    .update({
      status: nextStatus,
    })
    .eq("id", id)
    .in("status", ["available", "disabled"])
    .select("id")
    .single();

  if (error) {
    redirect(
      inventoryUrl(
        "Code state changed or could not be updated. Refresh and retry.",
        "error",
      ),
    );
  }

  refreshInventory();

  redirect(
    inventoryUrl(
      nextStatus === "disabled"
        ? "Code disabled. Key-managed stock was reduced automatically."
        : "Code returned to available inventory.",
    ),
  );
}

export async function deleteInventoryCode(formData: FormData) {
  const { supabase, user } = await requireAdmin();

  const id = stringValue(formData, "id");
  await auditInventory(user.id, "inventory_delete_requested", id);

  if (!id) {
    redirect(inventoryUrl("Missing inventory code ID.", "error"));
  }

  const { data: current, error: currentError } = await supabase
    .from("product_inventory")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (currentError || !current) {
    redirect(inventoryUrl("Inventory code could not be found.", "error"));
  }

  if (!["available", "disabled"].includes(current.status)) {
    redirect(
      inventoryUrl(
        "Reserved or sold codes are kept as fulfillment history and cannot be deleted here.",
        "error",
      ),
    );
  }

  const { error } = await supabase
    .from("product_inventory")
    .delete()
    .eq("id", id)
    .in("status", ["available", "disabled"])
    .select("id")
    .single();

  if (error) {
    redirect(
      inventoryUrl(
        "Code could not be deleted. It may now belong to a checkout or order.",
        "error",
      ),
    );
  }

  refreshInventory();

  redirect(inventoryUrl("Inventory code permanently deleted."));
}

export async function resetTestInventorySale(formData: FormData) {
  const { supabase, user } = await requireAdmin();

  const id = stringValue(formData, "id");
  await auditInventory(user.id, "test_inventory_reset_requested", id);

  if (!id) {
    redirect(inventoryUrl("Missing inventory code ID.", "error"));
  }

  const { error } = await supabase.rpc("birdshop_reset_test_inventory_sale", {
    p_inventory_id: id,
  });

  if (error) {
    redirect(
      inventoryUrl(
        "This action could not be completed. Refresh and retry. Financial history is protected.",
        "error",
      ),
    );
  }

  refreshInventory();

  redirect(
    inventoryUrl(
      "Test sale removed. Its assigned inventory was restored to available stock.",
    ),
  );
}

export async function deleteTestFulfilledInventory(formData: FormData) {
  const { supabase, user } = await requireAdmin();

  const id = stringValue(formData, "id");
  await auditInventory(user.id, "test_inventory_delete_requested", id);

  if (!id) {
    redirect(inventoryUrl("Missing inventory code ID.", "error"));
  }

  const { error } = await supabase.rpc(
    "birdshop_delete_test_fulfilled_inventory",
    {
      p_inventory_id: id,
    },
  );

  if (error) {
    redirect(
      inventoryUrl(
        "This action could not be completed. Refresh and retry. Financial history is protected.",
        "error",
      ),
    );
  }

  refreshInventory();

  redirect(
    inventoryUrl(
      "Test sale and selected test key permanently deleted. Any other keys from that test order were restored.",
    ),
  );
}

export async function revealInventoryCode(
  id: string,
): Promise<{ ok: true; code: string } | { ok: false; message: string }> {
  const { supabase, user } = await requireAdmin();
  try {
    await rateLimit("owner-code-reveal", user.id, 20, 3600);
    const { data, error } = await supabase
      .from("product_inventory")
      .select("code_ciphertext")
      .eq("id", id)
      .single();
    if (error || !data) throw new Error("Inventory code could not be found.");
    const { error: auditError } = await supabase
      .from("birdshop_audit_log")
      .insert({
        actor_id: user.id,
        action: "owner_code_reveal",
        entity_id: id,
      });
    if (auditError)
      throw new Error("Could not record secure code access. Please retry.");
    return { ok: true, code: decryptInventoryCode(data.code_ciphertext) };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? "This action could not be completed. Refresh and retry. Financial history is protected."
          : "Unable to reveal code.",
    };
  }
}

async function auditInventory(
  actorId: string,
  action: string,
  entityId: string,
) {
  if (!/^[0-9a-f-]{36}$/i.test(entityId))
    throw new Error("Invalid inventory record.");
  const { error } = await createAdminClient()
    .from("birdshop_audit_log")
    .insert({
      actor_id: actorId,
      action,
      entity_id: entityId,
      details: { actor_role: "owner", result: "requested" },
    });
  if (error) throw new Error("Could not record inventory action.");
}
