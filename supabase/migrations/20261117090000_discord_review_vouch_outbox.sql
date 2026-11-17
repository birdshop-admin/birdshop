-- Queue only newly approved BirdShop reviews for Discord publication.
-- Apply to staging before production, after existing review migrations.
begin;
create table if not exists public.discord_review_vouch_outbox (
  review_id uuid primary key references public.reviews(id) on delete cascade,
  state text not null default 'pending' check (state in ('pending','sending','sent')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
create index if not exists discord_review_vouch_outbox_due
  on public.discord_review_vouch_outbox (next_attempt_at)
  where state <> 'sent';
alter table public.discord_review_vouch_outbox enable row level security;
revoke all on public.discord_review_vouch_outbox from public, anon, authenticated;
grant select, insert, update, delete on public.discord_review_vouch_outbox to service_role;

create or replace function public.queue_approved_review_discord_vouch()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if new.status = 'approved'
     and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    insert into public.discord_review_vouch_outbox (review_id)
    values (new.id) on conflict (review_id) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists review_approved_discord_vouch on public.reviews;
create trigger review_approved_discord_vouch
after insert or update of status on public.reviews
for each row execute function public.queue_approved_review_discord_vouch();

-- Atomic job lease; an abandoned lease can be reclaimed after ten minutes.
create or replace function public.claim_discord_review_vouches(p_limit integer default 5)
returns table (review_id uuid, attempts integer)
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Not permitted';
  end if;
  return query
  with due as (
    select o.review_id
    from public.discord_review_vouch_outbox o
    join public.reviews r on r.id = o.review_id and r.status = 'approved'
    where (o.state = 'pending' and o.next_attempt_at <= now())
       or (o.state = 'sending' and o.locked_at < now() - interval '10 minutes')
    order by o.next_attempt_at, o.created_at
    for update of o skip locked
    limit least(greatest(p_limit,1),10)
  )
  update public.discord_review_vouch_outbox o
  set state='sending', attempts=o.attempts+1, locked_at=now()
  from due
  where o.review_id=due.review_id
  returning o.review_id, o.attempts;
end;
$$;
revoke all on function public.claim_discord_review_vouches(integer) from public, anon, authenticated;
grant execute on function public.claim_discord_review_vouches(integer) to service_role;
notify pgrst, 'reload schema';
commit;
