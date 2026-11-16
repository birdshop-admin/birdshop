import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMarketplaceUser } from "@/lib/marketplace";
import { closeMarketplaceThread, sendMarketplaceMessage } from "../actions";
import styles from "@/app/marketplace/marketplace.module.css";

export const dynamic="force-dynamic";
export const metadata={title:"Marketplace conversation | BirdShop"};

export default async function MarketplaceConversation({
  params,
}:{params:Promise<{id:string}>}){
  const user=await requireMarketplaceUser();
  const {id}=await params;
  if(!/^[0-9a-f-]{36}$/i.test(id))notFound();
  const db=createAdminClient();
  const {data:thread,error}=await db.from("birdshop_marketplace_threads")
    .select("id,buyer_user_id,seller_id,listing_id,status,created_at")
    .eq("id",id).maybeSingle();
  if(error||!thread)notFound();
  const {data:seller}=await db.from("birdshop_seller_profiles")
    .select("id,user_id,handle,display_name,status").eq("id",thread.seller_id).maybeSingle();
  if(!seller)notFound();
  const buyer=thread.buyer_user_id===user.id;
  const isSeller=seller.user_id===user.id&&seller.status==="active";
  if(!buyer&&!isSeller)notFound();

  const [{data:messages,error:messagesError},{data:listing}]=await Promise.all([
    db.from("birdshop_marketplace_messages")
      .select("id,sender_user_id,body,created_at")
      .eq("thread_id",id).order("created_at",{ascending:true}).limit(200),
    thread.listing_id?db.from("birdshop_marketplace_listings")
      .select("title").eq("id",thread.listing_id).maybeSingle()
      :Promise.resolve({data:null}),
  ]);
  if(messagesError)throw new Error("Messages are temporarily unavailable.");
  return <main className={`page-shell bs-editorial-page ${styles.shell}`} id="site-content">
    <SiteHeader/>
    <div className={styles.wrap}>
      <header className={styles.hero}>
        <span className={styles.eyebrow}>BIRDSHOP / PRIVATE INQUIRY</span>
        <h1>Conversation.</h1>
        <p>{listing?.title||"Marketplace inquiry"} · {buyer?"Seller: "+seller.display_name:"Buyer inquiry"}</p>
        <div className={styles.actions}>
          <Link className={styles.outline} href={buyer?"/marketplace/messages":"/sell/inbox"}>Back to inbox</Link>
        </div>
      </header>
      <div className={styles.stack}>
        <section className={styles.card}>
          <h2>Messages</h2>
          <p className={styles.small}>Only the buyer, approved seller and authorized BirdShop administrators may access this conversation. Do not share codes, account passwords or payment details.</p>
          <div style={{display:"grid",gap:14,margin:"26px 0"}}>
            {!(messages||[]).length&&<p>No messages yet.</p>}
            {(messages||[]).map(message=><div key={message.id}
              style={{maxWidth:"min(100%,760px)",
                marginLeft:message.sender_user_id===user.id?"auto":0,
                background:message.sender_user_id===user.id?"#190b11":"#111",
                border:"1px solid #ffffff25",padding:"14px 17px"}}>
              <small className={styles.meta}>
                {message.sender_user_id===user.id?"You":buyer?"Seller":"Buyer"} · {new Date(message.created_at).toLocaleString()}
              </small>
              <p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",marginBottom:0}}>{message.body}</p>
            </div>)}
          </div>
          {thread.status==="open"?<div>
            <form action={sendMarketplaceMessage}>
              <input type="hidden" name="thread_id" value={thread.id}/>
              <label className={styles.label} htmlFor="market-thread-message">Reply to this conversation</label>
              <textarea className={styles.field} id="market-thread-message" name="message" maxLength={4000} required/>
              <div className={styles.actions}><button className={styles.button} type="submit">Send reply</button></div>
            </form>
            <form action={closeMarketplaceThread} style={{marginTop:20}}>
              <input type="hidden" name="thread_id" value={thread.id}/>
              <button className={styles.outline} type="submit">Close conversation</button>
            </form>
          </div>:<p className={styles.notice}>This conversation has been closed.</p>}
        </section>
      </div>
    </div>
    <SiteFooter/>
  </main>;
}
