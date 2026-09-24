import Link from "next/link";

import AdminSidebar from "@/components/AdminSidebar";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  addInventoryCodes,
  deleteInventoryCode,
  deleteTestFulfilledInventory,
  resetTestInventorySale,
  setInventoryCodeStatus,
  setProductInventoryMode,
} from "./actions";

import RevealCodeButton from "./RevealCodeButton";
import InventoryFilters from "./inventoryFilters";

import styles from "./inventory.module.css";

export const dynamic =
  "force-dynamic";

type InventoryMode =
  | "manual"
  | "keys";

type InventoryStatus =
  | "available"
  | "reserved"
  | "sold"
  | "disabled";

type AdminProduct = {
  id: string;
  slug: string;
  name: string;
  stock: number;
  is_visible: boolean;
  inventory_mode:
    InventoryMode;
};

type InventoryRow = {
  id: string;
  product_id: string;
  code_hint: string;
  status:
    InventoryStatus;
  note:
    | string
    | null;
  reserved_reference:
    | string
    | null;
  created_at: string;
  updated_at: string;
  sold_at:
    | string
    | null;
};

type PageProps = {
  searchParams: Promise<{
    product?: string;
    status?: string;
    message?: string;
    tone?: string;
  }>;
};

function formatDate(
  value: string
) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      dateStyle:
        "medium",
      timeStyle:
        "short",
    }
  ).format(
    new Date(value)
  );
}

function statusLabel(
  status: InventoryStatus
) {
  switch (status) {
    case "available":
      return "Available";

    case "reserved":
      return "Reserved";

    case "sold":
      return "Sold";

    case "disabled":
      return "Disabled";
  }
}

