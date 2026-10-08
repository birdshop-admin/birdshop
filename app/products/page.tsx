"use client";
import { formatUSD } from "@/lib/money";

import Image from "next/image";
import Link from "next/link";
import ProductThumbnail from "@/components/ProductThumbnail";

import { useEffect, useMemo, useRef, useState } from "react";

import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

import {
  CartIcon,
  SearchIcon,
  CheckIcon,
  DiscordIcon,
  MessageIcon,
} from "@/components/SiteIcons";

import { useCart } from "@/app/cart-context";

import {
  discordLinkProps,
  hasDiscordInvite,
  siteConfig,
} from "@/lib/site-config";

import type { Product } from "@/lib/products";

import styles from "./products.module.css";

const ALL_PRODUCTS = "All Products";
const ADDED_FEEDBACK_MS = 1000;
const CARD_SIZES =
  "(max-width: 650px) 90vw, (max-width: 930px) 45vw, 340px";

/* =========================================================
   PRODUCT CARD
========================================================= */

function ProductCard({
  product,
  added,
  onAdd,
}: {
  product: Product;
  added: boolean;
  onAdd: (slug: string) => void;
}) {
  const isOutOfStock = product.stock <= 0;

  const stockText = isOutOfStock
    ? "Out of Stock"
    : product.stock < 25
      ? `${product.stock} left`
      : "In Stock";

  const stockClass = isOutOfStock
    ? styles.outOfStockStatus
    : product.stock < 25
      ? styles.lowStock
      : styles.inStock;

  function handleAdd() {
    if (isOutOfStock) {
      return;
    }

    onAdd(product.slug);
  }

  return (
    <article
      className={`${styles.productCard} ${
        isOutOfStock ? styles.outOfStockCard : ""
      }`}
    >
      <Link
        href={`/products/${product.slug}`}
        className={styles.productVisual}
        aria-label={`View ${product.name}`}
      >
        {product.badge && (
          <span className={styles.productBadge}>{product.badge}</span>
        )}

        <div className={styles.productMonogram}>
          <ProductThumbnail product={product} alt="" sizes={CARD_SIZES} />
        </div>

        <span className={styles.platformBadge}>{product.platform}</span>

        {isOutOfStock && (
          <div className={styles.outOfStockVisualLabel}>
            Currently unavailable
          </div>
        )}
      </Link>

      <div className={styles.productInfo}>
        <div className={styles.productMeta}>
          <span>{product.category}</span>

          <span className={stockClass}>
            {!isOutOfStock && <CheckIcon />}

            {stockText}
          </span>
        </div>

        {/* Names clamp to two lines; the title shows the full name. */}
        <Link
          href={`/products/${product.slug}`}
          className={styles.productName}
          title={product.name}
        >
          {product.name}
        </Link>

        <div className={styles.productBottom}>
          <div className={styles.priceGroup}>
            <strong>{formatUSD(product.price)}</strong>

            {product.oldPrice && (
              <span>{formatUSD(product.oldPrice)}</span>
            )}
          </div>

          <button
            type="button"
            className={`${styles.cardCart} ${
              added && !isOutOfStock ? styles.cardCartAdded : ""
            }`}
            disabled={isOutOfStock}
            aria-disabled={isOutOfStock}
            aria-label={
              isOutOfStock
                ? `${product.name} is out of stock`
                : `Add ${product.name} to cart`
            }
            title={isOutOfStock ? "Out of stock" : "Add to cart"}
            onClick={handleAdd}
          >
            {added && !isOutOfStock ? <CheckIcon /> : <CartIcon />}
          </button>
        </div>
      </div>
    </article>
  );
}

/* Same footprint as a card, so the grid does not jump when the catalog lands. */
function ProductCardSkeleton() {
  return (
    <div
      className={`${styles.productCard} ${styles.skeletonCard}`}
      aria-hidden="true"
    >
      <div className={`${styles.productVisual} ${styles.skeleton}`} />

      <div className={styles.productInfo}>
        <span className={`${styles.skeleton} ${styles.skeletonLine} ${styles.skeletonMeta}`} />
        <span className={`${styles.skeleton} ${styles.skeletonTitle}`} />
        <span className={`${styles.skeleton} ${styles.skeletonPrice}`} />
      </div>
    </div>
  );
}

/* =========================================================
   PRODUCTS PAGE
========================================================= */

