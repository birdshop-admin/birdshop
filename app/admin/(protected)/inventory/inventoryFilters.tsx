"use client";

import {
  useOptimistic,
  useTransition,
} from "react";

import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";

import styles from "./inventory.module.css";

type FilterProduct = {
  id: string;
  name: string;
};

type InventoryFiltersProps = {
  products: FilterProduct[];
  initialProduct: string;
  initialStatus: string;
};

export default function InventoryFilters({
  products,
  initialProduct,
  initialStatus,
}: InventoryFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams =
    useSearchParams();

  const [
    product,
    setOptimisticProduct,
  ] = useOptimistic(
    initialProduct
  );

  const [
    status,
    setOptimisticStatus,
  ] = useOptimistic(
    initialStatus
  );

  const [
    isPending,
    startTransition,
  ] = useTransition();

  function updateFilter(
    name:
      | "product"
      | "status",
    value: string
  ) {
    const params =
      new URLSearchParams(
        searchParams.toString()
      );

    if (value) {
      params.set(
        name,
        value
      );
    } else {
      params.delete(
        name
      );
    }

    params.delete(
      "message"
    );

    params.delete(
      "tone"
    );

    const query =
      params.toString();

    startTransition(
      () => {
        if (
          name ===
          "product"
        ) {
          setOptimisticProduct(
            value
          );
        } else {
          setOptimisticStatus(
            value
          );
        }

        router.replace(
          query
            ? `${pathname}?${query}`
            : pathname,
          {
            scroll: false,
          }
        );
      }
    );
  }

  return (
    <div
      className={
        styles.filters
      }
      aria-busy={
        isPending
      }
    >
      <label>
        <span>
          PRODUCT
        </span>

        <select
          value={
            product
          }
          onChange={(
            event
          ) => {
            updateFilter(
              "product",
              event.target.value
            );
          }}
        >
          <option value="">
            All Products
          </option>

          {products.map(
            (
              item
            ) => (
              <option
                key={
                  item.id
                }
                value={
                  item.id
                }
              >
                {
                  item.name
                }
              </option>
            )
          )}
        </select>
      </label>

      <label>
        <span>
          STATUS
        </span>

        <select
          value={
            status
          }
          onChange={(
            event
          ) => {
            updateFilter(
              "status",
              event.target.value
            );
          }}
        >
          <option value="">
            All Statuses
          </option>

          <option value="available">
            Available
          </option>

          <option value="reserved">
            Reserved
          </option>

          <option value="sold">
            Sold
          </option>

          <option value="disabled">
            Disabled
          </option>
        </select>
      </label>
    </div>
  );
}
