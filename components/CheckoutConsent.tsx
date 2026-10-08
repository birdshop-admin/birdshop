import Link from "next/link";

// Shown next to every pay button so customers see the policies before paying.
export default function CheckoutConsent({
  className,
  verb = "checking out",
}: {
  className?: string;
  verb?: string;
}) {
  return (
    <p className={className}>
      By {verb}, you agree to our <Link href="/terms">Terms of Service</Link>{" "}
      and <Link href="/refunds">Refund Policy</Link>.
    </p>
  );
}
