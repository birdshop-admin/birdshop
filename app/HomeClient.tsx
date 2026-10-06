"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import PublicProductCounter from "@/components/PublicProductCounter";

import {
  CartIcon,
  CheckIcon,
  DiscordIcon,
  ShieldIcon,
  LightningIcon,
  HeartIcon,
  PeopleIcon,
} from "@/components/SiteIcons";

import { useCart } from "@/app/cart-context";
import type { Service } from "@/lib/services";
import { siteConfig } from "@/lib/site-config";

export default function HomePage({ serviceList }: { serviceList: Service[] }) {
  const featuredServices = serviceList.filter((s) => s.featured).slice(0, 3);
  const { addToCart, productList } = useCart();

  const [addedProduct, setAddedProduct] = useState<string | null>(null);

  /* =======================================================
     FEATURED PRODUCTS

     Available products are always preferred first.
     Out-of-stock products only fill empty featured slots
     when fewer than 3 available products exist.
  ======================================================= */

  const featuredProducts = [
    ...productList.filter((product) => product.stock > 0),

    ...productList.filter((product) => product.stock <= 0),
  ].slice(0, 3);

  /* =======================================================
     STOCK LABEL
  ======================================================= */

  function getStockLabel(stock: number) {
    if (stock <= 0) {
      return "OUT OF STOCK";
    }

    if (stock < 25) {
      return `${stock} LEFT`;
    }

    return "IN STOCK";
  }

  /* =======================================================
     ADD TO CART
  ======================================================= */

  function handleAdd(slug: string) {
    const product = productList.find((item) => item.slug === slug);

    if (!product || product.stock <= 0) {
      return;
    }

    addToCart(slug, 1);

    setAddedProduct(slug);

    window.setTimeout(() => {
      setAddedProduct((current) => (current === slug ? null : current));
    }, 1000);
  }

  return (
    <main className="page-shell">
      <SiteHeader />

      {/* ===================================================
          HERO
      =================================================== */}

      <section className="hero">
        <div className="hero-content">
          <div className="hero-copy">
            <p className="eyebrow">
              DIGITAL KEYS
              <span>×</span>
              GAME SERVICES
              <span>×</span>A KINDER COMMUNITY
            </p>

            <h1>
              Welcome to
              <br />
              Bird Shop
            </h1>

            <p className="hero-description">
              Your trusted source for digital product keys and game-related
              services. Fast, reliable, and community-driven — so you can spend
              less time waiting and more time playing.
            </p>

            <Link
              href={siteConfig.discordUrl}
              target="_blank"
              rel="noreferrer"
              className="discord-button"
            >
              <DiscordIcon />

              <span>Join Discord</span>

              <span className="button-arrow">→</span>
            </Link>

            <div className="hero-secondary-buttons">
              <Link href="/products">Browse Products</Link>

              <Link href="/services">View Services</Link>

              <Link href="/reviews">Read Reviews</Link>
            </div>
          </div>

          <div className="hero-logo-area">
            <div className="logo-glow" />

            <Image
              src="/greenbs.png"
              alt="BirdShop"
              width={600}
              height={600}
              className="hero-logo"
              priority
            />

            <p className="hero-tagline">
              GAMES&nbsp;&nbsp; PEOPLE
              <br />A BRIGHTER TOMORROW
            </p>
          </div>

          <aside className="hero-rail">
            <span>GOOD</span>

            <span>GAMES</span>

            <span>BRIGHTER</span>

            <span>PEOPLE</span>

            <div className="rail-line" />

            <span>⌁</span>

            <div className="rail-line short" />

            <span>EST.</span>

            <span>2024</span>
          </aside>
        </div>
      </section>

      {/* ===================================================
          TRUST STRIP
      =================================================== */}

      <section className="trust-strip">
        <div className="trust-item">
          <div className="trust-icon">
            <ShieldIcon />
          </div>

          <div>
            <strong>Trusted & Secure</strong>

            <span>SAFE TRANSACTIONS</span>
          </div>
        </div>

        <div className="trust-item">
          <div className="trust-icon">
            <LightningIcon />
          </div>

          <div>
            <strong>Fast Delivery</strong>

            <span>GET YOUR KEYS QUICKLY</span>
          </div>
        </div>

        <div className="trust-item">
          <div className="trust-icon">
            <HeartIcon />
          </div>

          <PublicProductCounter />
        </div>

        <div className="trust-item">
          <div className="trust-icon">
            <PeopleIcon />
          </div>

          <div>
            <strong>A Kinder Community</strong>

            <span>GAMES BRING US CLOSER</span>
          </div>
        </div>
      </section>

      {/* ===================================================
          CATALOG
      =================================================== */}

      <section className="catalog-area">
        {/* =================================================
            PRODUCTS
        ================================================= */}

        <div className="catalog-row">
          <div className="catalog-intro">
            <div className="section-kicker">
              <span>PRODUCTS</span>

              <i />
            </div>

            <h2>
              Most Popular
              <br />
              Products
            </h2>

            <p>
              Digital product keys for the games you love. Instant delivery,
              trusted and reliable.
            </p>

            <Link href="/products" className="view-all">
              View All Products
              <span>→</span>
            </Link>
          </div>

          <div className="cards-grid">
            {featuredProducts.map((product) => {
              const outOfStock = product.stock <= 0;

              const lowStock = product.stock > 0 && product.stock < 25;

              return (
                <article
                  key={product.slug}
                  className={`store-card ${
                    outOfStock ? "store-card-out-of-stock" : ""
                  }`}
                >
                  <Link
                    href={`/products/${product.slug}`}
                    className="store-card-image"
                  >
                    <strong>{product.initials}</strong>
                  </Link>

                  <div className="store-card-bottom">
                    <div className="store-card-copy">
                      <Link href={`/products/${product.slug}`}>
                        <h3>{product.name}</h3>
                      </Link>

                      <div className="store-card-meta-row">
                        <span className="store-card-category">
                          {product.category.toUpperCase()}
                        </span>

                        <span
                          className={`store-card-stock ${
                            outOfStock
                              ? "stock-out"
                              : lowStock
                                ? "stock-low"
                                : "stock-in"
                          }`}
                        >
                          {getStockLabel(product.stock)}
                        </span>
                      </div>

                      <strong className="store-card-price">
                        ${product.price.toFixed(2)}
                      </strong>
                    </div>

                    <button
                      type="button"
                      className="small-cart"
                      disabled={outOfStock}
                      aria-disabled={outOfStock}
                      title={outOfStock ? "Out of stock" : "Add to cart"}
                      onClick={() => handleAdd(product.slug)}
                      aria-label={
                        outOfStock
                          ? `${product.name} is out of stock`
                          : `Add ${product.name} to cart`
                      }
                    >
                      {addedProduct === product.slug && !outOfStock ? (
                        <CheckIcon />
                      ) : (
                        <CartIcon />
                      )}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="catalog-divider" />

        {/* =================================================
            SERVICES
        ================================================= */}

        <div className="catalog-row">
          <div className="catalog-intro">
            <div className="section-kicker">
              <span>SERVICES</span>

              <i />
            </div>

            <h2>
              Most Popular
              <br />
              Services
            </h2>

            <p>
              Professional, reliable, and custom game services designed around
              your experience.
            </p>

            <Link href="/services" className="view-all">
              View All Services
              <span>→</span>
            </Link>
          </div>

          <div className="cards-grid">
            {featuredServices.map((service) => (
              <article key={service.slug} className="store-card">
                <Link
                  href={`/services/${service.slug}`}
                  className="store-card-image"
                >
                  <strong>{service.initials}</strong>
                </Link>

                <div className="store-card-bottom">
                  <div className="store-card-copy">
                    <h3>{service.name}</h3>

                    <span>{service.category.toUpperCase()}</span>

                    <strong>
                      {service.startingPrice !== null
                        ? `From $${service.startingPrice.toFixed(2)}`
                        : "Custom Quote"}
                    </strong>
                  </div>

                  <Link
                    href={`/services/${service.slug}`}
                    className="small-cart"
                    aria-label={`View ${service.name}`}
                  >
                    →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
