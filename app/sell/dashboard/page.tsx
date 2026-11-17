import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { createAdminClient } from "@/lib/supabase/admin";
import { marketplaceMoney, MARKETPLACE_CATEGORIES, requireApprovedSeller, type MarketplaceListing } from "@/lib/marketplace";
import { archiveMyListing, changeMyListingState, saveMarketplaceListing, updateMyShop } from "./actions";
import { SellerFinancials } from "./SellerFinancials";
import { getSellerConnect, refreshSellerConnect, sellerStripeBalance } from "@/lib/stripe-connect";
import { logServerError } from "@/lib/server-config";
import styles from "@/app/marketplace/marketplace.module.css";

export const dynamic="force-dynamic";
export const metadata={title:"Seller dashboard | BirdShop"};
const noticeText:Record<string,string>={
  "connect-returned":"Your Stripe verification status has been refreshed. Review any outstanding requirements below.",
  "listing-saved":"Listing saved as a draft. Submit it for owner review before it appears publicly.",
};

export default async function SellerDashboard({searchParams}:{
  searchParams:Promise<{notice?:string;edit?:string}>;
}){
  const {profile}=await requireApprovedSeller();
  const {notice,edit}=await searchParams;
  const db=createAdminClient();
  const [listingResult,orderResult,threadResult,disputeResult]=await Promise.all([
    db.from("birdshop_marketplace_listings")
      .select("id,seller_id,slug,title,description,listing_type,category,image_url,price_cents,stock,fulfillment_method,service_options,delivery_hours,status,created_at")
      .eq("seller_id",profile.id).order("created_at",{ascending:false}).limit(200),
    db.from("birdshop_marketplace_orders")
      .select("id,state,subtotal_cents,commission_cents,commission_bps,refunded_cents,stripe_dispute_status,fraudulent,listing_title,created_at").eq("seller_id",profile.id).order("created_at",{ascending:false}).limit(20),
    db.from("birdshop_marketplace_threads")
      .select("id,status").eq("seller_id",profile.id).limit(100),
    db.from("birdshop_marketplace_disputes")
      .select("id,status").eq("seller_id",profile.id).limit(100),
  ]);
  if(listingResult.error||orderResult.error||threadResult.error||disputeResult.error)
    throw new Error("The marketplace dashboard could not load. Please try again.");
  const listings=(listingResult.data||[]) as MarketplaceListing[];
  const selected=listings.find(listing=>listing.id===edit);
  const orders=orderResult.data||[];
  let connect = await getSellerConnect(profile.id);
  let balance = null;
  let stripeUnavailable = false;
  if (connect?.stripe_account_id) {
    try {
      connect = await refreshSellerConnect(connect);
      balance = await sellerStripeBalance(connect);
    } catch (error) { stripeUnavailable = true; logServerError("seller Stripe overview", error); }
  }
  return <main className={`page-shell bs-editorial-page ${styles.shell}`} id="site-content">
    <SiteHeader/>
    <div className={styles.wrap}>
      <header className={styles.hero}>
        <span className={styles.eyebrow}>BIRDSHOP / SELLER WORKSPACE</span>
        <h1>{profile.display_name}</h1>
        <p>Prepare listings, respond to inquiries and manage your approved storefront.</p>
        <div className={styles.actions}>
          <Link className={styles.outline} href={`/shops/${profile.handle}`}>View storefront</Link>
          <Link className={styles.outline} href="/sell">Seller account</Link>
          <Link className={styles.outline} href="/marketplace">Browse marketplace</Link>
        </div>
      </header>
      <div className={styles.stack}>
        {notice&&noticeText[notice]&&<p role="status" className={styles.notice}>{noticeText[notice]}</p>}
        <SellerFinancials profile={profile} connect={connect} balance={balance}
          stripeUnavailable={stripeUnavailable} orders={orders}/>
        <section className={styles.card}>
          <h2>Manage listings</h2>
          <p>Seller listings never publish automatically. Save a draft, submit for owner moderation, then choose when to pause a published listing.</p>
          {!listings.length?<p>No listings yet. Create your first listing below.</p>:(
            <div style={{overflowX:"auto"}}>
              <table className={styles.table}>
                <thead><tr><th>Listing</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>{listings.map(listing=><tr key={listing.id}>
                  <td>{listing.title}</td><td>{marketplaceMoney(listing.price_cents)}</td>
                  <td>{listing.stock}</td><td><span className={styles.status}>{listing.status.replaceAll("_"," ")}</span></td>
                  <td>
                    <div className={styles.actions} style={{margin:0}}>
                      {listing.status!=="archived"&&<Link className={styles.outline} href={`/sell/dashboard?edit=${listing.id}#listing-editor`}>Edit</Link>}
                      {["draft","rejected","paused"].includes(listing.status)&&listing.stock>0&&
                        <form action={changeMyListingState}>
                          <input type="hidden" name="id" value={listing.id}/>
                          <button className={styles.button} name="action" value="submit">Request approval</button>
                        </form>}
                      {listing.status!=="archived"&&<form action={archiveMyListing}>
                        <input type="hidden" name="id" value={listing.id}/>
                        <button className={styles.outline} type="submit">Remove</button>
                      </form>}
                      {listing.status==="published"&&<form action={changeMyListingState}>
                        <input type="hidden" name="id" value={listing.id}/>
                        <button className={styles.outline} name="action" value="pause">Pause</button>
                      </form>}
                    </div>
                  </td>
                </tr>)}</tbody>
              </table>
            </div>
          )}
        </section>
        <div className={styles.split}>
          <section className={styles.card} id="listing-editor">
            <h2>{selected?"Edit listing":"Create a listing"}</h2>
            {selected&&<p>Editing a published listing returns it to draft, requiring new approval.</p>}
            <form action={saveMarketplaceListing}>
              {selected&&<input type="hidden" name="id" value={selected.id}/>}
              <label className={styles.label} htmlFor="listing-title">Listing title</label>
              <input className={styles.field} id="listing-title" name="title" required minLength={3} maxLength={120} defaultValue={selected?.title||""}/>
              <label className={styles.label} htmlFor="listing-kind">Listing type</label>
              <select className={styles.field} id="listing-kind" name="listing_type" defaultValue={selected?.listing_type||"game_service"}>
                <option value="game_service">Game service</option>
                <option value="digital_product">Digital product (manual seller delivery)</option>
              </select>
              <label className={styles.label} htmlFor="listing-cat">Category</label>
              <select className={styles.field} id="listing-cat" name="category" defaultValue={selected?.category||"Deepwoken"}>
                {MARKETPLACE_CATEGORIES.map(category=><option key={category} value={category}>{category}</option>)}
              </select>
              <label className={styles.label} htmlFor="listing-desc">Description and delivery requirements</label>
              <textarea className={styles.field} name="description" id="listing-desc" required minLength={20} maxLength={3000} defaultValue={selected?.description||""}/>
              <label className={styles.label} htmlFor="listing-price">Price (USD)</label>
              <input className={styles.field} id="listing-price" type="number" name="price" step=".01" min=".50" max="999999.99" required defaultValue={selected?(selected.price_cents/100).toFixed(2):""}/>
              <label className={styles.label} htmlFor="listing-stock">Available units / service slots</label>
              <input className={styles.field} id="listing-stock" type="number" name="stock" min="0" max="10000" step="1" required defaultValue={selected?.stock??1}/>
              <label className={styles.label} htmlFor="listing-hours">Estimated delivery (hours)</label>
              <input className={styles.field} id="listing-hours" type="number" name="delivery_hours" min="1" max="720" step="1" required defaultValue={selected?.delivery_hours??24}/>
              <label className={styles.label} htmlFor="listing-options">Service options (optional; one per line)</label>
              <textarea className={styles.field} id="listing-options" name="service_options" maxLength={1000}
                placeholder={"Priority delivery\nProgression help\nCoaching session"}
                defaultValue={(selected?.service_options||[]).join("\n")}/>
              <p className={styles.small}>Up to 12 options, 80 characters each. Options are informational until seller checkout supports them.</p>
              <label className={styles.label} htmlFor="listing-image">Image HTTPS URL (optional)</label>
              <input className={styles.field} id="listing-image" type="url" name="image_url" maxLength={1000} placeholder="https://..." defaultValue={selected?.image_url||""}/>
              <p className={styles.small}>Upload only images you own or have permission to use. All listings require moderation. No automatic purchases until seller checkout is approved.</p>
              <button className={styles.button} type="submit">{selected?"Save listing changes":"Save draft"}</button>
              {selected&&<Link className={styles.outline} href="/sell/dashboard" style={{marginLeft:10}}>Cancel edit</Link>}
            </form>
          </section>
          <div className={styles.stack} style={{marginTop:0}}>
            <section className={styles.card}>
              <h2>Storefront settings</h2>
              <form action={updateMyShop}>
                <label className={styles.label} htmlFor="shop-name">Display name</label>
                <input className={styles.field} id="shop-name" name="display_name" minLength={3} maxLength={90} required defaultValue={profile.display_name}/>
                <label className={styles.label} htmlFor="shop-desc">Description</label>
                <textarea className={styles.field} id="shop-desc" name="description" maxLength={1500} defaultValue={profile.description||""}/>
                <label className={styles.label} htmlFor="shop-logo">Logo HTTPS URL (optional)</label>
                <input className={styles.field} id="shop-logo" name="logo_url" type="url" maxLength={1000} defaultValue={profile.logo_url||""}/>
                <p className={styles.small}>Your storefront URL /shops/{profile.handle} cannot be changed without owner assistance.</p>
                <button className={styles.button} type="submit">Save storefront</button>
              </form>
            </section>
            <section className={styles.card}>
              <h2>Orders and inquiries</h2>
              <p>Showing {orders.length} recent marketplace orders · {threadResult.data?.length||0} private conversations · {disputeResult.data?.length||0} disputes.</p>
              <p><Link href="/sell/orders">Open seller orders and fulfillment</Link></p>
              <p><Link href="/sell/inbox">Open seller inbox</Link></p>
              <p>Create and manage every product and service here. BirdShop handles payment setup automatically; you never need to create products in Stripe.</p>
            </section>

          </div>
        </div>
      </div>
    </div>
    <SiteFooter/>
  </main>;
}
