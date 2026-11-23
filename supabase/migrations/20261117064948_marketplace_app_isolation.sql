-- Marketplace app separation: independent event acknowledgements, no customer payloads.
begin;
create table public.birdshop_marketplace_webhook_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.birdshop_marketplace_webhook_events enable row level security;
revoke all on public.birdshop_marketplace_webhook_events from public,anon,authenticated;
grant select,insert,update on public.birdshop_marketplace_webhook_events to service_role;

create or replace function public.birdshop_marketplace_earnings_summary(p_seller uuid,p_user uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  perform private.birdshop_require_server();
  if not exists(select 1 from public.birdshop_seller_profiles where id=p_seller and user_id=p_user) then
    raise exception 'Seller ownership required'; end if;
  select jsonb_build_object(
    'pending_cents',coalesce(sum(e.amount_cents) filter(where e.status='pending'),0),
    'available_cents',coalesce(sum(e.amount_cents) filter(where e.status='available'),0),
    'next_eligible_after',min(o.payout_eligible_after) filter(where e.status='pending')
  ) into result from public.birdshop_marketplace_ledger e
    left join public.birdshop_marketplace_orders o on o.id=e.order_id
    where e.seller_id=p_seller;
  return result;
end $$;
revoke all on function public.birdshop_marketplace_earnings_summary(uuid,uuid) from public,anon,authenticated;
grant execute on function public.birdshop_marketplace_earnings_summary(uuid,uuid) to service_role;
commit;
