"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  redirect,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  buildInventoryCodeHint,
  decryptInventoryCode,
  encryptInventoryCode,
  hashInventoryCode,
  normalizeInventoryCode,
} from "@/lib/inventory-crypto";

type InventoryStatus =
  | "available"
  | "reserved"
  | "sold"
  | "disabled";

function stringValue(
  formData: FormData,
  name: string
) {
  return String(
    formData.get(name) ?? ""
  ).trim();
}

function inventoryUrl(
  message: string,
  tone:
    | "success"
    | "error" = "success"
) {
  const params =
    new URLSearchParams({
      message,
      tone,
    });

  return `/admin/inventory?${params.toString()}`;
}

async function requireAdmin() {
  const supabase =
    await createClient();

  const {
    data: userData,
    error: userError,
  } =
    await supabase.auth.getUser();

  const user =
    userData.user;

  if (
    userError ||
    !user
  ) {
    redirect(
      "/admin/login"
    );
  }

  const {
    data: adminUser,
    error: adminError,
  } =
    await supabase
      .from("admin_users")
      .select("user_id, role")
      .eq("user_id", user.id)
      .maybeSingle();

  if (
    adminError ||
    !adminUser
  ) {
    redirect(
      "/admin/login"
    );
  }

  return {
    supabase,
    user,
  };
}

function refreshInventory() {
  revalidatePath(
    "/admin/inventory"
  );

  revalidatePath(
    "/admin/products"
  );

  revalidatePath(
    "/products"
  );

  revalidatePath("/");
}

export async function setProductInventoryMode(
  formData: FormData
) {
  const {
    supabase,
  } =
    await requireAdmin();

  const productId =
    stringValue(
      formData,
      "product_id"
    );

  const mode =
    stringValue(
      formData,
      "mode"
    );

  if (
    !productId ||
    ![
      "manual",
      "keys",
    ].includes(mode)
  ) {
    redirect(
      inventoryUrl(
        "Invalid inventory mode request.",
        "error"
      )
    );
  }

  const {
    error,
  } =
    await supabase
      .from("products")
      .update({
        inventory_mode:
          mode,
      })
      .eq("id", productId);

  if (error) {
    redirect(
      inventoryUrl(
        `Could not update inventory mode: ${error.message}`,
        "error"
      )
    );
  }

  refreshInventory();

  redirect(
    inventoryUrl(
      mode === "keys"
        ? "Key-managed inventory enabled. Public stock now follows available codes."
        : "Manual stock mode restored. Existing codes remain securely stored."
    )
  );
}

export async function addInventoryCodes(
  formData: FormData
) {
  const {
    supabase,
    user,
  } =
    await requireAdmin();

  const productId =
    stringValue(
      formData,
      "product_id"
    );

  const rawCodes =
    String(
      formData.get("codes") ??
        ""
    );

  const note =
    stringValue(
      formData,
      "note"
    );

  if (!productId) {
    redirect(
      inventoryUrl(
        "Choose a product before adding codes.",
        "error"
      )
    );
  }

  const uniqueCodes =
    Array.from(
      new Set(
        rawCodes
          .split(/\r?\n/)
          .map(
            normalizeInventoryCode
          )
          .filter(Boolean)
      )
    );

  if (
    uniqueCodes.length === 0
  ) {
    redirect(
      inventoryUrl(
        "Paste at least one inventory code.",
        "error"
      )
    );
  }

  if (
    uniqueCodes.length > 250
  ) {
    redirect(
      inventoryUrl(
        "Add at most 250 codes at one time.",
        "error"
      )
    );
  }

  const {
    data: product,
    error: productError,
  } =
    await supabase
      .from("products")
      .select(
        "id, name, inventory_mode"
      )
      .eq("id", productId)
      .maybeSingle();

  if (
    productError ||
    !product
  ) {
    redirect(
      inventoryUrl(
        "The selected product could not be found.",
        "error"
      )
    );
  }

  let prepared;

  try {
    prepared =
      uniqueCodes.map(
        (code) => ({
          product_id:
            productId,

          code_ciphertext:
            encryptInventoryCode(
              code
            ),

          code_hash:
            hashInventoryCode(
              code
            ),

          code_hint:
            buildInventoryCodeHint(
              code
            ),

          status:
            "available",

          note:
            note || null,

          created_by:
            user.id,
        })
      );
  } catch (error) {
    redirect(
      inventoryUrl(
        error instanceof Error
          ? error.message
          : "Inventory encryption failed.",
        "error"
      )
    );
  }

  const hashes =
    prepared.map(
      (item) =>
        item.code_hash
    );

  const {
    data: existing,
    error: existingError,
  } =
    await supabase
      .from("product_inventory")
      .select("code_hash")
      .in("code_hash", hashes);

  if (existingError) {
    redirect(
      inventoryUrl(
        `Could not check existing inventory: ${existingError.message}`,
        "error"
      )
    );
  }

  const existingHashes =
    new Set(
      (existing ?? []).map(
        (item) =>
          item.code_hash
      )
    );

  const rows =
    prepared.filter(
      (item) =>
        !existingHashes.has(
          item.code_hash
        )
    );

  const duplicateCount =
    prepared.length -
    rows.length;

  if (
    rows.length === 0
  ) {
    redirect(
      inventoryUrl(
        "Every submitted code already exists in inventory.",
        "error"
      )
    );
  }

  const {
    error,
  } =
    await supabase
      .from("product_inventory")
      .insert(rows);

  if (error) {
    redirect(
      inventoryUrl(
        `Could not add inventory codes: ${error.message}`,
        "error"
      )
    );
  }

  refreshInventory();

  const modeNote =
    product.inventory_mode ===
    "keys"
      ? "Public stock was updated automatically."
      : "The product is still using manual stock until key-managed mode is enabled.";

  const duplicateNote =
    duplicateCount > 0
      ? ` ${duplicateCount} duplicate${duplicateCount === 1 ? " was" : "s were"} skipped.`
      : "";

  redirect(
    inventoryUrl(
      `${rows.length} code${rows.length === 1 ? "" : "s"} added to ${product.name}.${duplicateNote} ${modeNote}`
    )
  );
}

