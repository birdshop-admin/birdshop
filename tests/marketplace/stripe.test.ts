import { test, mock } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import type Stripe from "stripe";
import { getStripe, getMarketplaceStripe } from "../../lib/stripe";
import { commissionAmount, tierProgress } from "../../lib/seller-tiers";
import { ensureSellerConnect, createSellerAccountLink, refreshSellerConnect, type ConnectMapping } from "../../lib/stripe-connect";
import { marketplaceSessionParams, processMarketplaceStripeEvent, startMarketplaceCheckout, synchronizeMarketplaceCharge } from "../../lib/marketplace-payments";
import { POST as thinWebhook } from "../../app/api/stripe/connect/webhook/route";

test("commission integer rounding and tier milestones",()=>{
  assert.equal(commissionAmount(10000,800),800);assert.equal(commissionAmount(1,5000),1);
  assert.equal(commissionAmount(101,700),7);assert.equal(commissionAmount(10000,0),0);
  assert.throws(()=>commissionAmount(1.5,800));assert.throws(()=>commissionAmount(100,Infinity));
  assert.equal(tierProgress("starter",49999).remaining,1);
  assert.equal(tierProgress("bronze",50000).next?.key,"silver");
  assert.equal(tierProgress("silver",250000).next?.key,"gold");
  assert.equal(tierProgress("gold",100000000).next,null);
  assert.equal(tierProgress("gold",0,true).current.key,"partner");
  assert.equal(tierProgress("bronze",0).percent,0);
});
test("Stripe integration contract, ownership, thin signatures, inline prices and sandbox",async t=>{
  process.env.STRIPE_SECRET_KEY="sk_test_local_only";
  process.env.STRIPE_CONNECT_WEBHOOK_SECRET="whsec_local_only";
  process.env.STRIPE_CONNECT_ALLOWED_COUNTRIES="CA,GB";
  process.env.BIRDSHOP_SITE_URL="https://birdshop.example.test";
  const sellerId="20000000-0000-4000-8000-000000000001", userId="10000000-0000-4000-8000-000000000002";
  const mapping:ConnectMapping={seller_id:sellerId,stripe_account_id:null,country:"CA",creation_key:"creation_fixture",
    creation_started_at:new Date().toISOString(),creation_payload:{display_name:"Actual BirdShop seller",contact_email:"seller@example.test"},
    transfers_status:"pending",closed:false,requirements:[],future_requirements:[]};
  const orderFixture={id:"40000000-0000-4000-8000-000000000001",listing_id:"30000000-0000-4000-8000-000000000001",seller_id:sellerId,
    buyer_user_id:userId,quantity:1,subtotal_cents:10000,commission_bps:800,commission_cents:800,currency:"usd",
    stripe_destination:"acct_fixtureOwned",stripe_checkout_session_id:null as string|null,checkout_key:"50000000-0000-4000-8000-000000000001",
    checkout_expires_at:new Date(Date.now()+31*60000).toISOString(),listing_title:"Approved BirdShop product",state:"payment_pending"};
  const financialWrites:Record<string,unknown>[]=[];
  let dbCalls=0;
  const server=http.createServer(async(req,res)=>{
    dbCalls++;
    const parts=[];for await (const part of req) parts.push(part);
    const body=parts.length?JSON.parse(Buffer.concat(parts).toString()):{};
    res.setHeader("Content-Type","application/json");
    if(req.url?.startsWith("/rest/v1/rpc/birdshop_prepare_connect")) {
      if(body.p_user!==userId){res.statusCode=403;res.end(JSON.stringify({message:"ownership required"}));return;}
      res.end(JSON.stringify(mapping));return;
    }
    if(req.url?.startsWith("/rest/v1/birdshop_seller_connect_accounts")){
      if(req.method==="PATCH"){Object.assign(mapping,body);res.statusCode=204;res.end();return;}
      res.end(JSON.stringify(mapping));return;
    }
    if(req.url?.startsWith("/rest/v1/birdshop_marketplace_listings")){res.end(JSON.stringify({seller_id:sellerId}));return;}
    if(req.url?.startsWith("/rest/v1/rpc/birdshop_reserve_marketplace_checkout")){res.end(JSON.stringify(orderFixture));return;}
    if(req.url?.startsWith("/rest/v1/rpc/birdshop_apply_marketplace_charge")){financialWrites.push(body);res.end("null");return;}
    if(req.url?.startsWith("/rest/v1/birdshop_marketplace_orders")){
      if(req.method==="PATCH"){Object.assign(orderFixture,body);res.statusCode=204;res.end();return;}
      res.end(JSON.stringify(orderFixture));return;
    }
    res.statusCode=404;res.end(JSON.stringify({message:"unexpected fixture request"}));
  }).listen(0,"127.0.0.1");
  await once(server,"listening");
  const address=server.address();assert.ok(address && typeof address!=="string");
  process.env.NEXT_PUBLIC_SUPABASE_URL=`http://127.0.0.1:${address.port}`;
  process.env.SUPABASE_SECRET_KEY="test-only";
  const stripe=getStripe();
  let createCalls=0;
  const account=()=>({id:"acct_fixtureOwned",object:"v2.core.account",livemode:false,closed:false,
    identity:{country:"CA"},metadata:{birdshop_seller_id:sellerId},configuration:{recipient:{capabilities:{stripe_balance:{stripe_transfers:{status:"active"}}}}},
    requirements:{entries:[{description:"identity_document",awaiting_action_from:"user",minimum_deadline:{status:"currently_due"},errors:[]}]},future_requirements:{entries:[]}});
  const create=mock.method(stripe.v2.core.accounts,"create",async(params:Stripe.V2.Core.AccountCreateParams,opts:Stripe.RequestOptions)=>{
    createCalls++;assert.equal(params.dashboard,"express");assert.equal(params.identity?.country,"CA");
    assert.equal(params.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.requested,true);
    assert.equal(params.defaults?.responsibilities?.fees_collector,"application");
    assert.equal(opts.idempotencyKey,"birdshop-connect-creation_fixture");return account() as never;
  });
  const retrieve=mock.method(stripe.v2.core.accounts,"retrieve",async(id:string,params:Stripe.V2.Core.AccountRetrieveParams)=>{
    assert.equal(id,"acct_fixtureOwned");assert.ok(params.include?.includes("requirements"));
    assert.ok(params.include?.includes("configuration.recipient"));return account() as never;
  });
  try{
    await t.test("one account, frozen country and repeatable idempotency key",async()=>{
      const first=await ensureSellerConnect(sellerId,userId,"seller@example.test","ca");
      assert.equal(first.transfers_status,"active");assert.equal(first.requirements[0].deadline,"currently_due");
      await ensureSellerConnect(sellerId,userId,"seller@example.test","CA");assert.equal(createCalls,1);
      await assert.rejects(()=>ensureSellerConnect(sellerId,"other-user","seller@example.test","CA"),/ownership/);
      await assert.rejects(()=>ensureSellerConnect(sellerId,userId,"seller@example.test","US"),/country/);
    });
    await t.test("secure single-use onboarding links are scoped to the mapped seller account",async()=>{
      const link=mock.method(stripe.v2.core.accountLinks,"create",async(params:Stripe.V2.Core.AccountLinkCreateParams)=>{
        assert.equal(params.account,"acct_fixtureOwned");
        assert.deepEqual(params.use_case.account_onboarding?.configurations,["recipient"]);
        assert.equal(params.use_case.account_onboarding?.refresh_url,"https://birdshop.example.test/sell/connect/refresh");
        assert.equal(params.use_case.account_onboarding?.return_url,"https://birdshop.example.test/sell/connect/return");
        return {url:"https://connect.stripe.com/setup/single-use"} as never;
      });
      assert.equal(await createSellerAccountLink(mapping),"https://connect.stripe.com/setup/single-use");link.mock.restore();
    });
    await t.test("ownership mismatch fails closed",async()=>{
      retrieve.mock.mockImplementation(async()=>({...account(),metadata:{birdshop_seller_id:"someone-else"}}) as never);
      await assert.rejects(()=>refreshSellerConnect(mapping),/ownership/);
      retrieve.mock.mockImplementation(async()=>account() as never);
    });
    await t.test("thin webhook verifies raw-body signature and fetches current requirements on replays",async()=>{
      const payload=JSON.stringify({id:"evt_thinFixture",type:"v2.core.account[requirements].updated",created:new Date().toISOString(),
        related_object:{id:"acct_fixtureOwned",type:"v2.core.account",url:"/v2/core/accounts/acct_fixtureOwned"}});
      const header=stripe.webhooks.generateTestHeaderString({payload,secret:"whsec_local_only"});
      const request=(body=payload,signature=header)=>new Request("https://birdshop.example.test/api/stripe/connect/webhook",{method:"POST",body,headers:{"stripe-signature":signature}});
      const before=dbCalls;
      assert.equal((await thinWebhook(request(payload,"invalid"))).status,400);assert.equal(dbCalls,before);
      assert.equal((await thinWebhook(request(payload+" "))).status,400);assert.equal(dbCalls,before);
      const fetches=retrieve.mock.callCount();
      assert.equal((await thinWebhook(request())).status,200);
      assert.equal((await thinWebhook(request())).status,200);
      assert.equal(retrieve.mock.callCount(),fetches+2);
    });
    await t.test("inline Checkout uses trusted listing snapshot, saved destination and server fee",()=>{
      const order={id:"order-fixture",listing_id:"listing-fixture",seller_id:sellerId,buyer_user_id:"buyer",quantity:2,
        subtotal_cents:20000,commission_bps:800,commission_cents:1600,currency:"usd",stripe_destination:"acct_fixtureOwned",
        stripe_checkout_session_id:null,checkout_key:"request-key",checkout_expires_at:new Date(Date.now()+31*60000).toISOString(),listing_title:"BirdShop approved service",state:"payment_pending"};
      const params=marketplaceSessionParams(order,"https://birdshop.example.test");
      assert.equal(params.payment_intent_data?.application_fee_amount,1600);
      assert.equal(params.payment_intent_data?.transfer_data?.destination,"acct_fixtureOwned");
      assert.equal(params.line_items?.[0].price_data?.unit_amount,10000);
      assert.equal(params.line_items?.[0].price_data?.product_data?.name,"BirdShop approved service");
      assert.equal(params.line_items?.[0].quantity,2);
      assert.throws(()=>marketplaceSessionParams({...order,commission_cents:1},"https://birdshop.example.test"),/snapshot/);
      assert.throws(()=>marketplaceSessionParams({...order,currency:"eur"},"https://birdshop.example.test"),/snapshot/);
    });
    await t.test("server checkout retries reuse the same session and never create Stripe catalog products",async()=>{
      process.env.BIRDSHOP_MARKETPLACE_CHECKOUT_ENABLED="true";
      const stripeSession={id:"cs_marketplaceFixture",status:"open",url:"https://checkout.stripe.com/test-session",livemode:false};
      const createSession=mock.method(stripe.checkout.sessions,"create",async(params:Stripe.Checkout.SessionCreateParams,options:Stripe.RequestOptions)=>{
        assert.equal(params.line_items?.[0].price_data?.unit_amount,10000);
        assert.equal(params.payment_intent_data?.application_fee_amount,800);
        assert.equal(options.idempotencyKey,`birdshop-marketplace-checkout-${orderFixture.id}`);
        return stripeSession as never;
      });
      const readSession=mock.method(stripe.checkout.sessions,"retrieve",async()=>stripeSession as never);
      const product=mock.method(stripe.products,"create",async()=>{throw new Error("Sellers must not need Stripe Products");});
      try{
        assert.equal(await startMarketplaceCheckout(userId,orderFixture.listing_id,1,orderFixture.checkout_key),stripeSession.url);
        assert.equal(await startMarketplaceCheckout(userId,orderFixture.listing_id,1,orderFixture.checkout_key),stripeSession.url);
        assert.equal(createSession.mock.callCount(),1);assert.equal(product.mock.callCount(),0);
      }finally{createSession.mock.restore();readSession.mock.restore();product.mock.restore();}
    });
    await t.test("charge reconciliation rejects altered destinations and fees, and persists verified partial refunds",async()=>{
      const intent=mock.method(stripe.paymentIntents,"retrieve",async()=>({id:"pi_marketplaceFixture",status:"succeeded",livemode:false,
        metadata:{birdshop_marketplace_order_id:orderFixture.id},amount_received:10000,latest_charge:"ch_marketplaceFixture"}) as never);
      const disputes=mock.method(stripe.disputes,"list",async()=>({data:[],has_more:false}) as never);
      const charge={id:"ch_marketplaceFixture",payment_intent:"pi_marketplaceFixture",livemode:false,paid:true,captured:true,currency:"usd",
        amount:10000,amount_refunded:2000,application_fee_amount:800,transfer_data:{destination:"acct_fixtureOwned"},fraud_details:{}} as unknown as Stripe.Charge;
      try{
        const before=financialWrites.length;
        await assert.rejects(()=>synchronizeMarketplaceCharge({...charge,transfer_data:{destination:"acct_other"}} as Stripe.Charge,"evt_wrongDestination"),/differs/);
        await assert.rejects(()=>synchronizeMarketplaceCharge({...charge,application_fee_amount:1},"evt_wrongFee"),/differs/);
        assert.equal(financialWrites.length,before);
        assert.equal(await synchronizeMarketplaceCharge(charge,"evt_verifiedRefund"),true);
        assert.equal(financialWrites.at(-1)?.p_refunded,2000);
        assert.equal(financialWrites.at(-1)?.p_fee,800);
        assert.equal(financialWrites.at(-1)?.p_order,orderFixture.id);
      }finally{intent.mock.restore();disputes.mock.restore();}
    });
    await t.test("old unresolved account creation cannot create duplicates after Stripe's idempotency window",async()=>{
      mapping.stripe_account_id=null;mapping.creation_started_at=new Date(Date.now()-24*3600000).toISOString();
      await assert.rejects(()=>ensureSellerConnect(sellerId,userId,"seller@example.test","CA"),/reconciliation/);
      assert.equal(createCalls,1);mapping.stripe_account_id="acct_fixtureOwned";
    });
    await t.test("marketplace rejects live keys while first-party webhooks still route normally",async()=>{
      process.env.STRIPE_SECRET_KEY="sk_live_local_only";
      assert.throws(()=>getMarketplaceStripe(),/sandbox/);
      const session=mock.method(stripe.checkout.sessions,"retrieve",async()=>({id:"cs_firstParty",metadata:{birdshop_attempt_id:"first-party"}}) as never);
      assert.equal(await processMarketplaceStripeEvent({type:"checkout.session.completed",data:{object:{id:"cs_firstParty"}}} as Stripe.Event),false);
      session.mock.restore();process.env.STRIPE_SECRET_KEY="sk_test_local_only";
      process.env.BIRDSHOP_MARKETPLACE_CHECKOUT_ENABLED="false";
      await assert.rejects(()=>startMarketplaceCheckout("buyer","listing",1,"key"),/not enabled/);
    });
  }finally{create.mock.restore();retrieve.mock.restore();server.close();}
});
