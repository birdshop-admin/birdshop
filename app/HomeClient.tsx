"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import CatalogArtwork from "@/components/CatalogArtwork";
import DiscordInvite from "@/components/DiscordInvite";
import ProductThumbnail from "@/components/ProductThumbnail";
import PublicProductCounter from "@/components/PublicProductCounter";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import {
  ArrowIcon,
  CartIcon,
  CheckIcon,
  DiscordIcon,
  HeartIcon,
  LightningIcon,
  MessageIcon,
  PeopleIcon,
  ShieldIcon,
} from "@/components/SiteIcons";

import { useCart } from "@/app/cart-context";
import { formatUSD } from "@/lib/money";
import type { Product } from "@/lib/products";
import type { Service } from "@/lib/services";
import {
  discordLinkProps,
  hasDiscordInvite,
  siteConfig,
} from "@/lib/site-config";

/* =========================================================
   TYPES AND CONSTANTS
========================================================= */

/** The trimmed service app/page.tsx sends: only what a home card renders. */
export type HomeService = Pick<
  Service,
  | "slug"
  | "name"
  | "game"
  | "category"
  | "initials"
  | "shortDescription"
  | "startingPrice"
  | "badge"
  | "available"
  | "image"
> & {
  /** isQuoteOnly(service), computed on the server. */
  quoteOnly: boolean;
};

type HomeClientProps = {
  /** Server-picked featured products; null when the server query failed. */
  initialProducts: Product[] | null;
  /** Visible products in the server catalog. */
  productTotal: number;
  /** Up to 3 available services; null when services could not load. */
  services: HomeService[] | null;
  /** Available services in total. */
  serviceTotal: number;
};

type CardCount = 1 | 2 | 3;

/* Cart actions need the live catalog: addToCart is a no-op until it loads. */
type CartState = "ready" | "loading" | "unavailable";

const FEATURED_LIMIT = 3;
const ADDED_FEEDBACK_MS = 1600;
const LOW_STOCK = 25;

/* Rendered widths per layout (see the .cards-grid rules in globals.css). */
const IMAGE_SIZES: Record<CardCount, string> = {
  1: "(max-width: 740px) 100vw, (max-width: 1280px) 50vw, 600px",
  2: "(max-width: 600px) 84vw, (max-width: 1280px) 46vw, 520px",
  3: "(max-width: 860px) 300px, (max-width: 1280px) 31vw, 360px",
};

function toCardCount(length: number): CardCount {
  return length >= 3 ? 3 : length === 2 ? 2 : 1;
}

/* In-stock first, then sold-out items fill any empty slots (same rule as app/page.tsx). */
function pickFeaturedProducts(list: Product[]) {
  return [
    ...list.filter((product) => product.stock > 0),
    ...list.filter((product) => product.stock <= 0),
  ].slice(0, FEATURED_LIMIT);
}

function getStockStatus(stock: number) {
  if (stock <= 0) return { label: "Out of stock", tone: "stock-out" };
  if (stock < LOW_STOCK) return { label: `${stock} left`, tone: "stock-low" };
  return { label: "In stock", tone: "stock-in" };
}

/* =========================================================
   PAGE
========================================================= */