export async function setInventoryCodeStatus(
  formData: FormData
) {
  const {
    supabase,
  } =
    await requireAdmin();

  const id =
    stringValue(
      formData,
      "id"
    );

  const nextStatus =
    stringValue(
      formData,
      "status"
    ) as InventoryStatus;

  if (
    !id ||
    ![
      "available",
      "disabled",
    ].includes(
      nextStatus
    )
  ) {
    redirect(
      inventoryUrl(
        "Invalid inventory status change.",
        "error"
      )
    );
  }

  const {
    data: current,
    error: currentError,
  } =
    await supabase
      .from("product_inventory")
      .select("id, status")
      .eq("id", id)
      .maybeSingle();

  if (
    currentError ||
    !current
  ) {
    redirect(
      inventoryUrl(
        "Inventory code could not be found.",
        "error"
      )
    );
  }

  if (
    current.status ===
      "reserved" ||
    current.status ===
      "sold"
  ) {
    redirect(
      inventoryUrl(
        "Reserved or sold codes are locked from manual status changes.",
        "error"
      )
    );
  }

  const {
    error,
  } =
    await supabase
      .from("product_inventory")
      .update({
        status:
          nextStatus,
      })
      .eq("id", id);

  if (error) {
    redirect(
      inventoryUrl(
        `Could not update the code: ${error.message}`,
        "error"
      )
    );
  }

  refreshInventory();

  redirect(
    inventoryUrl(
      nextStatus ===
        "disabled"
        ? "Code disabled. Key-managed stock was reduced automatically."
        : "Code returned to available inventory."
    )
  );
}

export async function deleteInventoryCode(
  formData: FormData
) {
  const {
    supabase,
  } =
    await requireAdmin();

  const id =
    stringValue(
      formData,
      "id"
    );

  if (!id) {
    redirect(
      inventoryUrl(
        "Missing inventory code ID.",
        "error"
      )
    );
  }

  const {
    data: current,
    error: currentError,
  } =
    await supabase
      .from("product_inventory")
      .select("id, status")
      .eq("id", id)
      .maybeSingle();

  if (
    currentError ||
    !current
  ) {
    redirect(
      inventoryUrl(
        "Inventory code could not be found.",
        "error"
      )
    );
  }

  if (
    ![
      "available",
      "disabled",
    ].includes(
      current.status
    )
  ) {
    redirect(
      inventoryUrl(
        "Reserved or sold codes are kept as fulfillment history and cannot be deleted here.",
        "error"
      )
    );
  }

  const {
    error,
  } =
    await supabase
      .from("product_inventory")
      .delete()
      .eq("id", id);

  if (error) {
    redirect(
      inventoryUrl(
        `Could not delete the code: ${error.message}`,
        "error"
      )
    );
  }

  refreshInventory();

  redirect(
    inventoryUrl(
      "Inventory code permanently deleted."
    )
  );
}


export async function resetTestInventorySale(
  formData: FormData
) {
  const {
    supabase,
  } =
    await requireAdmin();

  const id =
    stringValue(
      formData,
      "id"
    );

  if (!id) {
    redirect(
      inventoryUrl(
        "Missing inventory code ID.",
        "error"
      )
    );
  }

  const { error } =
    await supabase.rpc(
      "birdshop_reset_test_inventory_sale",
      {
        p_inventory_id:
          id,
      }
    );

  if (error) {
    redirect(
      inventoryUrl(
        error.message,
        "error"
      )
    );
  }

  refreshInventory();

  redirect(
    inventoryUrl(
      "Test sale removed. Its assigned inventory was restored to available stock."
    )
  );
}

export async function deleteTestFulfilledInventory(
  formData: FormData
) {
  const {
    supabase,
  } =
    await requireAdmin();

  const id =
    stringValue(
      formData,
      "id"
    );

  if (!id) {
    redirect(
      inventoryUrl(
        "Missing inventory code ID.",
        "error"
      )
    );
  }

  const { error } =
    await supabase.rpc(
      "birdshop_delete_test_fulfilled_inventory",
      {
        p_inventory_id:
          id,
      }
    );

  if (error) {
    redirect(
      inventoryUrl(
        error.message,
        "error"
      )
    );
  }

  refreshInventory();

  redirect(
    inventoryUrl(
      "Test sale and selected test key permanently deleted. Any other keys from that test order were restored."
    )
  );
}

export async function revealInventoryCode(
  id: string
): Promise<
  | {
      ok: true;
      code: string;
    }
  | {
      ok: false;
      message: string;
    }
> {
  const {
    supabase,
  } =
    await requireAdmin();

  const {
    data,
    error,
  } =
    await supabase
      .from("product_inventory")
      .select("code_ciphertext")
      .eq("id", id)
      .maybeSingle();

  if (
    error ||
    !data
  ) {
    return {
      ok: false,
      message:
        "Inventory code could not be found.",
    };
  }

  try {
    return {
      ok: true,
      code:
        decryptInventoryCode(
          data.code_ciphertext
        ),
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Could not decrypt the inventory code.",
    };
  }
}
