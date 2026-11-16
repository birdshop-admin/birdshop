import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { createAdminClient } from "@/lib/supabase/admin";
import { MARKETPLACE_CATEGORIES, marketplaceMoney, type MarketplaceListing, type SellerProfile } from "@/lib/marketplace";
import styles from "./marketplace.module.css";

export const dynamic="force-dynamic";
export const metadata={title:"Marketplace | BirdShop"};

export default async function MarketplacePage({
  searchParams,
}:{searchParams:Promise<{category?:string;q?:string}>}){
  const {category,q}=await searchParams;
  const filter=category&&MARKETPLACE_CATEGORIES.includes(category as typeof MARKETPLACE_CATEGORIES[number])?category:"";
  const query=String(q||"").trim().slice(0,80).toLowerCase();
  const db=createAdminClient();
  const {data:sellers,error:sellerError}=await db.from("birdshop_seller_profiles")
    .select("id,user_id,handle,display_name,description,logo_url,status,commission_bps")
    .eq("status","active").limit(200);
  if(sellerError)throw new Error("The marketplace is temporarily unavailable.");
  const approved=(sellers||[]) as SellerProfile[];
  let listings:MarketplaceListing[]=[];
  if(approved.length){
    let request=db.from("birdshop_marketplace_listings")
      .select("id,seller_id,slug,title,description,listing_type,category,image_url,price_cents,stock,fulfillment_method,delivery_hours,status,created_at")
      .eq("status","published").in("seller_id",approved.map(s=>s.id))
      .order("created_at",{ascending:false}).limit(200);
    if(filter)request=request.eq("category",filter);
    const {data,error}=await request;
    if(error)throw new Error("Marketplace listings could not load.");
    listings=(data||[]) as MarketplaceListing[];
  }
  if(query)listings=listings.filter(l=>(l.title+" "+l.description+" "+l.category).toLowerCase().includes(query));

  return <main className={`page-shell bs-editorial-page ${styles.shell}`} id="site-content">
    <SiteHeader/>
    <div className={styles.wrap}>
      <header className={styles.hero}>
        <span className={styles.eyebrow}>BIRDSHOP / VERIFIED RESELLERS</span>
        <h1>The marketplace.</h1>
        <p>Independent sellers, owner-reviewed listings, and private communication. Seller checkout and payouts are being prepared separately; never pay a seller outside an approved BirdShop order.</p>
        <div className={styles.actions}>
          <Link href="/sell" className={styles.button}>Become a seller</Link>
          <Link href="/sell/dashboard" className={styles.outline}>Seller dashboard</Link>
        </div>
      </header>
      <div className={styles.stack}>
        <section className={styles.card}>
          <h2>Browse approved listings</h2>
          <form method="get" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,220px),1fr))",gap:12,alignItems:"end"}}>
            <div>
              <label className={styles.label} htmlFor="market-q">Search</label>
              <input className={styles.field} id="market-q" type="search" name="q" maxLength={80} defaultValue={query} placeholder="Games, services and products"/>
            </div>
            <div>
              <label className={styles.label} htmlFor="market-category">Category</label>
              <select className={styles.field} id="market-category" name="category" defaultValue={filter}>
                <option value="">All categories</option>
                {MARKETPLACE_CATEGORIES.map(item=><option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <button className={styles.button} type="submit">Apply filters</button>
          </form>
        </section>
        <section>
          <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
            <h2 style={{font:"italic 39px Georgia,serif"}}>Recently approved</h2>
            <p style={{fontSize:13,color:"#bcb4ae"}}>{listings.length} listing{listings.length===1?"":"s"}</p>
          </div>
          {!listings.length&&<div className={styles.card}>
            <h3>No listings available yet.</h3>
            <p>Listings appear here after an approved seller submits them and BirdShop's owner reviews them. No fabricated inventory or seller ratings are displayed.</p>
          </div>}
          <div className={styles.grid}>
            {listings.map(listing=>{
              const seller=approved.find(s=>s.id===listing.seller_id);
              return <article key={listing.id} className={styles.card}>
                {listing.image_url ? <div className={styles.thumb} role="img" aria-label={listing.title}
                  style={{backgroundImage:`linear-gradient(0deg,#0008,transparent),url("${listing.image_url}")`,backgroundSize:"cover",backgroundPosition:"center"}}/>
                  : <div className={styles.thumb} aria-hidden="true"/>}
                <p className={styles.meta}>{listing.category} / {listing.listing_type.replace("_"," ")}</p>
                <h3 className={styles.itemTitle}>{listing.title}</h3>
                <p>By <Link href={`/shops/${seller?.handle}`}>{seller?.display_name||"Approved seller"}</Link></p>
                <p>{listing.description.slice(0,150)}{listing.description.length>150?"…":""}</p>
                <p className={styles.price}>{marketplaceMoney(listing.price_cents)}</p>
                <p className={styles.small}>{listing.stock} available · Estimated delivery {listing.delivery_hours}h</p>
                <div className={styles.actions}>
                  <Link className={styles.outline} href={`/shops/${seller?.handle}`}>View seller</Link>
                  <Link className={styles.button} href={`/marketplace/inquire/${listing.id}`}>Ask seller</Link>
                </div>
              </article>;
            })}
          </div>
        </section>
        <div className={styles.card}>
          <h2>About buyer protection</h2>
          <p>Listings are reviewed before publication. Buyer messaging is available for product questions, but marketplace purchasing and automated seller payout are not enabled yet. Do not send passwords, gift-card codes, cryptocurrency, or off-platform payments to sellers.</p>
        </div>
      </div>
    </div>
    <SiteFooter/>
  </main>;
}
