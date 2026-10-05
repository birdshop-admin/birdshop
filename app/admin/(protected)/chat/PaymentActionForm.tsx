"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import type { PaymentActionResult } from "./actions";
import styles from "./AdminPaymentCenter.module.css";

const PAYMENT_FEEDBACK = "birdshop:payment-feedback";

export function PaymentFeedback({
  conversationId,
}: {
  conversationId: string;
}) {
  const [message, setMessage] = useState("");
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    function onFeedback(event: Event) {
      const detail = (
        event as CustomEvent<{ conversationId: string; message: string }>
      ).detail;
      if (detail.conversationId !== conversationId) return;
      setMessage(detail.message);
      clearTimeout(timeout);
      timeout = setTimeout(() => setMessage(""), 4500);
    }
    window.addEventListener(PAYMENT_FEEDBACK, onFeedback);
    return () => {
      window.removeEventListener(PAYMENT_FEEDBACK, onFeedback);
      clearTimeout(timeout);
    };
  }, [conversationId]);
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={message ? styles.paymentToast : styles.emptyFeedback}
    >
      {message}
    </div>
  );
}

export default function PaymentActionForm({
  action,
  className,
  children,
}: {
  action: (data: FormData) => Promise<PaymentActionResult>;
  className?: string;
  children: ReactNode;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const data = new FormData(event.currentTarget);
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const result = await action(data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.dispatchEvent(
        new CustomEvent(PAYMENT_FEEDBACK, {
          detail: {
            conversationId: String(data.get("conversation_id")),
            message: result.message,
          },
        }),
      );
    } catch {
      setError(
        "Unable to confirm the change. Check the payment status before retrying.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <form className={className} onSubmit={submit} aria-busy={pending}>
      <fieldset className={styles.paymentFields} disabled={pending}>
        {children}
      </fieldset>
      {pending && (
        <span className={styles.actionStatus} role="status">
          Updating payment…
        </span>
      )}
      {error && (
        <p className={styles.actionError} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
