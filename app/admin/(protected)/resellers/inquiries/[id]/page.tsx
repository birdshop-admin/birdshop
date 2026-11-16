import Link from "next/link";
import { notFound } from "next/navigation";
import AdminSidebar from "@/components/AdminSidebar";
import { requireOwner } from "@/lib/staff-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { closeOwnerMarketplaceThread } from "../actions";
import styles from "../../../admin.module.css";

export const dynamic="force-dynamic";

export default async function OwnerMarketplaceConversation({params}:{params:Promise<{id:string}>}){
  const {user}=await requireOwner();
  const {id}=await params;
  if(!/^[0-9a-f-]{36}$/i.test(id))notFound();
  const db=createAdminClient();
  const {data:thread,error}=await db.from("birdshop_marketplace_threads")
    .select("id,seller_id,buyer_user_id,status").eq("id",id).maybeSingle();
  if(error||!thread)notFound();
  // Audited administrative access to private marketplace communication.
  const {error:auditError}=await db.from("birdshop_marketplace_audit").insert({
    entity_type:"marketplace_thread",entity_id:id,actor_id:user.id,
    action:"owner_viewed_messages",
  });
  if(auditError)throw new Error("Marketplace audit storage is unavailable.");
  const {data:messages,error:messagesError}=await db.from("birdshop_marketplace_messages")
    .select("id,sender_user_id,body,created_at")
    .eq("thread_id",id).order("created_at",{ascending:true}).limit(250);
  if(messagesError)throw new Error("The conversation could not be loaded.");

  return <div className={styles.page}>
    <AdminSidebar/>
    <main className={styles.content}>
      <header className={styles.topbar}>
        <div><span>OWNER ONLY / ACCESS AUDITED</span>
          <h1>Conversation review</h1>
          <p>Moderation access to private marketplace conversation · {thread.status}</p>
        </div>
        <Link href="/admin/resellers/inquiries">← All inquiries</Link>
      </header>
      <section style={{display:"grid",gap:12,marginTop:24}}>
        {!(messages||[]).length&&<p>No messages.</p>}
        {(messages||[]).map(message=><article key={message.id}
          style={{padding:16,border:"1px solid #ffffff33",background:"#090909",
            color:"#f1eee9",overflowWrap:"anywhere"}}>
          <p style={{fontSize:12,opacity:.8}}>{message.sender_user_id===thread.buyer_user_id?"Buyer":"Seller"}
            {" · "}{new Date(message.created_at).toLocaleString()}</p>
          <p style={{whiteSpace:"pre-wrap"}}>{message.body}</p>
        </article>)}
      </section>
      {thread.status==="open"&&<form action={closeOwnerMarketplaceThread}
        style={{marginTop:30}}>
        <input type="hidden" name="thread_id" value={thread.id}/>
        <button type="submit" style={{background:"#8f152a",color:"#fff",padding:"12px 20px",
          border:"1px solid #ba3c50",borderRadius:2,cursor:"pointer"}}>
          Close conversation
        </button>
      </form>}
    </main>
  </div>;
}
