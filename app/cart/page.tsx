"use client";
import { formatUSD } from "@/lib/money";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ProductThumbnail from "@/components/ProductThumbnail";
import ProductCheckout from "@/components/ProductCheckout";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useCart } from "@/app/cart-context";

import styles from "./cart.module.css";

const CLEAR_CONFIRM_MS = 4000;

function CartHero({ description }: { description: string }) {
  return (
    <section className={styles.topSection}>
      <div className={styles.cartHero}>
        <span>Your order</span>
        <h1>Shopping Cart</h1>
        <p>{description}</p>
      </div>
    </section>
  );
}

function CartSkeleton() {
  return (
    <div className={styles.cartLayout} aria-hidden="true">
      <div className={styles.cartItems}>
        <div className={styles.cartHeading}>
          <span className={`${styles.skeleton} ${styles.skeletonHeading}`} />
        </div>

        {[0, 1].map((row) => (
          <div key={row} className={`${styles.cartItem} ${styles.skeletonRow}`}>
            <span className={`${styles.skeleton} ${styles.skeletonVisual}`} />

            <div className={styles.itemInfo}>
              <span className={`${styles.skeleton} ${styles.skeletonLine} ${styles.skeletonShort}`} />
              <span className={`${styles.skeleton} ${styles.skeletonTitle}`} />
              <span className={`${styles.skeleton} ${styles.skeletonLine} ${styles.skeletonMid}`} />
            </div>

            <span className={`${styles.skeleton} ${styles.skeletonQty}`} />
            <span className={`${styles.skeleton} ${styles.skeletonPrice}`} />
          </div>
        ))}
      </div>

      <div className={`${styles.summary} ${styles.summarySkeleton}`}>
        <span className={`${styles.skeleton} ${styles.skeletonLine} ${styles.skeletonShort}`} />
        <span className={`${styles.skeleton} ${styles.skeletonTitle}`} />
        <span className={`${styles.skeleton} ${styles.skeletonLine}`} />
        <span className={`${styles.skeleton} ${styles.skeletonLine}`} />
        <span className={`${styles.skeleton} ${styles.skeletonLine} ${styles.skeletonMid}`} />
        <span className={`${styles.skeleton} ${styles.skeletonButton}`} />
      </div>
    </div>
  );
}

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

  // Clear Cart asks for a second press within a few seconds.
  const [confirmClear, setConfirmClear] = useState(false);
  const clearTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (clearTimer.current !== null) {
        window.clearTimeout(clearTimer.current);
      }
    };
  }, []);

  function handleClear() {
    if (clearTimer.current !== null) {
      window.clearTimeout(clearTimer.current);
      clearTimer.current = null;
    }

    if (!confirmClear) {
      setConfirmClear(true);
      clearTimer.current = window.setTimeout(() => {
        clearTimer.current = null;
        setConfirmClear(false);
      }, CLEAR_CONFIRM_MS);
      return;
    }

    setConfirmClear(false);
    clearCart();
  }

  const validItems = items.flatMap((item) => {
    const product = products[item.slug];

    if (!product) return [];

    return [{ ...item, product }];
  });

  const subtotal = validItems.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0,
  );

  if (!productsLoaded) {
    return (
      <main className="page-shell">
        <SiteHeader />

        <CartHero description="Loading your BirdShop cart…" />

        <section className={styles.cartArea} aria-busy="true">
          <p className="visually-hidden" role="status">
            Loading your cart…
          </p>

          <CartSkeleton />
        </section>

        <SiteFooter />
      </main>
    );
  }

  if (productsError) {
    return (
      <main className="page-shell">
        <SiteHeader />

        <CartHero description="We could not load the latest product information." />

        <section className={styles.cartArea}>
          <div className={styles.emptyCart} role="alert">
            <span className={styles.emptyEyebrow}>Connection error</span>
            <h2 className={styles.emptyTitle}>Unable to load your cart.</h2>
            <p className={styles.emptyText}>
              BirdShop could not reach the product catalog. Your saved
              cart has not been intentionally cleared.
            </p>

            <button
              type="button"
              className={styles.emptyAction}
              onClick={() => void refreshProducts()}
            >
              Try Again
            </button>
          </div>
        </section>

        <SiteFooter />
      </main>
    );
  }

  return (
    <main className="page-shell">
      <SiteHeader />

      <CartHero description="Review your BirdShop products before continuing to checkout." />

      <section className={styles.cartArea}>
        {validItems.length === 0 ? (
          <div className={styles.emptyCart}>
            <span className={styles.emptyEyebrow}>Your cart is empty</span>
            <h2 className={styles.emptyTitle}>Nothing here yet.</h2>
            <p className={styles.emptyText}>
              Browse BirdShop products and add something to your cart.
            </p>

            <Link href="/products" className={styles.emptyAction}>
              Browse Products <span aria-hidden="true">→</span>
            </Link>

            <div className={styles.emptyLinks}>
              <Link href="/services">Explore Services</Link>
              <Link href="/how-to-order#products">How Ordering Works</Link>
            </div>

            {/* A saved checkout can still be recovered with an empty cart. */}
            <ProductCheckout />
          </div>
        ) : (
          <div className={styles.cartLayout}>
            <div className={styles.cartItems}>
              <div className={styles.cartHeading}>
                <h2>Your Items</h2>

                <button
                  type="button"
                  className={confirmClear ? styles.clearConfirm : undefined}
                  onClick={handleClear}
                >
                  <span aria-live="polite">
                    {confirmClear ? "Tap Again to Clear" : "Clear Cart"}
                  </span>
                </button>
              </div>

              {validItems.map(({ slug, quantity, product }) => {
                const lineTotal = product.price * quantity;
                const atMaximum =
                  quantity >= Math.min(10, product.stock);
                const lowStock =
                  product.stock > 0 && product.stock < 25;

                return (
                  <article key={slug} className={styles.cartItem}>
                    {/* The name link below goes to the same page. */}
                    <Link
                      href={`/products/${slug}`}
                      className={styles.itemVisual}
                      aria-hidden="true"
                      tabIndex={-1}
                    >
                      <ProductThumbnail
                        product={product}
                        alt=""
                        sizes="(max-width: 700px) 84px, 130px"
                      />
                    </Link>

                    <div className={styles.itemInfo}>
                      <span>{product.category}</span>

                      <Link href={`/products/${slug}`}>
                        <h3>{product.name}</h3>
                      </Link>

                      <p>
                        {product.platform} · {product.region}
                      </p>

                      {lowStock && (
                        <p className={styles.itemStock}>
                          {product.stock} left in stock
                        </p>
                      )}

                      <button
                        type="button"
                        aria-label={`Remove ${product.name} from cart`}
                        onClick={() => removeFromCart(slug)}
                      >
                        Remove
                      </button>
                    </div>

                    <div className={styles.quantityControl}>
                      <button
                        type="button"
                        aria-label={`Decrease ${product.name} quantity`}
                        onClick={() =>
                          updateQuantity(slug, quantity - 1)
                        }
                      >
                        −
                      </button>

                      <span aria-live="polite" aria-atomic="true">
                        <span className="visually-hidden">
                          {product.name} quantity{" "}
                        </span>
                        {quantity}
                      </span>

                      <button
                        type="button"
                        aria-label={`Increase ${product.name} quantity`}
                        disabled={atMaximum}
                        onClick={() =>
                          updateQuantity(slug, quantity + 1)
                        }
                      >
                        +
                      </button>
                    </div>

                    <strong className={styles.itemPrice}>
                      {formatUSD(lineTotal)}
                    </strong>
                  </article>
                );
              })}
            </div>

            <aside className={styles.summary}>
              <span>Order summary</span>
              <h2>Summary</h2>

              <div className={styles.summaryLine}>
                <span>Items</span>
                <strong>
                  {validItems.reduce(
                    (total, item) => total + item.quantity,
                    0,
                  )}
                </strong>
              </div>

              <div className={styles.summaryLine}>
                <span>Subtotal</span>
                <strong>{formatUSD(subtotal)}</strong>
              </div>

              <div className={styles.summaryLine}>
                <span>Delivery</span>
                <strong>Digital</strong>
              </div>

              <div className={styles.totalLine}>
                <span>Total</span>
                <strong>{formatUSD(subtotal)}</strong>
              </div>

              <ProductCheckout />

              <Link
                href="/products"
                className={styles.continueLink}
              >
                <span aria-hidden="true">←</span> Continue Shopping
              </Link>
            </aside>
          </div>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}