export default function HomeClient({
  initialProducts,
  productTotal,
  services,
  serviceTotal,
}: HomeClientProps) {
  const router = useRouter();

  const {
    addToCart,
    productList,
    productsLoaded,
    productsError,
    refreshProducts,
  } = useCart();

  /*
   * The server copy renders first (it matches the first client render, so
   * there is no hydration mismatch). Once the cart catalog has loaded, the
   * live list wins. A failed client load keeps showing the server copy.
   */
  const liveReady = productsLoaded && !productsError;

  const featuredProducts = useMemo(
    () => (liveReady ? pickFeaturedProducts(productList) : initialProducts),
    [liveReady, productList, initialProducts],
  );

  const totalProducts = liveReady ? productList.length : productTotal;

  const cartState: CartState = liveReady
    ? "ready"
    : productsError
      ? "unavailable"
      : "loading";

  const [added, setAdded] = useState<{ slug: string; name: string } | null>(
    null,
  );
  const addedTimer = useRef<number | null>(null);

  const [retryingProducts, setRetryingProducts] = useState(false);
  const [refreshingServices, startServicesRefresh] = useTransition();

  useEffect(
    () => () => {
      if (addedTimer.current !== null) window.clearTimeout(addedTimer.current);
    },
    [],
  );

  function handleAdd(product: Product) {
    if (cartState !== "ready" || product.stock <= 0) return;

    addToCart(product.slug, 1);
    setAdded({ slug: product.slug, name: product.name });

    if (addedTimer.current !== null) window.clearTimeout(addedTimer.current);

    addedTimer.current = window.setTimeout(() => {
      addedTimer.current = null;
      setAdded(null);
    }, ADDED_FEEDBACK_MS);
  }

  function retryProducts() {
    if (retryingProducts) return;

    setRetryingProducts(true);

    // refreshProducts never rejects; it resolves once the retry has settled.
    void refreshProducts().finally(() => setRetryingProducts(false));
  }

  function retryServices() {
    if (refreshingServices) return;

    // Re-runs the server component, which queries services again.
    startServicesRefresh(() => router.refresh());
  }

  /* ---------------------------------------------------------
     Products row content
  --------------------------------------------------------- */

  let productsContent: ReactNode;

  if (featuredProducts && featuredProducts.length > 0) {
    const count = toCardCount(featuredProducts.length);

    productsContent = (
      <ul role="list" className="cards-grid home-reveal" data-count={count}>
        {featuredProducts.map((product) => (
          <ProductCard
            key={product.slug}
            product={product}
            count={count}
            cartState={cartState}
            added={added?.slug === product.slug}
            onAdd={handleAdd}
          />
        ))}
      </ul>
    );
  } else if (featuredProducts) {
    productsContent = (
      <CatalogMessage
        eyebrow="Coming soon"
        title="New products are on the way."
        body={
          hasDiscordInvite
            ? "Join the Discord to hear first when new keys arrive."
            : "Get in touch and we will let you know when new keys arrive."
        }
      >
        <Link
          href={siteConfig.discordUrl}
          {...discordLinkProps}
          className="store-empty-button"
        >
          {hasDiscordInvite ? "Join Discord" : "Contact Us"}
        </Link>
      </CatalogMessage>
    );
  } else if (productsError) {
    productsContent = (
      <CatalogMessage
        eyebrow="Catalog unavailable"
        title="Products couldn’t load right now."
        body="Nothing in your cart has changed. Please try again in a moment."
        alert
      >
        <button
          type="button"
          className="store-empty-button"
          onClick={retryProducts}
          aria-disabled={retryingProducts || undefined}
          aria-busy={retryingProducts || undefined}
        >
          {retryingProducts ? "Trying Again…" : "Try Again"}
        </button>

        <Link href="/products" className="store-empty-link">
          Browse Products
        </Link>
      </CatalogMessage>
    );
  } else {
    productsContent = <CardsSkeleton label="Loading products" />;
  }

  /* ---------------------------------------------------------
     Services row content
  --------------------------------------------------------- */

  let servicesContent: ReactNode;

  if (services && services.length > 0) {
    const count = toCardCount(services.length);

    servicesContent = (
      <ul role="list" className="cards-grid home-reveal" data-count={count}>
        {services.map((service) => (
          <ServiceCard key={service.slug} service={service} count={count} />
        ))}
      </ul>
    );
  } else if (services) {
    servicesContent = (
      <CatalogMessage
        eyebrow="Coming soon"
        title="Services are being prepared."
        body="Tell us what you need and we will put together a custom quote in a private chat."
      >
        <Link href="/contact?topic=service" className="store-empty-button">
          Start a Custom Request
        </Link>
      </CatalogMessage>
    );
  } else {
    servicesContent = (
      <CatalogMessage
        eyebrow="Services unavailable"
        title="Services couldn’t load."
        body="This is usually brief. Try again, or open the full services page."
        alert
      >
        <button
          type="button"
          className="store-empty-button"
          onClick={retryServices}
          aria-disabled={refreshingServices || undefined}
          aria-busy={refreshingServices || undefined}
        >
          {refreshingServices ? "Trying Again…" : "Try Again"}
        </button>

        <Link href="/services" className="store-empty-link">
          Explore Services
        </Link>
      </CatalogMessage>
    );
  }

  return (
    <main className="page-shell home-page">
      <SiteHeader />

      <HomeHero />

      <TrustStrip />

      <div className="catalog-area">
        {/* Announces add-to-cart for screen readers. */}
        <p className="visually-hidden" role="status" aria-live="polite">
          {added ? `${added.name} added to cart` : ""}
        </p>

        {/* =================================================
            PRODUCTS
        ================================================= */}

        <section className="catalog-row" aria-labelledby="home-products-title">
          <CatalogIntro
            kicker="Products"
            titleId="home-products-title"
            title={
              <>
                Most popular <br />
                products
              </>
            }
            description="Digital product keys for the games you love. Instant delivery, trusted and reliable."
            href="/products"
            linkLabel={
              totalProducts > FEATURED_LIMIT
                ? `View All ${totalProducts} Products`
                : "View All Products"
            }
          />

          <div className="catalog-content">{productsContent}</div>
        </section>

        <div className="catalog-divider" aria-hidden="true" />

        {/* =================================================
            SERVICES
        ================================================= */}

        <section className="catalog-row" aria-labelledby="home-services-title">
          <CatalogIntro
            kicker="Services"
            titleId="home-services-title"
            title={
              <>
                Most popular <br />
                services
              </>
            }
            description="Professional, reliable, and custom game services designed around your experience."
            href="/services"
            linkLabel={
              serviceTotal > FEATURED_LIMIT
                ? `View All ${serviceTotal} Services`
                : "View All Services"
            }
          />

          <div className="catalog-content">{servicesContent}</div>
        </section>

        <div className="catalog-divider" aria-hidden="true" />

        {/* =================================================
            HOW IT WORKS
        ================================================= */}

        <section
          className="catalog-row home-steps"
          aria-labelledby="home-steps-title"
        >
          <CatalogIntro
            kicker="How it works"
            titleId="home-steps-title"
            title={
              <>
                Ordering, <br />
                made simple.
              </>
            }
            description="Three steps from choosing to receiving, for products, packages and custom work."
            href="/how-to-order"
            linkLabel="Read the Full Guide"
          />

          <div className="catalog-content">
            <ol role="list" className="home-steps-list home-reveal">
              <li>
                <span className="home-step-number" aria-hidden="true">
                  01
                </span>
                <h3>Choose what fits</h3>
                <p>A digital product, a service package, or something custom.</p>
              </li>

              <li>
                <span className="home-step-number" aria-hidden="true">
                  02
                </span>
                <h3>Check out securely</h3>
                <p>
                  Pay through Stripe. Custom work is quoted in your private chat
                  first.
                </p>
              </li>

              <li>
                <span className="home-step-number" aria-hidden="true">
                  03
                </span>
                <h3>Receive &amp; follow up</h3>
                <p>
                  Codes arrive by email. Services continue in{" "}
                  <Link href="/service-chat">My Service</Link>.
                </p>
              </li>
            </ol>
          </div>
        </section>
      </div>

      <SiteFooter />

      <DiscordInvite />
    </main>
  );
}

