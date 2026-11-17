import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const owner="10000000-0000-4000-8000-000000000001", sellerUser="10000000-0000-4000-8000-000000000002", buyer="10000000-0000-4000-8000-000000000003";
const seller="20000000-0000-4000-8000-000000000001", listing="30000000-0000-4000-8000-000000000001";
test("real marketplace migrations: fees, authorization, tiers, refunds, stock and replay", async t => {
  const db=new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema private;
    create function auth.role() returns text language sql as $$select current_setting('request.jwt.claim.role',true)$$;
    create table auth.users(id uuid primary key);
    create table public.admin_users(user_id uuid primary key,is_active boolean,role text);
    insert into auth.users values('${owner}'),('${sellerUser}'),('${buyer}');
    insert into public.admin_users values('${owner}',true,'owner');
    select set_config('request.jwt.claim.role','service_role',false);`);
  const foundation=readFileSync("supabase/migrations/20261004190000_service_payment_foundation.sql","utf8");
  const start=foundation.indexOf("create or replace function private.birdshop_require_server()");
  const end=foundation.indexOf("create or replace function public.birdshop_rate_limit",start);
  await db.exec(foundation.slice(start,end));
  for(const name of readdirSync("supabase/migrations").filter(f=>/marketplace_(phase1_foundation|transaction_safety|connect_tiers)\.sql$/.test(f)).sort())
    await db.exec(readFileSync(`supabase/migrations/${name}`,"utf8"));
  async function q(sql:string,params:unknown[]=[]){return (await db.query<Record<string,unknown>>(sql,params)).rows;}
  await db.exec(`insert into birdshop_seller_applications(id,user_id,contact_email,business_name,requested_handle,description,categories,payout_preference)
    values('${seller}','${sellerUser}','seller@example.test','Test seller','test-seller',repeat('a',40),array['Digital Goods'],'bank');`);
  await t.test("approval requires owner and every new seller starts Starter at 8%",async()=>{
    await assert.rejects(()=>q(`select birdshop_review_seller_application($1,'approved',$2)`,[seller,buyer]),/Owner approval/);
    await q(`select birdshop_review_seller_application($1,'approved',$2)`,[seller,owner]);
    const rows=await q(`select * from birdshop_seller_profiles where user_id=$1`,[sellerUser]);
    const actual=String(rows[0].id);
    // Stable fixture ID, not a production financial mutation.
    await q(`update birdshop_seller_profiles set id=$1 where id=$2`,[seller,actual]);
    assert.equal(rows[0].commission_bps,800); assert.equal(rows[0].earned_tier,"starter");
  });
  await db.exec(`insert into birdshop_marketplace_listings(id,seller_id,slug,title,description,listing_type,category,price_cents,stock,fulfillment_method,delivery_hours,status)
    values('${listing}','${seller}','test-item','Approved product',repeat('a',30),'digital_product','Digital Goods',10000,10,'seller_manual',24,'published');`);
  await t.test("country and Connect ownership are immutable, users cannot call privileged RPCs",async()=>{
    await assert.rejects(()=>q(`select birdshop_prepare_connect($1,$2,'CA','seller@example.test')`,[seller,buyer]),/ownership/);
    const first=await q(`select * from birdshop_prepare_connect($1,$2,'CA','seller@example.test')`,[seller,sellerUser]);
    const second=await q(`select * from birdshop_prepare_connect($1,$2,'CA','changed@example.test')`,[seller,sellerUser]);
    assert.equal(first[0].creation_key,second[0].creation_key);
    assert.deepEqual(first[0].creation_payload,second[0].creation_payload);
    await assert.rejects(()=>q(`select birdshop_prepare_connect($1,$2,'US','seller@example.test')`,[seller,sellerUser]),/immutable/);
    await db.exec(`set role authenticated`);
    await assert.rejects(()=>q(`select * from birdshop_seller_connect_accounts`),/permission denied/);
    await assert.rejects(()=>q(`select birdshop_owner_seller_pricing($1,$2,true,0)`,[owner,seller]),/permission denied/);
    await db.exec(`reset role`);
    await db.exec(`select set_config('request.jwt.claim.role','authenticated',false)`);
    await assert.rejects(()=>q(`select birdshop_owner_seller_pricing($1,$2,true,0)`,[owner,seller]),/Server authorization/);
    await db.exec(`select set_config('request.jwt.claim.role','service_role',false)`);
  });
  await db.exec(`update birdshop_seller_connect_accounts set stripe_account_id='acct_sandboxFixture',transfers_status='active' where seller_id='${seller}';`);
  const key="40000000-0000-4000-8000-000000000001";
  const reserve=()=>q(`select * from birdshop_reserve_marketplace_checkout($1,$2,1,$3)`,[buyer,listing,key]);
  let order="";
  await t.test("trusted snapshots and idempotent stock reservation; self-purchase and overselling fail",async()=>{
    const [row]=await reserve(); order=String(row.id);
    assert.equal(Number(row.subtotal_cents),10000);assert.equal(Number(row.commission_cents),800);
    assert.equal((await reserve())[0].id,order);
    assert.equal((await q(`select stock from birdshop_marketplace_listings where id=$1`,[listing]))[0].stock,9);
    await assert.rejects(()=>q(`select birdshop_reserve_marketplace_checkout($1,$2,10,gen_random_uuid())`,[buyer,listing]),/unavailable/);
    await assert.rejects(()=>q(`select birdshop_reserve_marketplace_checkout($1,$2,1,gen_random_uuid())`,[sellerUser,listing]),/self-purchase/);
    await assert.rejects(()=>q(`select birdshop_reserve_marketplace_checkout($1,$2,2,$3)`,[buyer,listing,key]),/key already used/);
    await assert.rejects(()=>q(`update birdshop_marketplace_orders set commission_cents=1 where id=$1`,[order]),/immutable/);
    await assert.rejects(()=>q(`insert into birdshop_marketplace_orders(listing_id,buyer_user_id,seller_id,quantity,subtotal_cents,commission_bps,commission_cents)
      values($1,$2,$3,1,10000,1,1)`,[listing,buyer,seller]),/fee snapshot/);
  });
  await t.test("suspension and incomplete Connect prohibit transactions",async()=>{
    await q(`update birdshop_seller_profiles set status='suspended' where id=$1`,[seller]);
    await assert.rejects(()=>q(`select birdshop_reserve_marketplace_checkout($1,$2,1,gen_random_uuid())`,[buyer,listing]),/Seller unavailable/);
    await q(`update birdshop_seller_profiles set status='active' where id=$1`,[seller]);
    await q(`update birdshop_seller_connect_accounts set transfers_status='restricted' where seller_id=$1`,[seller]);
    await assert.rejects(()=>q(`select birdshop_reserve_marketplace_checkout($1,$2,1,gen_random_uuid())`,[buyer,listing]),/onboarding incomplete/);
    await q(`update birdshop_seller_connect_accounts set transfers_status='active' where seller_id=$1`,[seller]);
  });
  async function charge(id:string,event:string,amount=10000,fee=800,refund=0,fraud=false,dispute:string|null=null){
    await q(`select birdshop_apply_marketplace_charge($1,$2,$3,$4,$5,'usd','acct_sandboxFixture',$6,$7,$8,$9,true)`,
      [id,event,`ch_${id}`,`pi_${id}`,amount,fee,refund,fraud,dispute]);
  }
  await t.test("provider verification is required; webhook replay is idempotent and amount mismatches fail",async()=>{
    await assert.rejects(()=>q(`select birdshop_marketplace_transition_order($1,'payment_pending','paid',null,'system','fake:event:123456')`,[order]),/evidence/);
    await assert.rejects(()=>charge(order,"evt_wrongAmount",9999),/does not match/);
    await charge(order,"evt_paidFirst");await charge(order,"evt_paidFirst");
    assert.equal((await q(`select count(*)::int as n from birdshop_marketplace_stripe_receipts`))[0].n,1);
    assert.equal((await q(`select state from birdshop_marketplace_orders where id=$1`,[order]))[0].state,"paid");
  });
  async function complete(id:string){
    const states=[['paid','fulfillment_pending',sellerUser,'seller'],['fulfillment_pending','delivered',sellerUser,'seller'],
      ['delivered','buyer_confirmed',buyer,'buyer'],['buyer_confirmed','completed',owner,'owner']];
    for(const [from,to,user,role] of states)await q(`select birdshop_marketplace_transition_order($1,$2,$3,$4,$5,$6,'Verified delivery note')`,[id,from,to,user,role,`test:${id}:${to}`]);
  }
  await t.test("pending, unpaid, paid and fraudulent orders do not qualify",async()=>{
    assert.equal(Number((await q(`select qualifying_sales_cents from birdshop_seller_profiles where id=$1`,[seller]))[0].qualifying_sales_cents),0);
    await complete(order);
    assert.equal(Number((await q(`select qualifying_sales_cents from birdshop_seller_profiles where id=$1`,[seller]))[0].qualifying_sales_cents),10000);
    await charge(order,"evt_fraud",10000,800,0,true);
    assert.equal(Number((await q(`select qualifying_sales_cents from birdshop_seller_profiles where id=$1`,[seller]))[0].qualifying_sales_cents),0);
  });
  let qualified="";
  await t.test("exact Bronze threshold; partial refunds reduce volume without downgrading earned tiers",async()=>{
    await q(`update birdshop_marketplace_listings set price_cents=50000 where id=$1`,[listing]);
    const [o]=await q(`select * from birdshop_reserve_marketplace_checkout($1,$2,1,gen_random_uuid())`,[buyer,listing]);qualified=String(o.id);
    await charge(qualified,"evt_threshold",50000,4000);await complete(qualified);
    let [s]=await q(`select * from birdshop_seller_profiles where id=$1`,[seller]);
    assert.equal(s.earned_tier,"bronze"); assert.equal(s.commission_bps,700);
    await charge(qualified,"evt_partial",50000,4000,10000);
    [s]=await q(`select * from birdshop_seller_profiles where id=$1`,[seller]);
    assert.equal(Number(s.qualifying_sales_cents),40000);assert.equal(s.earned_tier,"bronze");
    await charge(qualified,"evt_oldRefund",50000,4000,0);
    assert.equal(Number((await q(`select refunded_cents from birdshop_marketplace_orders where id=$1`,[qualified]))[0].refunded_cents),10000);
    assert.equal(Number((await q(`select amount_cents from birdshop_marketplace_ledger where order_id=$1`,[qualified]))[0].amount_cents),36800);
  });
  await t.test("disputes and full refunds remove qualification; tiers never auto-promote to Partner",async()=>{
    await charge(qualified,"evt_dispute",50000,4000,10000,false,"needs_response");
    assert.equal(Number((await q(`select qualifying_sales_cents from birdshop_seller_profiles where id=$1`,[seller]))[0].qualifying_sales_cents),0);
    await charge(qualified,"evt_won",50000,4000,10000,false,"won");
    assert.equal(Number((await q(`select qualifying_sales_cents from birdshop_seller_profiles where id=$1`,[seller]))[0].qualifying_sales_cents),40000);
    await charge(qualified,"evt_fullRefund",50000,4000,50000);
    assert.equal((await q(`select state from birdshop_marketplace_orders where id=$1`,[qualified]))[0].state,"refunded");
    assert.equal(Number((await q(`select qualifying_sales_cents from birdshop_seller_profiles where id=$1`,[seller]))[0].qualifying_sales_cents),0);
    await q(`update birdshop_marketplace_listings set price_cents=250000 where id=$1`,[listing]);
    const [silverOrder]=await q(`select * from birdshop_reserve_marketplace_checkout($1,$2,1,gen_random_uuid())`,[buyer,listing]);
    await charge(String(silverOrder.id),"evt_silverThreshold",250000,17500);await complete(String(silverOrder.id));
    const [silverSeller]=await q(`select * from birdshop_seller_profiles where id=$1`,[seller]);
    assert.equal(silverSeller.earned_tier,"silver");assert.equal(silverSeller.commission_bps,600);
    await q(`update birdshop_marketplace_listings set price_cents=1000000 where id=$1`,[listing]);
    const [o]=await q(`select * from birdshop_reserve_marketplace_checkout($1,$2,1,gen_random_uuid())`,[buyer,listing]);
    await charge(String(o.id),"evt_gold",1000000,60000);await complete(String(o.id));
    const [s]=await q(`select * from birdshop_seller_profiles where id=$1`,[seller]);
    assert.equal(s.earned_tier,"gold");assert.equal(s.commission_bps,500);assert.equal(s.partner_approved,false);
    // Historical fee did not change when the seller earned Gold.
    assert.equal(Number((await q(`select commission_bps from birdshop_marketplace_orders where id=$1`,[o.id]))[0].commission_bps),600);
  });
  await t.test("owner-only Partner and override, including zero and clearing an override",async()=>{
    await assert.rejects(()=>q(`select birdshop_owner_seller_pricing($1,$2,true,0)`,[buyer,seller]),/Owner approval/);
    await q(`select birdshop_owner_seller_pricing($1,$2,true,null)`,[owner,seller]);
    assert.equal((await q(`select commission_bps from birdshop_seller_profiles where id=$1`,[seller]))[0].commission_bps,400);
    await q(`select birdshop_owner_seller_pricing($1,$2,true,0)`,[owner,seller]);
    assert.equal((await q(`select commission_bps from birdshop_seller_profiles where id=$1`,[seller]))[0].commission_bps,0);
    await q(`select birdshop_owner_seller_pricing($1,$2,false,null)`,[owner,seller]);
    assert.equal((await q(`select commission_bps from birdshop_seller_profiles where id=$1`,[seller]))[0].commission_bps,500);
  });
  await t.test("expired checkout restores reserved inventory once; cancellation cannot race a live session",async()=>{
    const [o]=await q(`select * from birdshop_reserve_marketplace_checkout($1,$2,1,gen_random_uuid())`,[buyer,listing]);
    await assert.rejects(()=>q(`select birdshop_marketplace_transition_order($1,'payment_pending','cancelled',$2,'buyer','buyer:cancel:123456')`,[o.id,buyer]),/Expire the Stripe checkout/);
    const before=Number((await q(`select stock from birdshop_marketplace_listings where id=$1`,[listing]))[0].stock);
    await q(`select birdshop_expire_marketplace_checkout($1)`,[o.id]);await q(`select birdshop_expire_marketplace_checkout($1)`,[o.id]);
    assert.equal(Number((await q(`select stock from birdshop_marketplace_listings where id=$1`,[listing]))[0].stock),before+1);
  });
  await t.test("catalog security: RLS enabled and privileged RPCs inaccessible to public roles",async()=>{
    const rows=await q(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r' and c.relname like 'birdshop_%' and c.relname<>'admin_users' and not c.relrowsecurity`);
    assert.equal(rows.length,0);
    const functions=await q(`select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.prosecdef and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute'))`);
    assert.equal(functions.length,0);
  });
  await db.close();
});
