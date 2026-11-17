import Link from "next/link";
import { ArrowIcon, ShieldIcon, GridIcon } from "@/components/icons";
import { createAdminClient } from "@/lib/supabase/admin";
import { MARKETPLACE_CATEGORIES, marketplaceMoney, type MarketplaceListing, type SellerProfile } from "@/lib/marketplace";
import styles from "./marketplace.module.css";

export const dynamic="force-dynamic";
export const metadata={title:"Marketplace | BirdShop"};

export default async function MarketplacePage({
  searchParams,
}:{searchParams:Promise<{category?:string;q?:string;type?:string;sort?:string;available?:string}>}){
  const {category,q,type,sort,available}=await searchParams;
  const kind=["digital_product","game_service"].includes(type||"")?type:"";
  const ordering=["price_low","price_high"].includes(sort||"")?sort:"newest";
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
      .select("id,seller_id,slug,title,description,listing_type,category,image_url,price_cents,stock,fulfillment_method,service_options,delivery_hours,status,created_at")
      .eq("status","published").in("seller_id",approved.map(s=>s.id))
      .order(ordering==="newest"?"created_at":"price_cents",{ascending:ordering==="price_low"}).limit(200);
    if(filter)request=request.eq("category",filter);
    if(kind)request=request.eq("listing_type",kind);
    if(available==="true")request=request.gt("stock",0);
    const {data,error}=await request;
    if(error)throw new Error("Marketplace listings could not load.");
    listings=(data||[]) as MarketplaceListing[];
  }
  if(query)listings=listings.filter(l=>(l.title+" "+l.description+" "+l.category).toLowerCase().includes(query));

  return <main className={`page-shell bs-editorial-page ${styles.shell}`} id="site-content">

    <div className={styles.wrap}>
      <header className="explore-hero">
        <div><span className={styles.eyebrow}>A NEW WAY TO PLAY</span>
          <h1>Your next great{" "}<br/><em>find starts here.</em></h1>
          <p>Digital finds. Expert help. Independent sellers.<br/>Discover what moves your game forward.</p>
          <div className={styles.actions}><a className={styles.button} href="#browse-listings">Explore the marketplace <ArrowIcon/></a><Link className={styles.outline} href="/sell">Become a seller</Link></div>
        </div>
        <aside className="hero-editorial"><div className="hero-orbit" aria-hidden="true"/><span className="editorial-kicker">THE BIRDSHOP COLLECTIVE</span><p>Built for players.<br/><em>Powered by people.</em></p><div className="hero-caption"><ShieldIcon/><span>Owner-reviewed listings.<br/>A more personal marketplace.</span></div></aside>
      </header>
      <div className="market-trust"><span><ShieldIcon/> Owner-approved sellers</span><span><GridIcon/> Digital products & game services</span><span><ArrowIcon/> Secure checkout with Stripe</span></div>
      <nav className="category-rail" aria-label="Game categories"><Link href="/" aria-current={!filter?"page":undefined}>All games</Link>{MARKETPLACE_CATEGORIES.map(c=><Link key={c} href={`/?category=${encodeURIComponent(c)}`} aria-current={filter===c?"page":undefined}>{c}</Link>)}</nav>
      <div className={styles.stack}>
        <section className={`${styles.card} catalog-controls`} id="browse-listings">
          <div className="section-heading"><div><span className={styles.eyebrow}>CURATED BY BIRDSHOP</span><h2>Find your next advantage.</h2></div><p>{listings.length} approved listing{listings.length===1?"":"s"}</p></div>
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
            <div><label className={styles.label} htmlFor="market-type">Listing type</label><select className={styles.field} name="type" id="market-type" defaultValue={kind}><option value="">Products & services</option><option value="digital_product">Digital products</option><option value="game_service">Game services</option></select></div>
            <div><label className={styles.label} htmlFor="market-sort">Sort by</label><select className={styles.field} name="sort" id="market-sort" defaultValue={ordering}><option value="newest">Recently approved</option><option value="price_low">Price: low to high</option><option value="price_high">Price: high to low</option></select></div>
            <label className="availability-filter"><input type="checkbox" name="available" value="true" defaultChecked={available==="true"}/> In stock only</label>
            <button className={styles.button} type="submit">Apply filters</button>
          </form>
        </section>
        <section>
          <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
            <h2 style={{font:"italic 39px Georgia,serif"}}>Recently approved</h2>
            <p style={{fontSize:13,color:"#bcb4ae"}}>{listings.length} listing{listings.length===1?"":"s"}</p>
          </div>
          {!listings.length&&<div className={styles.card}>
            <h3>Your next find is on its way.</h3>
            <p>Listings appear here after an approved seller submits them and BirdShop&apos;s owner reviews them. Check back soon or explore another category.</p>
          </div>}
          <div className={styles.grid}>
            {listings.map(listing=>{
              const seller=approved.find(s=>s.id===listing.seller_id);
              return <article key={listing.id} className={`${styles.card} listing-card`}>
                {listing.image_url ? <div className={styles.thumb} role="img" aria-label={listing.title}
                  style={{backgroundImage:`linear-gradient(0deg,#0008,transparent),url("${listing.image_url}")`,backgroundSize:"cover",backgroundPosition:"center"}}/>
                  : <div className={`${styles.thumb} listing-placeholder`} aria-hidden="true"><GridIcon/><span>{listing.category}</span></div>}
                <p className={styles.meta}>{listing.category} / {listing.listing_type.replace("_"," ")}</p>
                <h3 className={styles.itemTitle}>{listing.title}</h3>
                <p>By <Link href={`/shops/${seller?.handle}`}>{seller?.display_name||"Approved seller"}</Link></p>
                <p>{listing.description.slice(0,150)}{listing.description.length>150?"…":""}</p>
                {listing.service_options?.length>0&&<p className={styles.small}>Options: {listing.service_options.join(" · ")}</p>}
                <p className={`${styles.price} listing-price`}>{marketplaceMoney(listing.price_cents)}</p>
                <p className={styles.small}>{listing.stock} available · Estimated delivery {listing.delivery_hours}h</p>
                <div className={styles.actions}>
                  <Link className={styles.outline} href={`/shops/${seller?.handle}`}>View seller</Link>
                  <Link className={styles.button} href={`/marketplace/checkout/${listing.id}`}>Buy now</Link>
                  <Link className={styles.outline} href={`/marketplace/inquire/${listing.id}`}>Ask seller</Link>
                </div>
              </article>;
            })}
          </div>
        </section>
        <div className={styles.card}>
          <h2>A better experience, from discovery to delivery.</h2>
          <p>Listings are reviewed before publication. Buyer messaging is available for product questions, and sandbox purchasing is available when enabled for testing. Do not send passwords, gift-card codes, cryptocurrency, or off-platform payments to sellers.</p>
        </div>
      </div>
    </div>

  </main>;
}