/* =========================================================
   HERO
========================================================= */

function HomeHero() {
  return (
    <section className="hero" aria-labelledby="home-hero-title">
      <div className="hero-content">
        <div className="hero-copy">
          {/* On phones the last item takes its own line, so a separator never
              starts a line. */}
          <p className="eyebrow">
            <span className="eyebrow-item">Digital keys</span>{" "}
            <span className="eyebrow-sep" aria-hidden="true">
              ×
            </span>{" "}
            <span className="eyebrow-item">Game services</span>{" "}
            <span className="eyebrow-sep eyebrow-sep--break" aria-hidden="true">
              ×
            </span>{" "}
            <span className="eyebrow-item eyebrow-item--last">
              A kinder community
            </span>
          </p>

          <h1 id="home-hero-title">
            Welcome to <br />
            Bird Shop
          </h1>

          <p className="hero-description">
            Your trusted source for digital product keys and game-related
            services. Fast, reliable, and community-driven — so you can spend
            less time waiting and more time playing.
          </p>

          {/* Without a configured invite this falls back to the Contact page. */}
          <Link
            href={siteConfig.discordUrl}
            {...discordLinkProps}
            className="discord-button"
          >
            {hasDiscordInvite ? <DiscordIcon /> : <MessageIcon />}

            <span className="discord-button-label">
              {hasDiscordInvite ? "Join Discord" : "Contact Us"}
            </span>

            <span className="button-arrow" aria-hidden="true">
              →
            </span>
          </Link>

          <div className="hero-secondary-buttons">
            <Link href="/products">Browse Products</Link>

            <Link href="/services">View Services</Link>

            <Link href="/reviews">Read Reviews</Link>
          </div>

          <Link href="/how-to-order" className="hero-guide-link">
            New to BirdShop? See how ordering works
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="hero-logo-area">
          <div className="logo-glow" aria-hidden="true" />

          {/* Both marks load eagerly: the theme is unknown at render time, and a
              lazy dark-mode mark would pop in late. The h1 names the brand.
              The entrance animation runs on this always-displayed wrapper, so
              switching theme (display:none -> block) does not replay it. */}
          <div className="hero-logo-mark">
            <Image
              src="/greenbs.png"
              alt=""
              width={600}
              height={600}
              sizes="(max-width: 740px) 220px, 360px"
              loading="eager"
              className="hero-logo theme-logo-light"
            />

            {/* The dark-green mark disappears on the dark hero; dark mode uses the cream mark. */}
            <Image
              src="/cremebs.png"
              alt=""
              width={600}
              height={600}
              sizes="(max-width: 740px) 220px, 360px"
              loading="eager"
              className="hero-logo theme-logo-dark"
            />
          </div>

          <p className="hero-tagline">
            Games&nbsp;&nbsp; people
            <br />A brighter tomorrow
          </p>
        </div>

        <div className="hero-rail" aria-hidden="true">
          <span>Good</span>
          <span>Games</span>
          <span>Brighter</span>
          <span>People</span>

          <i className="rail-line" />

          <span>⌁</span>

          <i className="rail-line short" />

          <span>Est.</span>
          <span>{siteConfig.established}</span>
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   TRUST STRIP
========================================================= */

function TrustStrip() {
  return (
    <ul role="list" className="trust-strip" aria-label="Why shop with BirdShop">
      <li className="trust-item">
        <div className="trust-icon">
          <ShieldIcon />
        </div>

        <div>
          <strong>Trusted &amp; Secure</strong>
          <span>Safe transactions</span>
        </div>
      </li>

      <li className="trust-item">
        <div className="trust-icon">
          <LightningIcon />
        </div>

        <div>
          <strong>Fast Delivery</strong>
          <span>Get your keys quickly</span>
        </div>
      </li>

      <li className="trust-item">
        <div className="trust-icon">
          <HeartIcon />
        </div>

        <PublicProductCounter />
      </li>

      <li className="trust-item">
        <div className="trust-icon">
          <PeopleIcon />
        </div>

        <div>
          <strong>A Kinder Community</strong>
          <span>Games bring us closer</span>
        </div>
      </li>
    </ul>
  );
}

/* =========================================================
   CATALOG PIECES
========================================================= */

function CatalogIntro({
  kicker,
  titleId,
  title,
  description,
  href,
  linkLabel,
}: {
  kicker: string;
  titleId: string;
  title: ReactNode;
  description: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="catalog-intro home-reveal">
      <div className="section-kicker">
        <span>{kicker}</span>
        <i aria-hidden="true" />
      </div>

      <h2 id={titleId}>{title}</h2>

      <p>{description}</p>

      <Link href={href} className="view-all">
        {linkLabel}
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

function ProductCard({
  product,
  count,
  cartState,
  added,
  onAdd,
}: {
  product: Product;
  count: CardCount;
  cartState: CartState;
  added: boolean;
  onAdd: (product: Product) => void;
}) {
  const titleId = useId();

  const spotlight = count === 1;
  const outOfStock = product.stock <= 0;
  const stock = getStockStatus(product.stock);
  const showAdded = added && !outOfStock;

  const oldPrice =
    product.oldPrice !== undefined && product.oldPrice > product.price
      ? product.oldPrice
      : null;
  const savePercent = oldPrice
    ? Math.round((1 - product.price / oldPrice) * 100)
    : 0;

  const cartDisabled = outOfStock || cartState !== "ready";
  // While the live catalog loads (usually a fraction of a second) the button
  // keeps its normal look; data-loading opts out of the disabled styling.
  const cartLoading = !outOfStock && cartState === "loading";

  let cartTitle = "Add to cart";
  let cartLabel = showAdded
    ? `${product.name} added to cart`
    : `Add ${product.name} to cart`;

  if (outOfStock) {
    cartTitle = "Out of stock";
    cartLabel = `${product.name} is out of stock`;
  } else if (cartState === "loading") {
    cartTitle = "Loading…";
  } else if (cartState === "unavailable") {
    cartTitle = "The cart is unavailable right now";
    cartLabel = `${product.name} can’t be added to the cart right now`;
  }

  let ctaText = "Add to Cart";
  if (outOfStock) ctaText = "Out of Stock";
  else if (cartState === "unavailable") ctaText = "Unavailable";
  else if (showAdded) ctaText = "Added";

  return (
    <li
      className={`store-card${spotlight ? " store-card--spotlight" : ""}${
        outOfStock ? " store-card-out-of-stock" : ""
      }`}
    >
      <div className="store-card-image">
        <ProductThumbnail
          product={product}
          alt=""
          fit="contain"
          padding={spotlight ? 28 : 16}
          sizes={IMAGE_SIZES[count]}
        />

        {product.badge ? (
          <span className="store-card-badge">{product.badge}</span>
        ) : null}

        {product.platform ? (
          <span className="store-card-chip">{product.platform}</span>
        ) : null}

        {/* Visual cue on the image; the stock pill below announces it. */}
        {outOfStock ? (
          <span className="store-card-chip store-card-chip--end" aria-hidden="true">
            Sold out
          </span>
        ) : null}
      </div>

      <div className="store-card-body">
        <div className="store-card-copy">
          <div className="store-card-meta-row">
            <span className="store-card-category">{product.category}</span>

            <span className={`store-card-stock ${stock.tone}`}>
              {stock.label}
            </span>
          </div>

          <h3 className="store-card-title" id={titleId}>
            {/* The stretched link: the whole card opens the product. */}
            <Link className="store-card-link" href={`/products/${product.slug}`}>
              {product.name}
            </Link>
          </h3>

          {count <= 2 && product.shortDescription ? (
            <p className="store-card-desc">{product.shortDescription}</p>
          ) : null}

          <p className="store-card-price">
            <span className="store-card-amount">{formatUSD(product.price)}</span>

            {oldPrice ? (
              <>
                <s>
                  <span className="visually-hidden">Was </span>
                  {formatUSD(oldPrice)}
                </s>

                {savePercent > 0 ? (
                  <span className="store-card-save">Save {savePercent}%</span>
                ) : null}
              </>
            ) : null}
          </p>
        </div>

        {spotlight ? (
          <button
            type="button"
            className="store-card-cta"
            disabled={cartDisabled}
            data-loading={cartLoading ? "" : undefined}
            title={cartTitle}
            aria-describedby={titleId}
            onClick={() => onAdd(product)}
          >
            {showAdded ? <CheckIcon /> : <CartIcon />}
            <span>{ctaText}</span>
          </button>
        ) : (
          <button
            type="button"
            className="small-cart"
            disabled={cartDisabled}
            data-loading={cartLoading ? "" : undefined}
            title={cartTitle}
            aria-label={cartLabel}
            onClick={() => onAdd(product)}
          >
            {showAdded ? <CheckIcon /> : <CartIcon />}
          </button>
        )}
      </div>
    </li>
  );
}

function ServiceCard({
  service,
  count,
}: {
  service: HomeService;
  count: CardCount;
}) {
  const spotlight = count === 1;
  const badge = service.badge || (service.quoteOnly ? "Custom quote" : null);
  const startingPrice = service.quoteOnly ? null : service.startingPrice;

  return (
    <li
      className={`store-card store-card--service${
        spotlight ? " store-card--spotlight" : ""
      }`}
    >
      <div className="store-card-image">
        <CatalogArtwork
          src={service.image}
          alt=""
          fit="cover"
          sizes={IMAGE_SIZES[count]}
          fallback={
            <span className="catalog-artwork-fallback" aria-hidden="true">
              {service.initials || "BS"}
            </span>
          }
        />

        {badge ? <span className="store-card-badge">{badge}</span> : null}

        {service.game ? (
          <span className="store-card-chip">{service.game}</span>
        ) : null}
      </div>

      <div className="store-card-body">
        <div className="store-card-copy">
          {service.category ? (
            <div className="store-card-meta-row">
              <span className="store-card-category">{service.category}</span>
            </div>
          ) : null}

          <h3 className="store-card-title">
            <Link className="store-card-link" href={`/services/${service.slug}`}>
              {service.name}
            </Link>
          </h3>

          {count <= 2 && service.shortDescription ? (
            <p className="store-card-desc">{service.shortDescription}</p>
          ) : null}

          <p className="store-card-price">
            {startingPrice !== null ? (
              <>
                <small>From</small>{" "}
                <span className="store-card-amount">
                  {formatUSD(startingPrice)}
                </span>
              </>
            ) : (
              <span className="store-card-amount">By quote</span>
            )}
          </p>
        </div>

        {/* Decorative: the stretched title link already opens the service. */}
        {spotlight ? (
          <span className="store-card-cta store-card-cta--decor" aria-hidden="true">
            <span>{service.quoteOnly ? "View Service" : "View Packages"}</span>
            <ArrowIcon />
          </span>
        ) : (
          <span className="small-cart small-cart--decor" aria-hidden="true">
            <ArrowIcon />
          </span>
        )}
      </div>
    </li>
  );
}

function CardsSkeleton({ label }: { label: string }) {
  return (
    <>
      <p className="visually-hidden" role="status">
        {label}
      </p>

      <ul className="cards-grid" data-count={3} aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <li key={index} className="store-card store-card--skeleton">
            <div className="store-card-image" />

            <div className="store-card-body">
              <div className="store-card-copy">
                <span className="skeleton-line" />
                <span className="skeleton-line" />
                <span className="skeleton-line" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function CatalogMessage({
  eyebrow,
  title,
  body,
  alert = false,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  alert?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="store-empty" role={alert ? "alert" : undefined}>
      <p className="store-empty-eyebrow">{eyebrow}</p>
      <h3>{title}</h3>
      <p>{body}</p>
      <div className="store-empty-actions">{children}</div>
    </div>
  );
}
