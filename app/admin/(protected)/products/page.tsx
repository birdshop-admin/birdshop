import SubmitButton from "@/components/SubmitButton";
import { requireOwner } from "@/lib/staff-auth";
import Image from "next/image";

import { createClient } from "@/lib/supabase/server";

import AdminSidebar from "@/components/AdminSidebar";

import {
  createProduct,
  deleteProduct,
  syncLocalProducts,
  updateProduct,
} from "./actions";

import styles from "./products.module.css";

export const dynamic = "force-dynamic";

/* =========================================================
   TYPES
========================================================= */

type ProductGalleryItem = {
  id: string;
  label: string;
  display: string;
  src?: string;
};

type DatabaseProduct = {
  id: string;

  slug: string;

  name: string;

  category: string;

  platform: string;

  region: string;

  price: number | string;

  old_price: number | string | null;

  badge: string | null;

  stock: number;

  delivery: string;

  description: string;

  short_description: string;

  code_format: string;

  initials: string;

  gallery: unknown;

  is_visible: boolean;

  sort_order: number;

  created_at: string;

  updated_at: string;
};

/* =========================================================
   NORMALIZE GALLERY
========================================================= */

function normalizeGallery(
  gallery: unknown,
  initials: string,
): ProductGalleryItem[] {
  const safeInitials = initials.trim() || "BS";

  const source = Array.isArray(gallery) ? gallery : [];

  const defaults: ProductGalleryItem[] = [
    {
      id: "main",
      label: "Main",
      display: safeInitials,
    },

    {
      id: "tile-2",
      label: "Details",
      display: "INFO",
    },

    {
      id: "tile-3",
      label: "Platform",
      display: "PLATFORM",
    },

    {
      id: "tile-4",
      label: "Code",
      display: "CODE",
    },
  ];

  return Array.from(
    {
      length: 4,
    },
    (_, index) => {
      const item = source[index];

      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;

        const src = typeof record.src === "string" ? record.src.trim() : "";

        return {
          id: String(record.id ?? defaults[index].id),

          label: String(record.label ?? defaults[index].label),

          display: String(record.display ?? defaults[index].display),

          ...(src
            ? {
                src,
              }
            : {}),
        };
      }

      return defaults[index];
    },
  );
}

/* =========================================================
   GALLERY EDITOR
========================================================= */

