import Link from "next/link";
import { ArrowIcon } from "./icons";
export default function SiteFooter() {
  return (
    <footer className="market-footer">
      <div>
        <Link className="footer-brand" href="/">
          BIRDSHOP <span>MARKETPLACE</span>
        </Link>
        <p>Good games. Great people. Your next find.</p>
        <small>
          Sandbox environment. Real payments and seller payouts are disabled.
        </small>
      </div>
      <nav aria-label="Marketplace footer">
        <Link href="/">Explore marketplace</Link>
        <Link href="/sell">Become a seller</Link>
        <Link href="/marketplace/orders">Your orders</Link>
        <Link href="https://birdshop.store">
          Official BirdShop store <ArrowIcon />
        </Link>
        <Link href="/admin/resellers">Marketplace administration</Link>
      </nav>
      <div className="market-footer-bottom">
        © {new Date().getFullYear()} BirdShop.{" "}
        <span>Independent sellers · Secure Stripe checkout</span>
      </div>
    </footer>
  );
}
