import Link from "next/link";
import Image from "next/image";
import { SearchIcon, ArrowIcon } from "./icons";
export default function SiteHeader() {
  return (
    <>
      <div className="market-announcement">
        <span>Independent sellers. One trusted marketplace.</span>
        <span className="sandbox-label">SANDBOX · TEST PAYMENTS ONLY</span>
      </div>
      <header className="market-header">
        <Link
          className="market-brand"
          href="/"
          aria-label="BirdShop Marketplace home"
        >
          <Image src="/cremebs.png" width={42} height={42} alt="" />
          <span>
            BIRDSHOP<small>MARKETPLACE</small>
          </span>
        </Link>
        <nav aria-label="Marketplace navigation">
          <Link href="/">Explore</Link>
          <Link href="/?type=digital_product">Digital products</Link>
          <Link href="/?type=game_service">Game services</Link>
        </nav>
        <div className="market-header-actions">
          <Link href="/account" className="header-inbox">
            Account
          </Link>
          <Link href="/sell" className="header-sell">
            Start selling <ArrowIcon />
          </Link>
        </div>
      </header>
      <div className="market-searchbar">
        <form action="/" method="get">
          <SearchIcon />
          <input
            type="search"
            name="q"
            aria-label="Search marketplace"
            placeholder="Search games, products, and services"
          />
          <button type="submit">Search</button>
        </form>
        <Link href="/marketplace/orders">My orders</Link>
        <Link href="/sell/dashboard">Seller workspace</Link>
      </div>
    </>
  );
}
