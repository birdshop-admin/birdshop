"use client";

import Image from "next/image";
import Link from "next/link";
import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

import {
  CartIcon,
  CheckIcon,
  LightningIcon,
  ShieldIcon,
  CopyIcon,
  DiscordIcon,
} from "@/components/SiteIcons";

import { useCart } from "@/app/cart-context";


import { siteConfig } from "@/lib/site-config";

import styles from "./product.module.css";

/* =========================================================
   PRODUCT PAGE
========================================================= */

export default function ProductPage({
  params,
}: {
  params: Promise<{
    slug: string;
  }>;
}) {
  const { slug } = use(params);

  return <ProductPageContent key={slug} slug={slug} />;
}

function ProductPageContent({
  slug,
}: {
  slug: string;
}) {
  const router = useRouter();

  const {
    addToCart,
    productList,
    products,
    productsLoaded,
  } = useCart();

  const product =
    products[slug];

  const [
    selectedImage,
    setSelectedImage,
  ] = useState(0);

  const [
    quantity,
    setQuantity,
  ] = useState(1);

  const [
    added,
    setAdded,
  ] = useState(false);

  /* =======================================================
     RELATED PRODUCTS
  ======================================================= */

  const relatedProducts =
    useMemo(() => {
      if (!product) {
        return [];
      }

      const related =
        productList
          .filter(
            (item) =>
              item.slug !==
                product.slug &&
              (
                item.category ===
                  product.category ||
                item.platform ===
                  product.platform
              )
          )
          .slice(0, 3);

      if (related.length < 3) {
        for (const item of productList) {
          const alreadyIncluded =
            related.some(
              (existing) =>
                existing.slug ===
                item.slug
            );

          if (
            item.slug !==
              product.slug &&
            !alreadyIncluded &&
            related.length < 3
          ) {
            related.push(item);
          }
        }
      }

      return related;
    }, [product, productList]);

  /* =======================================================
     PRODUCT LOADING
  ======================================================= */

  if (!productsLoaded) {
    return (
      <main className="page-shell">
        <SiteHeader />

        <section
          className={
            styles.notFound
          }
        >
          <span>
            BIRDSHOP / PRODUCTS
          </span>

          <h1>
            Loading product...
          </h1>
        </section>

        <SiteFooter />
      </main>
    );
  }

  /* =======================================================
     PRODUCT NOT FOUND
  ======================================================= */

  if (!product) {
    return (
      <main className="page-shell">
        <SiteHeader />

        <section
          className={
            styles.notFound
          }
        >
          <span>
            PRODUCT NOT FOUND
          </span>

          <h1>
            This product does not exist.
          </h1>

          <Link href="/products">
            Return to Products →
          </Link>
        </section>

        <SiteFooter />
      </main>
    );
  }

  /* =======================================================
     PRODUCT HELPERS
  ======================================================= */

  const activeGallery =
    product.gallery[
      selectedImage
    ] ??
    product.gallery[0];

  const stockLabel =
    product.stock <= 0
      ? "Out of Stock"
      : product.stock < 25
        ? `${product.stock} left`
        : "In Stock";

  const maxQuantity =
    Math.max(
      1,
      Math.min(
        4,
        product.stock
      )
    );

  const quantityOptions =
    Array.from(
      {
        length:
          maxQuantity,
      },
      (_, index) =>
        index + 1
    );

  /* =======================================================
     CART FUNCTIONS
  ======================================================= */

  function handleAddToCart() {
    if (
      product.stock <= 0
    ) {
      return;
    }

    addToCart(
      product.slug,
      quantity
    );

    setAdded(true);

    window.setTimeout(
      () => {
        setAdded(false);
      },
      1300
    );
  }

  function handleBuyNow() {
    if (
      product.stock <= 0
    ) {
      return;
    }

    addToCart(
      product.slug,
      quantity
    );

    router.push(
      "/cart"
    );
  }

  /* =======================================================
     PAGE
  ======================================================= */

  return (
    <main className="page-shell">
      <SiteHeader />

      {/* ===================================================
          PRODUCT AREA
      =================================================== */}

      <section
        className={
          styles.productArea
        }
      >
        {/* BREADCRUMBS */}

        <div
          className={
            styles.breadcrumbs
          }
        >
          <Link href="/">
            Home
          </Link>

          <span>/</span>

          <Link href="/products">
            Products
          </Link>

          <span>/</span>

          <span>
            {product.name}
          </span>
        </div>

        <div
          className={
            styles.productLayout
          }
        >
          {/* ===============================================
              GALLERY
          =============================================== */}

          <div
            className={
              styles.galleryColumn
            }
          >
            <div
              className={
                styles.productArtwork
              }
            >
              <div
                className={
                  styles.artGlow
                }
              />

              {activeGallery.src ? (
                <Image
                  src={
                    activeGallery.src
                  }
                  alt={`${product.name} - ${activeGallery.label}`}
                  fill
                  priority
                  sizes="(max-width: 900px) 100vw, 55vw"
                  className={
                    styles.artImage
                  }
                />
              ) : (
                <div
                  className={
                    styles.artPlaceholder
                  }
                >
                  <span>
                    {
                      activeGallery.display
                    }
                  </span>

                  <small>
                    {
                      activeGallery.label
                    }
                  </small>
                </div>
              )}

              {product.badge && (
                <span
                  className={
                    styles.artBadge
                  }
                >
                  {product.badge}
                </span>
              )}

              <span
                className={
                  styles.artCategory
                }
              >
                {product.category}
              </span>

              <div
                className={
                  styles.artFooter
                }
              >
                <span>
                  BIRDSHOP
                </span>

                <span>
                  {
                    product.platform
                  }
                </span>
              </div>
            </div>

            {/* THUMBNAILS */}

            <div
              className={
                styles.thumbnailRow
              }
            >
              {product.gallery.map(
                (
                  galleryItem,
                  index
                ) => {
                  const active =
                    selectedImage ===
                    index;

                  return (
                    <button
                      key={
                        galleryItem.id
                      }
                      type="button"
                      onClick={() =>
                        setSelectedImage(
                          index
                        )
                      }
                      className={
                        active
                          ? styles.activeThumbnail
                          : ""
                      }
                      aria-label={`View ${galleryItem.label}`}
                      aria-pressed={
                        active
                      }
                    >
                      {galleryItem.src ? (
                        <Image
                          src={
                            galleryItem.src
                          }
                          alt=""
                          fill
                          sizes="150px"
                          className={
                            styles.thumbnailImage
                          }
                        />
                      ) : (
                        <>
                          <strong>
                            {
                              galleryItem.display
                            }
                          </strong>

                          <span>
                            {
                              galleryItem.label
                            }
                          </span>
                        </>
                      )}
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {/* ===============================================
              PURCHASE COLUMN
          =============================================== */}

          <div
            className={
              styles.purchaseColumn
            }
          >
            <div
              className={
                styles.productHeading
              }
            >
              <div
                className={
                  styles.headingTop
                }
              >
                <span>
                  {
                    product.category
                  }
                </span>

                <span
                  className={
                    product.stock > 0
                      ? styles.available
                      : styles.unavailable
                  }
                >
                  {product.stock >
                    0 && (
                    <CheckIcon />
                  )}

                  {stockLabel}
                </span>
              </div>

              <h1>
                {product.name}
              </h1>

              <p>
                {
                  product.shortDescription
                }
              </p>
            </div>

            {/* PRICE */}

            <div
              className={
                styles.priceRow
              }
            >
              <strong>
                $
                {product.price.toFixed(
                  2
                )}
              </strong>

              {product.oldPrice && (
                <span>
                  $
                  {product.oldPrice.toFixed(
                    2
                  )}
                </span>
              )}
            </div>

            <div
              className={
                styles.purchaseDivider
              }
            />

            {/* PRODUCT DETAILS */}

            <div
              className={
                styles.optionGrid
              }
            >
              <div>
                <span>
                  PLATFORM
                </span>

                <strong>
                  {
                    product.platform
                  }
                </strong>
              </div>

              <div>
                <span>
                  REGION
                </span>

                <strong>
                  {
                    product.region
                  }
                </strong>
              </div>

              <div>
                <span>
                  DELIVERY
                </span>

                <strong>
                  {
                    product.delivery
                  }
                </strong>
              </div>

              <div>
                <span>
                  FORMAT
                </span>

                <strong>
                  {
                    product.codeFormat
                  }
                </strong>
              </div>
            </div>

            {/* STOCK */}

            <div
              className={
                styles.stockArea
              }
            >
              <div
                className={
                  styles.stockTop
                }
              >
                <span>
                  AVAILABILITY
                </span>

                <strong>
                  {stockLabel}
                </strong>
              </div>

              <div
                className={
                  styles.stockTrack
                }
              >
                <div
                  style={{
                    width:
                      product.stock <=
                      0
                        ? "0%"
                        : product.stock <
                            25
                          ? `${Math.max(
                              12,
                              product.stock *
                                3
                            )}%`
                          : "84%",
                  }}
                />
              </div>
            </div>

            {/* QUANTITY */}

            <div
              className={
                styles.quantityRow
              }
            >
              <label
                htmlFor="quantity"
              >
                QUANTITY
              </label>

              <select
                id="quantity"
                value={
                  quantity
                }
                disabled={
                  product.stock <=
                  0
                }
                onChange={(
                  event
                ) =>
                  setQuantity(
                    Number(
                      event.target
                        .value
                    )
                  )
                }
              >
                {quantityOptions.map(
                  (value) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {value}
                    </option>
                  )
                )}
              </select>
            </div>

            {/* BUY BUTTONS */}

            <div
              className={
                styles.purchaseButtons
              }
            >
              <button
                type="button"
                onClick={
                  handleAddToCart
                }
                disabled={
                  product.stock <=
                  0
                }
                className={`${styles.addButton} ${
                  added
                    ? styles.addedButton
                    : ""
                }`}
              >
                {added ? (
                  <CheckIcon />
                ) : (
                  <CartIcon />
                )}

                <span>
                  {product.stock <=
                  0
                    ? "Out of Stock"
                    : added
                      ? "Added to Cart"
                      : "Add to Cart"}
                </span>

                <span>
                  {added
                    ? "✓"
                    : "→"}
                </span>
              </button>

              <button
                type="button"
                onClick={
                  handleBuyNow
                }
                disabled={
                  product.stock <=
                  0
                }
                className={
                  styles.buyButton
                }
              >
                Buy Now
              </button>
            </div>

            {/* TRUST */}

            <div
              className={
                styles.purchaseTrust
              }
            >
              <div>
                <LightningIcon />

                <span>
                  <strong>
                    Fast Delivery
                  </strong>

                  Digital product
                  delivery
                </span>
              </div>

              <div>
                <ShieldIcon />

                <span>
                  <strong>
                    Secure Purchase
                  </strong>

                  Protected checkout
                  flow
                </span>
              </div>

              <div>
                <DiscordIcon />

                <span>
                  <strong>
                    Discord Support
                  </strong>

                  Help when you
                  need it
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================
          PRODUCT INFORMATION
      =================================================== */}

      <section
        className={
          styles.informationSection
        }
      >
        <div
          className={
            styles.descriptionBlock
          }
        >
          <p
            className={
              styles.sectionLabel
            }
          >
            PRODUCT INFORMATION
          </p>

          <h2>
            About this product
          </h2>

          <p
            className={
              styles.mainDescription
            }
          >
            {
              product.description
            }
          </p>

          <div
            className={
              styles.detailList
            }
          >
            <div>
              <span>
                TYPE
              </span>

              <strong>
                {
                  product.category
                }
              </strong>
            </div>

            <div>
              <span>
                PLATFORM
              </span>

              <strong>
                {
                  product.platform
                }
              </strong>
            </div>

            <div>
              <span>
                REGION
              </span>

              <strong>
                {
                  product.region
                }
              </strong>
            </div>

            <div>
              <span>
                DELIVERY
              </span>

              <strong>
                Digital
              </strong>
            </div>
          </div>
        </div>

        {/* DELIVERY STEPS */}

        <div
          className={
            styles.deliveryBlock
          }
        >
          <p
            className={
              styles.sectionLabel
            }
          >
            AFTER PURCHASE
          </p>

          <h2>
            How delivery works
          </h2>

          <div
            className={
              styles.steps
            }
          >
            <div>
              <span>
                01
              </span>

              <div>
                <strong>
                  Complete checkout
                </strong>

                <p>
                  Purchase the
                  product through
                  BirdShop.
                </p>
              </div>
            </div>

            <div>
              <span>
                02
              </span>

              <div>
                <strong>
                  Receive your code
                </strong>

                <p>
                  Your digital product
                  information is
                  delivered
                  electronically.
                </p>
              </div>
            </div>

            <div>
              <span>
                03
              </span>

              <div>
                <strong>
                  Redeem
                </strong>

                <p>
                  Follow the included
                  instructions for the
                  supported platform.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================
          REDEMPTION STRIP
      =================================================== */}

      <section
        className={
          styles.redemptionSection
        }
      >
        <div
          className={
            styles.redemptionIcon
          }
        >
          <CopyIcon />
        </div>

        <div
          className={
            styles.redemptionCopy
          }
        >
          <span>
            DIGITAL DELIVERY
          </span>

          <h2>
            Simple redemption.
          </h2>

          <p>
            Product-specific
            redemption instructions
            will appear with your
            order. Always confirm the
            platform and region before
            purchasing.
          </p>
        </div>

        <Link
          href={siteConfig.discordUrl}
          target="_blank"
          rel="noreferrer"
          className={
            styles.supportButton
          }
        >
          <DiscordIcon />

          Need Help?

          <span>
            →
          </span>
        </Link>
      </section>

      {/* ===================================================
          RELATED PRODUCTS
      =================================================== */}

      <section
        className={
          styles.relatedSection
        }
      >
        <div
          className={
            styles.relatedHeading
          }
        >
          <div>
            <p
              className={
                styles.sectionLabel
              }
            >
              YOU MAY ALSO LIKE
            </p>

            <h2>
              Related Products
            </h2>
          </div>

          <Link href="/products">
            View All Products

            <span>
              →
            </span>
          </Link>
        </div>

        <div
          className={
            styles.relatedGrid
          }
        >
          {relatedProducts.map(
            (related) => (
              <Link
                key={
                  related.slug
                }
                href={`/products/${related.slug}`}
                className={
                  styles.relatedCard
                }
              >
                <div
                  className={
                    styles.relatedImage
                  }
                >
                  <span>
                    {
                      related.initials
                    }
                  </span>
                </div>

                <div
                  className={
                    styles.relatedInfo
                  }
                >
                  <span>
                    {
                      related.category
                    }
                  </span>

                  <h3>
                    {
                      related.name
                    }
                  </h3>

                  <strong>
                    $
                    {related.price.toFixed(
                      2
                    )}
                  </strong>
                </div>
              </Link>
            )
          )}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}