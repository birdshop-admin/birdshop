// Loopback-only fixtures. Never imported or enabled by either application.
import http from 'node:http';
const sellerUser='00000000-0000-4000-8000-000000000007',buyerUser='00000000-0000-4000-8000-000000000008';
const sellerId='20000000-0000-4000-8000-000000000007';
const profile={id:sellerId,user_id:sellerUser,handle:'qa-seller',display_name:'QA BirdShop seller',description:'Independent game services and digital finds. Local browser-test data only.',logo_url:null,status:'active',commission_bps:700,earned_tier:'bronze',partner_approved:false,commission_override_bps:null,qualifying_sales_cents:125000};
const initial=[['Deepwoken progression coaching','Deepwoken','game_service',2400],['Digital adventure key','Game Keys','digital_product',950],['Grand Piece boss run','Grand Piece Online','game_service',4500]].map(([title,category,listing_type,price_cents],i)=>({id:`30000000-0000-4000-8000-00000000000${i+1}`,seller_id:sellerId,slug:`qa-listing-${i}`,title,description:'A local test listing for marketplace browsing, checkout review, and native seller tools.',listing_type,category,image_url:null,price_cents,stock:10,fulfillment_method:listing_type==='game_service'?'service_scheduled':'seller_manual',service_options:[],delivery_hours:24,status:'published',created_at:'2026-11-16T12:00:00Z'}));
let listings=structuredClone(initial);
const order={id:'40000000-0000-4000-8000-000000000007',listing_id:initial[0].id,seller_id:sellerId,buyer_user_id:buyerUser,state:'completed',quantity:1,currency:'usd',subtotal_cents:10000,commission_cents:800,commission_bps:800,refunded_cents:2000,stripe_dispute_status:null,fraudulent:false,listing_title:'Completed BirdShop service',created_at:'2026-11-16T12:00:00Z',paid_at:'2026-11-16T12:00:00Z',payment_verified_at:'2026-11-16T12:00:00Z',completed_at:'2026-11-16T14:00:00Z',payout_eligible_after:'2026-11-23T14:00:00Z'};
function filter(rows,url){for(const [key,value] of url.searchParams){if(['select','order','limit','offset'].includes(key))continue;if(value.startsWith('eq.'))rows=rows.filter(r=>String(key.split(".").reduce((v,k)=>v?.[k],r))===value.slice(3));if(value.startsWith('gt.'))rows=rows.filter(r=>r[key]>Number(value.slice(3)));if(value.startsWith('in.')){const ids=value.slice(4,-1).split(',');rows=rows.filter(r=>ids.includes(String(r[key])));}}const sort=url.searchParams.get('order');if(sort?.startsWith('price_cents.'))rows=[...rows].sort((a,b)=>(a.price_cents-b.price_cents)*(sort.includes('.desc')?-1:1));return rows;}
http.createServer(async(request,response)=>{
 response.setHeader('Content-Type','application/json');response.setHeader('Access-Control-Allow-Origin','*');response.setHeader('Access-Control-Allow-Headers','*');
 if(request.method==='OPTIONS'){response.end();return;}
 const url=new URL(request.url,'http://127.0.0.1');
 const chunks=[];for await(const chunk of request)chunks.push(chunk);
 const body=chunks.length?JSON.parse(Buffer.concat(chunks).toString()):{};
 if(url.pathname==='/__reset'){listings=structuredClone(initial);response.end('{}');return;}
 if(url.pathname==='/auth/v1/user'){
  let claims;try{claims=JSON.parse(Buffer.from(request.headers.authorization?.replace(/^Bearer /,'').split('.')[1],'base64url').toString());}catch{}
  if(!claims?.qa_visual_repair){response.statusCode=401;response.end(JSON.stringify({message:'No test session',code:'bad_jwt'}));return;}
  response.end(JSON.stringify({id:claims.sub,email:claims.email,aud:'authenticated',role:'authenticated',email_confirmed_at:'2026-11-01T00:00:00Z',created_at:'2026-11-01T00:00:00Z',app_metadata:{},user_metadata:{},identities:[]}));return;
 }
 if(url.pathname==='/auth/v1/otp'){response.end('{}');return;}
 if(url.pathname==='/auth/v1/verify'){
  if(body.token!=='123456'){response.statusCode=400;response.end(JSON.stringify({message:'Invalid test code',code:'otp_expired'}));return;}
  const exp=Math.floor(Date.now()/1000)+3600;const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
  const id=body.email==='buyer@example.test'?buyerUser:sellerUser;
  const user={id,email:body.email,aud:'authenticated',role:'authenticated',email_confirmed_at:'2026-11-01T00:00:00Z',app_metadata:{},user_metadata:{}};
  const token=`${enc({alg:'HS256',typ:'JWT'})}.${enc({sub:id,email:body.email,aud:'authenticated',role:'authenticated',exp,iat:exp-3600,qa_visual_repair:true})}.cWEtbG9jYWwtb25seQ`;
  response.end(JSON.stringify({access_token:token,refresh_token:'qa-local',token_type:'bearer',expires_in:3600,expires_at:exp,user}));return;
 }

 if(url.pathname==='/rest/v1/rpc/birdshop_rate_limit'){response.end('true');return;}
 if(url.pathname==='/rest/v1/rpc/birdshop_marketplace_earnings_summary'){response.end(JSON.stringify({pending_cents:7360,available_cents:0,next_eligible_after:order.payout_eligible_after}));return;}
 let rows=[];
 if(url.pathname==='/rest/v1/admin_users')rows=[{user_id:'00000000-0000-4000-8000-000000000009',role:'owner',is_active:true}];
 if(url.pathname==='/rest/v1/birdshop_seller_profiles')rows=[profile];
 if(url.pathname==='/rest/v1/birdshop_marketplace_listings'){
  if(request.method==='POST'){const row={...body,id:'30000000-0000-4000-8000-000000000009',created_at:new Date().toISOString()};listings.push(row);rows=[row];}
  else if(request.method==='PATCH'){rows=filter(listings,url);for(const row of rows)Object.assign(row,body);}
  else rows=listings.map(l=>({...l,birdshop_seller_profiles:{display_name:profile.display_name,status:profile.status}}));
 }
 if(url.pathname==='/rest/v1/birdshop_marketplace_orders')rows=[order];
 if(url.pathname==='/rest/v1/birdshop_marketplace_threads')rows=[];
 if(url.pathname==='/rest/v1/birdshop_marketplace_audit'&&request.method==='POST'){response.statusCode=201;response.end('{}');return;}
 rows=filter(rows,url);
 const single=request.headers.accept?.includes('application/vnd.pgrst.object+json');
 response.end(JSON.stringify(single?rows[0]??null:rows));
}).listen(54322,'127.0.0.1');