export default async function InventoryPage({
  searchParams,
}: PageProps) {
  const params =
    await searchParams;

  const supabase =
    await createClient();

  const [
    productsResult,
    availableResult,
    reservedResult,
    soldResult,
    disabledResult,
  ] =
    await Promise.all([
      supabase
        .from("products")
        .select(
          "id, slug, name, stock, is_visible, inventory_mode"
        )
        .order("name"),

      supabase
        .from("product_inventory")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq(
          "status",
          "available"
        ),

      supabase
        .from("product_inventory")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq(
          "status",
          "reserved"
        ),

      supabase
        .from("product_inventory")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq(
          "status",
          "sold"
        ),

      supabase
        .from("product_inventory")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq(
          "status",
          "disabled"
        ),
    ]);

  if (
    productsResult.error
  ) {
    throw new Error(
      `Unable to load products: ${productsResult.error.message}`
    );
  }

  const products =
    (productsResult.data ??
      []) as unknown as AdminProduct[];

  let inventoryQuery =
    supabase
      .from("product_inventory")
      .select(
        "id, product_id, code_hint, status, note, reserved_reference, created_at, updated_at, sold_at"
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .limit(100);

  if (params.product) {
    inventoryQuery =
      inventoryQuery.eq(
        "product_id",
        params.product
      );
  }

  if (
    [
      "available",
      "reserved",
      "sold",
      "disabled",
    ].includes(
      params.status ?? ""
    )
  ) {
    inventoryQuery =
      inventoryQuery.eq(
        "status",
        params.status
      );
  }

  const {
    data: inventoryData,
    error: inventoryError,
  } =
    await inventoryQuery;

  if (inventoryError) {
    throw new Error(
      `Unable to load inventory: ${inventoryError.message}`
    );
  }

  const inventory =
    (inventoryData ??
      []) as unknown as InventoryRow[];

  const fulfillmentReferences =
    Array.from(
      new Set(
        inventory
          .map(
            (item) =>
              item.reserved_reference
          )
          .filter(
            (value): value is string =>
              Boolean(value)
          )
      )
    );

  const orderSourceByReference =
    new Map<string, string>();

  if (
    fulfillmentReferences.length >
    0
  ) {
    const {
      data: orderRows,
      error: orderError,
    } =
      await supabase
        .from("orders")
        .select(
          "reference, source"
        )
        .in(
          "reference",
          fulfillmentReferences
        );

    if (orderError) {
      throw new Error(
        `Unable to load inventory order references: ${orderError.message}`
      );
    }

    for (
      const order
      of orderRows ?? []
    ) {
      orderSourceByReference.set(
        order.reference,
        order.source
      );
    }
  }

  const productMap =
    new Map(
      products.map(
        (product) => [
          product.id,
          product,
        ]
      )
    );

  const keyManaged =
    products.filter(
      (product) =>
        product.inventory_mode ===
        "keys"
    );

  const lowStock =
    keyManaged.filter(
      (product) =>
        product.stock <= 5
    ).length;

  const selectedProduct =
    products.find(
      (product) =>
        product.id ===
        params.product
    );

  return (
    <main
      className={
        styles.page
      }
    >
      <AdminSidebar />

      <section
        className={
          styles.content
        }
      >
        <header
          className={
            styles.header
          }
        >
          <div>
            <span>
              BIRDSHOP / ADMIN
            </span>

            <h1>
              Secure Inventory
            </h1>

            <p>
              Store digital codes securely and let BirdShop derive public stock from real available inventory.
            </p>
          </div>

          <Link
            href="/admin/products"
            className={
              styles.headerLink
            }
          >
            Product Manager →
          </Link>
        </header>

        {params.message && (
          <div
            className={`${styles.notice} ${
              params.tone ===
              "error"
                ? styles.noticeError
                : styles.noticeSuccess
            }`}
          >
            {params.message}
          </div>
        )}

        <section
          className={
            styles.stats
          }
        >
          <article>
            <span>
              AVAILABLE KEYS
            </span>

            <strong>
              {availableResult.count ??
                0}
            </strong>

            <small>
              READY TO FULFILL
            </small>
          </article>

          <article>
            <span>
              KEY-MANAGED PRODUCTS
            </span>

            <strong>
              {keyManaged.length}
            </strong>

            <small>
              STOCK AUTO-SYNCED
            </small>
          </article>

          <article>
            <span>
              RESERVED / SOLD
            </span>

            <strong>
              {(reservedResult.count ??
                0) +
                (soldResult.count ??
                  0)}
            </strong>

            <small>
              ORDER HISTORY READY
            </small>
          </article>

          <article>
            <span>
              LOW INVENTORY
            </span>

            <strong>
              {lowStock}
            </strong>

            <small>
              5 OR FEWER AVAILABLE
            </small>
          </article>
        </section>

        <section
          className={
            styles.securityCard
          }
        >
          <div>
            <span>
              ENCRYPTED INVENTORY
            </span>

            <h2>
              Product codes stay private.
            </h2>
          </div>

          <p>
            Codes are encrypted by the Next.js server before being stored in Supabase. Public visitors cannot query this table, and an authorized admin must explicitly reveal a code to see the plaintext value.
          </p>
        </section>

        <section
          className={
            styles.workspace
          }
        >
          <div
            className={
              styles.addPanel
            }
          >
            <div
              className={
                styles.sectionHeading
              }
            >
              <span>
                ADD INVENTORY
              </span>

              <h2>
                Load digital codes.
              </h2>

              <p>
                Paste one code per line. You can add codes before enabling automatic key-managed stock.
              </p>
            </div>

            <form
              action={
                addInventoryCodes
              }
              className={
                styles.addForm
              }
            >
              <label>
                <span>
                  PRODUCT
                </span>

                <select
                  name="product_id"
                  defaultValue={
                    selectedProduct?.id ??
                    products[0]?.id ??
                    ""
                  }
                  required
                >
                  {products.map(
                    (
                      product
                    ) => (
                      <option
                        key={
                          product.id
                        }
                        value={
                          product.id
                        }
                      >
                        {product.name}
                        {product.inventory_mode ===
                        "keys"
                          ? ` · ${product.stock} available`
                          : " · manual stock"}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                <span>
                  CODES

                  <small>
                    ONE PER LINE · MAX 250
                  </small>
                </span>

                <textarea
                  name="codes"
                  rows={10}
                  placeholder={
                    "XXXXX-XXXXX-XXXXX\nYYYYY-YYYYY-YYYYY\nZZZZZ-ZZZZZ-ZZZZZ"
                  }
                  required
                />
              </label>

              <label>
                <span>
                  NOTE

                  <small>
                    OPTIONAL
                  </small>
                </span>

                <input
                  name="note"
                  type="text"
                  placeholder="Supplier batch, purchase date, denomination, etc."
                />
              </label>

              <button
                type="submit"
                className={
                  styles.primaryButton
                }
              >
                Encrypt & Add Codes

                <span>
                  →
                </span>
              </button>
            </form>
          </div>

          <aside
            className={
              styles.modePanel
            }
          >
            <div
              className={
                styles.sectionHeading
              }
            >
              <span>
                STOCK MODE
              </span>

              <h2>
                Choose how stock works.
              </h2>

              <p>
                Key-managed products use the exact number of available codes as customer-facing stock.
              </p>
            </div>

            <div
              className={
                styles.modeList
              }
            >
              {products.map(
                (
                  product
                ) => (
                  <article
                    key={
                      product.id
                    }
                    className={
                      styles.modeCard
                    }
                  >
                    <div>
                      <span>
                        {product.inventory_mode ===
                        "keys"
                          ? "KEY MANAGED"
                          : "MANUAL STOCK"}
                      </span>

                      <strong>
                        {product.name}
                      </strong>

                      <small>
                        Current public stock:{" "}
                        {
                          product.stock
                        }
                      </small>
                    </div>

                    <form
                      action={
                        setProductInventoryMode
                      }
                    >
                      <input
                        type="hidden"
                        name="product_id"
                        value={
                          product.id
                        }
                      />

                      <input
                        type="hidden"
                        name="mode"
                        value={
                          product.inventory_mode ===
                          "keys"
                            ? "manual"
                            : "keys"
                        }
                      />

                      <button
                        type="submit"
                      >
                        {product.inventory_mode ===
                        "keys"
                          ? "Use Manual"
                          : "Use Keys"}
                      </button>
                    </form>
                  </article>
                )
              )}
            </div>
          </aside>
        </section>

        <section
          className={
            styles.inventorySection
          }
        >
          <div
            className={
              styles.inventoryHeading
            }
          >
            <div>
              <span>
                INVENTORY VAULT
              </span>

              <h2>
                Stored codes.
              </h2>
            </div>

            <p>
              Showing up to 100 recent inventory records.
            </p>
          </div>

          <InventoryFilters
            products={
              products.map(
                (
                  product
                ) => ({
                  id:
                    product.id,
                  name:
                    product.name,
                })
              )
            }
            initialProduct={
              params.product ??
              ""
            }
            initialStatus={
              params.status ??
              ""
            }
          />

          {inventory.length ===
          0 ? (
            <div
              className={
                styles.emptyState
              }
            >
              <span>
                NO INVENTORY FOUND
              </span>

              <h3>
                No codes match this view.
              </h3>

              <p>
                Add digital codes above, or choose All Products / All Statuses to reset the current view.
              </p>
            </div>
          ) : (
            <div
              className={
                styles.inventoryList
              }
            >
              {inventory.map(
                (
                  item
                ) => {
                  const product =
                    productMap.get(
                      item.product_id
                    );

                  const locked =
                    item.status ===
                      "sold" ||
                    item.status ===
                      "reserved";

                  const isTestFulfillment =
                    locked &&
                    Boolean(
                      item.reserved_reference
                    ) &&
                    orderSourceByReference.get(
                      item.reserved_reference ??
                        ""
                    ) ===
                      "admin_test";

                  return (
                    <article
                      key={
                        item.id
                      }
                      className={
                        styles.inventoryCard
                      }
                    >
                      <div
                        className={
                          styles.inventoryMain
                        }
                      >
                        <div
                          className={
                            styles.codeMark
                          }
                        >
                          KEY
                        </div>

                        <div
                          className={
                            styles.codeIdentity
                          }
                        >
                          <span>
                            {product?.name ??
                              "Unknown Product"}
                          </span>

                          <strong>
                            {
                              item.code_hint
                            }
                          </strong>

                          <small>
                            Added{" "}
                            {formatDate(
                              item.created_at
                            )}
                          </small>
                        </div>

                        <div
                          className={`${styles.statusBadge} ${styles[`status_${item.status}`]}`}
                        >
                          {statusLabel(
                            item.status
                          )}
                        </div>
                      </div>

                      <div
                        className={
                          styles.inventoryDetails
                        }
                      >
                        <div>
                          <span>
                            NOTE
                          </span>

                          <strong>
                            {item.note ||
                              "—"}
                          </strong>
                        </div>

                        <div>
                          <span>
                            REFERENCE
                          </span>

                          <strong>
                            {item.reserved_reference ||
                              "—"}
                          </strong>
                        </div>

                        <div>
                          <span>
                            LAST UPDATED
                          </span>

                          <strong>
                            {formatDate(
                              item.updated_at
                            )}
                          </strong>
                        </div>
                      </div>

                      <div
                        className={
                          styles.inventoryActions
                        }
                      >
                        <RevealCodeButton
                          inventoryId={
                            item.id
                          }
                        />

                        {!locked && (
                          <form
                            action={
                              setInventoryCodeStatus
                            }
                          >
                            <input
                              type="hidden"
                              name="id"
                              value={
                                item.id
                              }
                            />

                            <input
                              type="hidden"
                              name="status"
                              value={
                                item.status ===
                                "available"
                                  ? "disabled"
                                  : "available"
                              }
                            />

                            <button
                              type="submit"
                              className={
                                styles.secondaryButton
                              }
                            >
                              {item.status ===
                              "available"
                                ? "Disable"
                                : "Make Available"}
                            </button>
                          </form>
                        )}

                        {!locked && (
                          <form
                            action={
                              deleteInventoryCode
                            }
                          >
                            <input
                              type="hidden"
                              name="id"
                              value={
                                item.id
                              }
                            />

                            <button
                              type="submit"
                              className={
                                styles.deleteButton
                              }
                            >
                              Delete
                            </button>
                          </form>
                        )}

                        {isTestFulfillment && (
                          <>
                            <form
                              action={
                                resetTestInventorySale
                              }
                            >
                              <input
                                type="hidden"
                                name="id"
                                value={
                                  item.id
                                }
                              />

                              <button
                                type="submit"
                                className={
                                  styles.testResetButton
                                }
                              >
                                Reset Test Sale
                              </button>
                            </form>

                            <form
                              action={
                                deleteTestFulfilledInventory
                              }
                            >
                              <input
                                type="hidden"
                                name="id"
                                value={
                                  item.id
                                }
                              />

                              <button
                                type="submit"
                                className={
                                  styles.deleteButton
                                }
                              >
                                Delete Test Key
                              </button>
                            </form>
                          </>
                        )}

                        {locked &&
                          !isTestFulfillment && (
                            <span
                              className={
                                styles.lockedNote
                              }
                            >
                              Locked fulfillment history
                            </span>
                          )}
                      </div>
                    </article>
                  );
                }
              )}
            </div>
          )}

          {(disabledResult.count ??
            0) >
            0 && (
            <p
              className={
                styles.footerNote
              }
            >
              Disabled inventory is retained securely but does not count toward public stock.
            </p>
          )}
        </section>
      </section>
    </main>
  );
}