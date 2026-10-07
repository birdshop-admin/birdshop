begin;

alter table public.birdshop_email_jobs
  drop constraint if exists birdshop_email_jobs_status_check;

alter table public.birdshop_email_jobs
  add constraint birdshop_email_jobs_status_check
  check (
    status in (
      'queued',
      'sending',
      'sent',
      'failed',
      'attention',
      'cancelled'
    )
  );

-- Cancel obsolete chat notifications while retaining their history.
-- Receipts and product-delivery emails are not cancelled here.
update public.birdshop_email_jobs j
set
  status = 'cancelled',
  lease_id = null,
  lease_until = null,
  last_error = 'Conversation removed; chat email cancelled.'
where j.kind in (
  'conversation_customer',
  'conversation_admin',
  'recovery'
)
and j.status in ('queued', 'failed', 'attention')
and not exists (
  select 1
  from public.service_conversations c
  where c.id = j.entity_id
    and c.purged_at is null
    and c.deleted_at is null
);

commit;