function GalleryEditor({
  gallery,
  initials,
  createMode = false,
}: {
  gallery?: unknown;
  initials: string;
  createMode?: boolean;
}) {
  const items = normalizeGallery(gallery, initials);

  /*
   * When creating a product we leave the first display
   * field blank so the server can generate it from the
   * product initials/name.
   */
  if (createMode) {
    items[0] = {
      ...items[0],

      display: "",
    };
  }

  return (
    <section className={styles.galleryEditor}>
      <div className={styles.galleryEditorHeading}>
        <div>
          <span>PRODUCT GALLERY</span>

          <strong>Storefront artwork tiles</strong>
        </div>

        <p>
          Upload up to four product images. Saved artwork remains stored in
          BirdShop even though your browser resets the file chooser after saving
          or refreshing.
        </p>
      </div>

      <div className={styles.galleryGrid}>
        {items.map((item, index) => (
          <article key={`${item.id}-${index}`} className={styles.galleryTile}>
            {/* ===========================================
                  SAVED PREVIEW
              =========================================== */}

            <div className={styles.galleryPreview}>
              {item.src ? (
                <>
                  <Image
                    src={item.src}
                    alt={`${item.label || `Tile ${index + 1}`} saved artwork`}
                    fill
                    sizes="132px"
                    className={styles.galleryPreviewImage}
                  />

                  <span className={styles.gallerySavedBadge}>SAVED</span>
                </>
              ) : (
                <>
                  <strong>
                    {item.display || (index === 0 ? initials || "BS" : "—")}
                  </strong>

                  <span>{item.label || `Tile ${index + 1}`}</span>
                </>
              )}
            </div>

            {/* ===========================================
                  FIELDS
              =========================================== */}

            <div className={styles.galleryFields}>
              <label>
                <span>LARGE TEXT</span>

                <input
                  name={`gallery_${index + 1}_display`}
                  type="text"
                  defaultValue={item.display}
                  maxLength={16}
                  placeholder={index === 0 ? initials || "BS" : "INFO"}
                />
              </label>

              <label>
                <span>SMALL TEXT</span>

                <input
                  name={`gallery_${index + 1}_label`}
                  type="text"
                  defaultValue={item.label}
                  maxLength={28}
                  placeholder={`Tile ${index + 1}`}
                />
              </label>

              <div className={styles.galleryUploadField}>
                {/*
                    Keep the currently stored URL in the form.

                    This is NOT the file input.
                    This is the permanent Supabase image URL.
                  */}

                <input
                  type="hidden"
                  name={`gallery_${index + 1}_src`}
                  value={item.src ?? ""}
                />

                <label>
                  <span>PRODUCT IMAGE · OPTIONAL</span>

                  <input
                    className={styles.galleryFileInput}
                    name={`gallery_${index + 1}_file`}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                  />
                </label>

                <small className={styles.galleryUploadHelp}>
                  {item.src
                    ? "Current image is saved in BirdShop. The file selector resets after save or refresh; leave it empty to keep this saved image."
                    : "Choose a PNG, JPG, or WEBP image up to 8 MB. Leave it empty to use the text tile."}
                </small>

                {item.src && (
                  <label className={styles.galleryRemoveImage}>
                    <input
                      name={`gallery_${index + 1}_remove`}
                      type="checkbox"
                      value="true"
                    />

                    <span>Remove current image and use the text tile</span>
                  </label>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/* =========================================================
   ADMIN PRODUCTS PAGE
========================================================= */

export default async function AdminProductsPage() {
  await requireOwner();

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("sort_order", {
      ascending: true,
    })
    .order("name", {
      ascending: true,
    });

  if (error) {
    throw new Error(
      `Unable to load products: Please retry or contact the owner.`,
    );
  }

  const products = (data ?? []) as DatabaseProduct[];

  const visibleCount = products.filter((product) => product.is_visible).length;

  const totalStock = products.reduce(
    (total, product) => total + product.stock,
    0,
  );

  const inventoryValue = products.reduce(
    (total, product) => total + Number(product.price) * product.stock,
    0,
  );

  return (
    <main className={styles.page}>
      <AdminSidebar />

      {/* ===================================================
          CONTENT
      =================================================== */}

      <section className={styles.content}>
        {/* =================================================
            HEADER
        ================================================= */}

        <header className={styles.header}>
          <div>
            <span>BIRDSHOP / ADMIN</span>

            <h1>Products</h1>

            <p>
              Manage the BirdShop digital catalog, pricing, stock, storefront
              details, and artwork from one place.
            </p>
          </div>

          <div className={styles.headerActions}>
            <form action={syncLocalProducts}>
              <SubmitButton type="submit" className={styles.secondaryButton}>
                Import Current Catalog
              </SubmitButton>
            </form>

            <a href="#create-product" className={styles.primaryButton}>
              + Add Product
            </a>
          </div>
        </header>

        {/* =================================================
            STATS
        ================================================= */}

        <section className={styles.stats}>
          <article>
            <span>PRODUCTS</span>

            <strong>{products.length}</strong>

            <small>IN DATABASE</small>
          </article>

          <article>
            <span>VISIBLE</span>

            <strong>{visibleCount}</strong>

            <small>PUBLICLY ENABLED</small>
          </article>

          <article>
            <span>TOTAL STOCK</span>

            <strong>{totalStock}</strong>

            <small>AVAILABLE UNITS</small>
          </article>

          <article>
            <span>INVENTORY VALUE</span>

            <strong>
              $
              {inventoryValue.toLocaleString("en-US", {
                minimumFractionDigits: 2,

                maximumFractionDigits: 2,
              })}
            </strong>

            <small>LISTED VALUE</small>
          </article>
        </section>

        {/* =================================================
            CREATE PRODUCT
        ================================================= */}

        <details id="create-product" className={styles.createPanel}>
          <summary>
            <div>
              <span>NEW PRODUCT</span>

              <strong>Create a product</strong>
            </div>

            <span>+</span>
          </summary>

          <form action={createProduct} className={styles.editorForm}>
            <div className={styles.formGrid}>
              <label>
                <span>PRODUCT NAME</span>

                <input
                  name="name"
                  type="text"
                  placeholder="Minecraft Java & Bedrock"
                  required
                />
              </label>

              <label>
                <span>SLUG</span>

                <input
                  name="slug"
                  type="text"
                  placeholder="minecraft-java-bedrock"
                />
              </label>

              <label>
                <span>CATEGORY</span>

                <select name="category" defaultValue="Game Keys">
                  <option>Game Keys</option>

                  <option>Gift Cards</option>

                  <option>Subscriptions</option>

                  <option>Add-ons</option>
                </select>
              </label>

              <label>
                <span>PLATFORM</span>

                <input
                  name="platform"
                  type="text"
                  placeholder="PC / Steam"
                  required
                />
              </label>

              <label>
                <span>REGION</span>

                <input name="region" type="text" defaultValue="US" required />
              </label>

              <label>
                <span>DELIVERY</span>

                <input
                  name="delivery"
                  type="text"
                  placeholder="Instant Digital Delivery"
                  required
                />
              </label>

              <label>
                <span>PRICE</span>

                <input
                  name="price"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue="0"
                  required
                />
              </label>

              <label>
                <span>OLD PRICE</span>

                <input name="old_price" type="number" min="0" step="0.01" />
              </label>

              <label>
                <span>STOCK</span>

                <input
                  name="stock"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue="0"
                  required
                />
              </label>

              <label>
                <span>BADGE</span>

                <input name="badge" type="text" placeholder="Best Seller" />
              </label>

              <label>
                <span>CODE FORMAT</span>

                <input
                  name="code_format"
                  type="text"
                  placeholder="Digital key"
                />
              </label>

              <label>
                <span>INITIALS</span>

                <input
                  name="initials"
                  type="text"
                  placeholder="MC"
                  maxLength={4}
                />
              </label>

              <label>
                <span>SORT ORDER</span>

                <input
                  name="sort_order"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue="0"
                />
              </label>
            </div>

            <label className={styles.fullField}>
              <span>SHORT DESCRIPTION</span>

              <textarea
                name="short_description"
                rows={3}
                placeholder="Short product description..."
              />
            </label>

            <label className={styles.fullField}>
              <span>FULL DESCRIPTION</span>

              <textarea
                name="description"
                rows={6}
                placeholder="Full product description..."
              />
            </label>

            <GalleryEditor initials="BS" createMode />

            <label className={styles.visibilityToggle}>
              <input
                name="is_visible"
                type="checkbox"
                value="true"
                defaultChecked
              />

              <span>
                <strong>Visible on Store</strong>

                <small>Customers will be able to see this product.</small>
              </span>
            </label>

            <SubmitButton type="submit" className={styles.saveButton}>
              Create Product
            </SubmitButton>
          </form>
        </details>

        {/* =================================================
            PRODUCT CATALOG
        ================================================= */}

        <section className={styles.catalog}>
          <div className={styles.catalogHeading}>
            <div>
              <span>DATABASE CATALOG</span>

              <h2>Manage products.</h2>
            </div>

            <p>
              {products.length} {products.length === 1 ? "product" : "products"}
            </p>
          </div>

          {products.length === 0 ? (
            <div className={styles.emptyState}>
              <span>NO PRODUCTS</span>

              <h3>Your Supabase catalog is empty.</h3>

              <p>
                Click Import Current Catalog to copy your existing BirdShop
                products into the database.
              </p>

              <form action={syncLocalProducts}>
                <SubmitButton type="submit" className={styles.primaryButton}>
                  Import Current Catalog
                </SubmitButton>
              </form>
            </div>
          ) : (
            <div className={styles.productList}>
              {products.map((product) => (
                <details key={product.id} className={styles.productCard}>
                  {/* =====================================
                        PRODUCT SUMMARY
                    ===================================== */}

                  <summary>
                    <div className={styles.productIdentity}>
                      <div className={styles.initials}>
                        {product.initials || "BS"}
                      </div>

                      <div>
                        <span>
                          {product.category} · {product.platform}
                        </span>

                        <strong>{product.name}</strong>

                        <small>/{product.slug}</small>
                      </div>
                    </div>

                    <div className={styles.productStatus}>
                      <div>
                        <span>PRICE</span>

                        <strong>${Number(product.price).toFixed(2)}</strong>
                      </div>

                      <div>
                        <span>STOCK</span>

                        <strong>{product.stock}</strong>
                      </div>

                      <div>
                        <span>STATUS</span>

                        <strong
                          className={
                            product.is_visible ? styles.visible : styles.hidden
                          }
                        >
                          {product.is_visible ? "Visible" : "Hidden"}
                        </strong>
                      </div>

                      <span className={styles.expand}>+</span>
                    </div>
                  </summary>

                  {/* =====================================
                        EDIT PRODUCT
                    ===================================== */}

                  <form action={updateProduct} className={styles.editorForm}>
                    <input type="hidden" name="id" value={product.id} />

                    <input
                      type="hidden"
                      name="previous_initials"
                      value={product.initials}
                    />

                    <div className={styles.formGrid}>
                      <label>
                        <span>PRODUCT NAME</span>

                        <input
                          name="name"
                          type="text"
                          defaultValue={product.name}
                          required
                        />
                      </label>

                      <label>
                        <span>SLUG</span>

                        <input
                          name="slug"
                          type="text"
                          defaultValue={product.slug}
                          required
                        />
                      </label>

                      <label>
                        <span>CATEGORY</span>

                        <select name="category" defaultValue={product.category}>
                          <option>Game Keys</option>

                          <option>Gift Cards</option>

                          <option>Subscriptions</option>

                          <option>Add-ons</option>
                        </select>
                      </label>

                      <label>
                        <span>PLATFORM</span>

                        <input
                          name="platform"
                          type="text"
                          defaultValue={product.platform}
                          required
                        />
                      </label>

                      <label>
                        <span>REGION</span>

                        <input
                          name="region"
                          type="text"
                          defaultValue={product.region}
                          required
                        />
                      </label>

                      <label>
                        <span>DELIVERY</span>

                        <input
                          name="delivery"
                          type="text"
                          defaultValue={product.delivery}
                          required
                        />
                      </label>

                      <label>
                        <span>PRICE</span>

                        <input
                          name="price"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={Number(product.price)}
                          required
                        />
                      </label>

                      <label>
                        <span>OLD PRICE</span>

                        <input
                          name="old_price"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={
                            product.old_price === null
                              ? ""
                              : Number(product.old_price)
                          }
                        />
                      </label>

                      <label>
                        <span>STOCK</span>

                        <input
                          name="stock"
                          type="number"
                          min="0"
                          step="1"
                          defaultValue={product.stock}
                          required
                        />
                      </label>

                      <label>
                        <span>BADGE</span>

                        <input
                          name="badge"
                          type="text"
                          defaultValue={product.badge ?? ""}
                        />
                      </label>

                      <label>
                        <span>CODE FORMAT</span>

                        <input
                          name="code_format"
                          type="text"
                          defaultValue={product.code_format}
                        />
                      </label>

                      <label>
                        <span>INITIALS</span>

                        <input
                          name="initials"
                          type="text"
                          maxLength={4}
                          defaultValue={product.initials}
                        />
                      </label>

                      <label>
                        <span>SORT ORDER</span>

                        <input
                          name="sort_order"
                          type="number"
                          min="0"
                          step="1"
                          defaultValue={product.sort_order}
                        />
                      </label>
                    </div>

                    <label className={styles.fullField}>
                      <span>SHORT DESCRIPTION</span>

                      <textarea
                        name="short_description"
                        rows={3}
                        defaultValue={product.short_description}
                      />
                    </label>

                    <label className={styles.fullField}>
                      <span>FULL DESCRIPTION</span>

                      <textarea
                        name="description"
                        rows={6}
                        defaultValue={product.description}
                      />
                    </label>

                    <GalleryEditor
                      gallery={product.gallery}
                      initials={product.initials}
                    />

                    <label className={styles.visibilityToggle}>
                      <input
                        name="is_visible"
                        type="checkbox"
                        value="true"
                        defaultChecked={product.is_visible}
                      />

                      <span>
                        <strong>Visible on Store</strong>

                        <small>
                          Turn this off to hide the product without deleting it.
                        </small>
                      </span>
                    </label>

                    <div className={styles.editorActions}>
                      <SubmitButton type="submit" className={styles.saveButton}>
                        Save Changes
                      </SubmitButton>
                    </div>
                  </form>

                  {/* =====================================
                        DELETE PRODUCT
                    ===================================== */}

                  <div className={styles.dangerZone}>
                    <div>
                      <strong>Delete Product</strong>

                      <p>This removes the product from the Supabase catalog.</p>
                    </div>

                    <form action={deleteProduct.bind(null, product.id)}>
                      <SubmitButton
                        type="submit"
                        className={styles.deleteButton}
                      >
                        Delete
                      </SubmitButton>
                    </form>
                  </div>
                </details>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
