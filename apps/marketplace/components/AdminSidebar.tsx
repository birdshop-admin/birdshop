import Link from "next/link";
export default function AdminSidebar() {
  return (
    <aside className="market-admin-sidebar">
      <Link className="footer-brand" href="/">
        BIRDSHOP<small>MARKETPLACE OPERATIONS</small>
      </Link>
      <nav aria-label="Owner navigation">
        <Link href="/admin/resellers">Sellers & listings</Link>
        <Link href="/admin/resellers/orders">Orders & earnings</Link>
        <Link href="/admin/resellers/disputes">Disputes</Link>
        <Link href="/admin/resellers/inquiries">Message oversight</Link>
        <Link href="/">Back to marketplace</Link>
        <Link href="/sell">Account & sign out</Link>
      </nav>
    </aside>
  );
}
