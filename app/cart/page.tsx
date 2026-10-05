"use client";

import Link from "next/link";
import ProductCheckout from "@/components/ProductCheckout";

import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

import styles from "./cart.module.css";

import { useCart } from "@/app/cart-context";

/* =========================================================
   CART PAGE
========================================================= */

export default function CartPage() {
  const {
    items,

    products,
    productsLoaded,
    productsError,

    updateQuantity,
    removeFromCart,
    clearCart,
    refreshProducts,
  } = useCart();

  /* =======================================================
     VALID CART ITEMS
  ======================================================= */

  const validItems = items.flatMap((item) => {
    const product = products[item.slug];

    if (!product) {
      return [];
    }

    return [
      {
        ...item,
        product,
      },
    ];
  });

  /* =======================================================
     TOTALS
  ======================================================= */

  const subtotal = validItems.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0,
  );

  /* =======================================================
     LOADING
  ======================================================= */

  if (!productsLoaded) {
    return (
      <main className="page-shell">
        <SiteHeader />

        <section className={styles.topSection}>
          <div className={styles.cartHero}>
            <span>YOUR ORDER</span>

            <h1>Shopping Cart</h1>

            <p>Loading your BirdShop cart...</p>
          </div>
        </section>

        <section className={styles.cartArea}>
          <div className={styles.emptyCart}>
            <span>LOADING CART</span>

            <h2>Checking your products.</h2>

            <p>
              BirdShop is confirming the latest product information, pricing,
              and stock.
            </p>
          </div>
        </section>

        <SiteFooter />
      </main>
    );
  }

  /* =======================================================
     DATABASE ERROR
  ======================================================= */

  if (productsError) {
    return (
      <main className="page-shell">
        <SiteHeader />

        <section className={styles.topSection}>
          <div className={styles.cartHero}>
            <span>YOUR ORDER</span>

            <h1>Shopping Cart</h1>

            <p>We could not load the latest product information.</p>
          </div>
        </section>

        <section className={styles.cartArea}>
          <div className={styles.emptyCart}>
            <span>CONNECTION ERROR</span>

            <h2>Unable to load your cart.</h2>

            <p>
              BirdShop could not reach the product catalog. Your saved cart has
              not been intentionally cleared.
            </p>

            <button
              type="button"
              onClick={() => {
                void refreshProducts();
              }}
            >
              Try Again
            </button>
          </div>
        </section>

        <SiteFooter />
      </main>
    );
  }

  /* =======================================================
     PAGE
  ======================================================= */

  return (
    <main className="page-shell">
      <SiteHeader />

      {/* ===================================================
          CART HERO
      =================================================== */}

      <section className={styles.topSection}>
        <div className={styles.cartHero}>
          <span>YOUR ORDER</span>

          <h1>Shopping Cart</h1>

          <p>Review your BirdShop products before continuing to checkout.</p>
        </div>
      </section>

      {/* ===================================================
          CART
      =================================================== */}

      <section className={styles.cartArea}>
        {validItems.length === 0 ? (
          /* ===============================================
             EMPTY CART
          =============================================== */

          <div className={styles.emptyCart}>
            <span>YOUR CART IS EMPTY</span>

            <h2>Nothing here yet.</h2>

            <p>Browse BirdShop products and add something to your cart.</p>

            <Link href="/products">Browse Products →</Link>
          </div>
        ) : (
          /* ===============================================
             CART CONTENT
          =============================================== */

          <div className={styles.cartLayout}>
            {/* =============================================
                ITEMS
            ============================================= */}

            <div className={styles.cartItems}>
              <div className={styles.cartHeading}>
                <h2>Your Items</h2>

                <button type="button" onClick={clearCart}>
                  Clear Cart
                </button>
              </div>

              {validItems.map(({ slug, quantity, product }) => {
                const lineTotal = product.price * quantity;

                const atMaximum = quantity >= product.stock;

                const lowStock = product.stock > 0 && product.stock < 25;

                return (
                  <article key={slug} className={styles.cartItem}>
                    {/* ===================================
                          PRODUCT ART
                      =================================== */}

                    <Link
                      href={`/products/${slug}`}
                      className={styles.itemVisual}
                    >
                      <span>{product.initials}</span>
                    </Link>

                    {/* ===================================
                          PRODUCT INFO
                      =================================== */}

                    <div className={styles.itemInfo}>
                      <span>{product.category}</span>

                      <Link href={`/products/${slug}`}>
                        <h3>{product.name}</h3>
                      </Link>

                      <p>
                        {product.platform}

                        {" · "}

                        {product.region}
                      </p>

                      {lowStock && <p>{product.stock} left in stock</p>}

                      <button
                        type="button"
                        onClick={() => removeFromCart(slug)}
                      >
                        Remove
                      </button>
                    </div>

                    {/* ===================================
                          QUANTITY
                      =================================== */}

                    <div className={styles.quantityControl}>
                      <button
                        type="button"
                        aria-label={`Decrease ${product.name} quantity`}
                        onClick={() => updateQuantity(slug, quantity - 1)}
                      >
                        −
                      </button>

                      <span>{quantity}</span>

                      <button
                        type="button"
                        aria-label={`Increase ${product.name} quantity`}
                        disabled={atMaximum}
                        onClick={() => updateQuantity(slug, quantity + 1)}
                      >
                        +
                      </button>
                    </div>

                    {/* ===================================
                          PRICE
                      =================================== */}

                    <strong className={styles.itemPrice}>
                      ${lineTotal.toFixed(2)}
                    </strong>
                  </article>
                );
              })}
            </div>

            {/* =============================================
                ORDER SUMMARY
            ============================================= */}

            <aside className={styles.summary}>
              <span>ORDER SUMMARY</span>

              <h2>Summary</h2>

              <div className={styles.summaryLine}>
                <span>Items</span>

                <strong>
                  {validItems.reduce((total, item) => total + item.quantity, 0)}
                </strong>
              </div>

              <div className={styles.summaryLine}>
                <span>Subtotal</span>

                <strong>${subtotal.toFixed(2)}</strong>
              </div>

              <div className={styles.summaryLine}>
                <span>Delivery</span>

                <strong>Digital</strong>
              </div>

              <div className={styles.totalLine}>
                <span>Total</span>

                <strong>${subtotal.toFixed(2)}</strong>
              </div>

              <ProductCheckout />

              <Link href="/products" className={styles.continueLink}>
                ← Continue Shopping
              </Link>
            </aside>
          </div>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}
