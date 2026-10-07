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
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "birdshop-cart";

function normalizeGallery(row: DatabaseProduct): Product["gallery"] {
  if (Array.isArray(row.gallery) && row.gallery.length > 0) {
    return row.gallery as Product["gallery"];
  }

  const display =
    row.initials.trim() ||
    row.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join("") ||
    "BS";

  return [
    {
      id: "primary",
      label: "Product",
      display,
    },
  ] as Product["gallery"];
}

function mapDatabaseProduct(row: DatabaseProduct): Product {
  const price = Number(row.price);
  const oldPrice = row.old_price === null ? undefined : Number(row.old_price);

  return {
    slug: row.slug,
    name: row.name,
    category: row.category,
    platform: row.platform,
    region: row.region,
    price: Number.isFinite(price) ? price : 0,
    oldPrice:
      oldPrice !== undefined && Number.isFinite(oldPrice)
        ? oldPrice
        : undefined,
    badge: row.badge ?? undefined,
    stock: Math.max(0, Math.floor(Number(row.stock) || 0)),
    delivery: row.delivery,
    description: row.description,
    shortDescription: row.short_description,
    codeFormat: row.code_format,
    initials: row.initials || row.name.slice(0, 2).toUpperCase(),
    gallery: normalizeGallery(row),
  };
}

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

export function CartProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);

  const [items, setItems] = useState<CartItem[]>([]);
  const [productList, setProductList] = useState<Product[]>([]);
  const [products, setProducts] = useState<ProductMap>({});
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);

  const cartHydrated = useRef(false);

  const refreshProducts = useCallback(async () => {
    setProductsError(null);

    const { data, error } = await supabase
      .from("products")
      .select(
        [
          "id",
          "slug",
          "name",
          "category",
          "platform",
          "region",
          "price",
          "old_price",
          "badge",
          "stock",
          "delivery",
          "description",
          "short_description",
          "code_format",
          "initials",
          "gallery",
          "is_visible",
          "sort_order",
        ].join(","),
      )
      .eq("is_visible", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      setProductsError(
        "The product catalog could not load. Please refresh and retry.",
      );
      setProductsLoaded(true);
      return;
    }

    const nextProductList = (
      (data ?? []) as unknown as DatabaseProduct[]
    ).map(mapDatabaseProduct);

    const nextProducts = createProductMap(nextProductList);

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
      setItems((current) => sanitizeCartItems(current, nextProducts));
    }

    setProductsLoaded(true);
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshProducts();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [pathname, refreshProducts]);

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

  const clearCart = useCallback(() => {
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