export default function ProductsPage() {
  const {
    addToCart,
    productList,
    productsLoaded,
    productsError,
    refreshProducts,
  } = useCart();

  /* =======================================================
     CATEGORIES
  ======================================================= */

  const productCategories = useMemo(
    () => [
      ALL_PRODUCTS,
      ...Array.from(
        new Set(productList.map((product) => product.category)),
      ),
    ],
    [productList],
  );

  /* =======================================================
     FILTER STATE
  ======================================================= */

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(ALL_PRODUCTS);
  const [sort, setSort] = useState("featured");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [recentlyAdded, setRecentlyAdded] = useState<string | null>(null);

  const addedTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (addedTimer.current !== null) {
        window.clearTimeout(addedTimer.current);
      }
    };
  }, []);

  /* =======================================================
     FILTER PRODUCTS
  ======================================================= */

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return productList.filter((product) => {
      const matchesSearch =
        query.length === 0 ||
        [
          product.name,
          product.category,
          product.platform,
          product.region,
        ].some((value) => value.toLowerCase().includes(query));

      const matchesCategory =
        category === ALL_PRODUCTS || product.category === category;

      const matchesStock = !inStockOnly || product.stock > 0;

      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [productList, search, category, inStockOnly]);

  /* =======================================================
     SORT PRODUCTS
  ======================================================= */

  const sortedProducts = useMemo(() => {
    const result = [...filteredProducts];

    if (sort === "price-low") {
      result.sort((a, b) => a.price - b.price);
    }

    if (sort === "price-high") {
      result.sort((a, b) => b.price - a.price);
    }

    if (sort === "name") {
      result.sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  }, [filteredProducts, sort]);

  /* =======================================================
     AVAILABILITY GROUPS
  ======================================================= */

  const availableProducts = useMemo(
    () => sortedProducts.filter((product) => product.stock > 0),
    [sortedProducts],
  );

  const unavailableProducts = useMemo(
    () => sortedProducts.filter((product) => product.stock <= 0),
    [sortedProducts],
  );

  /* =======================================================
     FILTER HELPERS
  ======================================================= */

  function clearFilters() {
    setSearch("");
    setCategory(ALL_PRODUCTS);
    setSort("featured");
    setInStockOnly(false);
  }

  /* =======================================================
     CART
  ======================================================= */

  function handleAddToCart(slug: string) {
    const product = productList.find((item) => item.slug === slug);

    if (!product || product.stock <= 0) {
      return;
    }

    addToCart(slug, 1);

    setRecentlyAdded(slug);

    if (addedTimer.current !== null) {
      window.clearTimeout(addedTimer.current);
    }

    addedTimer.current = window.setTimeout(() => {
      addedTimer.current = null;
      setRecentlyAdded((current) => (current === slug ? null : current));
    }, ADDED_FEEDBACK_MS);
  }

  const addedProductName = recentlyAdded
    ? productList.find((item) => item.slug === recentlyAdded)?.name
    : undefined;

  /* =======================================================
     COUNTS
  ======================================================= */

  const totalVisible = sortedProducts.length;
  const availableCount = availableProducts.length;
  const unavailableCount = unavailableProducts.length;
  const countLabel = productsLoaded ? totalVisible : "—";

  /* =======================================================
     PAGE
  ======================================================= */

  return (
    <main className="page-shell">
      <SiteHeader />

      {/* ===================================================
          HERO
      =================================================== */}

      <section className={styles.topSection}>
        <div className={styles.catalogHero}>
          <div className={styles.catalogHeroCopy}>
            <p className={styles.eyebrow}>BirdShop / Digital store</p>

            <h1>Products</h1>

            <p>
              Browse digital keys, gift cards, subscriptions, and add-ons.
              Simple purchasing, fast delivery, and support when you need it.
            </p>

            <div className={styles.heroFacts}>
              <span>
                <CheckIcon />
                Digital delivery
              </span>

              <span>
                <CheckIcon />
                Secure checkout
              </span>

              <span>
                <CheckIcon />
                Discord support
              </span>
            </div>
          </div>

          <div className={styles.catalogHeroLogo}>
            <Image
              src="/greenbs.png"
              alt="BirdShop"
              width={300}
              height={300}
              className="theme-logo-light"
              loading="eager"
            />

            <Image
              src="/cremebs.png"
              alt="BirdShop"
              width={300}
              height={300}
              className="theme-logo-dark"
              loading="eager"
            />

            <span>Digital goods / Delivered simply</span>
          </div>
        </div>
      </section>

      {/* ===================================================
          STORE
      =================================================== */}

      <section className={styles.store}>
        <div className={styles.storeHeading}>
          <div>
            <p>The collection</p>

            <h2>All Products</h2>
          </div>

          <div className={styles.catalogCount}>
            <strong>{countLabel}</strong>

            <span>{totalVisible === 1 ? "product" : "products"}</span>
          </div>
        </div>

        <div className={styles.storeLayout}>
          {/* =================================================
              SIDEBAR
          ================================================= */}

          <aside className={styles.sidebar}>
            <div className={styles.searchBox}>
              <SearchIcon />

              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search products"
                aria-label="Search BirdShop products"
              />
            </div>

            <div className={styles.filterBlock}>
              <p className={styles.filterTitle}>Category</p>

              <div className={styles.categoryList}>
                {productsLoaded
                  ? productCategories.map((item) => {
                      const count =
                        item === ALL_PRODUCTS
                          ? productList.length
                          : productList.filter(
                              (product) => product.category === item,
                            ).length;

                      const active = category === item;

                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setCategory(item)}
                          className={active ? styles.activeCategory : ""}
                          aria-pressed={active}
                        >
                          <span>{item}</span>

                          <span>{count}</span>
                        </button>
                      );
                    })
                  : [0, 1, 2, 3].map((row) => (
                      <span
                        key={row}
                        className={`${styles.skeleton} ${styles.skeletonCategory}`}
                        aria-hidden="true"
                      />
                    ))}
              </div>
            </div>

            <div className={styles.filterBlock}>
              <p className={styles.filterTitle}>Availability</p>

              <label className={styles.stockToggle}>
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(event) => setInStockOnly(event.target.checked)}
                />

                <span className={styles.fakeCheckbox}>
                  {inStockOnly && <CheckIcon />}
                </span>

                <span>In stock only</span>
              </label>
            </div>

            <div className={styles.supportCard}>
              <span>Need help?</span>

              <h3>Not sure what you need?</h3>

              <p>
                Reach us through Discord for product questions and order
                support.
              </p>

              <Link href={siteConfig.discordUrl} {...discordLinkProps}>
                {hasDiscordInvite ? <DiscordIcon /> : <MessageIcon />}

                {hasDiscordInvite ? "Join Discord" : "Contact Support"}

                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </aside>

          {/* =================================================
              PRODUCT AREA
          ================================================= */}

          <div className={styles.productsArea}>
            <div className={styles.toolbar}>
              <div className={styles.resultSummary}>
                <p>
                  Showing <strong>{countLabel}</strong>{" "}
                  {countLabel === 1 ? "result" : "results"}
                </p>

                {productsLoaded && totalVisible > 0 && (
                  <span>
                    {availableCount} available
                    {!inStockOnly && unavailableCount > 0 && (
                      <> · {unavailableCount} out of stock</>
                    )}
                  </span>
                )}
              </div>

              <label>
                <span>Sort by</span>

                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                >
                  <option value="featured">Featured</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="name">Name</option>
                </select>
              </label>
            </div>

            {/* Polite confirmation for screen readers after Add to Cart. */}
            <p className="visually-hidden" role="status">
              {addedProductName ? `${addedProductName} added to cart` : ""}
            </p>

            {/* ===============================================
                LOADING
            =============================================== */}

            {!productsLoaded && (
              <div className={styles.productGrid} role="status">
                <span className="visually-hidden">Loading products…</span>

                {[0, 1, 2, 3, 4, 5].map((card) => (
                  <ProductCardSkeleton key={card} />
                ))}
              </div>
            )}

            {/* ===============================================
                AVAILABLE PRODUCTS
            =============================================== */}

            {availableProducts.length > 0 && (
              <section className={styles.availabilitySection}>
                <div className={styles.availabilityHeading}>
                  <div>
                    <span className={styles.availabilityDot} />

                    <strong>Available now</strong>
                  </div>

                  <span>
                    {availableProducts.length}{" "}
                    {availableProducts.length === 1 ? "product" : "products"}
                  </span>
                </div>

                <div className={styles.productGrid}>
                  {availableProducts.map((product) => (
                    <ProductCard
                      key={product.slug}
                      product={product}
                      added={recentlyAdded === product.slug}
                      onAdd={handleAddToCart}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* ===============================================
                OUT OF STOCK PRODUCTS
            =============================================== */}

            {!inStockOnly && unavailableProducts.length > 0 && (
              <section className={styles.outOfStockSection}>
                <div className={styles.outOfStockHeading}>
                  <div>
                    <span />

                    <div>
                      <strong>Currently unavailable</strong>

                      <p>
                        These products are kept below available items until
                        inventory is replenished.
                      </p>
                    </div>
                  </div>

                  <span>
                    {unavailableProducts.length}{" "}
                    {unavailableProducts.length === 1 ? "product" : "products"}
                  </span>
                </div>

                <div className={styles.productGrid}>
                  {unavailableProducts.map((product) => (
                    <ProductCard
                      key={product.slug}
                      product={product}
                      added={false}
                      onAdd={handleAddToCart}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* ===============================================
                FAILED LOAD (never reads as "no results")
            =============================================== */}

            {productsLoaded && productsError && (
              <div className={styles.emptyState} role="alert">
                <span>Catalog unavailable</span>

                <h3>The catalog could not load.</h3>

                <p>{productsError}</p>

                <button type="button" onClick={() => void refreshProducts()}>
                  Try Again
                </button>
              </div>
            )}

            {/* ===============================================
                EMPTY
            =============================================== */}

            {productsLoaded && !productsError && totalVisible === 0 && (
              <div className={styles.emptyState}>
                <span>No products found</span>

                <h3>Nothing matches those filters.</h3>

                <p>Try another search, category, or availability option.</p>

                <button type="button" onClick={clearFilters}>
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
