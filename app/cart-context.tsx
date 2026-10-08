"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/lib/products";
import {
  mapDatabaseProduct,
  PRODUCT_COLUMNS,
  type DatabaseProduct,
} from "@/lib/product-catalog";

export type CartItem = {
  slug: string;
  quantity: number;
};

type ProductMap = Record<string, Product>;

type CartContextValue = {
  items: CartItem[];
  totalItems: number;
  productList: Product[];
  products: ProductMap;
  productsLoaded: boolean;
  productsError: string | null;
  addToCart: (slug: string, quantity?: number) => void;
  removeFromCart: (slug: string) => void;
  updateQuantity: (slug: string, quantity: number) => void;
  clearCart: () => void;
  refreshProducts: () => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "birdshop-cart";

// Navigation, focus, visibility and reconnects reuse a catalog younger than this.
// Price and stock are re-validated server-side at checkout.
const STALE_MS = 30_000;
const CATALOG_ERROR =
  "The product catalog could not load. Please refresh and retry.";

function createProductMap(productList: Product[]) {
  return productList.reduce<ProductMap>((catalog, product) => {
    catalog[product.slug] = product;
    return catalog;
  }, {});
}

function getMaximumQuantity(slug: string, catalog: ProductMap) {
  const stock = catalog[slug]?.stock ?? 0;
  return Math.max(0, Math.min(10, Math.floor(stock)));
}

function sanitizeCartItems(value: unknown, catalog: ProductMap): CartItem[] {
  if (!Array.isArray(value)) return [];

  const quantities = new Map<string, number>();

  for (const entry of value) {
    if (
      !entry ||
      typeof entry !== "object" ||
      !("slug" in entry) ||
      !("quantity" in entry)
    ) {
      continue;
    }

    const slug = String(entry.slug);
    const rawQuantity = Number(entry.quantity);

    // Available stock may exclude this customer's reserved items.
    const maximum = 10;

    if (
      !catalog[slug] ||
      !Number.isFinite(rawQuantity) ||
      rawQuantity < 1
    ) {
      continue;
    }

    const quantity = Math.max(
      1,
      Math.min(maximum, Math.floor(rawQuantity)),
    );

    quantities.set(
      slug,
      Math.min(maximum, (quantities.get(slug) ?? 0) + quantity),
    );
  }

  return Array.from(quantities, ([slug, quantity]) => ({
    slug,
    quantity,
  }));
}

function sameItems(current: CartItem[], next: CartItem[]) {
  return (
    current.length === next.length &&
    current.every(
      (item, index) =>
        item.slug === next[index].slug &&
        item.quantity === next[index].quantity,
    )
  );
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);

  const [items, setItems] = useState<CartItem[]>([]);
  const [productList, setProductList] = useState<Product[]>([]);
  const [products, setProducts] = useState<ProductMap>({});
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);

  const cartHydrated = useRef(false);
  const lastFetchedAt = useRef(0);
  // Serialized rows of the last good catalog; null until one has loaded.
  const lastPayload = useRef<string | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const followUp = useRef<Promise<void> | null>(null);

  const loadCatalog = useCallback(async () => {
    const startedAt = Date.now();

    try {
      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_COLUMNS)
        .eq("is_visible", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;

      lastFetchedAt.current = startedAt;

      const payload = JSON.stringify(data ?? []);

      // Unchanged catalog: keep every array identity so no consumer re-renders
      // and the saved cart is not rewritten.
      if (payload === lastPayload.current && cartHydrated.current) {
        setProductsError(null);
        setProductsLoaded(true);
        return;
      }

      const nextProductList = (
        (data ?? []) as unknown as DatabaseProduct[]
      ).map(mapDatabaseProduct);

      const nextProducts = createProductMap(nextProductList);

      lastPayload.current = payload;
      setProductList(nextProductList);
      setProducts(nextProducts);

      if (!cartHydrated.current) {
        try {
          const savedCart = window.localStorage.getItem(STORAGE_KEY);
          const parsed = savedCart ? JSON.parse(savedCart) : [];

          setItems(sanitizeCartItems(parsed, nextProducts));
        } catch {
          setItems([]);
        }

        cartHydrated.current = true;
      } else {
        setItems((current) => {
          const next = sanitizeCartItems(current, nextProducts);
          return sameItems(current, next) ? current : next;
        });
      }

      setProductsError(null);
      setProductsLoaded(true);
    } catch {
      lastFetchedAt.current = startedAt;

      // A failed background refresh keeps the last good catalog on screen.
      // Without one, show the error; a previous error stays visible until a
      // retry succeeds, so pages never flash "not found" / "no results".
      if (lastPayload.current === null) {
        setProductsError(CATALOG_ERROR);
      }

      setProductsLoaded(true);
    }
  }, [supabase]);

  const startLoad = useCallback(() => {
    const run = loadCatalog().finally(() => {
      if (inFlight.current === run) inFlight.current = null;
    });

    inFlight.current = run;
    return run;
  }, [loadCatalog]);

  // Forced refresh (Try Again, checkout recovery). A request already in flight
  // may predate the caller's change (for example a released reservation), so
  // wait for it and fetch once more; concurrent callers share that follow-up.
  const refreshProducts = useCallback((): Promise<void> => {
    const current = inFlight.current;

    if (!current) return startLoad();

    if (!followUp.current) {
      followUp.current = current.then(() => {
        followUp.current = null;
        return startLoad();
      });
    }

    return followUp.current;
  }, [startLoad]);

  // Background revalidation: deduplicated, and skipped while the catalog is fresh.
  const revalidate = useCallback(() => {
    if (inFlight.current) return;

    if (
      lastPayload.current !== null &&
      Date.now() - lastFetchedAt.current < STALE_MS
    ) {
      return;
    }

    void startLoad();
  }, [startLoad]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      revalidate();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [pathname, revalidate]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") revalidate();
    }

    window.addEventListener("focus", revalidate);
    window.addEventListener("online", revalidate);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", revalidate);
      window.removeEventListener("online", revalidate);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, [revalidate]);

  useEffect(() => {
    if (!productsLoaded || !cartHydrated.current) return;

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // The in-memory cart remains usable.
    }
  }, [items, productsLoaded]);

  const addToCart = useCallback(
    (slug: string, quantity = 1) => {
      const maximum = getMaximumQuantity(slug, products);

      if (maximum <= 0) return;

      const safeQuantity = Math.max(
        1,
        Math.min(maximum, Math.floor(quantity)),
      );

      setItems((current) => {
        const existing = current.find((item) => item.slug === slug);

        if (!existing) {
          return [...current, { slug, quantity: safeQuantity }];
        }

        return current.map((item) =>
          item.slug === slug
            ? {
                ...item,
                quantity: Math.max(
                  item.quantity,
                  Math.min(maximum, item.quantity + safeQuantity),
                ),
              }
            : item,
        );
      });
    },
    [products],
  );

  const removeFromCart = useCallback((slug: string) => {
    setItems((current) => current.filter((item) => item.slug !== slug));
  }, []);

  const updateQuantity = useCallback(
    (slug: string, quantity: number) => {
      if (quantity <= 0) {
        setItems((current) => current.filter((item) => item.slug !== slug));
        return;
      }

      if (!Number.isFinite(quantity)) return;

      const maximum = getMaximumQuantity(slug, products);

      setItems((current) =>
        current.map((item) =>
          item.slug === slug
            ? {
                ...item,
                quantity: Math.max(
                  1,
                  Math.min(
                    Math.floor(quantity),
                    Math.max(item.quantity, maximum),
                  ),
                ),
              }
            : item,
        ),
      );
    },
    [products],
  );

  // Clear storage synchronously too, so a catalog load still in flight cannot
  // re-hydrate the purchased items from the saved cart.
  const clearCart = useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "[]");
    } catch {
      // The in-memory cart is still cleared.
    }
    setItems([]);
  }, []);

  const totalItems = useMemo(
    () => items.reduce((total, item) => total + item.quantity, 0),
    [items],
  );

  const value = useMemo(
    () => ({
      items,
      totalItems,
      productList,
      products,
      productsLoaded,
      productsError,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      refreshProducts,
    }),
    [
      items,
      totalItems,
      productList,
      products,
      productsLoaded,
      productsError,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      refreshProducts,
    ],
  );

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used inside CartProvider");
  }

  return context;
}
