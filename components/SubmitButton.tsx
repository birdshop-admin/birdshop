"use client";
import { useFormStatus } from "react-dom";
import type { ComponentProps } from "react";
export default function SubmitButton({
  disabled,
  children,
  ...props
}: ComponentProps<"button">) {
  const { pending } = useFormStatus();
  return (
    <button
      {...props}
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
    >
      {pending ? "Working…" : children}
    </button>
  );
}
