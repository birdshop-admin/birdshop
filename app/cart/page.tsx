"use client";

import Link from "next/link";
import ProductThumbnail from "@/components/ProductThumbnail";
import ProductCheckout from "@/components/ProductCheckout";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useCart } from "@/app/cart-context";

import styles from "./cart.module.css";

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
              BirdShop is confirming the latest product information,
              pricing, and stock.
            </p>
          </div>
        </section>

        <SiteFooter />
      </main>
    );
  }

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
              BirdShop could not reach the product catalog. Your saved
              cart has not been intentionally cleared.
            </p>

            <button
              type="button"
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

      <section className={styles.topSection}>
        <div className={styles.cartHero}>
          <span>YOUR ORDER</span>
          <h1>Shopping Cart</h1>
          <p>
            Review your BirdShop products before continuing to checkout.
          </p>
        </div>
      </section>

      <section className={styles.cartArea}>
        {validItems.length === 0 ? (
          <div className={styles.emptyCart}>
            <span>YOUR CART IS EMPTY</span>
            <h2>Nothing here yet.</h2>
            <p>Browse BirdShop products and add something to your cart.</p>

            <Link href="/products">Browse Products →</Link>

            <ProductCheckout />
          </div>
        ) : (
          <div className={styles.cartLayout}>
            <div className={styles.cartItems}>
              <div className={styles.cartHeading}>
                <h2>Your Items</h2>

                <button type="button" onClick={clearCart}>
                  Clear Cart
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
                    <Link
                      href={`/products/${slug}`}
                      className={styles.itemVisual}
                    >
                      <ProductThumbnail product={product} />
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
                        <p>{product.stock} left in stock</p>
                      )}

                      <button
                        type="button"
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

                      <span>{quantity}</span>

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
                      ${lineTotal.toFixed(2)}
                    </strong>
                  </article>
                );
              })}
            </div>

            <aside className={styles.summary}>
              <span>ORDER SUMMARY</span>
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

              <Link
                href="/products"
                className={styles.continueLink}
              >
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